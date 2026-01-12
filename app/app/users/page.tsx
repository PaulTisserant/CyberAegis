"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { mockUsers } from "@/lib/mock-data"
import { Plus, Trash2 } from "lucide-react"
import AddUserModal from "./AddUserModal"

export default function UsersPage() {
  const [users, setUsers] = useState(mockUsers)
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleAddUser = (newUser: {
    firstName: string
    lastName: string
    email: string
    position: string
    role: string
  }) => {
    const user = {
      id: String(users.length + 1),
      ...newUser,
    }
    setUsers([...users, user])
    setIsModalOpen(false)
  }

  const handleDeleteUser = (id: string) => {
    setUsers(users.filter((u) => u.id !== id))
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "bg-red-100 text-red-800"
      case "MANAGER":
        return "bg-blue-100 text-blue-800"
      case "ANIMATOR":
        return "bg-purple-100 text-purple-800"
      case "PLAYER":
        return "bg-green-100 text-green-800"
      case "CISO":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "ADMIN":
        return "Administrateur"
      case "MANAGER":
        return "Manager"
      case "ANIMATOR":
        return "Animateur"
      case "PLAYER":
        return "Joueur"
      case "CISO":
        return "CISO"
      default:
        return role
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Utilisateurs</h1>
          <p className="text-muted-foreground mt-1">Gérez les utilisateurs de votre compte</p>
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
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border hover:bg-muted/50 transition">
                    <td className="py-3 px-4 text-foreground font-medium">{user.firstName}</td>
                    <td className="py-3 px-4 text-foreground font-medium">{user.lastName}</td>
                    <td className="py-3 px-4 text-muted-foreground">{user.email}</td>
                    <td className="py-3 px-4 text-muted-foreground">{user.position}</td>
                    <td className="py-3 px-4">
                      <Badge className={`${getRoleColor(user.role)}`}>{getRoleLabel(user.role)}</Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteUser(user.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AddUserModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSubmit={handleAddUser} />
    </div>
  )
}
