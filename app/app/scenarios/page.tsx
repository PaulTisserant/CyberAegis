"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockScenarios } from "@/lib/mock-data"
import { Plus } from "lucide-react"
import CreateScenarioModal from "./CreateScenarioModal"

export default function ScenariosPage() {
  const [scenarios, setScenarios] = useState(mockScenarios)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleCreateScenario = (newScenario: {
    name: string
    description: string
    difficulty: string
    tags: string[]
  }) => {
    const scenario = {
      id: String(scenarios.length + 1),
      ...newScenario,
    }
    setScenarios([...scenarios, scenario])
    setIsModalOpen(false)
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Débutant":
        return "bg-green-100 text-green-800"
      case "Intermédiaire":
        return "bg-yellow-100 text-yellow-800"
      case "Avancé":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scénarios</h1>
          <p className="text-muted-foreground mt-1">Gérez vos scénarios d'escape game</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Créer un scénario
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenarios.map((scenario) => (
          <Card key={scenario.id} className="hover:shadow-lg transition">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{scenario.name}</CardTitle>
                  <CardDescription className="mt-1">{scenario.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Badge className={`${getDifficultyColor(scenario.difficulty)}`}>{scenario.difficulty}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {scenario.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
              <Button variant="outline" className="w-full bg-transparent">
                Voir détails
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <CreateScenarioModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleCreateScenario} />
    </div>
  )
}
