"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createSession } from "@/lib/firestore/sessions"
import { toast } from "sonner"
import type { Scenario } from "@/lib/types"

interface Props {
  open: boolean
  onClose: () => void
  organizationId: string
  createdBy: string
  scenarios: Scenario[]
}

export default function CreateSessionModal({ open, onClose, organizationId, createdBy, scenarios }: Props) {
  const [formData, setFormData] = useState({
    name: "",
    scenarioId: "",
    scenarioName: "",
    date: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleScenarioChange = (scenarioId: string) => {
    const scenario = scenarios.find((s) => s.id === scenarioId)
    setFormData({ ...formData, scenarioId, scenarioName: scenario?.name ?? "" })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.scenarioId) {
      toast.error("Veuillez sélectionner un scénario")
      return
    }
    setIsSubmitting(true)
    try {
      await createSession({
        name: formData.name,
        scenarioId: formData.scenarioId,
        scenarioName: formData.scenarioName,
        date: formData.date,
        status: "PLANNED",
        players: 1,
        organizationId,
        createdBy,
      })
      toast.success("Session créée avec succès")
      setFormData({ name: "", scenarioId: "", scenarioName: "", date: "" })
      onClose()
    } catch {
      toast.error("Erreur lors de la création de la session")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-md w-full">
        <div className="border-b border-border p-6">
          <h2 className="text-xl font-bold text-foreground">Créer une session</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nom de la session</label>
            <Input
              placeholder="Nom de la session"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Scénario</label>
            <Select value={formData.scenarioId} onValueChange={handleScenarioChange}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un scénario" />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.id}>
                    {scenario.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Date et heure</label>
            <Input
              type="datetime-local"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              required
            />
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Création..." : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
