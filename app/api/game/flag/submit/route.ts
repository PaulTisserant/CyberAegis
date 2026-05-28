import { NextRequest, NextResponse } from "next/server"
import { adminSubmitFlag } from "@/lib/firestore/player-flags"

/**
 * POST /api/game/flag/submit
 * Body: { sessionId: string, flag: string }
 * Header: Authorization: Bearer <Firebase idToken>
 *
 * Réponses :
 *  200 { success: true, flag, points, timeSincePrevious, totalScore, progress, completed }
 *  200 { alreadyFound: true, flag: { id, label } }
 *  200 { invalid: true }
 *  400 { error }       - paramètres manquants
 *  401 { error }       - pas de token
 *  403 { error }       - org mismatch / pas joueur de cette session
 *  404 { error }       - session ou scénario introuvable
 *  429 { error }       - throttling
 */

// Throttle simple en mémoire : 1 soumission / seconde / utilisateur.
// En prod multi-instance, remplacer par Firestore/Redis.
const lastSubmissionByUser = new Map<string, number>()
const THROTTLE_MS = 1000

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    let userId: string
    let organizationId: string
    try {
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString())
      userId = payload.uid || payload.sub
      organizationId = payload.organization_id || ""
      if (!userId) {
        return NextResponse.json({ error: "Token JWT invalide" }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    }

    // Throttling
    const now = Date.now()
    const last = lastSubmissionByUser.get(userId) ?? 0
    if (now - last < THROTTLE_MS) {
      return NextResponse.json(
        { error: "Trop de soumissions, ralentis un peu." },
        { status: 429 }
      )
    }
    lastSubmissionByUser.set(userId, now)

    const body = await request.json().catch(() => null)
    const sessionId = body?.sessionId
    const flag = body?.flag
    if (typeof sessionId !== "string" || typeof flag !== "string" || !flag.trim()) {
      return NextResponse.json(
        { error: "sessionId et flag (non vide) requis" },
        { status: 400 }
      )
    }
    if (flag.length > 200) {
      return NextResponse.json({ error: "Flag trop long" }, { status: 400 })
    }

    const result = await adminSubmitFlag(sessionId, userId, flag, organizationId)

    switch (result.kind) {
      case "success":
        return NextResponse.json({
          success: true,
          flag: result.flag,
          timeSincePrevious: result.timeSincePrevious,
          totalScore: result.totalScore,
          progress: result.progress,
          completed: result.completed,
        })
      case "already_found":
        return NextResponse.json({ alreadyFound: true, flag: result.flag })
      case "invalid":
        return NextResponse.json({ invalid: true })
      case "session_not_found":
        return NextResponse.json({ error: "Session introuvable" }, { status: 404 })
      case "scenario_no_flags":
        return NextResponse.json(
          { error: "Ce scénario n'a pas de flags configurés" },
          { status: 404 }
        )
      case "forbidden":
        return NextResponse.json(
          { error: "Vous n'êtes pas joueur de cette session" },
          { status: 403 }
        )
    }
  } catch (err) {
    console.error("[API /game/flag/submit] erreur :", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur inconnue" },
      { status: 500 }
    )
  }
}
