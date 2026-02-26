"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Users, Play, FileText } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useSessions } from "@/lib/hooks/useSessions"
import { useUsers } from "@/lib/hooks/useUsers"
import { useReports } from "@/lib/hooks/useReports"

export default function DashboardPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ""
  const { sessions } = useSessions(orgId)
  const { users } = useUsers(orgId)
  const { reports } = useReports(orgId)

  const activeSessions = sessions.filter((s) => s.status === "RUNNING").length
  const totalPlayers = sessions.reduce((sum, s) => sum + s.players, 0)

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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Tableau de bord</h1>
        <p className="text-muted-foreground">Bienvenue dans votre tableau de bord d'escape game cybersécurité</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions actives</CardTitle>
            <Play className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{activeSessions}</div>
            <p className="text-xs text-muted-foreground mt-1">En cours maintenant</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Joueurs</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalPlayers}</div>
            <p className="text-xs text-muted-foreground mt-1">Participants total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{users.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Dans votre compte</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rapports</CardTitle>
            <FileText className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{reports.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Générés</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Sessions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sessions récentes</CardTitle>
              <CardDescription>Vos dernières sessions d'escape game</CardDescription>
            </div>
            <Link href="/app/sessions">
              <Button variant="outline" size="sm">
                Voir tout
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-semibold text-foreground py-3 px-4">Nom</th>
                  <th className="text-left font-semibold text-foreground py-3 px-4">Scénario</th>
                  <th className="text-left font-semibold text-foreground py-3 px-4">Date</th>
                  <th className="text-left font-semibold text-foreground py-3 px-4">Statut</th>
                  <th className="text-left font-semibold text-foreground py-3 px-4">Joueurs</th>
                </tr>
              </thead>
              <tbody>
                {sessions.slice(0, 5).map((session) => (
                  <tr key={session.id} className="border-b border-border hover:bg-muted/50 transition">
                    <td className="py-3 px-4 text-foreground font-medium">{session.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{session.scenarioName}</td>
                    <td className="py-3 px-4 text-muted-foreground">{session.date}</td>
                    <td className="py-3 px-4">
                      <Badge className={`${getStatusColor(session.status)}`}>{getStatusLabel(session.status)}</Badge>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">{session.players}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
