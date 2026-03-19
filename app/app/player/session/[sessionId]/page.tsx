"use client"

import { useEffect, useState, use, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import VncViewer, { type VncViewerHandle } from "@/components/VncViewer"
import { useRouter } from "next/navigation"
import { auth } from "@/lib/firebase"
import Link from "next/link"
import { Activity, ArrowLeft, Clock3, Gauge } from "lucide-react"
import { onIdTokenChanged } from "firebase/auth"
import { toast } from "sonner"

type VmStatus = "pending" | "cloning" | "starting" | "running" | "ended" | "error"

export default function PlayerSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [status, setStatus] = useState<VmStatus>("pending")
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ending, setEnding] = useState(false)
  const [exactVmStatus, setExactVmStatus] = useState<string | null>(null)
  const [uptime, setUptime] = useState<number | null>(null)
  const [pingMs, setPingMs] = useState<number | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [firstPollDone, setFirstPollDone] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showVncDebug, setShowVncDebug] = useState(false)
  const proxmoxToastShownRef = useRef(false)
  const viewerRef = useRef<VncViewerHandle | null>(null)

  const normalizeStatus = (value: string): VmStatus => {
    if (value === "pending" || value === "cloning" || value === "starting" || value === "running" || value === "ended" || value === "error") {
      return value
    }

    if (value === "stopped" || value === "paused" || value === "unknown") {
      return "starting"
    }

    return "pending"
  }

  const toWebSocketUrl = (path: string): string => {
    if (path.startsWith("ws://") || path.startsWith("wss://")) return path
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    return `${protocol}//${window.location.host}${path}`
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  useEffect(() => {
    const unsub = onIdTokenChanged(auth, (user) => {
      setIsAuthenticated(Boolean(user))
      setAuthReady(true)
    })

    return () => unsub()
  }, [])

  useEffect(() => {
    if (!authReady) return

    if (!isAuthenticated) {
      setError("Authentification requise")
      setFirstPollDone(true)
      return
    }

    let timer: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        const token = await auth.currentUser?.getIdToken()

        if (!token) {
          // Au refresh, le token peut arriver après quelques centaines de ms.
          timer = setTimeout(poll, 1000)
          return
        }

        const response = await fetch(`/api/game/status?sessionId=${sessionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })

        const data = await response.json()
        if (!response.ok) {
          if (data?.errorType === "PROXMOX_CONNECTION" && !proxmoxToastShownRef.current) {
            proxmoxToastShownRef.current = true
            const code = typeof data?.errorCode === "string" ? ` (${data.errorCode})` : ""
            toast.error(`Connexion Proxmox indisponible${code}. Vérifiez le serveur ou le réseau.`)
          }
          setError(data.error ?? "Erreur de statut VM")
          return
        }

        setStatus(normalizeStatus(String(data.status ?? "pending")))
        if (typeof data.wsUrl === "string") setWsUrl(toWebSocketUrl(data.wsUrl))
        setExactVmStatus(typeof data.exactVmStatus === "string" ? data.exactVmStatus : null)
        setUptime(typeof data.uptime === "number" ? data.uptime : null)
        setPingMs(typeof data.pingMs === "number" ? data.pingMs : null)
        setCheckedAt(typeof data.checkedAt === "string" ? data.checkedAt : null)
        setError(null)
        setFirstPollDone(true)
        proxmoxToastShownRef.current = false

        const normalized = normalizeStatus(String(data.status ?? "pending"))
        if (normalized !== "running" && normalized !== "ended" && normalized !== "error") {
          timer = setTimeout(poll, 2000)
        }
      } catch {
        setError("Impossible de joindre le serveur")
        setFirstPollDone(true)
      }
    }

    poll()

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [sessionId, authReady, isAuthenticated])

  const handleEnd = async () => {
    try {
      setEnding(true)
      const token = await auth.currentUser?.getIdToken()

      if (!token) {
        setError("Authentification requise")
        return
      }

      const response = await fetch("/api/game/end", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      })

      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? "Erreur lors de l'arrêt")
        return
      }

      setStatus("ended")
      router.push("/app/sessions")
    } finally {
      setEnding(false)
    }
  }

  const statusLabel: Record<VmStatus, string> = {
    pending: "En attente",
    cloning: "Clonage",
    starting: "Démarrage",
    running: "En cours",
    ended: "Terminée",
    error: "Erreur",
  }

  const renderMetricValue = (value: string | null) => {
    if (!firstPollDone) {
      return (
        <div className="space-y-2 py-1">
          <div className="h-4 w-20 rounded bg-muted animate-pulse" />
          <div className="h-3 w-14 rounded bg-muted animate-pulse" />
        </div>
      )
    }

    return <p className="text-lg font-semibold text-foreground">{value ?? "Indisponible"}</p>
  }

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Console VM - Session {sessionId}</span>
            <Badge>{statusLabel[status]}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Statut exact VM</p>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </div>
              {renderMetricValue((exactVmStatus ?? status).toUpperCase())}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Ping Proxmox</p>
                <Gauge className="h-4 w-4 text-muted-foreground" />
              </div>
              {renderMetricValue(pingMs !== null ? `${pingMs} ms` : null)}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Uptime VM</p>
                <Clock3 className="h-4 w-4 text-muted-foreground" />
              </div>
              {renderMetricValue(uptime !== null ? formatDuration(uptime) : null)}
            </div>

            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Dernier check</p>
                <Clock3 className="h-4 w-4 text-muted-foreground" />
              </div>
              {renderMetricValue(
                checkedAt
                  ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "medium" }).format(new Date(checkedAt))
                  : null
              )}
            </div>
          </div>

          {status !== "running" && (
            <div className="flex items-center justify-center h-120 rounded border border-border bg-muted/40">
              <p className="text-muted-foreground">Préparation de la VM ({statusLabel[status]})...</p>
            </div>
          )}

          {status === "running" && wsUrl && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => viewerRef.current?.sendCtrlAltDel()}
                >
                  Ctrl+Alt+Suppr
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="gap-1.5"
                  onClick={() => viewerRef.current?.reconnect()}
                >
                  Reconnecter VNC
                </Button>
                <Button
                  type="button"
                  variant={showVncDebug ? "default" : "outline"}
                  className="gap-1.5"
                  onClick={() => setShowVncDebug((value) => !value)}
                >
                  {showVncDebug ? "Masquer debug" : "Afficher debug"}
                </Button>
                </div>
              </div>
              <VncViewer ref={viewerRef} wsUrl={wsUrl} debug={showVncDebug} />
            </div>
          )}

          <div className="flex justify-between">
            <Button asChild variant="outline">
              <Link href="/app/sessions">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour au suivi sessions
              </Link>
            </Button>
            <Button variant="destructive" onClick={handleEnd} disabled={ending || status === "ended"}>
              {ending ? "Arrêt..." : "Terminer la session"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
