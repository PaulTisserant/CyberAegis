"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface CreateSessionModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    name: string
    scenario: string
    date: string
    difficulty: string
  }) => void
  scenarios: Array<{ id: string; name: string }>
}

export default function CreateSessionModal({ isOpen, onClose, onSubmit, scenarios }: CreateSessionModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    scenario: "",
    date: "",
    difficulty: "Standard",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    setFormData({ name: "", scenario: "", date: "", difficulty: "Standard" })
  }

  if (!isOpen) return null

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
            <Select value={formData.scenario} onValueChange={(value) => setFormData({ ...formData, scenario: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un scénario" />
              </SelectTrigger>
              <SelectContent>
                {scenarios.map((scenario) => (
                  <SelectItem key={scenario.id} value={scenario.name}>
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
                <SelectItem value="Standard">Standard</SelectItem>
                <SelectItem value="Avancé">Avancé</SelectItem>
              </SelectContent>
            </Select>
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
