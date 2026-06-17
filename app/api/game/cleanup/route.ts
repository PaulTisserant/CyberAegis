import { NextRequest, NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"

/**
 * POST /api/game/cleanup
 * Marque toutes les game_sessions actives (cloning/starting/running) comme "ended".
 * Utilitaire de secours pour stopper les boucles VNC sur des sessions orphelines
 * (par ex. cloneVmid pointant sur le template apr\u00e8s un bug d'allocation).
 *
 * Body optionnel : { cloneVmid?: number, scenarioId?: string }
 *   - si cloneVmid fourni : ne nettoie que les sessions matchant ce VMID
 *   - si scenarioId fourni : ne nettoie que les sessions de ce sc\u00e9nario
 *   - sinon : nettoie toutes les sessions actives
 *
 * Auth : Bearer JWT Firebase requis.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non authentifi\u00e9" }, { status: 401 })
  }

  try {
    const token = authHeader.substring(7)
    JSON.parse(Buffer.from(token.split(".")[1], "base64").toString())
  } catch {
    return NextResponse.json({ error: "Token invalide" }, { status: 401 })
  }

  let cloneVmidFilter: number | undefined
  let scenarioIdFilter: string | undefined
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body?.cloneVmid === "number") cloneVmidFilter = body.cloneVmid
    if (typeof body?.scenarioId === "string") scenarioIdFilter = body.scenarioId
  } catch {
    // body absent/invalide \u2014 on continue sans filtre
  }

  const db = getAdminDb()
  const ACTIVE_STATUSES = ["cloning", "starting", "running"]

  let query: FirebaseFirestore.Query = db
    .collection("game_sessions")
    .where("status", "in", ACTIVE_STATUSES)

  if (typeof cloneVmidFilter === "number") {
    query = query.where("cloneVmid", "==", cloneVmidFilter)
  }
  if (scenarioIdFilter) {
    query = query.where("scenarioId", "==", scenarioIdFilter)
  }

  const snap = await query.get()
  if (snap.empty) {
    return NextResponse.json({ updated: 0, ids: [] })
  }

  const batch = db.batch()
  const ids: string[] = []
  for (const doc of snap.docs) {
    batch.update(doc.ref, {
      status: "ended",
      updatedAt: FieldValue.serverTimestamp(),
    })
    ids.push(doc.id)
  }
  await batch.commit()

  return NextResponse.json({ updated: ids.length, ids })
}
