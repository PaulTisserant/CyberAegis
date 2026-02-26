"use client"

import { useEffect, useState } from "react"
import { subscribeScenarios } from "@/lib/firestore/scenarios"
import type { Scenario } from "@/lib/types"

export function useScenarios(organizationId: string) {
  const [scenarios, setScenarios] = useState<Scenario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    const unsub = subscribeScenarios(
      organizationId,
      (items) => {
        setScenarios(items)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [organizationId])

  return { scenarios, loading, error }
}
