import { createServer, type IncomingMessage } from "http"
import { parse } from "url"
import next from "next"
import { loadEnvConfig } from "@next/env"
import { WebSocketServer, type WebSocket } from "ws"

loadEnvConfig(process.cwd())

const dev = process.env.NODE_ENV !== "production"
const hostname = "localhost"
const port = Number(process.env.PORT || 3000)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const nextUpgradeHandler = (app as unknown as {
    getUpgradeHandler?: () => (req: IncomingMessage, socket: unknown, head: Buffer) => void
  }).getUpgradeHandler?.()

  const server = createServer((req, res) => {
    handle(req, res, parse(req.url || "", true))
  })

  const wss = new WebSocketServer({ noServer: true })

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url || "")

    if (pathname !== "/api/vnc-proxy") {
      if (nextUpgradeHandler) {
        nextUpgradeHandler(req, socket, head)
        return
      }

      // Fallback défensif si l'API interne n'existe pas.
      socket.destroy()
      return
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req)
    })
  })

  wss.on("connection", async (ws: WebSocket, req: IncomingMessage) => {
    const { query } = parse(req.url || "", true)
    const sessionIdQuery = query.sessionId
    const sessionId = Array.isArray(sessionIdQuery) ? sessionIdQuery[0] : sessionIdQuery

    if (!sessionId || typeof sessionId !== "string") {
      ws.close(1008, "sessionId manquant")
      return
    }

    try {
      const { handleVncProxy } = await import("./lib/vncProxy")
      void handleVncProxy(ws, sessionId)
    } catch {
      ws.close(1011, "Impossible d'initialiser le proxy VNC")
    }
  })

  server.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log("> VNC WebSocket proxy actif sur /api/vnc-proxy?sessionId=...")
  })
})
