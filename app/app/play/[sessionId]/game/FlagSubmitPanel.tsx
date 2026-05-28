"use client"

import { useEffect, useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Check, Flag, Lock, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useAuth } from "@/lib/auth/AuthContext"
import { useSessionFlags, usePlayerInSession } from "@/lib/hooks/useSessionFlags"
import { FLAG_DIFFICULTY_BADGE } from "@/lib/flags-scoring"
import type { SubmittedFlag } from "@/lib/types"

const schema = z.object({
  flag: z.string().trim().min(1, "Saisis un flag").max(200, "Flag trop long"),
})
type FormData = z.infer<typeof schema>

interface Props {
  sessionId: string
  onCompleted?: (score: number) => void
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s === 0 ? `${m}min` : `${m}min ${s}s`
}

export default function FlagSubmitPanel({ sessionId, onCompleted }: Props) {
  const { user } = useAuth()
  const { flags, loading: flagsLoading, error: flagsError } = useSessionFlags(sessionId)
  const { player } = usePlayerInSession(sessionId, user?.uid ?? null)
  const [submitting, setSubmitting] = useState(false)
  const completedFiredRef = useRef(false)

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { flag: "" },
  })

  const submittedMap = new Map<string, SubmittedFlag>(
    (player?.submittedFlags ?? []).map((s) => [s.flagId, s])
  )
  const foundCount = submittedMap.size
  const totalCount = flags.length
  const progress = totalCount > 0 ? Math.round((foundCount / totalCount) * 100) : 0

  // Déclencher le callback onCompleted quand tous les flags sont trouvés
  useEffect(() => {
    if (
      !completedFiredRef.current &&
      totalCount > 0 &&
      foundCount >= totalCount &&
      onCompleted
    ) {
      completedFiredRef.current = true
      onCompleted(player?.score ?? 0)
    }
  }, [foundCount, totalCount, onCompleted, player?.score])

  const onSubmit = async (data: FormData) => {
    if (submitting) return
    setSubmitting(true)
    try {
      const { getAuth } = await import("firebase/auth")
      const token = await getAuth().currentUser?.getIdToken()
      if (!token) {
        toast.error("Session expirée, reconnecte-toi")
        return
      }
      const res = await fetch("/api/game/flag/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId, flag: data.flag }),
      })
      const json = await res.json()

      if (!res.ok) {
        toast.error(json.error ?? "Erreur lors de la soumission")
        return
      }
      if (json.invalid) {
        toast.error("Flag invalide. Continue à chercher !")
        return
      }
      if (json.alreadyFound) {
        toast.warning(`Déjà trouvé : ${json.flag?.label ?? ""}`)
        return
      }
      if (json.success) {
        toast.success(
          `+${json.flag.points} pts — ${json.flag.label} (${formatDuration(json.timeSincePrevious)})`
        )
        reset({ flag: "" })
        // Note: la modale de fin est déclenchée par l'effet useEffect ci-dessus (via player temps réel)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur réseau")
    } finally {
      setSubmitting(false)
      setFocus("flag")
    }
  }

  return (
    <aside className="w-full md:w-80 flex flex-col rounded-lg border border-border bg-card overflow-hidden shrink-0">
      {/* Header / score */}
      <div className="p-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-5 w-5 text-yellow-500" />
          <h2 className="text-base font-semibold text-foreground">Chasse aux flags</h2>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <div className="text-xs text-muted-foreground">Flags trouvés</div>
            <div className="font-mono text-base font-semibold text-foreground">
              {foundCount} / {totalCount}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Score</div>
            <div className="font-mono text-base font-semibold text-green-600">{player?.score ?? 0} pts</div>
          </div>
        </div>
        <Progress value={progress} className="mt-3 h-2" />
      </div>

      {/* Formulaire de soumission */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-4 border-b border-border space-y-2">
        <label className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
          <Flag className="h-3 w-3" /> Soumettre un flag
        </label>
        <Input
          {...register("flag")}
          placeholder="FLAG{...}"
          autoComplete="off"
          autoFocus
          disabled={submitting || flagsLoading}
          className="font-mono text-sm"
        />
        {errors.flag && (
          <p className="text-xs text-destructive">{errors.flag.message}</p>
        )}
        <Button
          type="submit"
          disabled={submitting || flagsLoading}
          className="w-full bg-green-600 hover:bg-green-700 text-white"
          size="sm"
        >
          {submitting ? "Vérification..." : "Soumettre"}
        </Button>
      </form>

      {/* Liste des flags */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {flagsError && <p className="text-xs text-destructive">{flagsError}</p>}
        {flagsLoading ? (
          <p className="text-xs text-muted-foreground">Chargement des flags...</p>
        ) : flags.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucun flag configuré pour ce scénario.</p>
        ) : (
          flags.map((f) => {
            const submitted = submittedMap.get(f.id)
            const found = !!submitted
            return (
              <div
                key={f.id}
                className={`rounded-md border p-2 text-sm transition-colors ${
                  found
                    ? "border-green-500/40 bg-green-50 dark:bg-green-950/30"
                    : "border-border bg-muted/30"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    {found ? (
                      <Check className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                    ) : (
                      <Lock className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">{f.label}</div>
                      {f.hint && !found && (
                        <div className="text-xs text-muted-foreground mt-0.5">{f.hint}</div>
                      )}
                      {found && submitted && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {formatDuration(submitted.timeSincePrevious)} · <span className="text-green-600 font-medium">+{submitted.points} pts</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge className={`shrink-0 text-xs ${FLAG_DIFFICULTY_BADGE[f.difficulty]}`}>
                    {f.difficulty}
                  </Badge>
                </div>
              </div>
            )
          })
        )}
      </div>
    </aside>
  )
}
