import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockSessions } from "@/lib/mock-data"
import { Play, X } from "lucide-react"

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  const session = mockSessions.find((s) => s.id === params.id)

  if (!session) {
    return <div className="text-center py-12">Session non trouvée</div>
  }

  const participants = [
    { name: "Alice Dupont", poste: "Développeur", statut: "En attente" },
    { name: "Bob Martin", poste: "Responsable IT", statut: "Prêt" },
    { name: "Carol Bernard", poste: "Directrice", statut: "Prêt" },
  ]

  const objectives = [
    "Identifier le vecteur d'attaque",
    "Isoler le système",
    "Restaurer les données",
    "Documenter l'incident",
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">{session.name}</h1>
        <p className="text-muted-foreground mt-2">Détails de la session d'escape game</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Scénario</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground">{session.scenario}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground">{session.date}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Statut</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge
              className={`text-lg font-bold ${
                session.status === "RUNNING"
                  ? "bg-green-100 text-green-800"
                  : session.status === "PLANNED"
                    ? "bg-gray-100 text-gray-800"
                    : "bg-red-100 text-red-800"
              }`}
            >
              {session.status === "RUNNING" ? "En cours" : session.status === "PLANNED" ? "Planifiée" : "Terminée"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Joueurs</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-foreground">{session.players}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Participants</CardTitle>
          <CardDescription>Liste des participants à cette session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left font-semibold text-foreground py-3 px-4">Nom</th>
                  <th className="text-left font-semibold text-foreground py-3 px-4">Poste</th>
                  <th className="text-left font-semibold text-foreground py-3 px-4">Statut</th>
                </tr>
              </thead>
              <tbody>
                {participants.map((participant) => (
                  <tr key={participant.name} className="border-b border-border hover:bg-muted/50 transition">
                    <td className="py-3 px-4 text-foreground font-medium">{participant.name}</td>
                    <td className="py-3 px-4 text-muted-foreground">{participant.poste}</td>
                    <td className="py-3 px-4">
                      <Badge className="bg-blue-100 text-blue-800">{participant.statut}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Objectifs</CardTitle>
          <CardDescription>Étapes à accomplir lors de la session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {objectives.map((objective, index) => (
              <div key={index} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <input type="checkbox" className="h-4 w-4 rounded" />
                <span className="text-foreground">{objective}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        {session.status === "PLANNED" && (
          <Button className="flex-1" size="lg">
            <Play className="h-4 w-4 mr-2" />
            Démarrer la session
          </Button>
        )}
        {session.status === "RUNNING" && (
          <Button variant="destructive" className="flex-1" size="lg">
            <X className="h-4 w-4 mr-2" />
            Arrêter la session
          </Button>
        )}
      </div>
    </div>
  )
}
