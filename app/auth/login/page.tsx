"use client"

import type React from "react"
import { Suspense } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { toast } from "sonner"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Entrez votre email pour réinitialiser le mot de passe")
      return
    }
    setIsResetting(true)
    try {
      await sendPasswordResetEmail(auth, email)
      toast.success("Email de réinitialisation envoyé, vérifiez votre boîte mail")
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === "auth/user-not-found") {
        toast.error("Aucun compte associé à cet email")
      } else {
        toast.error("Erreur lors de l'envoi de l'email")
      }
    } finally {
      setIsResetting(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const idToken = await credential.user.getIdToken()
      await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      })
      toast.success("Connexion réussie")
      const redirect = searchParams.get("redirect") ?? "/app"
      router.push(redirect)
    } catch (err: unknown) {
      await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null)
      const code = (err as { code?: string }).code
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        toast.error("Email ou mot de passe incorrect")
      } else if (code === "auth/too-many-requests") {
        toast.error("Trop de tentatives, réessayez plus tard")
      } else {
        toast.error("Erreur de connexion")
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Se connecter</CardTitle>
        <CardDescription>Entrez vos identifiants pour accéder à votre compte</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <Input
              id="email"
              type="email"
              placeholder="nom@entreprise.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Mot de passe
              </label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={isResetting}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {isResetting ? "Envoi..." : "Mot de passe oublié ?"}
              </button>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>
        <p className="text-sm text-muted-foreground text-center mt-6">
          Pas de compte ?{" "}
          <Link href="/auth/register" className="text-primary hover:underline font-medium">
            S'inscrire
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
