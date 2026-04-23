"use client"

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react"

const KEY_MAP: Record<string, number> = {
  Enter: 0xFF0D,
  Backspace: 0xFF08,
  Tab: 0xFF09,
  Escape: 0xFF1B,
  Delete: 0xFFFF,
  Insert: 0xFF63,
  Home: 0xFF50,
  End: 0xFF57,
  PageUp: 0xFF55,
  PageDown: 0xFF56,
  ArrowUp: 0xFF52,
  ArrowDown: 0xFF54,
  ArrowLeft: 0xFF51,
  ArrowRight: 0xFF53,
  F1: 0xFFBE,
  F2: 0xFFBF,
  F3: 0xFFC0,
  F4: 0xFFC1,
  F5: 0xFFC2,
  F6: 0xFFC3,
  F7: 0xFFC4,
  F8: 0xFFC5,
  F9: 0xFFC6,
  F10: 0xFFC7,
  F11: 0xFFC8,
  F12: 0xFFC9,
  Control: 0xFFE3,
  Alt: 0xFFE9,
  Shift: 0xFFE1,
  Meta: 0xFFEB,
  " ": 0x0020,
}

interface Props {
  wsUrl: string
  debug?: boolean
}

export interface VncViewerHandle {
  reconnect: () => void
  sendCtrlAltDel: () => void
}

type RfbState =
  | "handshake_version"
  | "handshake_security"
  | "handshake_secresult"
  | "handshake_serverinit"
  | "connected"

const initialPixelFormat = {
  bpp: 32,
  bigEndian: 0,
  redShift: 16,
  greenShift: 8,
  blueShift: 0,
}

const VncViewer = forwardRef<VncViewerHandle, Props>(function VncViewer(
  { wsUrl, debug = false },
  ref
) {
  const MAX_RECONNECT_ATTEMPTS = 5
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const closingRef = useRef(false)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const suppressAutoReconnectRef = useRef(false)
  const handshakeCompletedRef = useRef(false)
  const stateRef = useRef<RfbState>("handshake_version")
  const bufferRef = useRef(new Uint8Array(0))
  const formatRef = useRef({ w: 0, h: 0 })
  const pixelFormatRef = useRef(initialPixelFormat)
  const mountIdRef = useRef(0)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  const [rfbState, setRfbState] = useState<RfbState>("handshake_version")
  const [messageCount, setMessageCount] = useState(0)
  const [lastClose, setLastClose] = useState<string | null>(null)
  const [reconnectNonce, setReconnectNonce] = useState(0)

  const appendBuffer = (a: Uint8Array, b: Uint8Array) => {
    const merged = new Uint8Array(a.length + b.length)
    merged.set(a)
    merged.set(b, a.length)
    return merged
  }

  const send = useCallback((data: Uint8Array | string) => {
    if (!wsRef.current) return
    if (wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(data instanceof Uint8Array ? new Uint8Array(data) : data)
      } catch (err) {
        console.error("[VNC send] Erreur d'envoi", err)
      }
    }
  }, [])

  const updateRfbState = useCallback((newState: RfbState) => {
    stateRef.current = newState
    setRfbState(newState)
  }, [])

  const sendFramebufferUpdateRequest = useCallback((incremental: boolean) => {
    const { w, h } = formatRef.current
    if (!w || !h) return
    send(new Uint8Array([3, incremental ? 1 : 0, 0, 0, 0, 0, (w >> 8) & 0xff, w & 0xff, (h >> 8) & 0xff, h & 0xff]))
  }, [send])

  const drawRaw = useCallback((
    x: number,
    y: number,
    w: number,
    h: number,
    pixels: Uint8Array,
    bytesPerPixel: number
  ) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!ctx || !canvas) return

    const imageData = ctx.createImageData(w, h)
    const { bigEndian, redShift, greenShift, blueShift } = pixelFormatRef.current

    for (let p = 0; p < w * h; p++) {
      const base = p * bytesPerPixel

      let red = 0
      let green = 0
      let blue = 0

      if (bytesPerPixel === 4 && bigEndian === 0) {
        // Cas le plus fréquent sur Proxmox: little-endian 32bpp (BGRA)
        blue = pixels[base]
        green = pixels[base + 1]
        red = pixels[base + 2]
      } else {
        let pixelValue = 0
        if (bigEndian) {
          for (let i = 0; i < bytesPerPixel; i++) {
            pixelValue = (pixelValue << 8) | pixels[base + i]
          }
        } else {
          for (let i = bytesPerPixel - 1; i >= 0; i--) {
            pixelValue = (pixelValue << 8) | pixels[base + i]
          }
        }

        red = (pixelValue >> redShift) & 0xff
        green = (pixelValue >> greenShift) & 0xff
        blue = (pixelValue >> blueShift) & 0xff
      }

      imageData.data[p * 4] = red
      imageData.data[p * 4 + 1] = green
      imageData.data[p * 4 + 2] = blue
      imageData.data[p * 4 + 3] = 255
    }

    ctx.putImageData(imageData, x, y)
  }, [])

  const parseFramebufferUpdate = useCallback((): boolean => {
    const buf = bufferRef.current
    if (buf.length < 4) return false

    const rectCount = (buf[2] << 8) | buf[3]
    let offset = 4

    for (let i = 0; i < rectCount; i++) {
      if (buf.length < offset + 12) return false

      const x = (buf[offset] << 8) | buf[offset + 1]
      const y = (buf[offset + 2] << 8) | buf[offset + 3]
      const w = (buf[offset + 4] << 8) | buf[offset + 5]
      const h = (buf[offset + 6] << 8) | buf[offset + 7]
      const enc = new DataView(buf.buffer, buf.byteOffset + offset + 8, 4).getInt32(0, false)
      offset += 12

      if (enc === 0) {
        const bytesPerPixel = Math.max(1, Math.floor(pixelFormatRef.current.bpp / 8))
        const pixelLen = w * h * bytesPerPixel
        if (buf.length < offset + pixelLen) return false
        drawRaw(x, y, w, h, buf.slice(offset, offset + pixelLen), bytesPerPixel)
        offset += pixelLen
      } else if (enc === 1) {
        if (buf.length < offset + 4) return false
        const srcX = (buf[offset] << 8) | buf[offset + 1]
        const srcY = (buf[offset + 2] << 8) | buf[offset + 3]
        const canvas = canvasRef.current
        const ctx = canvas?.getContext("2d")
        if (ctx && canvas) {
          ctx.drawImage(canvas, srcX, srcY, w, h, x, y, w, h)
        }
        offset += 4
      } else if (enc === -223) {
        formatRef.current = { w, h }
        if (canvasRef.current) {
          canvasRef.current.width = w
          canvasRef.current.height = h
        }
      } else {
        return false
      }
    }

    bufferRef.current = buf.slice(offset)
    sendFramebufferUpdateRequest(true)
    return true
  }, [drawRaw, sendFramebufferUpdateRequest])

  const parseMessages = useCallback((): boolean => {
    const buf = bufferRef.current
    if (!buf.length) return false

    if (buf[0] === 0) return parseFramebufferUpdate()

    if (buf[0] === 2) {
      bufferRef.current = buf.slice(1)
      return true
    }

    if (buf[0] === 1) {
      if (buf.length < 6) return false
      const count = (buf[4] << 8) | buf[5]
      if (buf.length < 6 + count * 6) return false
      bufferRef.current = buf.slice(6 + count * 6)
      return true
    }

    if (buf[0] === 3) {
      if (buf.length < 8) return false
      const len = new DataView(buf.buffer, buf.byteOffset + 4, 4).getUint32(0, false)
      if (buf.length < 8 + len) return false
      bufferRef.current = buf.slice(8 + len)
      return true
    }

    return false
  }, [parseFramebufferUpdate])

  const processRfb = useCallback((data: Uint8Array) => {
    const state = stateRef.current

    if (state === "handshake_version") {
      send(new TextEncoder().encode("RFB 003.008\n"))
      updateRfbState("handshake_security")
      return
    }

    if (state === "handshake_security") {
      send(new Uint8Array([1]))
      updateRfbState("handshake_secresult")
      return
    }

    if (state === "handshake_secresult") {
      if (new DataView(data.buffer, data.byteOffset).getUint32(0, false) !== 0) {
        setConnectionError("Échec d'authentification VNC")
        return
      }
      send(new Uint8Array([1]))
      updateRfbState("handshake_serverinit")
      if (data.length > 4) processRfb(data.slice(4))
      return
    }

    if (state === "handshake_serverinit") {
      if (data.length < 24) return
      const view = new DataView(data.buffer, data.byteOffset)
      const w = view.getUint16(0, false)
      const h = view.getUint16(2, false)
      formatRef.current = { w, h }
      pixelFormatRef.current = {
        bpp: data[4] ?? 32,
        bigEndian: data[6] ?? 0,
        redShift: data[14] ?? 16,
        greenShift: data[15] ?? 8,
        blueShift: data[16] ?? 0,
      }

      if (canvasRef.current) {
        canvasRef.current.width = w
        canvasRef.current.height = h
      }

      // Le proxy a déjà envoyé SetPixelFormat + SetEncodings directement à QEMU.
      // Le VncViewer n'envoie que FramebufferUpdateRequest — le format est toujours 32bpp little-endian RGB.
      pixelFormatRef.current = { bpp: 32, bigEndian: 0, redShift: 16, greenShift: 8, blueShift: 0 }
      updateRfbState("connected")
      handshakeCompletedRef.current = true
      reconnectAttemptsRef.current = 0
      bufferRef.current = new Uint8Array(0)
      sendFramebufferUpdateRequest(false)
      return
    }

    if (state === "connected") {
      bufferRef.current = appendBuffer(bufferRef.current, data)
      let keep = true
      while (keep && bufferRef.current.length > 0) keep = parseMessages()
    }
  }, [parseMessages, send, sendFramebufferUpdateRequest, updateRfbState])

  const reconnectNow = useCallback(() => {
    setConnectionError(null)
    setLastClose(null)
    reconnectAttemptsRef.current = 0
    suppressAutoReconnectRef.current = true
    setReconnectNonce((value) => value + 1)
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }
    const activeWs = wsRef.current
    if (activeWs && (activeWs.readyState === WebSocket.OPEN || activeWs.readyState === WebSocket.CONNECTING)) {
      activeWs.close(1000, "reconnect-manuel")
    }
  }, [])

  const sendCtrlAltDel = useCallback(() => {
    const sendKeyEvent = (keySym: number, down: boolean) => {
      send(new Uint8Array([
        4,
        down ? 1 : 0,
        0,
        0,
        (keySym >> 24) & 0xff,
        (keySym >> 16) & 0xff,
        (keySym >> 8) & 0xff,
        keySym & 0xff,
      ]))
    }

    sendKeyEvent(0xffe3, true)
    sendKeyEvent(0xffe9, true)
    sendKeyEvent(0xffff, true)
    sendKeyEvent(0xffff, false)
    sendKeyEvent(0xffe9, false)
    sendKeyEvent(0xffe3, false)
  }, [send])

  useImperativeHandle(ref, () => ({
    reconnect: reconnectNow,
    sendCtrlAltDel,
  }), [reconnectNow, sendCtrlAltDel])

  useEffect(() => {
    const currentMountId = ++mountIdRef.current

    closingRef.current = false
    suppressAutoReconnectRef.current = false
    setConnectionError(null)
    setRfbState("handshake_version")
    setMessageCount(0)
    handshakeCompletedRef.current = false
    bufferRef.current = new Uint8Array(0)
    formatRef.current = { w: 0, h: 0 }
    pixelFormatRef.current = initialPixelFormat
    updateRfbState("handshake_version")

    let connectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      // Réinitialiser l'état pour les reconnexions (le useEffect ne re-run pas à chaque retry)
      closingRef.current = false
      handshakeCompletedRef.current = false
      bufferRef.current = new Uint8Array(0)
      formatRef.current = { w: 0, h: 0 }
      pixelFormatRef.current = initialPixelFormat

      const ws = new WebSocket(wsUrl)
      ws.binaryType = "arraybuffer"
      wsRef.current = ws
      updateRfbState("handshake_version")

      ws.onopen = () => {
        if (currentMountId !== mountIdRef.current || wsRef.current !== ws) return
        suppressAutoReconnectRef.current = false
      }

      ws.onmessage = (event) => {
        if (currentMountId !== mountIdRef.current || wsRef.current !== ws) return
        setMessageCount((count) => count + 1)
        processRfb(new Uint8Array(event.data))
      }

      ws.onerror = () => {
        if (currentMountId !== mountIdRef.current || wsRef.current !== ws) return
        if (!closingRef.current && reconnectAttemptsRef.current >= 4) {
          setConnectionError("Erreur WebSocket proxy VNC")
        }
      }

      ws.onclose = (event) => {
        if (currentMountId !== mountIdRef.current || wsRef.current !== ws) return
        setLastClose(`code=${event.code}${event.reason ? `, raison=${event.reason}` : ""}`)
        wsRef.current = null
        if (closingRef.current) return
        if (suppressAutoReconnectRef.current) return

        // Code 1013 = serveur occupé (verrou session actif, cooldown proxy en cours).
        // On réessaie après 5s (match le cooldown proxy de 4s) sans incrémenter le compteur.
        if (event.code === 1013) {
          reconnectTimerRef.current = setTimeout(connect, 5000)
          return
        }

        // Incrémenter dans tous les cas (handshake établi ou non).
        // Si le tunnel s'est établi (handshakeCompleted) mais a fermé anormalement (1006),
        // réessayer avec un backoff plus long pour laisser QEMU libérer son slot VNC.
        reconnectAttemptsRef.current += 1

        if (reconnectAttemptsRef.current <= MAX_RECONNECT_ATTEMPTS) {
          // Tunnels établis qui ferment anormalement → délai plus long (5s de base)
          const baseDelay = handshakeCompletedRef.current ? 5000 : 400
          const delay = baseDelay + (reconnectAttemptsRef.current - 1) * 1000
          reconnectTimerRef.current = setTimeout(connect, delay)
          return
        }

        setConnectionError(
          handshakeCompletedRef.current
            ? "Connexion VNC interrompue par Proxmox (trop de tentatives)"
            : "Connexion VNC fermée (échecs répétés du handshake)"
        )
      }
    }

    // Délai anti-StrictMode : React monte/démonte en dev, on attend 350ms pour laisser
    // le cycle se stabiliser avant d'ouvrir la vraie connexion WebSocket.
    connectTimer = setTimeout(() => {
      if (currentMountId !== mountIdRef.current) return
      connect()
    }, 350)

    return () => {
      closingRef.current = true
      if (connectTimer) {
        clearTimeout(connectTimer)
        connectTimer = null
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
        reconnectTimerRef.current = null
      }
      const activeWs = wsRef.current
      if (activeWs) {
        if (activeWs.readyState === WebSocket.OPEN || activeWs.readyState === WebSocket.CONNECTING) {
            activeWs.close()
        }
      }
    }
  }, [wsUrl, processRfb, updateRfbState, reconnectNonce])

  const sendKey = (key: string, down: boolean) => {
    const mapped = KEY_MAP[key] ?? (key.length === 1 ? key.charCodeAt(0) : 0)
    if (!mapped) return
    send(new Uint8Array([4, down ? 1 : 0, 0, 0, (mapped >> 24) & 0xff, (mapped >> 16) & 0xff, (mapped >> 8) & 0xff, mapped & 0xff]))
  }

  const sendPointer = (x: number, y: number, mask: number) => {
    send(new Uint8Array([5, mask, (x >> 8) & 0xff, x & 0xff, (y >> 8) & 0xff, y & 0xff]))
  }

  return (
    <div className="space-y-3">
      {connectionError && <p className="text-sm text-destructive">{connectionError}</p>}
      {debug && (
        <div className="rounded border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
          <div className="grid grid-cols-1 gap-1 md:grid-cols-3">
            <p>Etat RFB: <span className="font-medium text-foreground">{rfbState}</span></p>
            <p>Messages recus: <span className="font-medium text-foreground">{messageCount}</span></p>
            <p>Derniere fermeture: <span className="font-medium text-foreground">{lastClose ?? "aucune"}</span></p>
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        tabIndex={0}
        className="block w-full max-w-full rounded border border-border bg-black"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          sendPointer(Math.round(e.clientX - rect.left), Math.round(e.clientY - rect.top), 0)
        }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          sendPointer(Math.round(e.clientX - rect.left), Math.round(e.clientY - rect.top), 1 << e.button)
        }}
        onMouseUp={(e) => {
          const rect = e.currentTarget.getBoundingClientRect()
          sendPointer(Math.round(e.clientX - rect.left), Math.round(e.clientY - rect.top), 0)
        }}
        onContextMenu={(e) => e.preventDefault()}
        onKeyDown={(e) => {
          e.preventDefault()
          sendKey(e.key, true)
        }}
        onKeyUp={(e) => {
          e.preventDefault()
          sendKey(e.key, false)
        }}
      />
    </div>
  )
})

export default VncViewer
