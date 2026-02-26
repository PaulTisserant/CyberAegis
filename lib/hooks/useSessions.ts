"use client"

import { useEffect, useState } from "react"
import { subscribeSessions, subscribeSessionPlayers } from "@/lib/firestore/sessions"
import type { Session, Player } from "@/lib/types"

export function useSessions(organizationId: string) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    const unsub = subscribeSessions(
      organizationId,
      (items) => {
        setSessions(items)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [organizationId])

  return { sessions, loading, error }
}

export function useSessionPlayers(sessionId: string) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    const unsub = subscribeSessionPlayers(
      sessionId,
      (items) => {
        setPlayers(items)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [sessionId])

  return { players, loading, error }
}
