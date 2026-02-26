"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/auth/AuthContext"
import { updateUser } from "@/lib/firestore/users"
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  verifyBeforeUpdateEmail,
  sendEmailVerification,
} from "firebase/auth"
import { auth } from "@/lib/firebase"
import { toast } from "sonner"
import { User, Lock, Shield, Mail } from "lucide-react"

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrateur",
  MANAGER: "Manager",
  ANIMATOR: "Animateur",
  PLAYER: "Joueur",
}

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-800",
  MANAGER: "bg-blue-100 text-blue-800",
  ANIMATOR: "bg-purple-100 text-purple-800",
  PLAYER: "bg-green-100 text-green-800",
}

export default function ProfilePage() {
  const { user } = useAuth()

  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    position: user?.position ?? "",
  })
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })
  const [isSavingPassword, setIsSavingPassword] = useState(false)

  const [emailForm, setEmailForm] = useState({
    newEmail: "",
    currentPassword: "",
  })
  const [isSavingEmail, setIsSavingEmail] = useState(false)
  const [isSendingVerification, setIsSendingVerification] = useState(false)

  const handleResendVerification = async () => {
    const fbUser = auth.currentUser
    if (!fbUser) return
    setIsSendingVerification(true)
    try {
      await sendEmailVerification(fbUser)
      toast.success("Email de vérification envoyé, vérifiez votre boîte mail")
    } catch {
      toast.error("Erreur lors de l'envoi de l'email de vérification")
    } finally {
      setIsSendingVerification(false)
    }
  }

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSavingEmail(true)
    try {
      const fbUser = auth.currentUser
      if (!fbUser || !fbUser.email) throw new Error("Non connecté")

      const credential = EmailAuthProvider.credential(fbUser.email, emailForm.currentPassword)
      await reauthenticateWithCredential(fbUser, credential)
      await verifyBeforeUpdateEmail(fbUser, emailForm.newEmail)

      toast.success("Un email de confirmation a été envoyé à la nouvelle adresse. L'email sera mis à jour après validation.")
      setEmailForm({ newEmail: "", currentPassword: "" })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        toast.error("Mot de passe actuel incorrect")
      } else if (code === "auth/email-already-in-use") {
        toast.error("Cet email est déjà utilisé par un autre compte")
      } else if (code === "auth/invalid-email") {
        toast.error("Adresse email invalide")
      } else {
        toast.error("Erreur lors du changement d'email")
      }
    } finally {
      setIsSavingEmail(false)
    }
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setIsSavingProfile(true)
    try {
      await updateUser(user.uid, {
        firstName: profileForm.firstName,
        lastName: profileForm.lastName,
        position: profileForm.position,
      })
      toast.success("Profil mis à jour")
    } catch {
      toast.error("Erreur lors de la mise à jour du profil")
    } finally {
      setIsSavingProfile(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    if (passwordForm.newPassword.length < 6) {
      toast.error("Le nouveau mot de passe doit contenir au moins 6 caractères")
      return
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas")
      return
    }
    setIsSavingPassword(true)
    try {
      const fbUser = auth.currentUser
      if (!fbUser || !fbUser.email) throw new Error("Non connecté")

      // Réauthentification obligatoire avant de changer le mot de passe
      const credential = EmailAuthProvider.credential(fbUser.email, passwordForm.currentPassword)
      await reauthenticateWithCredential(fbUser, credential)
      await updatePassword(fbUser, passwordForm.newPassword)

      toast.success("Mot de passe modifié avec succès")
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" })
    } catch (err: unknown) {
      const code = (err as { code?: string }).code
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        toast.error("Mot de passe actuel incorrect")
      } else if (code === "auth/too-many-requests") {
        toast.error("Trop de tentatives, réessayez plus tard")
      } else {
        toast.error("Erreur lors du changement de mot de passe")
      }
    } finally {
      setIsSavingPassword(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Mon profil</h1>
        <p className="text-muted-foreground mt-1">Gérez vos informations personnelles et votre sécurité</p>
      </div>

      {/* Carte identité */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold">
              {user.firstName.charAt(0)}{user.lastName.charAt(0)}
            </div>
            <div>
              <CardTitle>{user.firstName} {user.lastName}</CardTitle>
              <CardDescription>{user.email}</CardDescription>
              <Badge className={`mt-1 ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-800"}`}>
                <Shield className="h-3 w-3 mr-1" />
                {ROLE_LABELS[user.role] ?? user.role}
              </Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Informations personnelles */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Informations personnelles
          </CardTitle>
          <CardDescription>Modifiez vos informations de profil</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Prénom</label>
                <Input
                  value={profileForm.firstName}
                  onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Nom</label>
                <Input
                  value={profileForm.lastName}
                  onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="flex items-center gap-2">
                <Input value={user.email} disabled className="opacity-60" />
                {auth.currentUser?.emailVerified ? (
                  <span className="text-xs text-green-600 font-medium whitespace-nowrap">✓ Vérifié</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={isSendingVerification}
                    className="text-xs text-primary hover:underline whitespace-nowrap disabled:opacity-50"
                  >
                    {isSendingVerification ? "Envoi..." : "Vérifier l'email"}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Poste / Fonction</label>
              <Input
                placeholder="Ex : Responsable IT"
                value={profileForm.position}
                onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSavingProfile}>
                {isSavingProfile ? "Enregistrement..." : "Enregistrer les modifications"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Modifier l'adresse email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Modifier l'adresse email
          </CardTitle>
          <CardDescription>Un email de confirmation sera envoyé à la nouvelle adresse avant la mise à jour</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangeEmail} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nouvelle adresse email</label>
              <Input
                type="email"
                placeholder="nouveau@email.com"
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Mot de passe actuel (confirmation)</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={emailForm.currentPassword}
                onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSavingEmail}>
                {isSavingEmail ? "Envoi..." : "Modifier l'email"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Changer le mot de passe */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Changer le mot de passe
          </CardTitle>
          <CardDescription>Utilisez un mot de passe fort d'au moins 6 caractères</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Mot de passe actuel</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nouveau mot de passe</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Confirmer le nouveau mot de passe</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isSavingPassword}>
                {isSavingPassword ? "Modification..." : "Changer le mot de passe"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
