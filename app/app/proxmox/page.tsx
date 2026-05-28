"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/lib/auth/AuthContext"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Server, HardDrive, ChevronUp, Eye, EyeOff, RefreshCw } from "lucide-react"
import { getAuth } from "firebase/auth"
import { toast } from "sonner"
import {
  getProxmoxServers,
  createProxmoxServer,
  deleteProxmoxServer,
} from "@/lib/firestore/proxmox-servers"
import {
  getProxmoxTemplates,
  deleteProxmoxTemplate,
} from "@/lib/firestore/proxmox-templates"
import type { ProxmoxServer, ProxmoxTemplate } from "@/lib/types"

// ─── Formulaire serveur ───────────────────────────────────────────────────

interface ServerForm {
  host: string
  token: string
  node: string
}

const EMPTY_SERVER: ServerForm = { host: "", token: "", node: "pve" }

// ─── Page ─────────────────────────────────────────────────────────────────

export default function ProxmoxPage() {
  const { user } = useAuth()
  const organizationId = user?.organizationId ?? ""

  const [servers, setServers] = useState<ProxmoxServer[]>([])
  const [templates, setTemplates] = useState<ProxmoxTemplate[]>([])
  const [loading, setLoading] = useState(true)

  // Formulaire serveur
  const [showServerForm, setShowServerForm] = useState(false)
  const [serverForm, setServerForm] = useState<ServerForm>(EMPTY_SERVER)
  const [savingServer, setSavingServer] = useState(false)
  const [showToken, setShowToken] = useState(false)

  // Synchronisation
  const [syncing, setSyncing] = useState(false)

  // Chargement initial
  useEffect(() => {
    if (!organizationId) return
    ;(async () => {
      try {
        const [s, t] = await Promise.all([
          getProxmoxServers(organizationId),
          getProxmoxTemplates(organizationId),
        ])
        setServers(s)
        setTemplates(t)
      } catch {
        toast.error("Erreur lors du chargement des données Proxmox")
      } finally {
        setLoading(false)
      }
    })()
  }, [organizationId])

  // ─── Actions serveur ────────────────────────────────────────────────────

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!serverForm.host.trim() || !serverForm.token.trim() || !serverForm.node.trim()) {
      toast.error("Tous les champs sont requis")
      return
    }
    setSavingServer(true)
    try {
      const id = await createProxmoxServer({
        host: serverForm.host.trim(),
        token: serverForm.token.trim(),
        node: serverForm.node.trim(),
        organizationId,
      })
      const newServer: ProxmoxServer = {
        id,
        host: serverForm.host.trim(),
        token: serverForm.token.trim(),
        node: serverForm.node.trim(),
        organizationId,
        createdAt: { toMillis: () => Date.now() } as never,
        updatedAt: { toMillis: () => Date.now() } as never,
      }
      setServers((prev) => [newServer, ...prev])
      setServerForm(EMPTY_SERVER)
      setShowServerForm(false)
      toast.success("Serveur Proxmox ajouté")
    } catch {
      toast.error("Erreur lors de l'ajout du serveur")
    } finally {
      setSavingServer(false)
    }
  }

  const handleDeleteServer = async (id: string) => {
    const linked = templates.filter((t) => t.proxmoxServerId === id)
    if (linked.length > 0) {
      toast.error(`Ce serveur est utilisé par ${linked.length} template(s). Supprimez-les d'abord.`)
      return
    }
    try {
      await deleteProxmoxServer(id)
      setServers((prev) => prev.filter((s) => s.id !== id))
      toast.success("Serveur supprimé")
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }

  // ─── Synchronisation Proxmox ────────────────────────────────────────────

  const handleSync = async () => {
    if (servers.length === 0) {
      toast.error("Aucun serveur Proxmox configuré")
      return
    }
    setSyncing(true)
    try {
      const token = await getAuth().currentUser?.getIdToken()
      const res = await fetch("/api/proxmox/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token ?? ""}`,
        },
        body: JSON.stringify({ organizationId }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? "Erreur de synchronisation")
      // Recharge les templates depuis Firestore
      const updated = await getProxmoxTemplates(organizationId)
      setTemplates(updated)
      toast.success(`Synchronisation terminée — ${updated.length} template(s) chargé(s)`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la synchronisation")
    } finally {
      setSyncing(false)
    }
  }

  // ─── Actions template ────────────────────────────────────────────────────

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteProxmoxTemplate(id)
      setTemplates((prev) => prev.filter((t) => t.id !== id))
      toast.success("Template supprimé")
    } catch {
      toast.error("Erreur lors de la suppression")
    }
  }

  // ─── Rendu ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="text-muted-foreground">Chargement...</span>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      {/* En-tête */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Infrastructure VM</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gérez vos serveurs Proxmox et les templates de VM à cloner pour chaque scénario.
        </p>
      </div>

      {/* ── Serveurs Proxmox ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Serveurs Proxmox</h2>
            <Badge variant="outline">{servers.length}</Badge>
          </div>
          <Button
            size="sm"
            variant={showServerForm ? "outline" : "default"}
            onClick={() => setShowServerForm((v) => !v)}
          >
            {showServerForm ? (
              <>
                <ChevronUp className="h-4 w-4 mr-1" /> Annuler
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" /> Ajouter un serveur
              </>
            )}
          </Button>
        </div>

        {/* Formulaire ajout serveur */}
        {showServerForm && (
          <Card className="border-dashed">
            <CardContent className="pt-4">
              <form onSubmit={handleAddServer} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Hôte <span className="text-muted-foreground/60">ex: 192.168.1.10:8006</span>
                    </label>
                    <Input
                      placeholder="host:8006"
                      value={serverForm.host}
                      onChange={(e) => setServerForm({ ...serverForm, host: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Nœud Proxmox</label>
                    <Input
                      placeholder="pve"
                      value={serverForm.node}
                      onChange={(e) => setServerForm({ ...serverForm, node: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Token API{" "}
                    <span className="text-muted-foreground/60">
                      ex: PVEAPIToken=user@pam!token=xxxx
                    </span>
                  </label>
                  <div className="relative">
                    <Input
                      type={showToken ? "text" : "password"}
                      placeholder="PVEAPIToken=..."
                      value={serverForm.token}
                      onChange={(e) => setServerForm({ ...serverForm, token: e.target.value })}
                      className="pr-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowToken((v) => !v)}
                    >
                      {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" size="sm" disabled={savingServer}>
                  {savingServer ? "Enregistrement..." : "Enregistrer le serveur"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Liste des serveurs */}
        {servers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun serveur configuré.</p>
        ) : (
          <div className="space-y-2">
            {servers.map((srv) => {
              const linkedTemplates = templates.filter((t) => t.proxmoxServerId === srv.id)
              return (
                <Card key={srv.id}>
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <Server className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="font-mono text-sm text-foreground font-medium">
                          {srv.host}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Nœud : <span className="font-medium">{srv.node}</span> · {linkedTemplates.length} template(s)
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleDeleteServer(srv.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Templates VM ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-foreground">Templates VM</h2>
            <Badge variant="outline">{templates.length}</Badge>
          </div>
          <Button
            size="sm"
            onClick={handleSync}
            disabled={syncing || servers.length === 0}
            title={servers.length === 0 ? "Ajoutez d'abord un serveur Proxmox" : ""}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Synchronisation..." : "Synchroniser depuis Proxmox"}
          </Button>
        </div>

        {servers.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Configurez un serveur Proxmox pour synchroniser les templates.
          </p>
        )}

        {/* Liste des templates */}
        {templates.length === 0 && servers.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucun template synchronisé. Cliquez sur <strong>Synchroniser depuis Proxmox</strong> pour importer les templates disponibles.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((tpl) => {
              const srv = servers.find((s) => s.id === tpl.proxmoxServerId)
              return (
                <Card key={tpl.id}>
                  <CardContent className="py-3 px-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <HardDrive className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-foreground">{tpl.name}</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            VMID {tpl.vmid}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {srv ? (
                            <>
                              Serveur : <span className="font-medium">{srv.host}</span> · nœud{" "}
                              <span className="font-medium">{srv.node}</span>
                            </>
                          ) : (
                            <span className="text-destructive">Serveur introuvable</span>
                          )}
                          {tpl.description && <> · {tpl.description}</>}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleDeleteTemplate(tpl.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
                            </>
                          ) : (
                            <span className="text-destructive">Serveur introuvable</span>
                          )}
                          {tpl.description && <> · {tpl.description}</>}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive shrink-0"
                      onClick={() => handleDeleteTemplate(tpl.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Rappel liaison scénario ──────────────────────────────────────── */}
      {templates.length > 0 && (
        <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm font-medium text-blue-800 dark:text-blue-200">
              Comment lier un template à un scénario ?
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4 text-xs text-blue-700 dark:text-blue-300 space-y-1">
            <p>
              1. Allez dans <strong>Scénarios</strong> → <strong>Créer un scénario</strong>.
            </p>
            <p>
              2. Dans le champ <strong>Template Proxmox</strong>, sélectionnez le template correspondant.
            </p>
            <p>
              3. Ajoutez les flags cachés dans cette VM (section <strong>Flags</strong> du formulaire).
            </p>
            <p>
              4. Lors du lancement d'une session, la VM sera clonée automatiquement depuis ce template.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
