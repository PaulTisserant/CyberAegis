"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CreateScenarioModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    name: string
    description: string
    difficulty: string
    tags: string[]
  }) => void
}

export default function CreateScenarioModal({ isOpen, onClose, onSubmit }: CreateScenarioModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    difficulty: "Débutant",
    tags: "",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: formData.name,
      description: formData.description,
      difficulty: formData.difficulty,
      tags: formData.tags.split(",").filter((t) => t.trim()),
    })
    setFormData({ name: "", description: "", difficulty: "Débutant", tags: "" })
  }

  if (!isOpen) return null

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
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Niveau de difficulté</label>
            <Select
              value={formData.difficulty}
              onValueChange={(value) => setFormData({ ...formData, difficulty: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Débutant">Débutant</SelectItem>
                <SelectItem value="Intermédiaire">Intermédiaire</SelectItem>
                <SelectItem value="Avancé">Avancé</SelectItem>
              </SelectContent>
            </Select>
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
            <Button type="submit" className="flex-1">
              Créer
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
