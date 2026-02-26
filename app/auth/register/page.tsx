"use client"

import type React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth"
import { doc, setDoc, addDoc, collection, Timestamp } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { toast } from "sonner"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    companyName: "",
    firstName: "",
    lastName: "",
    adminEmail: "",
    password: "",
    confirmPassword: "",
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.password !== formData.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }
    if (formData.password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères")
      return
    }
    setIsLoading(true)
    try {
      // 1. Créer l'organisation
      const orgRef = await addDoc(collection(db, "organizations"), {
        name: formData.companyName,
        plan: "starter",
        maxUsers: 10,
        maxSessions: 5,
        createdAt: Timestamp.now(),
        isActive: true,
      })

      // 2. Créer le compte Firebase Auth
      const { user: fbUser } = await createUserWithEmailAndPassword(
        auth,
        formData.adminEmail,
        formData.password
      )

      // 3. Créer le document utilisateur dans Firestore
      await setDoc(doc(db, "users", fbUser.uid), {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.adminEmail,
        position: "Administrateur",
        role: "ADMIN",
        organizationId: orgRef.id,
        createdAt: Timestamp.now(),
        isActive: true,
      })

      // 4. Créer le cookie de session httpOnly avec le JWT Firebase
      const idToken = await fbUser.getIdToken()
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })

      await sendEmailVerification(fbUser)
      toast.success("Compte créé ! Un email de vérification a été envoyé.")
      router.push("/app")
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === "auth/email-already-in-use") {
        toast.error("Cet email est déjà utilisé")
      } else if (code === "auth/invalid-email") {
        toast.error("Email invalide")
      } else if (code === "auth/weak-password") {
        toast.error("Mot de passe trop faible (min. 6 caractères)")
      } else {
        toast.error("Erreur lors de la création du compte")
        console.error(err)
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Créer un compte</CardTitle>
        <CardDescription>Inscrivez votre entreprise pour accéder à CyberAegis</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="companyName" className="text-sm font-medium text-foreground">
              Nom de l'entreprise
            </label>
            <Input
              id="companyName"
              name="companyName"
              placeholder="Votre entreprise"
              value={formData.companyName}
              onChange={handleChange}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="firstName" className="text-sm font-medium text-foreground">
                Prénom
              </label>
              <Input
                id="firstName"
                name="firstName"
                placeholder="Jean"
                value={formData.firstName}
                onChange={handleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="lastName" className="text-sm font-medium text-foreground">
                Nom
              </label>
              <Input
                id="lastName"
                name="lastName"
                placeholder="Dupont"
                value={formData.lastName}
                onChange={handleChange}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="adminEmail" className="text-sm font-medium text-foreground">
              Email administrateur
            </label>
            <Input
              id="adminEmail"
              name="adminEmail"
              type="email"
              placeholder="admin@entreprise.com"
              value={formData.adminEmail}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Mot de passe
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              Confirmer le mot de passe
            </label>
            <Input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Création du compte..." : "Créer mon compte"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground text-center mt-6">
          Déjà un compte ?{" "}
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
