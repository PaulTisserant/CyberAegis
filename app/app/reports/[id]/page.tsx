"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockReports } from "@/lib/mock-data"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { Download } from "lucide-react"
import { use } from "react"

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const report = mockReports.find((r) => r.id === id)

  if (!report) {
    return <div className="text-center py-12">Rapport non trouvé</div>
  }

  const scoreData = [
    { name: "Analyse", score: 85 },
    { name: "Réactivité", score: 78 },
    { name: "Communication", score: 92 },
    { name: "Décision", score: 88 },
  ]

  const timelineData = [
    { time: "0:00", actions: 2 },
    { time: "5:00", actions: 5 },
    { time: "10:00", actions: 8 },
    { time: "15:00", actions: 12 },
    { time: "20:00", actions: 15 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{report.sessionName}</h1>
          <p className="text-muted-foreground mt-2">Rapport détaillé - {report.generatedAt}</p>
        </div>
        <Button>
          <Download className="h-4 w-4 mr-2" />
          Télécharger PDF
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Score global</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">85.7%</p>
            <p className="text-xs text-muted-foreground mt-1">Bon</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Temps de résolution</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">18:32</p>
            <p className="text-xs text-muted-foreground mt-1">minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Actions critiques</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">3</p>
            <p className="text-xs text-muted-foreground mt-1">erreurs identifiées</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Équipe</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">5</p>
            <p className="text-xs text-muted-foreground mt-1">participants</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Scores par compétence</CardTitle>
            <CardDescription>Évaluation des compétences acquises</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={scoreData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" stroke="var(--color-foreground)" />
                <YAxis stroke="var(--color-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: `1px solid var(--color-border)`,
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "var(--color-foreground)" }}
                />
                <Bar dataKey="score" fill="var(--color-primary)" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Chronologie des actions</CardTitle>
            <CardDescription>Nombre d'actions par intervalle</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timelineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="time" stroke="var(--color-foreground)" />
                <YAxis stroke="var(--color-foreground)" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: `1px solid var(--color-border)`,
                    borderRadius: "8px",
                  }}
                  labelStyle={{ color: "var(--color-foreground)" }}
                />
                <Line
                  type="monotone"
                  dataKey="actions"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-primary)", r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Findings */}
      <Card>
        <CardHeader>
          <CardTitle>Résultats détaillés</CardTitle>
          <CardDescription>Analyses et recommandations</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-start gap-3">
                <Badge className="bg-green-100 text-green-800 mt-1">Excellent</Badge>
                <div>
                  <p className="font-semibold text-foreground">Bonne analyse initiale</p>
                  <p className="text-sm text-muted-foreground">L'équipe a rapidement identifié le vecteur d'attaque.</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-start gap-3">
                <Badge className="bg-yellow-100 text-yellow-800 mt-1">À améliorer</Badge>
                <div>
                  <p className="font-semibold text-foreground">Communication entre les équipes</p>
                  <p className="text-sm text-muted-foreground">
                    La coordination aurait pu être améliorée lors de la phase d'isolation.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-3">
                <Badge className="bg-red-100 text-red-800 mt-1">Critique</Badge>
                <div>
                  <p className="font-semibold text-foreground">Erreur de restauration</p>
                  <p className="text-sm text-muted-foreground">
                    Une restauration partielle a été effectuée. Refaire la sauvegarde complète est recommandé.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
