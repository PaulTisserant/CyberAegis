import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"
import type { ProxmoxServer, ProxmoxTemplate, Scenario, GameSession } from "@/lib/types"

// ─── Helper ───────────────────────────────────────────────────────────────
// Le SDK Admin retourne ses propres Timestamp, compatibles structurellement
// avec le type client — on cast pour rester cohérent avec lib/types.ts
function castTimestamp(data: FirebaseFirestore.DocumentData): Record<string, unknown> {
  return data as Record<string, unknown>
}

// ─── ProxmoxServer ────────────────────────────────────────────────────────

const SERVERS_COL = "proxmox_servers"

export async function adminGetProxmoxServers(organizationId: string): Promise<ProxmoxServer[]> {
  const db = getAdminDb()
  const snap = await db
    .collection(SERVERS_COL)
    .where("organizationId", "==", organizationId)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...castTimestamp(d.data()) } as ProxmoxServer))
}

export async function adminCreateProxmoxServer(
  data: Omit<ProxmoxServer, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const db = getAdminDb()
  const ref = await db.collection(SERVERS_COL).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

export async function adminUpdateProxmoxServer(
  id: string,
  data: Partial<Omit<ProxmoxServer, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  const db = getAdminDb()
  await db
    .collection(SERVERS_COL)
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() })
}

// ─── ProxmoxTemplate ──────────────────────────────────────────────────────

const TEMPLATES_COL = "proxmox_templates"

export async function adminGetProxmoxTemplates(organizationId: string): Promise<ProxmoxTemplate[]> {
  const db = getAdminDb()
  const snap = await db
    .collection(TEMPLATES_COL)
    .where("organizationId", "==", organizationId)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...castTimestamp(d.data()) } as ProxmoxTemplate))
}

export async function adminCreateProxmoxTemplate(
  data: Omit<ProxmoxTemplate, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const db = getAdminDb()
  const ref = await db.collection(TEMPLATES_COL).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

export async function adminUpdateProxmoxTemplate(
  id: string,
  data: Partial<Omit<ProxmoxTemplate, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  const db = getAdminDb()
  await db
    .collection(TEMPLATES_COL)
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() })
}

// ─── Scenario ─────────────────────────────────────────────────────────────

const SCENARIOS_COL = "scenarios"

export async function adminGetScenarios(organizationId: string): Promise<Scenario[]> {
  const db = getAdminDb()
  const snap = await db
    .collection(SCENARIOS_COL)
    .where("organizationId", "==", organizationId)
    .get()
  return snap.docs.map((d) => ({ id: d.id, ...castTimestamp(d.data()) } as Scenario))
}

export async function adminCreateScenario(
  data: Omit<Scenario, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const db = getAdminDb()
  const ref = await db.collection(SCENARIOS_COL).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

export async function adminUpdateScenario(
  id: string,
  data: Partial<Omit<Scenario, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  const db = getAdminDb()
  await db
    .collection(SCENARIOS_COL)
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() })
}

export async function adminGetScenario(id: string): Promise<Scenario | null> {
  const db = getAdminDb()
  const snap = await db.collection(SCENARIOS_COL).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...castTimestamp(snap.data()!) } as Scenario
}

export async function adminGetScenarioWithProxmox(scenarioId: string) {
  const scenario = await adminGetScenario(scenarioId)
  if (!scenario) return null

  const template = await adminGetProxmoxTemplateById(scenario.proxmoxTemplateId)
  if (!template) return { scenario, template: null, server: null }

  const server = await adminGetProxmoxServerById(template.proxmoxServerId)
  return { scenario, template, server }
}

// ─── ProxmoxServer / Template — getById ──────────────────────────────────

async function adminGetProxmoxTemplateById(id: string): Promise<ProxmoxTemplate | null> {
  const db = getAdminDb()
  const snap = await db.collection(TEMPLATES_COL).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...castTimestamp(snap.data()!) } as ProxmoxTemplate
}

async function adminGetProxmoxServerById(id: string): Promise<ProxmoxServer | null> {
  const db = getAdminDb()
  const snap = await db.collection(SERVERS_COL).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...castTimestamp(snap.data()!) } as ProxmoxServer
}

// ─── GameSession ──────────────────────────────────────────────────────────

const GAME_SESSIONS_COL = "game_sessions"

export async function adminCreateGameSession(
  data: Omit<GameSession, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const db = getAdminDb()
  const ref = await db.collection(GAME_SESSIONS_COL).add({
    ...data,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

export async function adminUpdateGameSession(
  id: string,
  data: Partial<Omit<GameSession, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  const db = getAdminDb()
  await db
    .collection(GAME_SESSIONS_COL)
    .doc(id)
    .update({ ...data, updatedAt: FieldValue.serverTimestamp() })
}

export async function adminGetGameSession(id: string): Promise<GameSession | null> {
  const db = getAdminDb()
  const snap = await db.collection(GAME_SESSIONS_COL).doc(id).get()
  if (!snap.exists) return null
  return { id: snap.id, ...castTimestamp(snap.data()!) } as GameSession
}
