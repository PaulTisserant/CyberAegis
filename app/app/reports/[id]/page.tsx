"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { getReport } from "@/lib/firestore/reports"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { ArrowLeft, Download, Flag, Trophy, Users, Clock, Check, Lock, ChevronDown, ChevronUp } from "lucide-react"
import { use } from "react"
import Link from "next/link"
import type { Report, ReportFlagMeta, PlayerReportData } from "@/lib/types"
import { FLAG_DIFFICULTY_BADGE } from "@/lib/flags-scoring"
import { downloadReportCsv } from "@/lib/reports-export"

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}

function PlayerFlagTimeline({
  player,
  flags,
}: {
  player: PlayerReportData
  flags: ReportFlagMeta[]
}) {
  const [open, setOpen] = useState(false)
  const submittedMap = new Map(player.submittedFlags.map((sf) => [sf.flagId, sf]))

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Header joueur */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Trophy className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{player.displayName}</div>
            <div className="text-xs text-muted-foreground">
              {player.flagsFound}/{flags.length} flags · {player.score} pts · {formatDuration(player.durationSeconds)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-4">
          <Progress value={player.progress} className="w-24 h-1.5" />
          <span className="text-xs font-medium text-muted-foreground w-10 text-right">
            {player.progress}%
          </span>
          <Badge className={
            player.status === "FINISHED"
              ? "bg-green-100 text-green-800"
              : player.status === "PLAYING"
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-800"
          }>
            {player.status === "FINISHED" ? "Terminé" : player.status === "PLAYING" ? "En jeu" : "En attente"}
          </Badge>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Timeline des flags */}
      {open && (
        <div className="divide-y divide-border">
          {flags.map((flag, idx) => {
            const sf = submittedMap.get(flag.id)
            const found = !!sf
            return (
              <div
                key={flag.id}
                className={`flex items-center gap-4 px-4 py-3 text-sm ${
                  found ? "bg-green-50/50 dark:bg-green-950/20" : "bg-background"
                }`}
              >
                {/* Indicateur */}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  found ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                }`}>
                  {found ? <Check className="w-4 h-4" /> : <Lock className="w-3.5 h-3.5" />}
                </div>

                {/* Numéro */}
                <span className="text-xs text-muted-foreground font-mono w-5 shrink-0">
                  {String(idx + 1).padStart(2, "0")}
                </span>

                {/* Label */}
                <span className={`flex-1 font-medium ${found ? "text-foreground" : "text-muted-foreground"}`}>
                  {flag.label}
                </span>

                {/* Difficulté */}
                <Badge className={`text-xs shrink-0 ${FLAG_DIFFICULTY_BADGE[flag.difficulty]}`}>
                  {flag.difficulty}
                </Badge>

                {/* Points */}
                <span className={`text-xs font-mono w-16 text-right shrink-0 ${
                  found ? "text-green-600 font-semibold" : "text-muted-foreground"
                }`}>
                  {found ? `+${sf!.points} pts` : `${flag.points} pts`}
                </span>

                {/* Temps d'obtention */}
                <span className={`text-xs font-mono w-20 text-right shrink-0 ${
                  found ? "text-foreground" : "text-muted-foreground/40"
                }`}>
                  {found ? formatDuration(sf!.timeSincePrevious) : "—"}
                </span>
              </div>
            )
          })}

          {/* Total joueur */}
          <div className="flex items-center gap-4 px-4 py-3 bg-muted/20 text-sm font-semibold">
            <div className="w-7 shrink-0" />
            <span className="w-5 shrink-0" />
            <span className="flex-1 text-foreground">Total</span>
            <span className="w-24 shrink-0" />
            <span className="w-16 text-right font-mono text-green-600">{player.score} pts</span>
            <span className="w-20 text-right font-mono text-muted-foreground">{formatDuration(player.durationSeconds)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

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
  const flags: ReportFlagMeta[] = data.flags ?? []

  const scoreChartData = data.players.map((p) => ({
    name: p.displayName,
    score: p.score,
  }))

  const flagsChartData = flags.map((f) => {
    const foundBy = data.players.filter((p) =>
      p.submittedFlags.some((sf) => sf.flagId === f.id)
    ).length
    const avgTime =
      foundBy > 0
        ? Math.round(
            data.players
              .flatMap((p) => p.submittedFlags.filter((sf) => sf.flagId === f.id))
              .reduce((a, sf) => a + sf.timeSincePrevious, 0) / foundBy
          )
        : 0
    return {
      name: f.label.length > 20 ? f.label.slice(0, 18) + "…" : f.label,
      foundBy,
      avgTimeSec: avgTime,
    }
  })

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{report.sessionName}</h1>
          <p className="text-muted-foreground mt-2">
            Rapport généré le{" "}
            {report.generatedAt.toDate().toLocaleDateString("fr-FR", { dateStyle: "long" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" className="bg-transparent">
            <Link href="/app/reports">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Rapports
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-transparent"
            onClick={() => downloadReportCsv(report)}
            title="Telecharger le rapport CSV"
          >
            <Download className="h-4 w-4 mr-2" />
            CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" /> Complétion
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold text-primary">{data.completionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {data.players.filter((p) => p.status === "FINISHED").length} / {data.totalPlayers} joueurs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Durée moyenne
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold text-primary">{data.averageDuration}</p>
            <p className="text-xs text-muted-foreground mt-1">minutes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5" /> Score moyen
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold text-primary">{data.averageScore}</p>
            <p className="text-xs text-muted-foreground mt-1">sur {data.maxScore} pts max</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Flag className="h-3.5 w-3.5" /> Flags
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <p className="text-3xl font-bold text-primary">{data.totalFlags}</p>
            <p className="text-xs text-muted-foreground mt-1">à trouver dans ce scénario</p>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques */}
      {data.players.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Scores par joueur</CardTitle>
              <CardDescription>Score sur {data.maxScore} pts max</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={scoreChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, data.maxScore || "auto"]} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                    formatter={(v: number) => [`${v} pts`, "Score"]}
                  />
                  <Bar dataKey="score" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {flags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Popularité des flags</CardTitle>
                <CardDescription>Nombre de joueurs ayant trouvé chaque flag</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={flagsChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis allowDecimals={false} domain={[0, data.totalPlayers || 1]} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: "8px" }}
                      formatter={(v: number, name: string) =>
                        name === "foundBy"
                          ? [`${v} joueur(s)`, "Trouvé par"]
                          : [`${formatDuration(v)}`, "Temps moyen"]
                      }
                    />
                    <Bar dataKey="foundBy" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Timeline flags par joueur */}
      {flags.length > 0 && data.players.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Détail par joueur — flags & temps d&apos;obtention</CardTitle>
            <CardDescription>
              Cliquez sur un joueur pour voir sa progression flag par flag
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.players.map((p) => (
              <PlayerFlagTimeline key={p.userId} player={p} flags={flags} />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Tableau récapitulatif */}
      <Card>
        <CardHeader>
          <CardTitle>Classement final</CardTitle>
          <CardDescription>Résultats agrégés par joueur</CardDescription>
        </CardHeader>
        <CardContent>
          {data.players.length === 0 ? (
            <p className="text-muted-foreground text-center py-6">Aucun joueur enregistré.</p>
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
                  {data.players
                    .slice()
                    .sort((a, b) => b.score - a.score)
                    .map((p, i) => (
                      <tr key={p.userId} className="border-b border-border hover:bg-muted/50 transition">
                        <td className="py-3 px-4 text-muted-foreground font-mono font-bold">
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`}
                        </td>
                        <td className="py-3 px-4 font-medium">{p.displayName}</td>
                        <td className="py-3 px-4 font-mono">
                          <span className="font-bold">{p.score}</span>
                          {data.maxScore > 0 && (
                            <span className="text-muted-foreground text-xs ml-1">/ {data.maxScore}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono">
                          {p.flagsFound}
                          <span className="text-muted-foreground text-xs"> / {data.totalFlags}</span>
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

