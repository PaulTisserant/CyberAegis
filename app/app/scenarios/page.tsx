"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Flag, RefreshCw } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { useScenarios } from "@/lib/hooks/useScenarios"
import { useInitializeData } from "@/lib/hooks/useInitializeData"
import ScenarioFlagsModal from "./ScenarioFlagsModal"
import { toast } from "sonner"
import { getAuth } from "firebase/auth"

export default function ScenariosPage() {
  const { user } = useAuth()
  const { initialized, error: initError } = useInitializeData()
  const { scenarios, loading, error } = useScenarios(user?.organizationId ?? "")
  const [flagsModal, setFlagsModal] = useState<{ id: string; name: string } | null>(null)
  const [syncing, setSyncing] = useState(false)

  const handleResync = async () => {
    if (!user?.organizationId) return
    setSyncing(true)
    try {
      const token = await getAuth().currentUser?.getIdToken()
      const res = await fetch("/api/proxmox/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ organizationId: user.organizationId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error(d.error ?? "Erreur de synchronisation")
      } else {
        toast.success("Synchronisation terminée")
      }
    } catch {
      toast.error("Impossible de contacter le serveur Proxmox")
    } finally {
      setSyncing(false)
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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Scénarios</h1>
          <p className="text-muted-foreground mt-1">
            Synchronisés depuis Proxmox · configurez les flags de chaque scénario
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleResync} disabled={syncing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchronisation..." : "Re-synchroniser Proxmox"}
        </Button>
      </div>

      {scenarios.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>Aucun scénario Proxmox disponible pour l instant.</p>
          <p className="text-sm mt-2">Vérifiez que le préfixe <code className="font-mono">PROXMOX_TEMPLATE_PREFIX</code> correspond aux noms de vos VMs.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scenarios.map((scenario) => {
            const flagCount = scenario.flags?.length ?? 0
            return (
              <Card key={scenario.id} className="hover:shadow-lg transition flex flex-col">
                <CardHeader>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{scenario.name}</CardTitle>
                    <CardDescription className="mt-1">{scenario.description}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge className={getDifficultyColor(scenario.difficulty)}>{scenario.difficulty}</Badge>
                    <span className="text-xs text-muted-foreground">{scenario.duration} min</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {scenario.tags.map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Flag className="h-3.5 w-3.5 text-muted-foreground" />
                    {flagCount === 0 ? (
                      <span className="text-orange-600 font-medium">Aucun flag configuré</span>
                    ) : (
                      <span className="text-green-700 font-medium">{flagCount} flag(s) configuré(s)</span>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button
                    variant={flagCount === 0 ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() => setFlagsModal({ id: scenario.id, name: scenario.name })}
                  >
                    <Flag className="h-4 w-4 mr-2" />
                    {flagCount === 0 ? "Configurer les flags" : "Modifier les flags"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      )}

      {flagsModal && (
        <ScenarioFlagsModal
          scenarioId={flagsModal.id}
          scenarioName={flagsModal.name}
          onClose={() => setFlagsModal(null)}
        />
      )}
    </div>
  )
}
