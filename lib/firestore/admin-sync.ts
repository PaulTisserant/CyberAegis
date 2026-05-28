import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"
import type { ProxmoxServer, ProxmoxTemplate, Scenario, GameSession, Player, PlayerReportData } from "@/lib/types"
import { BASE_POINTS, FLAG_WEIGHTS } from "@/lib/flags-scoring"

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
  // Re-vérification anti-doublon : cherche par vmid avant de créer
  const existing = await db
    .collection(TEMPLATES_COL)
    .where("organizationId", "==", data.organizationId)
    .where("vmid", "==", data.vmid)
    .limit(1)
    .get()
  if (!existing.empty) return existing.docs[0].id
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
  // Re-vérification anti-doublon : cherche par proxmoxTemplateId avant de créer
  const existing = await db
    .collection(SCENARIOS_COL)
    .where("organizationId", "==", data.organizationId)
    .where("proxmoxTemplateId", "==", data.proxmoxTemplateId)
    .limit(1)
    .get()
  if (!existing.empty) return existing.docs[0].id
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
  const server = { id: snap.id, ...castTimestamp(snap.data()!) } as ProxmoxServer

  // Le .env est la source de vérité pour les credentials Proxmox.
  // Firestore peut contenir un token périmé (sync non rejouée après rotation) —
  // on override systématiquement avec l'env si défini, comme le fait `proxmox-sync`.
  const envHost = process.env.PROXMOX_HOST
  const envToken = process.env.PROXMOX_TOKEN
  const envNode = process.env.PROXMOX_NODE
  if (envHost) server.host = envHost
  if (envToken) server.token = envToken
  if (envNode) server.node = envNode

  return server
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

// ─── Génération de rapport (admin) ────────────────────────────────────────

const REPORTS_COL = "reports"

/**
 * Génère et persiste un rapport pour une session parente.
 * Cette version admin est appelée depuis les API routes (server-side).
 * Anti-doublon : si un rapport existe déjà, retourne son id sans recréer.
 */
export async function adminGenerateSessionReport(
  parentSessionId: string,
  organizationId: string
): Promise<string> {
  const db = getAdminDb()

  // Anti-doublon
  const existingSnap = await db
    .collection(REPORTS_COL)
    .where("sessionId", "==", parentSessionId)
    .limit(1)
    .get()
  if (!existingSnap.empty) return existingSnap.docs[0].id

  // Charger la session parente
  const sessionSnap = await db.collection("sessions").doc(parentSessionId).get()
  if (!sessionSnap.exists) throw new Error(`Session ${parentSessionId} introuvable`)
  const session = sessionSnap.data()!

  // Charger le scénario
  const scenario = await adminGetScenario(session.scenarioId ?? "")
  const totalFlags = scenario?.flags?.length ?? 0
  const maxScore =
    scenario?.flags?.reduce(
      (acc, f) => acc + (FLAG_WEIGHTS[f.difficulty] ?? 1) * BASE_POINTS,
      0
    ) ?? 0

  // Charger les joueurs dans sessions/{parentSessionId}/players
  const playersSnap = await db
    .collection("sessions")
    .doc(parentSessionId)
    .collection("players")
    .orderBy("score", "desc")
    .get()
  const players = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Player))

  // Fallback : chercher dans game_sessions/{gameSessionId}/players si pas de joueurs
  if (players.length === 0 && session.gameSessionId) {
    const gsPlayersSnap = await db
      .collection(GAME_SESSIONS_COL)
      .doc(session.gameSessionId)
      .collection("players")
      .get()
    players.push(
      ...gsPlayersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Player))
    )
  }

  const sessionEndMs = Date.now()
  const playerDatas: PlayerReportData[] = players.map((p) => {
    const joinedMs =
      p.joinedAt && typeof (p.joinedAt as unknown as { toMillis?: () => number }).toMillis === "function"
        ? (p.joinedAt as unknown as { toMillis: () => number }).toMillis()
        : sessionEndMs
    const completedMs =
      p.completedAt && typeof (p.completedAt as unknown as { toMillis?: () => number }).toMillis === "function"
        ? (p.completedAt as unknown as { toMillis: () => number }).toMillis()
        : sessionEndMs
    const durationSeconds = Math.round(Math.max(0, completedMs - joinedMs) / 1000)
    return {
      userId: p.userId,
      displayName: p.displayName,
      score: p.score ?? 0,
      progress: p.progress ?? 0,
      status: p.status,
      flagsFound: p.submittedFlags?.length ?? 0,
      totalFlags,
      durationSeconds,
      submittedFlags: p.submittedFlags ?? [],
    }
  })

  const totalPlayers = playerDatas.length
  const finished = playerDatas.filter((p) => p.status === "FINISHED")
  const completionRate =
    totalPlayers > 0 ? Math.round((finished.length / totalPlayers) * 100) : 0
  const averageScore =
    totalPlayers > 0
      ? Math.round(playerDatas.reduce((a, p) => a + p.score, 0) / totalPlayers)
      : 0
  const averageDuration =
    totalPlayers > 0
      ? Math.round(
          playerDatas.reduce((a, p) => a + p.durationSeconds, 0) / totalPlayers / 60
        )
      : 0

  const ref = await db.collection(REPORTS_COL).add({
    sessionId: parentSessionId,
    sessionName: session.name ?? "Session sans nom",
    organizationId,
    type: "Session",
    generatedAt: FieldValue.serverTimestamp(),
    data: {
      totalPlayers,
      completionRate,
      averageScore,
      averageDuration,
      totalFlags,
      maxScore,
      players: playerDatas,
    },
  })
  return ref.id
}
