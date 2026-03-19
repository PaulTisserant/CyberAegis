import https from "https"
import WebSocket from "ws"
import forge from "node-forge"
import { getGameSession } from "./firestore/game-sessions"
import { getScenarioWithProxmox } from "./firestore/scenarios"
import { getVNCTicket, getVMStatus, startVM } from "./proxmox-api"

const upstreamAgent = new https.Agent({ rejectUnauthorized: false })
const WS_OPEN_TIMEOUT_MS = Number(process.env.PROXMOX_WS_OPEN_TIMEOUT_MS ?? 12000)
const WS_HANDSHAKE_TIMEOUT_MS = Number(process.env.PROXMOX_WS_HANDSHAKE_TIMEOUT_MS ?? 12000)
const VNC_PROXY_DEBUG = process.env.PROXMOX_VNC_DEBUG === "true"

type DebugLogger = (message: string, details?: Record<string, unknown>) => void

type HandshakeSource = "proxmox" | "client"
const vncSessionLocks = new Set<string>()

function receiveBinaryFrame(
  ws: WebSocket,
  minBytes = 1,
  timeoutMs = WS_HANDSHAKE_TIMEOUT_MS,
  source: HandshakeSource = "proxmox",
  stage = "unknown"
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let buffer = Buffer.alloc(0)
    
    const timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error(`Timeout handshake VNC (${source}:${stage}, ${timeoutMs}ms, ${buffer.length}/${minBytes} reçus)`))
    }, timeoutMs)

    const onMessage = (payload: WebSocket.RawData) => {
      const chunk = Buffer.isBuffer(payload) ? payload : Buffer.from(payload as ArrayBuffer)
      buffer = Buffer.concat([buffer, chunk])
      
      if (buffer.length >= minBytes) {
        cleanup()
        resolve(buffer)
      }
    }

    const onError = (err: Error) => {
      cleanup()
      reject(err)
    }

    const onClose = (code: number, reasonBuffer: Buffer) => {
      cleanup()
      const reason = reasonBuffer?.toString("utf8") || ""
      reject(
        new Error(
          `WebSocket fermée pendant le handshake (${source}:${stage}, code=${code}${reason ? `, reason=${reason}` : ""})`
        )
      )
    }

    const cleanup = () => {
      clearTimeout(timeoutId)
      ws.off("message", onMessage)
      ws.off("error", onError)
      ws.off("close", onClose)
    }

    ws.on("message", onMessage)
    ws.on("error", onError)
    ws.on("close", onClose)
  })
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

  const cipher = forge.cipher.createCipher(
    "DES-ECB",
    forge.util.createBuffer(key.toString("binary"))
  )
  cipher.start()
  cipher.update(forge.util.createBuffer(challenge.toString("binary")))
  cipher.finish()

  return Buffer.from(cipher.output.getBytes(), "binary")
}

async function performRfbHandshakeWithProxmox(
  proxmoxWs: WebSocket,
  passwordToUse: string,
  log?: DebugLogger
): Promise<Buffer> {
  await receiveBinaryFrame(proxmoxWs, 12, WS_HANDSHAKE_TIMEOUT_MS, "proxmox", "server-version")
  proxmoxWs.send(Buffer.from("RFB 003.008\n"))

  const secData = await receiveBinaryFrame(proxmoxWs, 2, WS_HANDSHAKE_TIMEOUT_MS, "proxmox", "security-types")
  const secTypesCount = secData[0]
  const secTypes = [...secData.slice(1, 1 + secTypesCount)]
  log?.("sec types recus", { secTypes })

  if (secTypes.includes(2)) {
    log?.("auth choisie", { type: "vnc-auth" })
    proxmoxWs.send(Buffer.from([2]))
    const challenge = await receiveBinaryFrame(proxmoxWs, 16, WS_HANDSHAKE_TIMEOUT_MS, "proxmox", "vnc-challenge")
    proxmoxWs.send(vncDesEncrypt(challenge, passwordToUse))
  } else if (secTypes.includes(1)) {
    log?.("auth choisie", { type: "none" })
    proxmoxWs.send(Buffer.from([1]))
  } else {
    throw new Error(`Type de sécurité VNC non supporté: ${secTypes.join(",")}`)
  }

  const secResult = await receiveBinaryFrame(proxmoxWs, 4, WS_HANDSHAKE_TIMEOUT_MS, "proxmox", "security-result")
  const secResultCode = secResult.readUInt32BE(0)
  log?.("sec result", { code: secResultCode, length: secResult.length })
  if (secResultCode !== 0) {
    throw new Error("Authentification VNC refusée par Proxmox")
  }

  proxmoxWs.send(Buffer.from([1]))

  let serverInit: Buffer
  if (secResult.length >= 28) {
    serverInit = secResult.subarray(4)
    log?.("server init extrait", { bytes: serverInit.length })
  } else {
    serverInit = await receiveBinaryFrame(proxmoxWs, 24, WS_HANDSHAKE_TIMEOUT_MS, "proxmox", "server-init")
    log?.("server init size", { bytes: serverInit.length })
  }
  return serverInit
}

async function performBrowserNoAuthHandshake(
  clientWs: WebSocket,
  serverInit: Buffer,
  log?: DebugLogger
): Promise<void> {
  if (clientWs.readyState !== WebSocket.OPEN) {
    throw new Error("Client WebSocket is not open before handshake")
  }
  clientWs.send(Buffer.from("RFB 003.008\n"))
  await receiveBinaryFrame(clientWs, 12, WS_HANDSHAKE_TIMEOUT_MS, "client", "browser-version")

  if (clientWs.readyState !== WebSocket.OPEN) throw new Error("Client WebSocket closed")
  clientWs.send(Buffer.from([1, 1]))
  await receiveBinaryFrame(clientWs, 1, WS_HANDSHAKE_TIMEOUT_MS, "client", "browser-security-choice")

  if (clientWs.readyState !== WebSocket.OPEN) throw new Error("Client WebSocket closed")
  clientWs.send(Buffer.from([0, 0, 0, 0]))
  await receiveBinaryFrame(clientWs, 1, WS_HANDSHAKE_TIMEOUT_MS, "client", "browser-client-init")

  if (clientWs.readyState !== WebSocket.OPEN) throw new Error("Client WebSocket closed")
  clientWs.send(serverInit)
  log?.("handshake navigateur termine")
}

export async function handleVncProxy(clientWs: WebSocket, sessionId: string): Promise<void> {
  let proxmoxWs: WebSocket | null = null
  const clientId = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const sessionLog: DebugLogger = (message, details) => {
    if (!VNC_PROXY_DEBUG) return
    const payload = details ? ` ${JSON.stringify(details)}` : ""
    console.log(`[VNC Proxy][${sessionId}][${clientId}] ${message}${payload}`)
  }

  if (vncSessionLocks.has(sessionId)) {
    sessionLog("connexion ignoree (verrou session actif)")
    if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
      clientWs.close(1013, "Connexion VNC deja en cours")
    }
    return
  }

  vncSessionLocks.add(sessionId)
  
  // IMMEDIATELY unlock if the frontend explicitly closed before handshake completes
  const onClientEarlyClose = () => {
    vncSessionLocks.delete(sessionId)
    sessionLog("client fermé prématurément, verrou libéré")
  }
  clientWs.once("close", onClientEarlyClose)

  try {
    const gameSession = await getGameSession(sessionId)
    if (!gameSession) {
      clientWs.close(1008, "Session introuvable")
      return
    }

    if (gameSession.status === "ended" || gameSession.status === "error") {
      clientWs.close(1008, "Session invalide ou VM non prête")
      return
    }

    const { cloneNode, cloneVmid } = gameSession
    if (!cloneNode || !cloneVmid) {
      clientWs.close(1011, "Clone VM incomplet")
      return
    }

    const scenarioData = await getScenarioWithProxmox(gameSession.scenarioId)
    if (!scenarioData?.server) {
      clientWs.close(1011, "Configuration Proxmox introuvable")
      return
    }

    const { server } = scenarioData

    // Vérifier l'état de la VM et la démarrer si elle est éteinte
    try {
      const vmStatus = await getVMStatus(server.host, server.token, cloneNode, cloneVmid)
      if (vmStatus.status === "stopped") {
        sessionLog("VM stoppée. Démarrage en cours...")
        await startVM(server.host, server.token, cloneNode, cloneVmid)
        // Petit délai pour laisser le temps à l'hyperviseur d'ouvrir le port VNC
        await new Promise((resolve) => setTimeout(resolve, 3000))
      }
    } catch (statusError) {
      sessionLog("Échec de la vérification/démarrage de la VM", { error: String(statusError) })
    }

    const vncData = await getVNCTicket(
      server.host,
      server.token,
      cloneNode,
      cloneVmid
    )
    const { ticket, port, password, user } = vncData
    // IMPORTANT: Pour Proxmox VE, si `password` n'est pas fourni, 
    // la clé DES attendue est les 8 premiers caractères du *ticket*, non pas le username.
    const vncPassword = password || ticket
    sessionLog("ticket OK", {
      cloneNode,
      cloneVmid,
      port,
      ticketLength: ticket.length,
      hasPassword: !!password,
      passwordLength: password?.length,
      user
    })

    const proxmoxWsUrl = `wss://${server.host}/api2/json/nodes/${cloneNode}/qemu/${cloneVmid}/vncwebsocket?port=${port}&vncticket=${encodeURIComponent(ticket)}`

    proxmoxWs = new WebSocket(proxmoxWsUrl, {
      headers: { Authorization: server.token },
      agent: upstreamAgent,
    })

    await new Promise<void>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout ouverture WebSocket Proxmox (${WS_OPEN_TIMEOUT_MS}ms)`))
      }, WS_OPEN_TIMEOUT_MS)

      proxmoxWs?.once("open", () => {
        clearTimeout(timeoutId)
        sessionLog("ws upstream open")
        resolve()
      })
      proxmoxWs?.once("error", (err) => {
        clearTimeout(timeoutId)
        reject(err)
      })
    })

    const serverInit = await performRfbHandshakeWithProxmox(proxmoxWs, vncPassword, sessionLog)
    await performBrowserNoAuthHandshake(clientWs, serverInit, sessionLog)
    sessionLog("tunnel actif")

    // Remove the early close listener since we're attaching proper relay handlers now
    clientWs.off("close", onClientEarlyClose)

    proxmoxWs.on("message", (payload) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.send(payload)
        } catch (e) {
          sessionLog("Erreur relay proxmox->client", { error: String(e) })
        }
      }
    })

    clientWs.on("message", (payload) => {
      if (proxmoxWs?.readyState === WebSocket.OPEN) {
        try {
          proxmoxWs.send(payload)
        } catch (e) {
          sessionLog("Erreur relay client->proxmox", { error: String(e) })
        }
      }
    })

    const cleanup = () => {
      if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
        clientWs.close()
      }
      if (proxmoxWs && (proxmoxWs.readyState === WebSocket.OPEN || proxmoxWs.readyState === WebSocket.CONNECTING)) {
        proxmoxWs.close()
      }
    }

    clientWs.on("close", cleanup)
    clientWs.on("error", cleanup)
    proxmoxWs.on("close", cleanup)
    proxmoxWs.on("error", cleanup)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur proxy VNC"
    const isClientHandshakeClose = message.includes("WebSocket fermée pendant le handshake")
    const isNormalClientClose = message.includes("(client:") && message.includes("code=1000")
    if (isClientHandshakeClose) {
      if (isNormalClientClose) {
        console.log("[VNC Proxy]", message)
      } else {
        console.warn("[VNC Proxy]", message)
      }
    } else {
      console.error("[VNC Proxy]", message)
    }
    if (clientWs.readyState === WebSocket.OPEN || clientWs.readyState === WebSocket.CONNECTING) {
      clientWs.close(1011, message)
    }
    if (proxmoxWs && (proxmoxWs.readyState === WebSocket.OPEN || proxmoxWs.readyState === WebSocket.CONNECTING)) {
      proxmoxWs.close()
    }
  } finally {
    vncSessionLocks.delete(sessionId)
  }
}
