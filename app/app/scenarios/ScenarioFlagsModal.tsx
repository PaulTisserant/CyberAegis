"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, X, Flag } from "lucide-react"
import { toast } from "sonner"
import { setScenarioFlags, getScenario } from "@/lib/firestore/scenarios"
import { FLAG_DIFFICULTIES, FLAG_DIFFICULTY_BADGE, computeFlagScore } from "@/lib/flags-scoring"
import type { FlagDifficulty, ScenarioFlag } from "@/lib/types"

interface FlagRow {
  id: string
  label: string
  value: string
  difficulty: FlagDifficulty
  hint: string
}

function toRows(flags: ScenarioFlag[]): FlagRow[] {
  return flags
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((f) => ({
      id: f.id,
      label: f.label,
      value: f.value,
      difficulty: f.difficulty,
      hint: f.hint ?? "",
    }))
}

interface Props {
  scenarioId: string
  scenarioName: string
  onClose: () => void
}

export default function ScenarioFlagsModal({ scenarioId, scenarioName, onClose }: Props) {
  const [flags, setFlags] = useState<FlagRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Charger les flags existants
  useEffect(() => {
    getScenario(scenarioId).then((sc) => {
      if (sc?.flags) setFlags(toRows(sc.flags))
      setLoading(false)
    })
  }, [scenarioId])

  const addFlag = () => {
    setFlags((f) => [
      ...f,
      {
        id: `flag_${f.length + 1}`,
        label: "",
        value: "",
        difficulty: "Facile",
        hint: "",
      },
    ])
  }

  const removeFlag = (idx: number) => setFlags((f) => f.filter((_, i) => i !== idx))

  const updateFlag = (idx: number, patch: Partial<FlagRow>) =>
    setFlags((f) => f.map((row, i) => (i === idx ? { ...row, ...patch } : row)))

  const totalMaxPoints = flags.reduce(
    (acc, f) => acc + computeFlagScore(f.difficulty).points,
    0
  )

  const validate = (): string | null => {
    const ids = new Set<string>()
    for (const f of flags) {
      if (!f.id.trim()) return "Chaque flag doit avoir un identifiant"
      if (ids.has(f.id.trim())) return `Identifiant dupliqué : ${f.id}`
      ids.add(f.id.trim())
      if (!f.label.trim()) return `Libellé manquant pour ${f.id}`
      if (!f.value.trim()) return `Valeur manquante pour ${f.id}`
    }
    return null
  }

  const handleSave = async () => {
    const err = validate()
    if (err) {
      toast.error(err)
      return
    }
    setSaving(true)
    try {
      await setScenarioFlags(
        scenarioId,
        flags.map((f, i) => ({
          id: f.id.trim(),
          label: f.label.trim(),
          value: f.value.trim(),
          difficulty: f.difficulty,
          hint: f.hint.trim() || undefined,
          order: i,
        }))
      )
      toast.success("Flags enregistrés")
      onClose()
    } catch {
      toast.error("Erreur lors de l'enregistrement")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] flex flex-col">
        {/* En-tête */}
        <div className="flex items-start justify-between p-6 border-b border-border shrink-0">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <Flag className="h-5 w-5 text-primary" />
              Flags du scénario
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{scenarioName}</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition ml-4"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Chargement...</p>
          ) : (
            <>
              {/* Résumé points */}
              {flags.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{flags.length} flag(s)</span>
                  <span className="font-medium text-foreground">
                    Total max :{" "}
                    <span className="text-primary font-bold">{totalMaxPoints} pts</span>
                  </span>
                </div>
              )}

              {/* Lignes de flags */}
              <div className="space-y-3">
                {flags.map((f, idx) => {
                  const { points } = computeFlagScore(f.difficulty)
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-border bg-muted/20 p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          Flag #{idx + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <Badge className={`text-xs ${FLAG_DIFFICULTY_BADGE[f.difficulty]}`}>
                            {f.difficulty} · {points} pts
                          </Badge>
                          <button
                            type="button"
                            onClick={() => removeFlag(idx)}
                            className="text-destructive hover:text-destructive/80"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">
                            Identifiant <span className="text-muted-foreground/60">(slug court)</span>
                          </label>
                          <Input
                            placeholder="flag_env"
                            value={f.id}
                            onChange={(e) => updateFlag(idx, { id: e.target.value })}
                            className="font-mono text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">Difficulté</label>
                          <Select
                            value={f.difficulty}
                            onValueChange={(v) => updateFlag(idx, { difficulty: v as FlagDifficulty })}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {FLAG_DIFFICULTIES.map((d) => (
                                <SelectItem key={d} value={d}>
                                  {d} · {computeFlagScore(d).points} pts
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">Libellé visible</label>
                          <Input
                            placeholder="Le fichier .env du serveur"
                            value={f.label}
                            onChange={(e) => updateFlag(idx, { label: e.target.value })}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs text-muted-foreground font-medium">
                            Valeur attendue{" "}
                            <span className="text-muted-foreground/60">(jamais vue par le joueur)</span>
                          </label>
                          <Input
                            placeholder="FLAG{secret_env}"
                            value={f.value}
                            onChange={(e) => updateFlag(idx, { value: e.target.value })}
                            className="font-mono text-sm"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground font-medium">
                          Indice <span className="text-muted-foreground/60">(optionnel)</span>
                        </label>
                        <Input
                          placeholder="Cherchez dans les fichiers de configuration…"
                          value={f.hint}
                          onChange={(e) => updateFlag(idx, { hint: e.target.value })}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFlag}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter un flag
              </Button>
            </>
          )}
        </div>

        {/* Pied */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-border shrink-0">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={saving || loading}>
            {saving ? "Enregistrement..." : "Enregistrer les flags"}
          </Button>
        </div>
      </div>
    </div>
  )
}
