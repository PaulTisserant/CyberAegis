import { FieldValue, Timestamp as AdminTimestamp } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"
import { adminGetScenario } from "./admin-sync"
import type { GameSession, Player, ScenarioFlag, SubmittedFlag } from "@/lib/types"

const GAME_SESSIONS_COL = "game_sessions"
const SESSIONS_COL = "sessions"

export type SubmitFlagResult =
  | {
      kind: "success"
      flag: { id: string; label: string; difficulty: string; points: number }
      timeSincePrevious: number
      totalScore: number
      progress: number
      completed: boolean
    }
  | { kind: "already_found"; flag: { id: string; label: string } }
  | { kind: "invalid" }
  | { kind: "session_not_found" }
  | { kind: "scenario_no_flags" }
  | { kind: "forbidden" }

function normalize(s: string): string {
  return s.trim().toLowerCase()
}

/**
 * Soumet un flag pour un joueur.
 *
 * @param gameSessionId - ID dans la collection `game_sessions` (celui de l'URL /app/play/{id}/game)
 * @param userId        - uid Firebase du joueur
 * @param flagInput     - valeur saisie par le joueur
 * @param organizationId - extraite du JWT pour vérifier l'appartenance
 */
export async function adminSubmitFlag(
  gameSessionId: string,
  userId: string,
  flagInput: string,
  organizationId: string
): Promise<SubmitFlagResult> {
  const db = getAdminDb()

  // 1. Charger la GameSession pour obtenir scenarioId et parentSessionId
  const gsSnap = await db.collection(GAME_SESSIONS_COL).doc(gameSessionId).get()
  if (!gsSnap.exists) return { kind: "session_not_found" }

  const gs = gsSnap.data() as GameSession

  // 1a. Vérifier que c'est bien le joueur propriétaire de cette game session
  if (gs.playerId !== userId) return { kind: "forbidden" }

  // 1b. Vérifier l'organisation via le document Firestore
  // (le JWT Firebase ne contient pas de custom claim organization_id)
  const userSnap = await db.collection("users").doc(userId).get()
  if (!userSnap.exists) return { kind: "forbidden" }
  const userData = userSnap.data() as { organizationId?: string; firstName?: string; lastName?: string; email?: string }
  const userOrg: string = userData.organizationId ?? ""
  if (gs.organizationId !== userOrg) return { kind: "forbidden" }

  const parentSessionId = gs.parentSessionId

  // 2. Charger le scénario + ses flags
  const scenario = await adminGetScenario(gs.scenarioId)
  if (!scenario?.flags?.length) return { kind: "scenario_no_flags" }

  // 3. Trouver le flag matchant
  const inputNorm = normalize(flagInput)
  const matched: ScenarioFlag | undefined = scenario.flags.find(
    (f) => normalize(f.value) === inputNorm
  )
  if (!matched) return { kind: "invalid" }

  // 4. Trouver ou créer le document joueur dans sessions/{parentSessionId}/players
  // Le doc peut être absent si la partie a été lancée via /app/play/ sans session parente gérée.
  let playerRef: FirebaseFirestore.DocumentReference

  if (parentSessionId) {
    const sessionRef = db.collection(SESSIONS_COL).doc(parentSessionId)
    const playersSnap = await sessionRef
      .collection("players")
      .where("userId", "==", userId)
      .limit(1)
      .get()

    if (playersSnap.empty) {
      // Créer le document joueur à la volée
      const displayName = [userData.firstName, userData.lastName].filter(Boolean).join(" ") || userId
      const newPlayerRef = sessionRef.collection("players").doc()
      await newPlayerRef.set({
        userId,
        displayName,
        email: userData.email ?? "",
        score: 0,
        progress: 0,
        joinedAt: AdminTimestamp.now(),
        status: "PLAYING",
        submittedFlags: [],
      } satisfies Omit<Player, "id">)
      playerRef = newPlayerRef
    } else {
      playerRef = playersSnap.docs[0].ref
    }
  } else {
    // Pas de session parente : stocker les flags directement dans la game_session
    // Utiliser un sous-document virtuel dans game_sessions/{gameSessionId}/players/{userId}
    playerRef = db
      .collection(GAME_SESSIONS_COL)
      .doc(gameSessionId)
      .collection("players")
      .doc(userId)

    const snap = await playerRef.get()
    if (!snap.exists) {
      const displayName = [userData.firstName, userData.lastName].filter(Boolean).join(" ") || userId
      await playerRef.set({
        userId,
        displayName,
        email: userData.email ?? "",
        score: 0,
        progress: 0,
        joinedAt: AdminTimestamp.now(),
        status: "PLAYING",
        submittedFlags: [],
      } satisfies Omit<Player, "id">)
    }
  }

  // 5. Transaction : idempotence + mise à jour atomique
  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(playerRef)
    const player = snap.data() as Player

    const submitted: SubmittedFlag[] = player.submittedFlags ?? []
    if (submitted.some((s) => s.flagId === matched.id)) {
      return { kind: "already_found" as const, flag: { id: matched.id, label: matched.label } }
    }

    const nowMs = Date.now()
    const prevMs = player.lastFlagAt
      ? (player.lastFlagAt as unknown as AdminTimestamp).toMillis()
      : player.joinedAt
        ? (player.joinedAt as unknown as AdminTimestamp).toMillis()
        : nowMs
    const timeSincePrevious = Math.max(0, Math.round((nowMs - prevMs) / 1000))

    const newSubmission: SubmittedFlag = {
      flagId: matched.id,
      submittedAt: AdminTimestamp.fromMillis(nowMs) as unknown as SubmittedFlag["submittedAt"],
      timeSincePrevious,
      difficulty: matched.difficulty,
      weight: matched.weight,
      points: matched.points,
    }

    const totalFlags = scenario.flags!.length
    const newSubmitted = [...submitted, newSubmission]
    const newScore = (player.score ?? 0) + matched.points
    const newProgress = Math.round((newSubmitted.length / totalFlags) * 100)
    const completed = newSubmitted.length >= totalFlags

    const update: Record<string, unknown> = {
      submittedFlags: newSubmitted,
      score: newScore,
      progress: newProgress,
      lastFlagAt: FieldValue.serverTimestamp(),
      flagsTotal: totalFlags,
      status: completed ? "FINISHED" : "PLAYING",
    }
    if (completed) update.completedAt = FieldValue.serverTimestamp()

    tx.update(playerRef, update)

    return {
      kind: "success" as const,
      flag: {
        id: matched.id,
        label: matched.label,
        difficulty: matched.difficulty,
        points: matched.points,
      },
      timeSincePrevious,
      totalScore: newScore,
      progress: newProgress,
      completed,
    }
  })

  return result
}

