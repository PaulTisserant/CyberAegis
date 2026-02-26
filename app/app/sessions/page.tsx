"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Play, Eye } from "lucide-react"
import CreateSessionModal from "./CreateSessionModal"
import Link from "next/link"
import { useAuth } from "@/lib/auth/AuthContext"
import { useSessions } from "@/lib/hooks/useSessions"
import { useScenarios } from "@/lib/hooks/useScenarios"
import { startSession } from "@/lib/firestore/sessions"
import { toast } from "sonner"

export default function SessionsPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ""
  const { sessions, loading, error } = useSessions(orgId)
  const { scenarios } = useScenarios(orgId)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleStart = async (id: string) => {
    try {
      await startSession(id)
      toast.success("Session démarrée")
    } catch {
      toast.error("Erreur lors du démarrage")
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
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucune session pour l’instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-semibold text-foreground py-3 px-4">Nom</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Scénario</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Date</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Statut</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Joueurs</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b border-border hover:bg-muted/50 transition">
                      <td className="py-3 px-4 text-foreground font-medium">{session.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{session.scenarioName}</td>
                      <td className="py-3 px-4 text-muted-foreground">{session.date}</td>
                      <td className="py-3 px-4">
                        <Badge className={getStatusColor(session.status)}>{getStatusLabel(session.status)}</Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{session.players}</td>
                      <td className="py-3 px-4 flex gap-2">
                        <Link href={`/app/sessions/${session.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        {session.status === "PLANNED" && (
                          <Button variant="ghost" size="sm" onClick={() => handleStart(session.id)}>
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
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
