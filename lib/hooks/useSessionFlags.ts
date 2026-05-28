"use client"

import { useEffect, useState } from "react"
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { getScenarioFlagsPublic } from "@/lib/firestore/scenarios"
import type { GameSession, Player, PublicScenarioFlag } from "@/lib/types"

/**
 * Résout le couple (scenarioId, parentSessionId) depuis un gameSessionId.
 * Le gameSessionId est l'ID dans la collection `game_sessions`.
 * Le parentSessionId est l'ID dans la collection `sessions` (lien posé par attachGameSessionToSession).
 */
async function resolveGameSession(
  gameSessionId: string
): Promise<{ scenarioId: string; parentSessionId: string } | null> {
  const snap = await getDoc(doc(db, "game_sessions", gameSessionId))
  if (!snap.exists()) return null
  const gs = snap.data() as GameSession
  if (!gs.parentSessionId) return null
  return { scenarioId: gs.scenarioId, parentSessionId: gs.parentSessionId }
}

/**
 * Charge (one-shot) la liste publique des flags du scénario lié à un gameSessionId.
 * Ne contient jamais le champ `value` (envoyé seulement côté serveur).
 */
export function useSessionFlags(gameSessionId: string | null) {
  const [flags, setFlags] = useState<PublicScenarioFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameSessionId) return
    let cancelled = false
    setLoading(true)
    ;(async () => {
      try {
        const resolved = await resolveGameSession(gameSessionId)
        if (!resolved) throw new Error("Session de jeu introuvable ou non encore liée")
        const list = await getScenarioFlagsPublic(resolved.scenarioId)
        if (!cancelled) {
          setFlags(list)
          setLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erreur de chargement des flags")
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [gameSessionId])

  return { flags, loading, error }
}

/**
 * Écoute en temps réel le doc Player correspondant à `userId`
 * dans la sous-collection `sessions/{parentSessionId}/players`.
 * Passe par `game_sessions/{gameSessionId}.parentSessionId` pour trouver la bonne session.
 */
export function usePlayerInSession(gameSessionId: string | null, userId: string | null) {
  const [player, setPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!gameSessionId || !userId) return

    let unsub: (() => void) | undefined
    let cancelled = false

    resolveGameSession(gameSessionId).then((resolved) => {
      if (cancelled || !resolved) {
        if (!cancelled) {
          setPlayer(null)
          setLoading(false)
        }
        return
      }
      const q = query(
        collection(db, "sessions", resolved.parentSessionId, "players"),
        where("userId", "==", userId)
      )
      unsub = onSnapshot(
        q,
        (snap) => {
          const docSnap = snap.docs[0]
          setPlayer(docSnap ? ({ id: docSnap.id, ...docSnap.data() } as Player) : null)
          setLoading(false)
        },
        (err) => {
          setError(err.message)
          setLoading(false)
        }
      )
    })

    return () => {
      cancelled = true
      unsub?.()
    }
  }, [gameSessionId, userId])

  return { player, loading, error }
}

