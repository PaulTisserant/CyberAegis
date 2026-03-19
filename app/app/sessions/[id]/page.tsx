"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { ArrowLeft, Play, X, SquareTerminal } from "lucide-react"
import { use } from "react"
import {
  attachGameSessionToSession,
  finishSession,
  getSession,
  updateSessionVmStatus,
} from "@/lib/firestore/sessions"
import { useSessionPlayers } from "@/lib/hooks/useSessions"
import { toast } from "sonner"
import type { Session } from "@/lib/types"
import Link from "next/link"

export default function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const { players } = useSessionPlayers(id)

  useEffect(() => {
    getSession(id).then((s) => {
      setSession(s)
      setLoading(false)
    })
  }, [id])

  const handleStart = async () => {
    try {
      if (!session) return

      const token = await (await import("firebase/auth").then((m) => m.getAuth))()
        .currentUser?.getIdToken()
      if (!token) {
        toast.error("Vous devez être connecté")
        return
      }

      const response = await fetch("/api/game/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scenarioId: session.scenarioId }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? "Erreur de démarrage VM")
        await updateSessionVmStatus(id, "error")
        return
      }

      await attachGameSessionToSession(id, data.sessionId)
      setSession((s) => (s ? { ...s, status: "RUNNING", gameSessionId: data.sessionId, vmStatus: "starting" } : s))
      toast.success("Session démarrée")
    } catch { toast.error("Erreur") }
  }

  const handleFinish = async () => {
    try {
      if (session?.gameSessionId) {
        const token = await (await import("firebase/auth").then((m) => m.getAuth))()
          .currentUser?.getIdToken()
        if (!token) {
          toast.error("Vous devez être connecté")
          return
        }

        await fetch("/api/game/end", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId: session.gameSessionId }),
        })

        await updateSessionVmStatus(id, "ended")
      }

      await finishSession(id)
      setSession((s) => s ? { ...s, status: "FINISHED" } : s)
      toast.success("Session terminée")
    } catch { toast.error("Erreur") }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="text-muted-foreground">Chargement...</span>
    </div>
  )
  if (!session) return <div className="text-center py-12">Session non trouvée</div>

  const formatDateFr = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  }

  const vmStatus = session.vmStatus ?? "pending"
  const vmStatusColor = vmStatus === "running"
    ? "bg-green-100 text-green-800"
    : vmStatus === "ended" || vmStatus === "error"
      ? "bg-red-100 text-red-800"
      : "bg-gray-100 text-gray-800"

  const vmStatusLabel = vmStatus === "running"
    ? "En cours"
    : vmStatus === "starting"
      ? "Démarrage"
      : vmStatus === "cloning"
        ? "Clonage"
        : vmStatus === "ended"
          ? "Terminée"
          : vmStatus === "error"
            ? "Erreur"
            : "En attente"

  const displayedPlayers = players.length > 0 ? players.length : session.players

  const statusColor = session.status === "RUNNING"
    ? "bg-green-100 text-green-800"
    : session.status === "PLANNED"
      ? "bg-gray-100 text-gray-800"
      : "bg-red-100 text-red-800"

  const statusLabel = session.status === "RUNNING" ? "En cours"
    : session.status === "PLANNED" ? "Planifiée" : "Terminée"

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-foreground">{session.name}</h1>
        <Button asChild variant="outline" size="sm" className="bg-transparent">
          <Link href="/app/sessions">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux sessions
          </Link>
        </Button>
      </div>
      <p className="text-muted-foreground mt-2">Détails de la session d’escape game</p>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Scénario</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold text-foreground">{session.scenarioName}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Date</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold text-foreground">{formatDateFr(session.date)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Statut</CardTitle></CardHeader>
          <CardContent>
            <Badge className={`${statusColor} text-sm font-bold`}>{statusLabel}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Statut VM</CardTitle></CardHeader>
          <CardContent>
            <Badge className={`${vmStatusColor} text-sm font-bold`}>{vmStatusLabel}</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Joueurs</CardTitle></CardHeader>
          <CardContent><p className="text-lg font-bold text-foreground">{displayedPlayers}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Participants en temps réel</CardTitle>
          <CardDescription>Scores et progression des joueurs</CardDescription>
        </CardHeader>
        <CardContent>
          {players.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">
              Aucun joueur connecté pour l’instant. Le suivi du statut VM reste disponible ci-dessus.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-semibold py-3 px-4">Joueur</th>
                    <th className="text-left font-semibold py-3 px-4">Score</th>
                    <th className="text-left font-semibold py-3 px-4">Progression</th>
                    <th className="text-left font-semibold py-3 px-4">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((p) => (
                    <tr key={p.id} className="border-b border-border hover:bg-muted/50 transition">
                      <td className="py-3 px-4 font-medium">{p.displayName}</td>
                      <td className="py-3 px-4">{p.score}</td>
                      <td className="py-3 px-4 w-40">
                        <div className="flex items-center gap-2">
                          <Progress value={p.progress} className="flex-1" />
                          <span className="text-xs text-muted-foreground">{p.progress}%</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={
                          p.status === "FINISHED" ? "bg-green-100 text-green-800" :
                          p.status === "PLAYING" ? "bg-blue-100 text-blue-800" :
                          "bg-gray-100 text-gray-800"
                        }>
                          {p.status === "FINISHED" ? "Terminé" : p.status === "PLAYING" ? "En jeu" : "En attente"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {session.status === "PLANNED" && (
          <Button className="flex-1" size="lg" onClick={handleStart}>
            <Play className="h-4 w-4 mr-2" />
            Démarrer la session
          </Button>
        )}
        {session.status === "RUNNING" && session.gameSessionId && (
          <Link href={`/app/player/session/${session.gameSessionId}`} className="flex-1">
            <Button className="w-full" size="lg" variant="outline">
              <SquareTerminal className="h-4 w-4 mr-2" />
              Ouvrir l'écran VM
            </Button>
          </Link>
        )}
        {session.status === "RUNNING" && (
          <Button variant="destructive" className="flex-1" size="lg" onClick={handleFinish}>
            <X className="h-4 w-4 mr-2" />
            Terminer la session
          </Button>
        )}
      </div>
    </div>
  )
}
