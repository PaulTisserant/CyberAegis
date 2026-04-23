import https from "https"
import WebSocket from "ws"
import forge from "node-forge"
import { adminGetGameSession as getGameSession, adminGetScenarioWithProxmox as getScenarioWithProxmox } from "./firestore/admin-sync"
import { getVNCTicket, getVMStatus, startVM } from "./proxmox-api"

const upstreamAgent = new https.Agent({ rejectUnauthorized: false })
const WS_OPEN_TIMEOUT_MS = Number(process.env.PROXMOX_WS_OPEN_TIMEOUT_MS ?? 12000)
const WS_HANDSHAKE_TIMEOUT_MS = Number(process.env.PROXMOX_WS_HANDSHAKE_TIMEOUT_MS ?? 12000)
const VNC_PROXY_DEBUG = process.env.PROXMOX_VNC_DEBUG === "true"

type DebugLogger = (message: string, details?: Record<string, unknown>) => void

const vncSessionLocks = new Set<string>()

// ─── WsStream ────────────────────────────────────────────────────────────────
// Tampon d'octets exact pour les WebSocket. Accumule les chunks entrants et les
// sert en lectures de taille exacte, en reportant les octets en surplus au prochain
// appel. Cela corrige la "frame fusion" où Proxmox envoie plusieurs messages RFB
// dans un seul frame WebSocket (ex: version+secTypes, ou secResult+serverInit).
class WsStream {
  private buf = Buffer.alloc(0)
  private waiters: Array<{
    n: number
    resolve: (b: Buffer) => void
    reject: (e: Error) => void
    timer: ReturnType<typeof setTimeout>
  }> = []

  constructor(private ws: WebSocket) {
    ws.on("message", this.onMessage)
    ws.on("close", this.onClose)
    ws.on("error", this.onError)
  }

  private onMessage = (data: WebSocket.RawData) => {
    const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
    this.buf = Buffer.concat([this.buf, chunk])
    this.drain()
  }

  private drain() {
    while (this.waiters.length > 0 && this.buf.length >= this.waiters[0].n) {
      const waiter = this.waiters.shift()!
      clearTimeout(waiter.timer)
      const result = this.buf.subarray(0, waiter.n)
      this.buf = this.buf.subarray(waiter.n)
      waiter.resolve(result)
    }
  }

  private onClose = (code: number, reasonBuf: Buffer) => {
    const reason = reasonBuf?.toString("utf8") || ""
    const msg = "WebSocket fermée (code=" + String(code) + (reason ? ", " + reason : "") + ")"
    for (const { reject, timer } of this.waiters) {
      clearTimeout(timer)
      reject(new Error(msg))
    }
    this.waiters = []
  }

  private onError = (err: Error) => {
    for (const { reject, timer } of this.waiters) {
      clearTimeout(timer)
      reject(err)
    }
    this.waiters = []
  }

  read(n: number, timeoutMs: number, stage: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.resolve === resolve)
        if (idx >= 0) this.waiters.splice(idx, 1)
        reject(new Error("Timeout handshake VNC (" + stage + ", " + timeoutMs + "ms, " + this.buf.length + "/" + n + " recus)"))
      }, timeoutMs)
      this.waiters.push({ n, resolve, reject, timer })
      this.drain()
    })
  }

  /** Detache le stream et retourne les octets non consommes. */
  detach(): Buffer {
    this.ws.off("message", this.onMessage)
    this.ws.off("close", this.onClose)
    this.ws.off("error", this.onError)
    const leftover = this.buf
    this.buf = Buffer.alloc(0)
    return leftover
  }
}

function vncDesEncrypt(challenge: Buffer, ticket: string): Buffer {
  const key = Buffer.alloc(8)
  for (let i = 0; i < 8; i++) {
    const inputByte = i < ticket.length ? ticket.charCodeAt(i) : 0
    let reversed = 0
    for (let bit = 0; bit < 8; bit++) {
      reversed = (reversed << 1) | ((inputByte >> bit) & 1)
    }
    key[i] = reversed
  }
  const cipher = forge.cipher.createCipher("DES-ECB", forge.util.createBuffer(key.toString("binary")))
  cipher.start()
  cipher.update(forge.util.createBuffer(challenge.toString("binary")))
  cipher.finish()
  return Buffer.from(cipher.output.getBytes(), "binary")
}

async function performRfbHandshakeWithProxmox(
  proxmoxWs: WebSocket,
  passwordToUse: string,
  log?: DebugLogger
): Promise<{ serverInit: Buffer; leftover: Buffer }> {
  const stream = new WsStream(proxmoxWs)

  await stream.read(12, WS_HANDSHAKE_TIMEOUT_MS, "proxmox:server-version")
  proxmoxWs.send(Buffer.from("RFB 003.008\n"))
  log?.("version RFB envoyee")

  const countBuf = await stream.read(1, WS_HANDSHAKE_TIMEOUT_MS, "proxmox:security-count")
  const secTypesCount = countBuf[0]
  const secTypes: number[] = secTypesCount > 0
    ? [...(await stream.read(secTypesCount, WS_HANDSHAKE_TIMEOUT_MS, "proxmox:security-types"))]
    : []
  log?.("sec types recus", { secTypes })

  if (secTypes.includes(2)) {
    log?.("auth choisie", { type: "vnc-auth" })
    proxmoxWs.send(Buffer.from([2]))
    const challenge = await stream.read(16, WS_HANDSHAKE_TIMEOUT_MS, "proxmox:vnc-challenge")
    proxmoxWs.send(vncDesEncrypt(challenge, passwordToUse))
  } else if (secTypes.includes(1)) {
    log?.("auth choisie", { type: "none" })
    proxmoxWs.send(Buffer.from([1]))
  } else {
    stream.detach()
    throw new Error("Type de securite VNC non supporte: " + secTypes.join(","))
  }

  const secResult = await stream.read(4, WS_HANDSHAKE_TIMEOUT_MS, "proxmox:security-result")
  const secResultCode = secResult.readUInt32BE(0)
  log?.("sec result", { code: secResultCode })
  if (secResultCode !== 0) {
    stream.detach()
    throw new Error("Authentification VNC refusee par Proxmox")
  }

  proxmoxWs.send(Buffer.from([1]))

  const serverInitHeader = await stream.read(24, WS_HANDSHAKE_TIMEOUT_MS, "proxmox:server-init-header")
  const nameLen = serverInitHeader.readUInt32BE(20)
  const nameBytes = nameLen > 0
    ? await stream.read(nameLen, WS_HANDSHAKE_TIMEOUT_MS, "proxmox:server-name")
    : Buffer.alloc(0)

  const serverInit = Buffer.concat([serverInitHeader, nameBytes])
  const fbWidth = serverInitHeader.readUInt16BE(0)
  const fbHeight = serverInitHeader.readUInt16BE(2)
  log?.("server init recu", { fbWidth, fbHeight, nameLen, name: nameBytes.toString() })

  const leftover = stream.detach()
  return { serverInit, leftover }
}

async function performBrowserNoAuthHandshake(
  clientStream: WsStream,
  clientWs: WebSocket,
  serverInit: Buffer,
  log?: DebugLogger
): Promise<void> {
  if (clientWs.readyState !== WebSocket.OPEN) {
    throw new Error("Client WebSocket non ouverte avant handshake")
  }
  clientWs.send(Buffer.from("RFB 003.008\n"))
  await clientStream.read(12, WS_HANDSHAKE_TIMEOUT_MS, "client:version")

  if (clientWs.readyState !== WebSocket.OPEN) throw new Error("Client WebSocket fermee")
  clientWs.send(Buffer.from([1, 1]))
  await clientStream.read(1, WS_HANDSHAKE_TIMEOUT_MS, "client:security-choice")

  if (clientWs.readyState !== WebSocket.OPEN) throw new Error("Client WebSocket fermee")
  clientWs.send(Buffer.from([0, 0, 0, 0]))
  await clientStream.read(1, WS_HANDSHAKE_TIMEOUT_MS, "client:client-init")

  if (clientWs.readyState !== WebSocket.OPEN) throw new Error("Client WebSocket fermee")
  clientWs.send(serverInit)
  log?.("handshake navigateur termine")
}

export async function handleVncProxy(clientWs: WebSocket, sessionId: string): Promise<void> {
  let proxmoxWs: WebSocket | null = null
  const clientId = Date.now() + "-" + Math.floor(Math.random() * 10000)
  const sessionLog: DebugLogger = (message, details) => {
    if (!VNC_PROXY_DEBUG) return
    const payload = details ? " " + JSON.stringify(details) : ""
    console.log("[VNC Proxy][" + sessionId + "][" + clientId + "] " + message + payload)
  }

  if (vncSessionLocks.has(sessionId)) {
    sessionLog("connexion ignoree (verrou session actif)")
    if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
      clientWs.close(1013, "Connexion VNC deja en cours")
    }
    return
  }

  vncSessionLocks.add(sessionId)
  let tunnelEstablished = false

  try {
    const gameSession = await getGameSession(sessionId)
    if (!gameSession) { clientWs.close(1008, "Session introuvable"); return }
    if (gameSession.status === "ended" || gameSession.status === "error") { clientWs.close(1008, "Session invalide ou VM non prete"); return }

    const { cloneNode, cloneVmid } = gameSession
    if (!cloneNode || !cloneVmid) { clientWs.close(1011, "Clone VM incomplet"); return }

    const scenarioData = await getScenarioWithProxmox(gameSession.scenarioId)
    if (!scenarioData?.server) { clientWs.close(1011, "Configuration Proxmox introuvable"); return }

    const { server } = scenarioData

    try {
      const vmStatus = await getVMStatus(server.host, server.token, cloneNode, cloneVmid)
      if (vmStatus.status === "stopped") {
        sessionLog("VM stoppee - demarrage...")
        await startVM(server.host, server.token, cloneNode, cloneVmid)
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    } catch (statusError) {
      sessionLog("Echec verification/demarrage VM", { error: String(statusError) })
    }

    const vncData = await getVNCTicket(server.host, server.token, cloneNode, cloneVmid)
    const { ticket, port, password, user } = vncData
    const vncPassword = password || ticket
    sessionLog("ticket VNC OK", { cloneNode, cloneVmid, port, ticketLength: ticket.length, hasPassword: !!password, user })

    const proxmoxWsUrl = "wss://" + server.host + "/api2/json/nodes/" + cloneNode + "/qemu/" + cloneVmid + "/vncwebsocket?port=" + port + "&vncticket=" + encodeURIComponent(ticket)

    // CRITICAL: désactiver perMessageDeflate. Le client ws de Node.js
    // négocie la compression par défaut, contrairement au WebSocket natif
    // du navigateur (que noVNC utilise). Si Proxmox/pveproxy accepte la
    // compression, les frames RFB post-handshake sont compressées côté ws
    // mais Proxmox les relaie telles quelles à QEMU via le UNIX socket,
    // ce qui corrompt le flux → QEMU RST → code 1006.
    proxmoxWs = new WebSocket(proxmoxWsUrl, ["binary"], {
      headers: { Authorization: server.token },
      agent: upstreamAgent,
      perMessageDeflate: false,
    })

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => reject(new Error("Timeout ouverture WS Proxmox (" + WS_OPEN_TIMEOUT_MS + "ms)")), WS_OPEN_TIMEOUT_MS)
      proxmoxWs?.once("open", () => {
        clearTimeout(timeoutId)
        sessionLog("ws upstream open", {
          protocol: proxmoxWs?.protocol || "(none)",
          extensions: proxmoxWs?.extensions || "(none)",
        })
        resolve()
      })
      proxmoxWs?.once("error", (err) => { clearTimeout(timeoutId); reject(err) })
    })

    // Surveillance précoce de fermeture Proxmox
    let proxmoxClosedEarly = false
    const earlyCloseHandler = (code: number, reason: Buffer) => {
      proxmoxClosedEarly = true
      console.log("[VNC DIAG] Proxmox WS fermee PREMATUREMENT", { code, reason: reason?.toString() || "" })
    }
    proxmoxWs.on("close", earlyCloseHandler)

    // PHASE 1 : handshake RFB avec Proxmox via WsStream
    const { serverInit, leftover: proxmoxLeftover } = await performRfbHandshakeWithProxmox(proxmoxWs, vncPassword, sessionLog)

    // Buffer les messages Proxmox pendant le handshake browser
    const proxmoxPendingBuffer: Buffer[] = []
    const proxmoxBufferHandler = (data: WebSocket.RawData) => {
      const chunk = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer)
      proxmoxPendingBuffer.push(chunk)
      const hex = chunk.subarray(0, 32).toString("hex")
      console.log("[VNC DIAG] proxmox msg recu (buffer)", { bytes: chunk.length, hex })
    }
    proxmoxWs.on("message", proxmoxBufferHandler)

    // Retirer early close handler (sera remplacé par le handler tunnel)
    proxmoxWs.off("close", earlyCloseHandler)

    // PHASE 2 : handshake no-auth avec le navigateur via WsStream dedie
    const clientStream = new WsStream(clientWs)
    await performBrowserNoAuthHandshake(clientStream, clientWs, serverInit, sessionLog)
    const clientLeftover = clientStream.detach()

    // Retirer le buffer handler temporaire
    proxmoxWs.off("message", proxmoxBufferHandler)

    // PHASE 3 : relay bidirectionnel
    tunnelEstablished = true
    sessionLog("tunnel actif")

    let relayFromProxmox = 0
    let relayFromClient = 0

    const sendToClient = (payload: WebSocket.RawData) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        relayFromProxmox++
        const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload as ArrayBuffer)
        if (relayFromProxmox <= 5 || relayFromProxmox % 50 === 0) {
          sessionLog("relay proxmox->client", { count: relayFromProxmox, bytes: buf.length, hex: buf.subarray(0, 32).toString("hex") })
        }
        try { clientWs.send(payload) } catch (e) { sessionLog("Erreur relay proxmox->client", { error: String(e) }) }
      }
    }

    const sendToProxmox = (payload: WebSocket.RawData) => {
      if (proxmoxWs?.readyState === WebSocket.OPEN) {
        relayFromClient++
        const buf = Buffer.isBuffer(payload) ? payload : Buffer.from(payload as ArrayBuffer)
        if (relayFromClient <= 5 || relayFromClient % 20 === 0) {
          sessionLog("relay client->proxmox", { count: relayFromClient, bytes: buf.length, hex: buf.subarray(0, 32).toString("hex"), isBuffer: Buffer.isBuffer(payload) })
        }
        try { proxmoxWs.send(payload, { binary: true }) } catch (e) { sessionLog("Erreur relay client->proxmox", { error: String(e) }) }
      }
    }

    // Enregistrer les relay handlers AVANT le flush (pas de trou)
    proxmoxWs.on("message", sendToClient)
    clientWs.on("message", sendToProxmox)

    // Diagnostic : listener counts + socket states
    console.log("[VNC DIAG] relay handlers OK", {
      proxmoxListeners: proxmoxWs.listenerCount("message"),
      clientListeners: clientWs.listenerCount("message"),
      proxmoxState: proxmoxWs.readyState,
      clientState: clientWs.readyState,
    })

    // Flusher les données en attente APRÈS l'enregistrement des handlers
    if (proxmoxLeftover.length > 0) {
      sessionLog("flush proxmox leftover (handshake)", { bytes: proxmoxLeftover.length })
      sendToClient(proxmoxLeftover)
    }
    for (const pending of proxmoxPendingBuffer) {
      sessionLog("flush proxmox pending (browser-hs)", { bytes: pending.length })
      sendToClient(pending)
    }
    if (clientLeftover.length > 0) {
      sessionLog("flush client leftover", { bytes: clientLeftover.length })
      sendToProxmox(clientLeftover)
    }

    if (serverInit.length >= 4) {
      const fbWidth = serverInit.readUInt16BE(0)
      const fbHeight = serverInit.readUInt16BE(2)
      sessionLog("tunnel pret", { fbWidth, fbHeight })
    }

    // Diagnostic a 3s : si aucun relay n'a eu lieu, quelque chose ne va pas
    const diagTimer = setTimeout(() => {
      console.log("[VNC DIAG 3s]", {
        relayFromProxmox,
        relayFromClient,
        proxmoxState: proxmoxWs?.readyState,
        clientState: clientWs.readyState,
        proxmoxListeners: proxmoxWs?.listenerCount("message"),
        clientListeners: clientWs.listenerCount("message"),
      })
    }, 3000)

    const cleanup = () => {
      clearTimeout(diagTimer)
      sessionLog("tunnel ferme (cleanup)")
      if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) clientWs.close()
      if (proxmoxWs && (proxmoxWs.readyState === WebSocket.OPEN || proxmoxWs.readyState === WebSocket.CONNECTING)) proxmoxWs.close()
    }

    await new Promise<void>((resolve) => {
      let resolved = false
      const done = (side: string) => {
        if (resolved) return
        resolved = true
        sessionLog("tunnel ferme par", { side })
        cleanup()
        resolve()
      }
      clientWs.once("close", (code) => done("client(" + code + ")"))
      clientWs.once("error", (e) => done("client-error(" + String(e) + ")"))
      proxmoxWs!.once("close", (code) => done("proxmox(" + code + ")"))
      proxmoxWs!.once("error", (e) => done("proxmox-error(" + String(e) + ")"))
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur proxy VNC"
    const isBrowserClose = message.includes("WebSocket fermee") || message.includes("Client WebSocket")
    if (isBrowserClose) { console.warn("[VNC Proxy]", message) } else { console.error("[VNC Proxy]", message) }
    if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) clientWs.close(1011, message.slice(0, 120))
    if (proxmoxWs && (proxmoxWs.readyState === WebSocket.OPEN || proxmoxWs.readyState === WebSocket.CONNECTING)) proxmoxWs.close()
  } finally {
    const cooldownMs = 4000
    setTimeout(() => {
      vncSessionLocks.delete(sessionId)
      if (VNC_PROXY_DEBUG) console.log("[VNC Proxy][" + sessionId + "][" + (tunnelEstablished ? "ok" : "err") + "] verrou libere (cooldown " + cooldownMs + "ms)")
    }, cooldownMs)
  }
}
