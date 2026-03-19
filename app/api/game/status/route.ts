import { NextRequest, NextResponse } from "next/server"
import { getGameSession, updateGameSession } from "@/lib/firestore/game-sessions"
import { getScenarioWithProxmox } from "@/lib/firestore/scenarios"
import { getVMStatus, isProxmoxTimeoutError } from "@/lib/proxmox-api"

/**
 * GET /api/game/status?sessionId=X
 * Verifie le statut de la VM clonée
 * Retourne "running" quand la VM est prête
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier l'authentification
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    try {
      // Validation simple du JWT (voir commentaire dans start/route.ts)
      const token = authHeader.substring(7)
      JSON.parse(Buffer.from(token.split(".")[1], "base64").toString())
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    }

    // Récupérer la session de jeu
    const sessionId = request.nextUrl.searchParams.get("sessionId")
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId requis" }, { status: 400 })
    }

    const gameSession = await getGameSession(sessionId)
    if (!gameSession) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 })
    }

    const { cloneVmid, cloneNode } = gameSession

    if (gameSession.status === "error" || gameSession.status === "ended") {
      return NextResponse.json({
        status: gameSession.status,
        message: `Session ${gameSession.status}`,
        cloneVmid,
        cloneNode,
        checkedAt: new Date().toISOString(),
      })
    }

    // Récupérer les infos Proxmox
    const scenarioData = await getScenarioWithProxmox(gameSession.scenarioId)
    if (!scenarioData?.template || !scenarioData?.server) {
      return NextResponse.json(
        { error: "Configuration Proxmox introuvable" },
        { status: 500 }
      )
    }

    const { server } = scenarioData

    if (!cloneVmid || !cloneNode) {
      return NextResponse.json(
        { error: "Infos de clone incomplètes" },
        { status: 500 }
      )
    }

    // Vérifier le statut de la VM auprès de Proxmox
    try {
      const pingStartedAt = Date.now()
      const vmStatus = await getVMStatus(server.host, server.token, cloneNode, cloneVmid)
      const pingMs = Date.now() - pingStartedAt
      const checkedAt = new Date().toISOString()

      if (vmStatus.status === "running") {
        // Mettre à jour la session
        await updateGameSession(sessionId, { status: "running" })

        return NextResponse.json({
          status: "running",
          exactVmStatus: vmStatus.status,
          wsUrl: `/api/vnc-proxy?sessionId=${sessionId}`,
          cloneVmid,
          cloneNode,
          uptime: vmStatus.uptime,
          pingMs,
          checkedAt,
        })
      }

      return NextResponse.json({
        status: vmStatus.status,
        exactVmStatus: vmStatus.status,
        message: `VM actuellement : ${vmStatus.status}`,
        cloneVmid,
        cloneNode,
        uptime: vmStatus.uptime,
        pingMs,
        checkedAt,
      })
    } catch (err: any) {
      console.error("[API /game/status] Erreur Proxmox :", err)
      const errCode = typeof err?.code === "string" ? err.code : "UNKNOWN"
      const timeout = isProxmoxTimeoutError(err)
      return NextResponse.json(
        {
          error: timeout
            ? "Connexion Proxmox indisponible (timeout)"
            : "Impossible de vérifier le statut Proxmox",
          errorType: "PROXMOX_CONNECTION",
          errorCode: timeout ? "ETIMEDOUT" : errCode,
          message: err?.message ?? "Connexion Proxmox indisponible",
        },
        { status: timeout ? 504 : 503 }
      )
    }
  } catch (err: any) {
    console.error("[API /game/status] Erreur :", err)
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    )
  }
}
