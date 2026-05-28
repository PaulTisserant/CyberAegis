"use client"

import { use, useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth/AuthContext"
import VncViewer, { type VncViewerHandle } from "@/components/VncViewer"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, MonitorPlay, RotateCw, Keyboard, Trophy, PartyPopper } from "lucide-react"
import Link from "next/link"
import FlagSubmitPanel from "./FlagSubmitPanel"
import { getGameSession } from "@/lib/firestore/game-sessions"
import { finishSession } from "@/lib/firestore/sessions"
import { generateSessionReport } from "@/lib/firestore/reports"
import { toast } from "sonner"

interface Props {
  params: Promise<{ sessionId: string }>
}

export default function GamePage({ params }: Props) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { user } = useAuth()
  const vncRef = useRef<VncViewerHandle>(null)
  const [ending, setEnding] = useState(false)
  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [finalScore, setFinalScore] = useState(0)
  const [generatingReport, setGeneratingReport] = useState(false)

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

  const handleEndWithReport = async () => {
    if (generatingReport) return
    setGeneratingReport(true)
    try {
      const { getAuth } = await import("firebase/auth")
      const token = await getAuth().currentUser?.getIdToken()

      // 1. Terminer la VM
      await fetch(`/api/game/end?sessionId=${sessionId}`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })

      // 2. Récupérer la parentSessionId depuis la game session
      const gs = await getGameSession(sessionId)
      const parentSessionId = gs?.parentSessionId

      if (parentSessionId && user?.organizationId) {
        // 3. Marquer la session parente comme terminée
        try {
          await finishSession(parentSessionId)
        } catch { /* non bloquant */ }

        // 4. Générer le rapport
        try {
          const reportId = await generateReport(parentSessionId, user.organizationId)
          toast.success("Rapport généré avec succès !")
          router.push(`/app/reports/${reportId}`)
          return
        } catch {
          toast.error("Impossible de générer le rapport")
        }
      }

      router.push("/app")
    } catch (err) {
      console.error("[GamePage] Erreur fin avec rapport :", err)
      toast.error("Erreur lors de la finalisation")
      router.push("/app")
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleCompleted = useCallback((score: number) => {
    setFinalScore(score)
    setShowCompletionModal(true)
  }, [])

  useEffect(() => {
    const onUnload = () => {
      navigator.sendBeacon(`/api/game/end?sessionId=${sessionId}`)
    }
    window.addEventListener("beforeunload", onUnload)
    return () => window.removeEventListener("beforeunload", onUnload)
  }, [sessionId])

  return (
    <div className="space-y-4 p-4 h-screen flex flex-col">
      {/* Modale félicitations */}
      {showCompletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4 text-center space-y-6">
            <div className="flex justify-center">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/40 flex items-center justify-center">
                  <Trophy className="w-10 h-10 text-yellow-500" />
                </div>
                <PartyPopper className="w-6 h-6 text-green-500 absolute -top-1 -right-1" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Félicitations !</h2>
              <p className="text-muted-foreground">
                Tu as trouvé <strong>tous les flags</strong> de cette session.
              </p>
              <div className="inline-flex items-center gap-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 px-4 py-2 rounded-full font-mono font-semibold text-lg mt-2">
                <Trophy className="w-5 h-5" />
                {finalScore} pts
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Veux-tu terminer la session maintenant ? Un rapport sera généré automatiquement.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => setShowCompletionModal(false)}
                disabled={generatingReport}
              >
                Continuer d&apos;explorer
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleEndWithReport}
                disabled={generatingReport}
              >
                {generatingReport ? "Génération du rapport..." : "Terminer & voir le rapport"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <Button asChild variant="outline" size="sm" className="bg-transparent">
            <Link href="/app">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Accueil
            </Link>
          </Button>
          <div className="flex items-center gap-2">
            <MonitorPlay className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Partie en cours</h1>
          </div>
          <Badge className="bg-green-100 text-green-800 font-mono text-xs">
            {sessionId.slice(0, 8)}…
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent"
            onClick={() => vncRef.current?.sendCtrlAltDel()}
          >
            <Keyboard className="h-4 w-4 mr-1" />
            Ctrl+Alt+Suppr
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent"
            onClick={() => vncRef.current?.reconnect()}
          >
            <RotateCw className="h-4 w-4 mr-1" />
            Reconnecter
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleEnd}
            disabled={ending}
          >
            {ending ? "Arrêt..." : "Terminer la partie"}
          </Button>
        </div>
      </div>

      {/* Contenu principal : VNC + panel flags */}
      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        {/* Viewer VNC */}
        <Card className="flex-1 min-h-0 overflow-hidden">
          <CardContent className="p-0 h-full flex items-center justify-center bg-black rounded-lg">
            <VncViewer
              ref={vncRef}
              wsUrl={wsUrl}
              debug={process.env.NODE_ENV === "development"}
            />
          </CardContent>
        </Card>

        {/* Panel flags */}
        <FlagSubmitPanel sessionId={sessionId} onCompleted={handleCompleted} />
      </div>
    </div>
  )
}
