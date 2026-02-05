"use client"

import { useState, useEffect, use } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Clock, CheckCircle2, AlertCircle } from "lucide-react"

export default function PlayerSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const [timeLeft, setTimeLeft] = useState(3600) // 1 hour in seconds
  const [completedObjectives, setCompletedObjectives] = useState<number[]>([])

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const objectives = [
    { id: 1, title: "Analyser les logs système", description: "Trouvez les logs suspectes" },
    { id: 2, title: "Identifier le malware", description: "Scannez et identifiez la menace" },
    { id: 3, title: "Isoler le système", description: "Déconnectez le système du réseau" },
    { id: 4, title: "Restaurer les données", description: "Restaurez depuis la dernière sauvegarde" },
  ]

  const toggleObjective = (id: number) => {
    setCompletedObjectives((prev) => (prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]))
  }

  const progressPercentage = (completedObjectives.length / objectives.length) * 100

  return (
    <div className="min-h-screen bg-background">
      {/* Top Bar */}
      <div className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Session Active</h1>
            <p className="text-sm text-muted-foreground">Scénario: Investigation Ransomware</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Temps restant</p>
              <p className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {formatTime(timeLeft)}
              </p>
            </div>
            <Button variant="destructive">Terminer la session</Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 p-6">
        {/* VM Console Area */}
        <div className="lg:col-span-3">
          <Card className="h-[600px] bg-black border-muted">
            <CardHeader className="border-b border-border">
              <CardTitle className="text-green-500 font-mono">console@escape-vm:~$</CardTitle>
            </CardHeader>
            <CardContent className="h-full flex items-center justify-center bg-black">
              <div className="text-center">
                <p className="text-green-500 font-mono mb-4">Connexion à la machine virtuelle...</p>
                <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-green-500 font-mono mt-4 text-sm">Chargement de l'environnement d'escape game</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Progression</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-sm font-medium text-foreground">Objectifs complétés</p>
                  <p className="text-sm text-primary font-bold">
                    {completedObjectives.length}/{objectives.length}
                  </p>
                </div>
                <Progress value={progressPercentage} className="h-2" />
              </div>
            </CardContent>
          </Card>

          {/* Briefing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Briefing</CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-3">
              <div>
                <p className="font-semibold text-foreground mb-2">Situation:</p>
                <p className="text-muted-foreground">
                  Une attaque par ransomware a été détectée. Vous devez enquêter et contenir la menace.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground mb-2">Objectif:</p>
                <p className="text-muted-foreground">
                  Complétez tous les objectifs pour réussir cette session d'escape game.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Objectives */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Objectifs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {objectives.map((obj) => {
                const isCompleted = completedObjectives.includes(obj.id)
                return (
                  <button
                    key={obj.id}
                    onClick={() => toggleObjective(obj.id)}
                    className={`w-full text-left p-3 rounded-lg border-2 transition ${
                      isCompleted
                        ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                        : "border-border hover:border-primary bg-muted/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                      )}
                      <div>
                        <p
                          className={`text-sm font-medium ${
                            isCompleted ? "text-green-700 dark:text-green-400" : "text-foreground"
                          }`}
                        >
                          {obj.title}
                        </p>
                        <p className="text-xs text-muted-foreground">{obj.description}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
