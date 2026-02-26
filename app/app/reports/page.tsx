"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Download, Eye } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useReports } from "@/lib/hooks/useReports"

export default function ReportsPage() {
  const { user } = useAuth()
  const { reports, loading, error } = useReports(user?.organizationId ?? "")

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
                        {report.generatedAt.toDate().toLocaleDateString("fr-FR")}
                      </td>
                      <td className="py-3 px-4 flex gap-2">
                        <Link href={`/app/reports/${report.id}`}>
                          <Button variant="ghost" size="sm"><Eye className="h-4 w-4" /></Button>
                        </Link>
                        <Button variant="ghost" size="sm">
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
