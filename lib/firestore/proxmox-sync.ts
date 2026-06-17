import "server-only"
import type { Difficulty } from "@/lib/types"
import {
  adminCreateProxmoxServer as createProxmoxServer,
  adminGetProxmoxServers as getProxmoxServers,
  adminUpdateProxmoxServer as updateProxmoxServer,
  adminCreateProxmoxTemplate as createProxmoxTemplate,
  adminGetProxmoxTemplates as getProxmoxTemplates,
  adminUpdateProxmoxTemplate as updateProxmoxTemplate,
  adminCreateScenario as createScenario,
  adminGetScenarios as getScenarios,
  adminUpdateScenario as updateScenario,
} from "./admin-sync"
import { listVMs } from "@/lib/proxmox-api"

// ─── Configuration serveur (via .env) ─────────────────────────────────────

function getProxmoxSyncEnvConfig() {
  const host = process.env.PROXMOX_HOST
  const token = process.env.PROXMOX_TOKEN
  const node = process.env.PROXMOX_NODE
  const templatePrefix = process.env.PROXMOX_TEMPLATE_PREFIX

  if (!host || !token || !node || !templatePrefix) {
    throw new Error(
      "Variables Proxmox manquantes. Renseignez PROXMOX_HOST, PROXMOX_TOKEN, PROXMOX_NODE et PROXMOX_TEMPLATE_PREFIX dans .env"
    )
  }

  return { host, token, node, templatePrefix: templatePrefix.toLowerCase() }
}

function getDifficultyFromTemplateName(templateName: string): Difficulty {
  const normalized = templateName.toLowerCase()
  if (normalized.includes("3")) return "Avancé"
  if (normalized.includes("2")) return "Intermédiaire"
  return "Débutant"
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(" ")
}

function buildScenarioFromTemplateName(templateName: string) {
  const cleanName = templateName.replace(/[-_]+/g, " ").trim()
  return {
    name: toTitleCase(cleanName),
    description: `Scénario généré automatiquement depuis le template Proxmox ${templateName}.`,
    difficulty: getDifficultyFromTemplateName(templateName),
    tags: ["Proxmox", "Template", "Cybersécurité"],
    duration: 60,
  }
}

/**
 * Fonction de synchronisation Proxmox → Firestore
 * Crée les données Proxmox et les scénarios s'ils n'existent pas
 * SAFE : vérifie d'abord si les données existent déjà
 */
export async function synchronizeProxmoxScenarios(organizationId: string): Promise<void> {
  console.log(
    `[Init] Synchronisation Proxmox pour l'organisation ${organizationId}`
  )

  try {
    const proxmox = getProxmoxSyncEnvConfig()

    // Étape 1 : Créer/récupérer le serveur ProxmoxServer
    const existingServers = await getProxmoxServers(organizationId)
    let proxmoxServerId: string

    if (existingServers.length > 0) {
      const server = existingServers[0]
      proxmoxServerId = server.id
      await updateProxmoxServer(proxmoxServerId, {
        host: proxmox.host,
        token: proxmox.token,
        node: proxmox.node,
      })
      console.log(`[Init] Serveur Proxmox mis à jour (${proxmoxServerId})`)
    } else {
      console.log("[Init] Création du serveur ProxmoxServer...")
      proxmoxServerId = await createProxmoxServer({
        host: proxmox.host,
        token: proxmox.token,
        node: proxmox.node,
        organizationId,
      })
      console.log(`[Init] ProxmoxServer créé : ${proxmoxServerId}`)
    }

    // Étape 2 : Découvrir les templates VM sur Proxmox via /nodes/{node}/qemu
    const proxmoxVMs = await listVMs(proxmox.host, proxmox.token, proxmox.node)
    const templateVMs = proxmoxVMs.filter((vm) => {
      const vmName = (vm.name ?? "").toLowerCase()
      return vm.template === 1 && vmName.startsWith(proxmox.templatePrefix)
    })

    if (templateVMs.length === 0) {
      console.log(
        `[Init] Aucun template trouvé avec le préfixe ${proxmox.templatePrefix}`
      )
      return
    }

    // Étape 3 : Charger les données existantes une seule fois (hors boucle)
    const existingTemplates = await getProxmoxTemplates(organizationId)
    // adminGetScenarios retourne TOUS les scénarios (actifs + inactifs)
    const existingScenarios = await getScenarios(organizationId)

    // Index des vmids présents sur Proxmox pour ce préfixe
    const activeVmids = new Set(templateVMs.map((vm) => vm.vmid))

    // ── Étape 3a : Dédoublonner les templates Firestore par vmid ──────────
    // Si plusieurs templates ont le même vmid, garder le plus récent et supprimer les autres
    const vmidToCanonicalTemplateId = new Map<number, string>()
    const orphanTemplateIds = new Set<string>()

    for (const template of existingTemplates) {
      if (!vmidToCanonicalTemplateId.has(template.vmid)) {
        vmidToCanonicalTemplateId.set(template.vmid, template.id)
      } else {
        // Doublon : marquer comme orphelin (sera supprimé après réassignation des scénarios)
        orphanTemplateIds.add(template.id)
      }
    }

    // Réassigner les scénarios liés à un template doublon vers le canonical
    for (const scenario of existingScenarios) {
      if (orphanTemplateIds.has(scenario.proxmoxTemplateId)) {
        const orphanTemplate = existingTemplates.find((t) => t.id === scenario.proxmoxTemplateId)
        if (orphanTemplate) {
          const canonicalId = vmidToCanonicalTemplateId.get(orphanTemplate.vmid)
          if (canonicalId) {
            await updateScenario(scenario.id, { proxmoxTemplateId: canonicalId })
            console.log(`[Init] Scénario "${scenario.name}" réassigné vers template canonical ${canonicalId}`)
          }
        }
      }
    }

    for (const templateVm of templateVMs) {
      // ── Template : upsert par vmid (utilise le canonical s'il existe) ───
      const canonicalId = vmidToCanonicalTemplateId.get(templateVm.vmid)
      const foundTemplate = canonicalId
        ? existingTemplates.find((t) => t.id === canonicalId)
        : undefined

      let proxmoxTemplateId: string
      if (foundTemplate) {
        proxmoxTemplateId = foundTemplate.id
        await updateProxmoxTemplate(proxmoxTemplateId, {
          name: templateVm.name,
          description: `Template synchronisé depuis Proxmox (vmid=${templateVm.vmid})`,
          proxmoxServerId,
          vmid: templateVm.vmid,
        })
      } else {
        proxmoxTemplateId = await createProxmoxTemplate({
          vmid: templateVm.vmid,
          name: templateVm.name,
          description: `Template synchronisé depuis Proxmox (vmid=${templateVm.vmid})`,
          proxmoxServerId,
          organizationId,
        })
      }

      // ── Scénario : match UNIQUEMENT par proxmoxTemplateId ───────────────
      // Recharger les scénarios pour tenir compte des réassignations
      const currentScenarios = await getScenarios(organizationId)
      const scenarioDefinition = buildScenarioFromTemplateName(templateVm.name)
      const existingScenario = currentScenarios.find(
        (s) => s.proxmoxTemplateId === proxmoxTemplateId
      )

      if (!existingScenario) {
        await createScenario({
          name: scenarioDefinition.name,
          description: scenarioDefinition.description,
          difficulty: scenarioDefinition.difficulty,
          tags: scenarioDefinition.tags,
          duration: scenarioDefinition.duration,
          proxmoxTemplateId,
          organizationId,
          isActive: true,
        })
        console.log(`[Init] Scénario créé depuis template ${templateVm.name}`)
      } else if (existingScenario.isActive) {
        await updateScenario(existingScenario.id, {
          name: scenarioDefinition.name,
          description: scenarioDefinition.description,
          difficulty: scenarioDefinition.difficulty,
          tags: scenarioDefinition.tags,
          duration: scenarioDefinition.duration,
          proxmoxTemplateId,
        })
        console.log(`[Init] Scénario mis à jour pour ${templateVm.name}`)
      } else {
        console.log(`[Init] Scénario ignoré (désactivé manuellement) : ${templateVm.name}`)
      }
    }

    // ── Étape 4 : Désactiver les scénarios dont le vmid a disparu de Proxmox ──
    // Recharger les scénarios actifs après toutes les écritures
    const finalScenarios = await getScenarios(organizationId)
    for (const scenario of finalScenarios) {
      if (!scenario.isActive) continue
      const template = existingTemplates.find((t) => t.id === scenario.proxmoxTemplateId)
      if (!template) continue
      if (!activeVmids.has(template.vmid)) {
        await updateScenario(scenario.id, { isActive: false })
        console.log(
          `[Init] Scénario "${scenario.name}" désactivé — VM vmid=${template.vmid} absente de Proxmox`
        )
      }
    }

    console.log("[Init] Synchronisation terminée ✓")
  } catch (err) {
    console.error("[Init] Erreur lors de la synchronisation :", err)
    throw err
  }
}
