"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createScenario } from "@/lib/firestore/scenarios"
import { toast } from "sonner"
import type { Difficulty } from "@/lib/types"

interface Props {
  open: boolean
  onClose: () => void
  organizationId: string
}

export default function CreateScenarioModal({ open, onClose, organizationId }: Props) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    difficulty: "Débutant" as Difficulty,
    tags: "",
    duration: 60,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await createScenario({
        name: formData.name,
        description: formData.description,
        difficulty: formData.difficulty,
        tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
        duration: formData.duration,
        organizationId,
        isActive: true,
      })
      toast.success("Scénario créé avec succès")
      setFormData({ name: "", description: "", difficulty: "Débutant", tags: "", duration: 60 })
      onClose()
    } catch {
      toast.error("Erreur lors de la création du scénario")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-md w-full">
        <div className="border-b border-border p-6">
          <h2 className="text-xl font-bold text-foreground">Créer un scénario</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nom</label>
            <Input
              placeholder="Nom du scénario"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              placeholder="Description du scénario"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Difficulté</label>
              <Select
                value={formData.difficulty}
                onValueChange={(v) => setFormData({ ...formData, difficulty: v as Difficulty })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Débutant">Débutant</SelectItem>
                  <SelectItem value="Intermédiaire">Intermédiaire</SelectItem>
                  <SelectItem value="Avancé">Avancé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Durée (min)</label>
              <Input
                type="number"
                min={5}
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tags (séparés par des virgules)</label>
            <Input
              placeholder="Phishing, Sécurité, Formation"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
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
