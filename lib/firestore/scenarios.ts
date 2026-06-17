import { db } from "@/lib/firebase"
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  Timestamp,
  type Unsubscribe,
  onSnapshot,
} from "firebase/firestore"
import type { Scenario, ScenarioFlag, PublicScenarioFlag } from "@/lib/types"
import { computeFlagScore } from "@/lib/flags-scoring"
import { getProxmoxTemplate } from "./proxmox-templates"
import { getProxmoxServer } from "./proxmox-servers"

const COL = "scenarios"

export async function getScenarios(organizationId: string): Promise<Scenario[]> {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId),
    where("isActive", "==", true)
  )
  const snap = await getDocs(q)
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Scenario))
  return items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
}

export async function getScenario(id: string): Promise<Scenario | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Scenario
}

export function subscribeScenarios(
  organizationId: string,
  callback: (items: Scenario[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId),
    where("isActive", "==", true)
  )
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Scenario))
      callback(items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()))
    },
    onError
  )
}

export async function createScenario(
  data: Omit<Scenario, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return ref.id
}

export async function updateScenario(
  id: string,
  data: Partial<Omit<Scenario, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function deleteScenario(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    isActive: false,
    updatedAt: Timestamp.now(),
  })
}

/**
 * Récupère les infos complètes d'un scénario avec ses relations Proxmox
 * Utile pour obtenir : template -> serveur Proxmox
 */
export async function getScenarioWithProxmox(id: string) {
  const scenario = await getScenario(id)
  if (!scenario) return null

  const template = await getProxmoxTemplate(scenario.proxmoxTemplateId)
  if (!template) return { scenario, template: null, server: null }

  const server = await getProxmoxServer(template.proxmoxServerId)
  
  return { scenario, template, server }
}

// ─── Flags du scénario ─────────────────────────────────────────────────────

/**
 * Normalise la liste de flags : recalcule weight/points depuis difficulty,
 * trie par `order`, et assigne un `order` séquentiel.
 */
export function normalizeScenarioFlags(
  flags: Array<Omit<ScenarioFlag, "weight" | "points" | "order"> & Partial<Pick<ScenarioFlag, "order">>>
): ScenarioFlag[] {
  return flags
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((f, idx) => {
      const { weight, points } = computeFlagScore(f.difficulty)
      return {
        id: f.id,
        label: f.label,
        value: f.value,
        difficulty: f.difficulty,
        weight,
        points,
        hint: f.hint,
        order: idx,
      }
    })
}

/** Remplace l'intégralité des flags d'un scénario (admin). */
export async function setScenarioFlags(
  scenarioId: string,
  flags: Array<Omit<ScenarioFlag, "weight" | "points" | "order"> & Partial<Pick<ScenarioFlag, "order">>>
): Promise<void> {
  const normalized = normalizeScenarioFlags(flags)
  await updateDoc(doc(db, COL, scenarioId), {
    flags: normalized,
    updatedAt: Timestamp.now(),
  })
}

/** Vue publique des flags : sans le champ `value`, pour le client joueur. */
export async function getScenarioFlagsPublic(scenarioId: string): Promise<PublicScenarioFlag[]> {
  const sc = await getScenario(scenarioId)
  if (!sc?.flags) return []
  return sc.flags
    .slice()
    .sort((a, b) => a.order - b.order)
    .map(({ value: _value, ...rest }) => rest)
}

