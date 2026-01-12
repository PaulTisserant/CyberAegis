"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface AddUserModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    firstName: string
    lastName: string
    email: string
    position: string
    role: string
  }) => void
}

export default function AddUserModal({ isOpen, onClose, onSubmit }: AddUserModalProps) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    position: "",
    role: "PLAYER",
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
    setFormData({
      firstName: "",
      lastName: "",
      email: "",
      position: "",
      role: "PLAYER",
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-md w-full">
        <div className="border-b border-border p-6">
          <h2 className="text-xl font-bold text-foreground">Ajouter un utilisateur</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Prénom</label>
              <Input
                placeholder="Prénom"
                value={formData.firstName}
                onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nom</label>
              <Input
                placeholder="Nom"
                value={formData.lastName}
                onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Email</label>
            <Input
              type="email"
              placeholder="email@entreprise.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Poste</label>
            <Input
              placeholder="Poste ou fonction"
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Rôle</label>
            <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Administrateur</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="ANIMATOR">Animateur</SelectItem>
                <SelectItem value="PLAYER">Joueur</SelectItem>
                <SelectItem value="CISO">CISO</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1">
              Ajouter
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
