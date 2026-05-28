"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Menu, X, LogOut, Settings, User } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthContext"
import { toast } from "sonner"

const navigation = [
  { name: "Dashboard", href: "/app" },
  { name: "Sessions", href: "/app/sessions" },
  { name: "Scénarios", href: "/app/scenarios" },
  { name: "Infrastructure VM", href: "/app/proxmox" },
  { name: "Utilisateurs", href: "/app/users" },
  { name: "Rapports", href: "/app/reports" },
]

export default function AppLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const handleLogout = async () => {
    try {
      await signOut()
      router.push("/")
    } catch {
      toast.error("Erreur lors de la déconnexion")
    }
  }

  const initials = user
    ? `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase()
    : "?"

  const displayName = user ? `${user.firstName} ${user.lastName}` : ""
  const orgName = "CyberAegis"

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 border-r border-border bg-card transition-all duration-300 ${
          sidebarOpen ? "w-64" : "w-20"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4 border-b border-border">
          {sidebarOpen && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                CA
              </div>
              <span className="font-bold text-foreground">CyberAegis</span>
            </div>
          )}
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1 rounded-lg hover:bg-muted transition">
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        <nav className="space-y-2 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-2 rounded-lg transition ${
                  isActive ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
                } ${!sidebarOpen && "px-2 text-center"}`}
                title={!sidebarOpen ? item.name : ""}
              >
                {sidebarOpen ? item.name : item.name.charAt(0)}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className={`transition-all duration-300 ${sidebarOpen ? "ml-64" : "ml-20"}`}>
        {/* Top Bar */}
        <header className="border-b border-border bg-card sticky top-0 z-40">
          <div className="flex h-16 items-center justify-between px-6">
            <h1 className="text-xl font-bold text-foreground">{orgName}</h1>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-full gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-medium text-sm">
                    {initials}
                  </div>
                  {sidebarOpen && <span className="text-sm hidden md:block">{displayName}</span>}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href="/app/profile" className="flex items-center gap-2 cursor-pointer">
                    <User className="h-4 w-4" />
                    Mon profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/app/profile" className="flex items-center gap-2 cursor-pointer">
                    <Settings className="h-4 w-4" />
                    Paramètres
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="flex items-center gap-2 text-destructive" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
