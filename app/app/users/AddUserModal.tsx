"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { doc, setDoc, Timestamp } from "firebase/firestore"
import { initializeApp, deleteApp } from "firebase/app"
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth"
import { db, firebaseConfig } from "@/lib/firebase"
import { toast } from "sonner"
import type { UserRole } from "@/lib/types"

interface Props {
  open: boolean
  onClose: () => void
  organizationId: string
}

export default function AddUserModal({ open, onClose, organizationId }: Props) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    position: "",
    role: "PLAYER" as UserRole,
    password: "",
    confirmPassword: "",
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractÃ¨res")
      return
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }
    setIsSubmitting(true)
    // App Firebase secondaire pour crÃ©er le compte sans dÃ©connecter l'admin
    const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`)
    try {
      const secondaryAuth = getAuth(secondaryApp)
      const { user: newUser } = await createUserWithEmailAndPassword(
        secondaryAuth,
        formData.email,
        formData.password
      )
      await setDoc(doc(db, "users", newUser.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        position: formData.position,
        role: formData.role,
        organizationId,
        createdAt: Timestamp.now(),
        isActive: true,
      })
      toast.success(`Compte crÃ©Ã© pour ${formData.firstName} ${formData.lastName}`)
      setFormData({ firstName: "", lastName: "", email: "", position: "", role: "PLAYER", password: "", confirmPassword: "" })
      onClose()
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === "auth/email-already-in-use") {
        toast.error("Cet email est dÃ©jÃ  utilisÃ©")
      } else {
        toast.error("Erreur lors de la crÃ©ation du compte")
      }
    } finally {
      await deleteApp(secondaryApp).catch(() => null)
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-border p-6">
          <h2 className="text-xl font-bold text-foreground">Ajouter un utilisateur</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">PrÃ©nom</label>
              <Input
                placeholder="PrÃ©nom"
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
            <label className="text-sm font-medium text-foreground">RÃ´le</label>
            <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v as UserRole })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">Administrateur</SelectItem>
                <SelectItem value="MANAGER">Manager</SelectItem>
                <SelectItem value="ANIMATOR">Animateur</SelectItem>
                <SelectItem value="PLAYER">Joueur</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="border-t border-border pt-4 space-y-4">
            <p className="text-sm font-medium text-foreground">Mot de passe initial</p>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Mot de passe</label>
              <Input
                type="password"
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Confirmer le mot de passe</label>
              <Input
                type="password"
                placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "CrÃ©ation..." : "CrÃ©er le compte"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
