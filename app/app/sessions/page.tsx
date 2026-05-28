"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Play, Eye, SquareTerminal, FileText } from "lucide-react"
import CreateSessionModal from "./CreateSessionModal"
import Link from "next/link"
import { useAuth } from "@/lib/auth/AuthContext"
import { useSessions } from "@/lib/hooks/useSessions"
import { useScenarios } from "@/lib/hooks/useScenarios"
import {
  attachGameSessionToSession,
  finishSession,
  updateSessionVmStatus,
} from "@/lib/firestore/sessions"
import { getReportBySessionId, generateSessionReport } from "@/lib/firestore/reports"
import { toast } from "sonner"

export default function SessionsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ""
  const { sessions, loading, error } = useSessions(orgId)
  const { scenarios } = useScenarios(orgId)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "RUNNING" | "PLANNED" | "FINISHED" | "ALL">("ACTIVE")
  const [reportIds, setReportIds] = useState<Record<string, string>>({})

  // Charger les IDs de rapport pour les sessions terminées
  useEffect(() => {
    const finished = sessions.filter((s) => s.status === "FINISHED")
    finished.forEach((s) => {
      if (reportIds[s.id] !== undefined) return
      getReportBySessionId(s.id).then((r) => {
        if (r) setReportIds((prev) => ({ ...prev, [s.id]: r.id }))
        else setReportIds((prev) => ({ ...prev, [s.id]: "" }))
      })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions])

  const formatDateFr = (value: string) => {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date)
  }

  const getVmStatusColor = (status?: string) => {
    switch (status) {
      case "running": return "bg-green-100 text-green-800"
      case "starting":
      case "cloning":
      case "pending": return "bg-gray-100 text-gray-800"
      case "ended": return "bg-red-100 text-red-800"
      case "error": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getVmStatusLabel = (status?: string) => {
    switch (status) {
      case "running": return "En cours"
      case "starting": return "Démarrage"
      case "cloning": return "Clonage"
      case "pending": return "En attente"
      case "ended": return "Terminée"
      case "error": return "Erreur"
      default: return "N/A"
    }
  }

  const handleGenerateReport = async (sessionId: string) => {
    if (!user?.organizationId) return
    try {
      const rId = await generateSessionReport(sessionId, user.organizationId)
      setReportIds((prev) => ({ ...prev, [sessionId]: rId }))
      toast.success("Rapport généré")
    } catch {
      toast.error("Impossible de générer le rapport")
    }
  }

  const getAuthToken = async () => {
    const authModule = await import("firebase/auth")
    return authModule.getAuth().currentUser?.getIdToken()
  }

  const handleStart = async (id: string, scenarioId: string) => {
    try {
      const token = await getAuthToken()
      if (!token) {
        toast.error("Vous devez être connecté pour démarrer une session")
        return
      }

      const response = await fetch("/api/game/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scenarioId }),
      })

      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? "Erreur lors du démarrage de la VM")
        await updateSessionVmStatus(id, "error")
        return
      }

      await attachGameSessionToSession(id, data.sessionId)
      toast.success("Session démarrée, VM en cours de préparation")
    } catch {
      toast.error("Erreur lors du démarrage")
    }
  }

  const handleFinish = async (id: string, gameSessionId?: string) => {
    try {
      if (!gameSessionId) {
        await finishSession(id)
        toast.success("Session terminée")
        return
      }

      const token = await getAuthToken()
      if (!token) {
        toast.error("Vous devez être connecté pour terminer une session")
        return
      }

      const response = await fetch("/api/game/end", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId: gameSessionId }),
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error ?? "Erreur lors de l'arrêt de la VM")
        return
      }

      await updateSessionVmStatus(id, "ended")
      toast.success("Session terminée et VM nettoyée")
    } catch {
      toast.error("Erreur lors de la fin de session")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "RUNNING": return "bg-green-100 text-green-800"
      case "PLANNED": return "bg-gray-100 text-gray-800"
      case "FINISHED": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "RUNNING": return "En cours"
      case "PLANNED": return "Planifiée"
      case "FINISHED": return "Terminée"
      default: return status
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="text-muted-foreground">Chargement...</span>
    </div>
  )
  if (error) return <div className="text-destructive">{error}</div>

  const filteredSessions = sessions.filter((session) => {
    if (statusFilter === "ALL") return true
    if (statusFilter === "ACTIVE") return session.status === "PLANNED" || session.status === "RUNNING"
    return session.status === statusFilter
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sessions</h1>
          <p className="text-muted-foreground mt-1">Gérez vos sessions d’escape game</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Créer une session
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Toutes les sessions</CardTitle>
          <CardDescription>Liste complète de vos sessions d’escape game</CardDescription>
          <div className="rounded-lg border border-border bg-muted/30 p-2">
            <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={statusFilter === "ACTIVE" ? "default" : "secondary"}
              className={statusFilter === "ACTIVE" ? "shadow-sm" : "text-foreground"}
              onClick={() => setStatusFilter("ACTIVE")}
            >
              Actives
            </Button>
            <Button
              type="button"
              variant={statusFilter === "RUNNING" ? "default" : "secondary"}
              className={statusFilter === "RUNNING" ? "shadow-sm" : "text-foreground"}
              onClick={() => setStatusFilter("RUNNING")}
            >
              En cours
            </Button>
            <Button
              type="button"
              variant={statusFilter === "PLANNED" ? "default" : "secondary"}
              className={statusFilter === "PLANNED" ? "shadow-sm" : "text-foreground"}
              onClick={() => setStatusFilter("PLANNED")}
            >
              Planifiées
            </Button>
            <Button
              type="button"
              variant={statusFilter === "FINISHED" ? "default" : "secondary"}
              className={statusFilter === "FINISHED" ? "shadow-sm" : "text-foreground"}
              onClick={() => setStatusFilter("FINISHED")}
            >
              Terminées
            </Button>
            <Button
              type="button"
              variant={statusFilter === "ALL" ? "default" : "secondary"}
              className={statusFilter === "ALL" ? "shadow-sm" : "text-foreground"}
              onClick={() => setStatusFilter("ALL")}
            >
              Toutes
            </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune session pour l’instant.</p>
          ) : filteredSessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune session pour ce filtre.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-semibold text-foreground py-3 px-4">Nom</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Scénario</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Date</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Statut</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Statut VM</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Joueurs</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session) => (
                    <tr key={session.id} className="border-b border-border hover:bg-muted/50 transition">
                      <td className="py-3 px-4 text-foreground font-medium">{session.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{session.scenarioName}</td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDateFr(session.date)}</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(session.status)}>{getStatusLabel(session.status)}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={getVmStatusColor(session.vmStatus)}>{getVmStatusLabel(session.vmStatus)}</Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{session.players}</td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-2">
                        <Link href={`/app/sessions/${session.id}`}>
                          <Button variant="outline" size="sm" className="gap-1.5">
                            <Eye className="h-4 w-4" />
                            Voir
                          </Button>
                        </Link>
                        {session.status === "PLANNED" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleStart(session.id, session.scenarioId)}
                          >
                            <Play className="h-4 w-4" />
                            Démarrer
                          </Button>
                        )}
                        {session.status === "RUNNING" && session.gameSessionId && (
                          <Link href={`/app/player/session/${session.gameSessionId}`}>
                            <Button variant="secondary" size="sm" className="gap-1.5" title="Ouvrir l'écran VM">
                              <SquareTerminal className="h-4 w-4" />
                              Console
                            </Button>
                          </Link>
                        )}
                        {session.status === "RUNNING" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleFinish(session.id, session.gameSessionId)}
                          >
                            Terminer
                          </Button>
                        )}
                        {session.status === "FINISHED" && (
                          reportIds[session.id]
                            ? (
                              <Link href={`/app/reports/${reportIds[session.id]}`}>
                                <Button variant="outline" size="sm" className="gap-1.5 text-blue-700 border-blue-300 hover:bg-blue-50">
                                  <FileText className="h-4 w-4" />
                                  Rapport
                                </Button>
                              </Link>
                            )
                            : reportIds[session.id] === ""
                              ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5"
                                  onClick={() => handleGenerateReport(session.id)}
                                >
                                  <FileText className="h-4 w-4" />
                                  Générer rapport
                                </Button>
                              )
                              : null
                        )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CreateSessionModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        organizationId={orgId}
        createdBy={user?.uid ?? ""}
        scenarios={scenarios}
      />
    </div>
  )
}
