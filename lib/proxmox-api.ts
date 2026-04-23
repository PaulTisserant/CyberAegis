import https from "https"
import { URL } from "url"

type ProxmoxApiResponse<T = unknown> = {
  data: T
}

const DEFAULT_PROXMOX_TIMEOUT_MS = 12000

type ProxmoxNetworkError = Error & {
  code?: string
  errno?: number
  syscall?: string
  address?: string
  port?: number
}

function isProxmoxInsecureTlsEnabled() {
  return process.env.PROXMOX_TLS_INSECURE === "true"
}

function getProxmoxRequestTimeoutMs() {
  const raw = process.env.PROXMOX_REQUEST_TIMEOUT_MS
  const parsed = raw ? Number(raw) : NaN
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PROXMOX_TIMEOUT_MS
  return parsed
}

export function isProxmoxTimeoutError(err: unknown) {
  const networkErr = err as ProxmoxNetworkError
  if (networkErr?.code === "ETIMEDOUT") return true
  const msg = typeof networkErr?.message === "string" ? networkErr.message.toLowerCase() : ""
  return msg.includes("timed out") || msg.includes("timeout")
}

function createTimeoutError(host: string, path: string, timeoutMs: number): ProxmoxNetworkError {
  const err = new Error(
    `Timeout Proxmox (${timeoutMs}ms) ${host}${path}`
  ) as ProxmoxNetworkError
  err.code = "ETIMEDOUT"
  err.syscall = "connect"
  return err
}

/**
 * Effectue une requête vers l'API REST Proxmox
 * Todas les requêtes incluent le token d'authentification
 */
export async function proxmoxFetch(
  host: string,
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<ProxmoxApiResponse> {
  const url = `https://${host}/api2/json${path}`
  const headers: Record<string, string> = {
    Authorization: token,
    ...((options.headers as Record<string, string> | undefined) ?? {}),
  }

  const body = typeof options.body === "string" ? options.body : undefined
  if (body && !headers["Content-Length"]) {
    headers["Content-Length"] = Buffer.byteLength(body).toString()
  }

  const parsedUrl = new URL(url)
  const timeoutMs = getProxmoxRequestTimeoutMs()

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        protocol: parsedUrl.protocol,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: `${parsedUrl.pathname}${parsedUrl.search}`,
        method: options.method ?? "GET",
        headers,
        rejectUnauthorized: !isProxmoxInsecureTlsEnabled(),
        timeout: timeoutMs,
      },
      (res) => {
        let raw = ""
        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          raw += chunk
        })
        res.on("end", () => {
          const status = res.statusCode ?? 500
          const contentType = Array.isArray(res.headers["content-type"])
            ? res.headers["content-type"].join(";")
            : res.headers["content-type"] ?? ""

          if (status < 200 || status >= 300) {
            reject(
              new Error(
                `Proxmox ${options.method ?? "GET"} ${path} → HTTP ${status}: ${raw}`
              )
            )
            return
          }

          if (!contentType.includes("application/json") || raw.trim().length === 0) {
            resolve({ data: null })
            return
          }

          try {
            resolve(JSON.parse(raw) as ProxmoxApiResponse)
          } catch {
            reject(new Error(`Réponse JSON invalide depuis Proxmox pour ${path}`))
          }
        })
      }
    )

    req.setTimeout(timeoutMs, () => {
      req.destroy(createTimeoutError(host, path, timeoutMs))
    })

    req.on("error", (err) => {
      reject(err)
    })

    if (body) req.write(body)
    req.end()
  })
}

/**
 * Phase 1 : Lister les nœuds Proxmox
 */
export async function listNodes(host: string, token: string) {
  const { data } = await proxmoxFetch(host, token, "/nodes")
  return data as Array<{ node: string; status: string; uptime: number }>
}

/**
 * Phase 1 : Lister les VMs d'un nœud
 */
export async function listVMs(host: string, token: string, node: string) {
  const { data } = await proxmoxFetch(host, token, `/nodes/${node}/qemu`)
  return data as Array<{
    vmid: number
    name: string
    template?: number
    status: string
    uptime?: number
  }>
}

/**
 * Phase 2a : Cloner un template VM
 */
export async function cloneTemplate(
  host: string,
  token: string,
  node: string,
  templateVmid: number,
  newVmid: number,
  sessionId: string
) {
  const body = new URLSearchParams({
    newid: String(newVmid),
    name: `escape-${sessionId.slice(0, 8)}`,
    full: "0", // clone lié (quasi-instantané)
  })

  return proxmoxFetch(host, token, `/nodes/${node}/qemu/${templateVmid}/clone`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
}

/**
 * Phase 2b : Démarrer une VM
 */
export async function startVM(
  host: string,
  token: string,
  node: string,
  vmid: number
) {
  return proxmoxFetch(host, token, `/nodes/${node}/qemu/${vmid}/status/start`, {
    method: "POST",
  })
}

/**
 * Phase 2c : Vérifier le statut actuellen d'une VM
 */
export async function getVMStatus(
  host: string,
  token: string,
  node: string,
  vmid: number
) {
  const { data } = await proxmoxFetch(host, token, `/nodes/${node}/qemu/${vmid}/status/current`)
  return data as {
    status: "running" | "stopped" | "paused" | "unknown"
    vmid: number
    uptime: number
    name: string
    mem?: number
    maxmem?: number
    cpu?: number
  }
}

/**
 * Phase 3 : Obtenir un ticket VNC (WebSocket)
 */
export async function getVNCTicket(
  host: string,
  token: string,
  node: string,
  vmid: number
) {
  const body = new URLSearchParams({ websocket: "1" })

  const { data } = await proxmoxFetch(host, token, `/nodes/${node}/qemu/${vmid}/vncproxy`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })

  return data as {
    ticket: string
    port: number
    cert?: string
    password?: string
    user?: string
  }
}

/**
 * Phase 4a : Arrêter une VM de force
 */
export async function stopVM(
  host: string,
  token: string,
  node: string,
  vmid: number
) {
  return proxmoxFetch(host, token, `/nodes/${node}/qemu/${vmid}/status/stop`, {
    method: "POST",
  })
}

/**
 * Phase 4b : Supprimer une VM
 */
export async function deleteVM(
  host: string,
  token: string,
  node: string,
  vmid: number
) {
  return proxmoxFetch(host, token, `/nodes/${node}/qemu/${vmid}`, {
    method: "DELETE",
  })
}

/**
 * Utilitaire : Générer un VMID unique (gamme 1000-9999 réservée aux clones de sessions)
 * À améliorer : utiliser Redis ou une séquence Firestore pour plus de robustesse
 */
export function generateCloneVmid(): number {
  return 1000 + Math.floor(Math.random() * 9000)
}
