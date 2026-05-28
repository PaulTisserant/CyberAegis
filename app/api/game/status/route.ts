import { NextRequest, NextResponse } from "next/server"
import { adminGetGameSession as getGameSession, adminUpdateGameSession as updateGameSession, adminGetScenarioWithProxmox as getScenarioWithProxmox } from "@/lib/firestore/admin-sync"
import { getVMStatus, startVM, isProxmoxTimeoutError } from "@/lib/proxmox-api"

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

      // VM arrêtée → la redémarrer automatiquement
      if (vmStatus.status === "stopped") {
        console.log(`[API /game/status] VM ${cloneVmid} arrêtée — redémarrage automatique`)
        try {
          await startVM(server.host, server.token, cloneNode, cloneVmid)
          await updateGameSession(sessionId, { status: "starting" })
        } catch (startErr) {
          console.error("[API /game/status] Échec du redémarrage automatique :", startErr)
        }

        return NextResponse.json({
          status: "starting",
          exactVmStatus: vmStatus.status,
          message: "VM arrêtée — redémarrage en cours",
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
    } catch (err: unknown) {
      console.error("[API /game/status] Erreur Proxmox :", err)
      const errMsg = err instanceof Error ? err.message : String(err)
      const errCode = (err as { code?: string })?.code ?? "UNKNOWN"

      // La VM n'existe plus sur Proxmox (supprimée manuellement ou par cleanup)
      const vmNotFound =
        errMsg.includes("does not exist") ||
        errMsg.includes("Configuration file") ||
        errMsg.includes("no such vm") ||
        errMsg.includes("HTTP 500")

      if (vmNotFound) {
        console.log(`[API /game/status] VM ${cloneVmid} introuvable — session marquée comme terminée`)
        try {
          await updateGameSession(sessionId, { status: "ended" })
        } catch (updateErr) {
          console.error("[API /game/status] Impossible de mettre à jour la session :", updateErr)
        }
        return NextResponse.json({
          status: "ended",
          message: "La VM n'existe plus sur Proxmox",
          cloneVmid,
          cloneNode,
          checkedAt: new Date().toISOString(),
        })
      }

      const timeout = isProxmoxTimeoutError(err)
      return NextResponse.json(
        {
          error: timeout
            ? "Connexion Proxmox indisponible (timeout)"
            : "Impossible de vérifier le statut Proxmox",
          errorType: "PROXMOX_CONNECTION",
          errorCode: timeout ? "ETIMEDOUT" : errCode,
          message: errMsg || "Connexion Proxmox indisponible",
        },
        { status: timeout ? 504 : 503 }
      )
    }
  } catch (err: unknown) {
    console.error("[API /game/status] Erreur :", err)
    const msg = err instanceof Error ? err.message : "Erreur serveur"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
