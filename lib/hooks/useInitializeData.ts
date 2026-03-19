"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/AuthContext"
import { toast } from "sonner"

/**
 * Hook pour initialiser les données codées en dur (Proxmox + scénarios)
 * À appeler une seule fois au démarrage, quand l'utilisateur est authentifié
 */
export function useInitializeData() {
  const { user } = useAuth()
  const [initialized, setInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!user?.organizationId || initialized) return

    ;(async () => {
      try {
        console.log("[useInitializeData] Synchronisation Proxmox...")

        const token = await (await import("firebase/auth").then((m) => m.getAuth))()
          .currentUser?.getIdToken()

        const response = await fetch("/api/proxmox/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ organizationId: user.organizationId }),
        })

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: "Erreur inconnue" }))
          if (data?.errorType === "PROXMOX_CONNECTION") {
            toast.error("Connexion Proxmox indisponible. Vérifiez le serveur ou le réseau.")
          }
          throw new Error(data.error ?? "Erreur de synchronisation Proxmox")
        }

        setInitialized(true)
        console.log("[useInitializeData] Done ✓")
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        console.error("[useInitializeData] Error :", error)
        setError(error)
      }
    })()
  }, [user?.organizationId, initialized])

  return { initialized, error }
}
