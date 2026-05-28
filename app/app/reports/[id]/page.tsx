"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { getReport } from "@/lib/firestore/reports"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { ArrowLeft, Download, Flag, Trophy, Users, Clock } from "lucide-react"
import { use } from "react"
import Link from "next/link"
import type { Report } from "@/lib/types"

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getReport(id).then((r) => {
      setReport(r)
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="text-muted-foreground">Chargement...</span>
    </div>
  )
  if (!report) {
    return <div className="text-center py-12">Rapport non trouvé</div>
  }

  const { data } = report

  const scoreChartData = data.players.map((p) => ({
    name: p.displayName,
    score: p.score,
    max: data.maxScore,
  }))

  const flagsChartData = data.players.map((p) => ({
    name: p.displayName,
    flags: p.flagsFound,
    total: data.totalFlags,
  }))

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return s > 0 ? `${m}min ${s}s` : `${m}min`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{report.sessionName}</h1>
          <p className="text-muted-foreground mt-2">
            Rapport généré le {report.generatedAt.toDate().toLocaleDateString("fr-FR", {
              dateStyle: "long",
            })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="bg-transparent">
            <Link href="/app/reports">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Rapports
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="bg-transparent" disabled>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              Complétion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{data.completionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.players.filter((p) => p.status === "FINISHED").length} / {data.totalPlayers} joueurs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Durée moyenne
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{data.averageDuration}</p>
            <p className="text-xs text-muted-foreground mt-1">minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-muted-foreground" />
              Score moyen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{data.averageScore}</p>
            <p className="text-xs text-muted-foreground mt-1">sur {data.maxScore} pts max</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Flag className="h-4 w-4 text-muted-foreground" />
              Flags par scénario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{data.totalFlags}</p>
            <p className="text-xs text-muted-foreground mt-1">flags à trouver</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      {data.players.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Scores par joueur</CardTitle>
              <CardDescription>Comparaison des scores individuels</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={scoreChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-foreground)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--color-foreground)" domain={[0, data.maxScore || "auto"]} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "var(--color-foreground)" }}
                    formatter={(value: number) => [`${value} pts`, "Score"]}
                  />
                  <Bar dataKey="score" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Flags trouvés par joueur</CardTitle>
              <CardDescription>Nombre de flags découverts sur {data.totalFlags} total</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={flagsChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" stroke="var(--color-foreground)" tick={{ fontSize: 12 }} />
                  <YAxis stroke="var(--color-foreground)" domain={[0, data.totalFlags || "auto"]} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: "8px",
                    }}
                    labelStyle={{ color: "var(--color-foreground)" }}
                    formatter={(value: number) => [`${value} flag(s)`, "Flags trouvés"]}
                  />
                  <Bar dataKey="flags" fill="#22c55e" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Table joueurs */}
      <Card>
        <CardHeader>
          <CardTitle>Résultats détaillés par joueur</CardTitle>
          <CardDescription>Performance individuelle de chaque participant</CardDescription>
        </CardHeader>
        <CardContent>
          {data.players.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Aucun joueur enregistré pour cette session.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-semibold py-3 px-4">#</th>
                    <th className="text-left font-semibold py-3 px-4">Joueur</th>
                    <th className="text-left font-semibold py-3 px-4">Score</th>
                    <th className="text-left font-semibold py-3 px-4">Flags</th>
                    <th className="text-left font-semibold py-3 px-4">Durée</th>
                    <th className="text-left font-semibold py-3 px-4">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map((p, i) => (
                    <tr key={p.userId} className="border-b border-border hover:bg-muted/50 transition">
                      <td className="py-3 px-4 text-muted-foreground font-mono">{i + 1}</td>
                      <td className="py-3 px-4 font-medium">{p.displayName}</td>
                      <td className="py-3 px-4 font-mono">
                        <span className="font-bold">{p.score}</span>
                        {data.maxScore > 0 && (
                          <span className="text-muted-foreground text-xs ml-1">/ {data.maxScore}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono">
                        {p.flagsFound}
                        {data.totalFlags > 0 && (
                          <span className="text-muted-foreground text-xs"> / {data.totalFlags}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{formatDuration(p.durationSeconds)}</td>
                      <td className="py-3 px-4">
                        <Badge className={
                          p.status === "FINISHED"
                            ? "bg-green-100 text-green-800"
                            : p.status === "PLAYING"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
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
    </div>
  )
}

