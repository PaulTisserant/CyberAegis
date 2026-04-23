"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth/AuthContext"
import { useScenarios } from "@/lib/hooks/useScenarios"
import { useInitializeData } from "@/lib/hooks/useInitializeData"

export default function ScenariosPage() {
  const { user } = useAuth()
  const { initialized, error: initError } = useInitializeData()
  const { scenarios, loading, error } = useScenarios(user?.organizationId ?? "")

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Débutant": return "bg-green-100 text-green-800"
      case "Intermédiaire": return "bg-yellow-100 text-yellow-800"
      case "Avancé": return "bg-red-100 text-red-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  if (initError) return <div className="text-destructive">{initError.message}</div>

  if (!initialized) return (
    <div className="flex items-center justify-center h-64">
      <span className="text-muted-foreground">Synchronisation des templates Proxmox...</span>
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="text-muted-foreground">Chargement...</span>
    </div>
  )
  if (error) return <div className="text-destructive">{error}</div>

  return (
    <div className="space-y-6">
      <div>
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scénarios</h1>
          <p className="text-muted-foreground mt-1">
            Scénarios synchronisés automatiquement depuis Proxmox (lecture seule)
          </p>
        </div>
      </div>

      {scenarios.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Aucun scénario Proxmox disponible pour l’instant.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario) => (
            <Card key={scenario.id} className="hover:shadow-lg transition">
              <CardHeader>
                <div className="flex-1">
                  <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  <CardDescription className="mt-1">{scenario.description}</CardDescription>
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
    </div>
  )
}
