"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from "lucide-react"
import AddUserModal from "./AddUserModal"
import { useAuth } from "@/lib/auth/AuthContext"
import { useUsers } from "@/lib/hooks/useUsers"
import { deactivateUser } from "@/lib/firestore/users"
import { toast } from "sonner"

export default function UsersPage() {
  const { user } = useAuth()
  const orgId = user?.organizationId ?? ""
  const { users, loading, error } = useUsers(orgId)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleDeactivate = async (uid: string) => {
    try {
      await deactivateUser(uid)
      toast.success("Utilisateur désactivé")
    } catch {
      toast.error("Erreur lors de la désactivation")
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "ADMIN": return "bg-red-100 text-red-800"
      case "MANAGER": return "bg-blue-100 text-blue-800"
      case "ANIMATOR": return "bg-purple-100 text-purple-800"
      case "PLAYER": return "bg-green-100 text-green-800"
      default: return "bg-gray-100 text-gray-800"
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "ADMIN": return "Administrateur"
      case "MANAGER": return "Manager"
      case "ANIMATOR": return "Animateur"
      case "PLAYER": return "Joueur"
      default: return role
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <span className="text-muted-foreground">Chargement...</span>
    </div>
  )
  if (error) return <div className="text-destructive">{error}</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">Gérez les utilisateurs de votre organisation</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Ajouter un utilisateur
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tous les utilisateurs</CardTitle>
          <CardDescription>Liste complète des utilisateurs de votre organisation</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Aucun utilisateur pour l’instant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left font-semibold text-foreground py-3 px-4">Prénom</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Nom</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Email</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Poste</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Rôle</th>
                    <th className="text-left font-semibold text-foreground py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b border-border hover:bg-muted/50 transition">
                      <td className="py-3 px-4 text-foreground font-medium">{u.firstName}</td>
                      <td className="py-3 px-4 text-foreground font-medium">{u.lastName}</td>
                      <td className="py-3 px-4 text-muted-foreground">{u.email}</td>
                      <td className="py-3 px-4 text-muted-foreground">{u.position}</td>
                      <td className="py-3 px-4">
                        <Badge className={getRoleColor(u.role)}>{getRoleLabel(u.role)}</Badge>
                      </td>
                      <td className="py-3 px-4">
                        {u.id !== user?.uid && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => handleDeactivate(u.id)}
                            className="text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <AddUserModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        organizationId={orgId}
      />
    </div>
  )
}
