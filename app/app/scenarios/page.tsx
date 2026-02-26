"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Pencil, Trash2 } from "lucide-react"
import CreateScenarioModal from "./CreateScenarioModal"
import { useAuth } from "@/lib/auth/AuthContext"
import { useScenarios } from "@/lib/hooks/useScenarios"
import { deleteScenario } from "@/lib/firestore/scenarios"
import { toast } from "sonner"

export default function ScenariosPage() {
  const { user } = useAuth()
  const { scenarios, loading, error } = useScenarios(user?.organizationId ?? "")
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleDelete = async (id: string) => {
    try {
      await deleteScenario(id)
      toast.success("Scénario supprimé")
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Débutant": return "bg-green-100 text-green-800"
      case "Intermédiaire": return "bg-yellow-100 text-yellow-800"
      case "Avancé": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
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
          <h1 className="text-3xl font-bold text-foreground">Scénarios</h1>
          <p className="text-muted-foreground mt-1">Gérez vos scénarios d’escape game</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Créer un scénario
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Aucun scénario pour l’instant.</p>
          <Button className="mt-4" onClick={() => setIsModalOpen(true)}>Créer le premier scénario</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario) => (
            <Card key={scenario.id} className="hover:shadow-lg transition">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">{scenario.name}</CardTitle>
                    <CardDescription className="mt-1">{scenario.description}</CardDescription>
                  </div>
                  <Button
                    variant="ghost" size="sm"
                    className="text-destructive hover:bg-destructive/10 ml-2"
                    onClick={() => handleDelete(scenario.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={getDifficultyColor(scenario.difficulty)}>{scenario.difficulty}</Badge>
                  <span className="text-xs text-muted-foreground">{scenario.duration} min</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {scenario.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <CreateScenarioModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        organizationId={user?.organizationId ?? ""}
      />
    </div>
  )
}
