"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/AuthContext"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useRouter } from "next/navigation"

/**
 * Page d'attente : Polling du statut de la VM
 * Affiche : Clonage → Démarrage → Prête !
 */
export default function WaitGamePage({ params }: { params: { sessionId: string } }) {
  const router = useRouter()
  const { user } = useAuth()
  const [status, setStatus] = useState<string>("cloning")
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uptime, setUptime] = useState<number>(0)
  const [elapsedTime, setElapsedTime] = useState<number>(0)

  // Polling du statut
  useEffect(() => {
    if (status === "running" && wsUrl) {
      // VM est prête, rediriger vers le lecteur VNC
      return
    }

    const pollStatus = async () => {
      try {
        const token = await (await import("firebase/auth").then((m) => m.getAuth))()
          .currentUser?.getIdToken()

        if (!token) {
          setError("Pas d'authentification")
          return
        }

        const response = await fetch(
          `/api/game/status?sessionId=${params.sessionId}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )

        if (!response.ok) {
          const data = await response.json()
          setError(data.error || "Erreur lors du polling")
          return
        }

        const data = await response.json()
        setStatus(data.status)
        if (data.wsUrl) setWsUrl(data.wsUrl)
        if (data.uptime !== undefined) setUptime(data.uptime)
        setError(null)
      } catch (err: any) {
        setError(err.message)
      }
    }

    // Poll toutes les 2 secondes
    const interval = setInterval(pollStatus, 2000)

    // Poll immédiatement
    pollStatus()

    return () => clearInterval(interval)
  }, [params.sessionId, status, wsUrl])

  // Increment elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime((t) => t + 1)
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Redirection quand prête
  useEffect(() => {
    if (status === "running" && wsUrl) {
      // Attendre 1s avant de rediriger
      const timeout = setTimeout(() => {
        router.push(`/app/play/${params.sessionId}/game`)
      }, 1000)
      return () => clearTimeout(timeout)
    }
  }, [status, wsUrl, params.sessionId, router])

  const getStatusMessage = () => {
    switch (status) {
      case "cloning":
        return "Clone de la VM en cours..."
      case "starting":
        return "Démarrage de la VM..."
      case "running":
        return "✓ VM prête ! Préparation du lecteur VNC..."
      case "error":
        return "Erreur lors de la préparation"
      default:
        return "Attente..."
    }
  }

  const getStatusColor = () => {
    switch (status) {
      case "running":
        return "text-green-600"
      case "error":
        return "text-red-600"
      default:
        return "text-yellow-600"
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Card className="w-full max-w-md p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-8">Préparation de la partie</h1>

          {/* Status Animation */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2 mb-4">
              {["cloning", "starting", "running"].map((step) => (
                <div key={step} className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                      status === step || status === "running"
                        ? "bg-blue-600 text-white"
                        : status > step
                          ? "bg-green-600 text-white"
                          : "bg-gray-300 text-gray-600"
                    }`}
                  >
                    {step === "cloning" ? "1" : step === "starting" ? "2" : "3"}
                  </div>
                  <span className="text-xs mt-2">
                    {step === "cloning" ? "Clone" : step === "starting" ? "Start" : "Ready"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Status Message */}
          <p className={`text-lg font-semibold mb-4 ${getStatusColor()}`}>
            {getStatusMessage()}
          </p>

          {/* Timers */}
          <div className="bg-gray-100 p-4 rounded mb-4 text-sm">
            <div className="flex justify-between mb-2">
              <span>Temps écoulé :</span>
              <span>{elapsedTime}s</span>
            </div>
            {uptime > 0 && (
              <div className="flex justify-between">
                <span>Uptime VM :</span>
                <span>{uptime}s</span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && <div className="text-red-600 text-sm mb-4">Erreur : {error}</div>}

          {/* Cancel Button */}
          {status !== "running" && (
            <Button
              variant="outline"
              onClick={() => router.back()}
              disabled={status === "running"}
            >
              Annuler
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
