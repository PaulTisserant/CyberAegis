import "server-only"
import type { Difficulty } from "@/lib/types"
import {
  createProxmoxServer,
  getProxmoxServers,
  updateProxmoxServer,
} from "./proxmox-servers"
import {
  createProxmoxTemplate,
  getProxmoxTemplates,
  updateProxmoxTemplate,
} from "./proxmox-templates"
import { createScenario, getScenarios, updateScenario } from "./scenarios"
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

    // Étape 3 : Upsert des templates Proxmox en DB
    const existingTemplates = await getProxmoxTemplates(organizationId)

    for (const templateVm of templateVMs) {
      const foundTemplate = existingTemplates.find((t) => t.vmid === templateVm.vmid)

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

      // Étape 4 : Upsert scénario associé au template
      const existingScenarios = await getScenarios(organizationId)
      const scenarioDefinition = buildScenarioFromTemplateName(templateVm.name)
      const existingScenario = existingScenarios.find(
        (s) => s.proxmoxTemplateId === proxmoxTemplateId || s.name === scenarioDefinition.name
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
      } else {
        await updateScenario(existingScenario.id, {
          name: scenarioDefinition.name,
          description: scenarioDefinition.description,
          difficulty: scenarioDefinition.difficulty,
          tags: scenarioDefinition.tags,
          duration: scenarioDefinition.duration,
          proxmoxTemplateId,
          isActive: true,
        })
        console.log(`[Init] Scénario déjà présent pour ${templateVm.name}`)
      }
    }

    console.log("[Init] Synchronisation terminée ✓")
  } catch (err) {
    console.error("[Init] Erreur lors de la synchronisation :", err)
    throw err
  }
}
