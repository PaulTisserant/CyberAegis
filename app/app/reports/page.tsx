"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Download, Eye } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useReports } from "@/lib/hooks/useReports"
import { downloadReportCsv } from "@/lib/reports-export"

export default function ReportsPage() {
  const { user } = useAuth()
  const { reports, loading, error } = useReports(user?.organizationId ?? "")

  const totalReports = reports.length
  const totalPlayers = reports.reduce((acc, r) => acc + (r.data?.totalPlayers ?? 0), 0)
  const avgCompletion = totalReports > 0
    ? Math.round(reports.reduce((acc, r) => acc + (r.data?.completionRate ?? 0), 0) / totalReports)
    : 0
  const avgScore = totalReports > 0
    ? Math.round(reports.reduce((acc, r) => acc + (r.data?.averageScore ?? 0), 0) / totalReports)
    : 0

  const reportsByMonth = reports.reduce<Record<string, number>>((acc, report) => {
    const date = report.generatedAt.toDate()
    const key = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" }).format(date)
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})

  const topSessions = reports
    .slice()
    .sort((a, b) => (b.data?.averageScore ?? 0) - (a.data?.averageScore ?? 0))
    .slice(0, 5)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="text-muted-foreground">Chargement...</span>
    </div>
  )
  if (error) return <div className="text-destructive">{error}</div>

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Rapports</h1>
        <p className="text-muted-foreground mt-1">Consultez et téléchargez vos rapports d’escape game</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Rapports</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalReports}</p>
            <p className="text-xs text-muted-foreground mt-1">tous scénarios confondus</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Joueurs analysés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{totalPlayers}</p>
            <p className="text-xs text-muted-foreground mt-1">cumul de tous les rapports</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Complétion moyenne</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{avgCompletion}%</p>
            <p className="text-xs text-muted-foreground mt-1">sur l’ensemble des sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Score moyen global</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-foreground">{avgScore}</p>
            <p className="text-xs text-muted-foreground mt-1">moyenne des scores moyens</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vue d’ensemble mensuelle</CardTitle>
            <CardDescription>Nombre de rapports générés par mois</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(reportsByMonth).length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(reportsByMonth).map(([month, count]) => (
                  <div key={month} className="flex items-center justify-between text-sm rounded-md border border-border px-3 py-2">
                    <span className="text-foreground font-medium">{month}</span>
                    <Badge variant="outline">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top sessions</CardTitle>
            <CardDescription>Meilleurs scores moyens</CardDescription>
          </CardHeader>
          <CardContent>
            {topSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune donnée.</p>
            ) : (
              <div className="space-y-2">
                {topSessions.map((report, idx) => (
                  <div key={report.id} className="rounded-md border border-border px-3 py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {idx + 1}. {report.sessionName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {report.data?.totalPlayers ?? 0} joueur(s) · complétion {report.data?.completionRate ?? 0}%
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800">{report.data?.averageScore ?? 0}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Rapports disponibles</CardTitle>
          <CardDescription>Liste de tous vos rapports générés</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun rapport généré pour l’instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-semibold text-foreground py-3 px-4">Session</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Type</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Joueurs</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Complétion</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Date de génération</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((report) => (
                    <tr key={report.id} className="border-b border-border hover:bg-muted/50 transition">
                      <td className="py-3 px-4 text-foreground font-medium">{report.sessionName}</td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">{report.type}</Badge>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {report.data?.totalPlayers ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        {report.data?.completionRate != null ? (
                          <span className={`font-medium ${
                            report.data.completionRate >= 80 ? "text-green-600" :
                            report.data.completionRate >= 50 ? "text-yellow-600" :
                            "text-red-600"
                          }`}>
                            {report.data.completionRate}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {report.generatedAt.toDate().toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-4 flex gap-2">
                        <Link href={`/app/reports/${report.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => downloadReportCsv(report)}
                          title="Telecharger le rapport CSV"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
