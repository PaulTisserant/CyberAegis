"use client"

import { useEffect, useState } from "react"
import { getReports } from "@/lib/firestore/reports"
import type { Report } from "@/lib/types"

export function useReports(organizationId: string) {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!organizationId) return
    setLoading(true)
    getReports(organizationId)
      .then((items) => {
        setReports(items)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [organizationId])

  return { reports, loading, error }
}
