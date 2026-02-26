"use client"

import { useEffect, useState } from "react"
import { subscribeUsers } from "@/lib/firestore/users"
import type { User } from "@/lib/types"

export function useUsers(organizationId: string) {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    const unsub = subscribeUsers(
      organizationId,
      (items) => {
        setUsers(items)
        setLoading(false)
      },
      (err) => {
        setError(err.message)
        setLoading(false)
      }
    )
    return () => unsub()
  }, [organizationId])

  return { users, loading, error }
}
