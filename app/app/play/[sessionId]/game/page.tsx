"use client"

import { use, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/AuthContext"
import VncViewer, { type VncViewerHandle } from "@/components/VncViewer"
import { Button } from "@/components/ui/button"

interface Props {
  params: Promise<{ sessionId: string }>
}

export default function GamePage({ params }: Props) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const vncRef = useRef<VncViewerHandle>(null)
  const [ending, setEnding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const wsUrl = `ws://${typeof window !== "undefined" ? window.location.host : "localhost:3000"}/api/vnc-proxy?sessionId=${sessionId}`

  const handleEnd = async () => {
    if (ending) return
    setEnding(true)
    try {
      const { getAuth } = await import("firebase/auth")
      const token = await getAuth().currentUser?.getIdToken()
      await fetch(`/api/game/end?sessionId=${sessionId}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
    } catch (err) {
      console.error("[GamePage] Erreur fin de partie :", err)
    } finally {
      router.push("/app")
    }
  }

  // Fin de partie si l'utilisateur ferme/rafraîchit la page
  useEffect(() => {
    const onUnload = () => {
      navigator.sendBeacon(`/api/game/end?sessionId=${sessionId}`)
    }
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [sessionId])

  return (
    <div className="flex flex-col min-h-screen bg-black">
      {/* Barre de contrôle */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-700">
        <span className="text-xs text-gray-400 font-mono">
          Session : <span className="text-green-400">{sessionId}</span>
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-gray-600 text-gray-300 hover:text-white"
            onClick={() => vncRef.current?.sendCtrlAltDel()}
          >
            Ctrl+Alt+Suppr
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs border-gray-600 text-gray-300 hover:text-white"
            onClick={() => vncRef.current?.reconnect()}
          >
            Reconnecter
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="text-xs"
            onClick={handleEnd}
            disabled={ending}
          >
            {ending ? "Fin en cours..." : "Terminer la partie"}
          </Button>
        </div>
      </div>

      {/* Viewer VNC */}
      <div className="flex-1 flex items-center justify-center p-4">
        {error ? (
          <p className="text-red-400">{error}</p>
        ) : (
          <VncViewer ref={vncRef} wsUrl={wsUrl} debug={process.env.NODE_ENV === "development"} />
        )}
      </div>
    </div>
  )
}
