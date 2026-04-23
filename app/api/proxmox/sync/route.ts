import { NextRequest, NextResponse } from "next/server"
import { synchronizeProxmoxScenarios } from "@/lib/firestore/proxmox-sync"
import { isProxmoxTimeoutError } from "@/lib/proxmox-api"

/**
 * POST /api/proxmox/sync
 * Lance la synchronisation des templates Proxmox -> templates/scénarios Firestore.
 * Exécuté côté serveur pour accéder aux variables PROXMOX_*.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    // Validation JWT minimale (même approche que les routes /api/game)
    try {
      const token = authHeader.substring(7)
      JSON.parse(Buffer.from(token.split(".")[1], "base64").toString())
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({} as Record<string, unknown>))
    const organizationId = typeof body.organizationId === "string" ? body.organizationId : ""

    if (!organizationId) {
      return NextResponse.json({ error: "organizationId requis" }, { status: 400 })
    }

    await synchronizeProxmoxScenarios(organizationId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (isProxmoxTimeoutError(err)) {
      return NextResponse.json(
        {
          error: "Connexion Proxmox indisponible (timeout)",
          errorType: "PROXMOX_CONNECTION",
          errorCode: "ETIMEDOUT",
        },
        { status: 503 }
      )
    }

    const message = err instanceof Error ? err.message : "Erreur serveur"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
