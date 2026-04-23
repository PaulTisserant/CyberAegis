"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useScenarios } from "@/lib/hooks/useScenarios"
import { useInitializeData } from "@/lib/hooks/useInitializeData"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"

/**
 * Page d'exemple : Lancer une partie d'escape game
 * Démontre l'utilisation de :
 * - useInitializeData() : initialise Proxmox + scénarios
 * - useScenarios() : récupère les scénarios disponibles
 * - API /api/game/start : lance une partie
 */
export default function PlayGamePage() {
  const router = useRouter()
  const { user } = useAuth()
  const { initialized } = useInitializeData()
  const { scenarios, loading, error } = useScenarios(user?.organizationId || "")
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  const handlePlayScenario = async (scenarioId: string) => {
    try {
      setLaunching(true)
      setLaunchError(null)

      // Récupérer le token JWT
      const token = await (
        await import("firebase/auth").then((m) => m.getAuth)
      )().currentUser?.getIdToken()

      if (!token) {
        setLaunchError("Pas d'authentification")
        return
      }

      // Appeler l'API pour démarrer la partie
      const response = await fetch("/api/game/start", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ scenarioId }),
      })

      if (!response.ok) {
        const data = await response.json()
        setLaunchError(data.error || "Erreur lors du lancement")
        return
      }

      const { sessionId } = await response.json()

      // Rediriger vers la page d'attente
      router.push(`/app/play/${sessionId}`)
    } catch (err: any) {
      setLaunchError(err.message || "Erreur serveur")
    } finally {
      setLaunching(false)
    }
  }

  if (!initialized) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Initialisation des données Proxmox...</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div>Chargement des scénarios...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-red-600 p-4">
        <strong>Erreur :</strong> {error}
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <h1 className="text-3xl font-bold mb-8">Escape Games Cybersécurité</h1>

      {launchError && (
        <div className="bg-red-100 text-red-800 p-4 rounded mb-4">{launchError}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {scenarios.map((scenario) => (
          <Card key={scenario.id} className="flex flex-col">
            <div className="p-6 flex-1 flex flex-col">
              <h3 className="text-xl font-bold mb-2">{scenario.name}</h3>
              <p className="text-gray-600 mb-4 flex-1">{scenario.description}</p>

              <div className="flex items-center gap-2 mb-4">
                <Badge
                  className={
                    scenario.difficulty === "Débutant"
                      ? "bg-green-100 text-green-800"
                      : scenario.difficulty === "Intermédiaire"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                  }
                >
                  {scenario.difficulty}
                </Badge>
                <span className="text-sm text-gray-500">{scenario.duration} min</span>
              </div>

              <div className="flex gap-2 flex-wrap mb-4">
                {scenario.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>

              <Button
                onClick={() => handlePlayScenario(scenario.id)}
                disabled={launching}
                className="w-full"
              >
                {launching ? "Lancement..." : "Jouer !"}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {scenarios.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">Aucun scénario disponible</p>
        </div>
      )}
    </div>
  )
}
