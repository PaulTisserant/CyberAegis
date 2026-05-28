import { db } from "@/lib/firebase"
import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
} from "firebase/firestore"
import type { Report, Player, PlayerReportData } from "@/lib/types"
import { getScenario } from "@/lib/firestore/scenarios"
import { BASE_POINTS, FLAG_WEIGHTS } from "@/lib/flags-scoring"

const COL = "reports"

export async function getReports(organizationId: string): Promise<Report[]> {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId)
  )
  const snap = await getDocs(q)
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report))
  return items.sort((a, b) => b.generatedAt.toMillis() - a.generatedAt.toMillis())
}

export async function getReportBySessionId(sessionId: string): Promise<Report | null> {
  const q = query(collection(db, COL), where("sessionId", "==", sessionId))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Report
}

export async function getReport(id: string): Promise<Report | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Report
}

export async function createReport(
  data: Omit<Report, "id" | "generatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    generatedAt: Timestamp.now(),
  })
  return ref.id
}

/**
 * Génère et persiste un rapport de session complet.
 * Anti-doublon : si un rapport existe déjà pour cette session, retourne son ID.
 */
export async function generateSessionReport(
  sessionId: string,
  organizationId: string
): Promise<string> {
  // Anti-doublon
  const existing = await getReportBySessionId(sessionId)
  if (existing) return existing.id

  // Charger la session
  const sessionSnap = await getDoc(doc(db, "sessions", sessionId))
  if (!sessionSnap.exists()) throw new Error(`Session ${sessionId} introuvable`)
  const session = sessionSnap.data()

  // Charger les joueurs (sous-collection)
  const playersSnap = await getDocs(
    query(
      collection(db, "sessions", sessionId, "players"),
      orderBy("score", "desc")
    )
  )
  const players = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Player)  )

  // Charger le scénario pour totalFlags et maxScore
  const scenario = await getScenario(session.scenarioId ?? "")
  const totalFlags = scenario?.flags?.length ?? 0
  const maxScore = scenario?.flags?.reduce(
    (acc, f) => acc + (FLAG_WEIGHTS[f.difficulty] ?? 1) * BASE_POINTS,
    0
  ) ?? 0

  // Timestamp de fin de session (maintenant) pour les joueurs sans completedAt
  const sessionEndMs = Date.now()

  // Construire les données par joueur
  const playerDatas: PlayerReportData[] = players.map((p) => {
    const joinedMs = p.joinedAt?.toMillis() ?? sessionEndMs
    const completedMs = p.completedAt?.toMillis() ?? sessionEndMs
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

  // Agrégats
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

  return createReport({
    sessionId,
    sessionName: session.name ?? "Session sans nom",
    organizationId,
    type: "Session",
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
}

