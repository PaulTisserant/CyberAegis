"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2 } from "lucide-react"
import { createScenario, normalizeScenarioFlags } from "@/lib/firestore/scenarios"
import { toast } from "sonner"
import type { Difficulty, FlagDifficulty } from "@/lib/types"
import { useEffect } from "react"
import { getProxmoxTemplates } from "@/lib/firestore/proxmox-templates"
import type { ProxmoxTemplate } from "@/lib/types"
import {
  FLAG_DIFFICULTIES,
  FLAG_DIFFICULTY_BADGE,
  computeFlagScore,
} from "@/lib/flags-scoring"

interface FlagRow {
  id: string
  label: string
  value: string
  difficulty: FlagDifficulty
  hint: string
}

interface Props {
  open: boolean
  onClose: () => void
  organizationId: string
}

export default function CreateScenarioModal({ open, onClose, organizationId }: Props) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    difficulty: "Débutant" as Difficulty,
    tags: "",
    duration: 60,
    proxmoxTemplateId: "",
  })
  const [flags, setFlags] = useState<FlagRow[]>([])
  const [templates, setTemplates] = useState<ProxmoxTemplate[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (!open || !organizationId) return

    ;(async () => {
      try {
        const items = await getProxmoxTemplates(organizationId)
        setTemplates(items)
      } catch {
        toast.error("Impossible de charger les templates Proxmox")
      }
    })()
  }, [open, organizationId])

  const addFlag = () => {
    setFlags((f) => [
      ...f,
      { id: `flag_${f.length + 1}`, label: "", value: "", difficulty: "Facile", hint: "" },
    ])
  }
  const removeFlag = (idx: number) => setFlags((f) => f.filter((_, i) => i !== idx))
  const updateFlag = (idx: number, patch: Partial<FlagRow>) =>
    setFlags((f) => f.map((row, i) => (i === idx ? { ...row, ...patch } : row)))

  const totalMaxPoints = flags.reduce(
    (acc, f) => acc + computeFlagScore(f.difficulty).points,
    0
  )

  const validateFlags = (): string | null => {
    const ids = new Set<string>()
    for (const f of flags) {
      if (!f.id.trim()) return "Chaque flag doit avoir un identifiant"
      if (ids.has(f.id)) return `Identifiant de flag dupliqué : ${f.id}`
      ids.add(f.id)
      if (!f.label.trim()) return `Libellé manquant pour le flag ${f.id}`
      if (!f.value.trim()) return `Valeur attendue manquante pour le flag ${f.id}`
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const err = validateFlags()
    if (err) {
      toast.error(err)
      return
    }
    setIsSubmitting(true)
    try {
      const normalizedFlags = flags.length > 0
        ? normalizeScenarioFlags(
            flags.map((f, i) => ({
              id: f.id.trim(),
              label: f.label.trim(),
              value: f.value.trim(),
              difficulty: f.difficulty,
              hint: f.hint.trim() || undefined,
              order: i,
            }))
          )
        : undefined

      await createScenario({
        name: formData.name,
        description: formData.description,
        difficulty: formData.difficulty,
        tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
        duration: formData.duration,
        proxmoxTemplateId: formData.proxmoxTemplateId,
        organizationId,
        isActive: true,
        ...(normalizedFlags ? { flags: normalizedFlags } : {}),
      })
      toast.success("Scénario créé avec succès")
      setFormData({
        name: "",
        description: "",
        difficulty: "Débutant",
        tags: "",
        duration: 60,
        proxmoxTemplateId: "",
      })
      setFlags([])
      onClose()
    } catch {
      toast.error("Erreur lors de la création du scénario")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="border-b border-border p-6">
          <h2 className="text-xl font-bold text-foreground">Créer un scénario</h2>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Nom</label>
            <Input
              placeholder="Nom du scénario"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Description</label>
            <Textarea
              placeholder="Description du scénario"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Difficulté</label>
              <Select
                value={formData.difficulty}
                onValueChange={(v) => setFormData({ ...formData, difficulty: v as Difficulty })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Débutant">Débutant</SelectItem>
                  <SelectItem value="Intermédiaire">Intermédiaire</SelectItem>
                  <SelectItem value="Avancé">Avancé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Durée (min)</label>
              <Input
                type="number"
                min={5}
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Template Proxmox</label>
            <Select
              value={formData.proxmoxTemplateId}
              onValueChange={(v) => setFormData({ ...formData, proxmoxTemplateId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    {template.name} (vmid: {template.vmid})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tags (séparés par des virgules)</label>
            <Input
              placeholder="Phishing, Sécurité, Formation"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            />
          </div>

          {/* ── Section Flags ────────────────────────────────────────────── */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">
                Flags du scénario{" "}
                {flags.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    · total max : {totalMaxPoints} pts
                  </span>
                )}
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addFlag}
                className="bg-transparent"
              >
                <Plus className="h-4 w-4 mr-1" />
                Ajouter un flag
              </Button>
            </div>
            {flags.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucun flag défini. Le scénario sera créé sans système de flags.
              </p>
            ) : (
              <div className="space-y-3">
                {flags.map((row, idx) => {
                  const { points } = computeFlagScore(row.difficulty)
                  return (
                    <div
                      key={idx}
                      className="border border-border rounded-md p-3 space-y-2 bg-muted/30"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge className={FLAG_DIFFICULTY_BADGE[row.difficulty]}>
                          {row.difficulty} · {points} pts
                        </Badge>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFlag(idx)}
                          className="h-7 w-7 p-0 text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Identifiant (ex: first_blood)"
                          value={row.id}
                          onChange={(e) => updateFlag(idx, { id: e.target.value })}
                          className="font-mono text-xs"
                        />
                        <Select
                          value={row.difficulty}
                          onValueChange={(v) =>
                            updateFlag(idx, { difficulty: v as FlagDifficulty })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FLAG_DIFFICULTIES.map((d) => (
                              <SelectItem key={d} value={d}>
                                {d} ({computeFlagScore(d).points} pts)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Input
                        placeholder="Libellé visible par le joueur"
                        value={row.label}
                        onChange={(e) => updateFlag(idx, { label: e.target.value })}
                      />
                      <Input
                        placeholder="Valeur attendue (ex: FLAG{first_blood})"
                        value={row.value}
                        onChange={(e) => updateFlag(idx, { value: e.target.value })}
                        className="font-mono text-xs"
                      />
                      <Input
                        placeholder="Indice (optionnel)"
                        value={row.hint}
                        onChange={(e) => updateFlag(idx, { hint: e.target.value })}
                        className="text-xs"
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1 bg-transparent" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isSubmitting || !formData.proxmoxTemplateId}
            >
              {isSubmitting ? "Création..." : "Créer"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
