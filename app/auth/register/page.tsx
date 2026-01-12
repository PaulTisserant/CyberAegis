"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

export default function RegisterPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    companyName: "",
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
      alert("Les mots de passe ne correspondent pas")
      return
    }
    setIsLoading(true)
    // Mock registration - redirect to dashboard after a short delay
    setTimeout(() => {
      router.push("/app")
      setIsLoading(false)
    }, 800)
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Créer un compte</CardTitle>
        <CardDescription>Inscrivez votre entreprise pour accéder à SecureGame</CardDescription>
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
            {isLoading ? "Création..." : "S'inscrire"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground text-center mt-6">
          Vous avez déjà un compte ?{" "}
          <Link href="/auth/login" className="text-primary hover:underline font-medium">
            Se connecter
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
