import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/firebase"
import { getGameSession, updateGameSession } from "@/lib/firestore/game-sessions"
import { getScenarioWithProxmox } from "@/lib/firestore/scenarios"
import { deleteVM, isProxmoxTimeoutError, stopVM } from "@/lib/proxmox-api"

/**
 * POST /api/game/end
 * Termine une partie et nettoie la VM :
 * 1. Arrête la VM clonée
 * 2. La supprime de Proxmox
 * 3. Marque la GameSession comme "ended"
 */
export async function POST(request: NextRequest) {
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

    // Récupérer l'ID de la session de jeu
    const { sessionId } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId requis" }, { status: 400 })
    }

    const gameSession = await getGameSession(sessionId)
    if (!gameSession) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 })
    }

    const { cloneVmid, cloneNode } = gameSession
    if (!cloneVmid || !cloneNode) {
      // Session n'a jamais eu de VM clonée (erreur au démarrage)
      await updateGameSession(sessionId, { status: "ended", endedAt: new Date() as any })
      return NextResponse.json({
        status: "ended",
        message: "Session terminée (pas de VM à nettoyer)",
      })
    }

    // Récupérer les infos Proxmox
    const scenarioData = await getScenarioWithProxmox(gameSession.scenarioId)
    if (!scenarioData?.server) {
      console.warn(
        `[API /game/end] Impossible de trouver serveur Proxmox pour session ${sessionId}`
      )
      // Même sans serveur, marquer comme ended
      await updateGameSession(sessionId, { status: "ended", endedAt: new Date() as any })
      return NextResponse.json({
        status: "ended",
        message: "Session terminée (serveur Proxmox non trouvé)",
      })
    }

    const { server } = scenarioData

    try {
      // Étape 1 : Arrêter la VM
      console.log(`[Game] Stopping VM ${cloneVmid}...`)
      try {
        await stopVM(server.host, server.token, cloneNode, cloneVmid)
      } catch (err) {
        console.warn(`[Game] Erreur lors de l'arrêt de la VM : ${err}`)
        // Continuer malgré l'erreur
      }

      // Attendre 1s après arrêt
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Étape 2 : Supprimer la VM
      console.log(`[Game] Deleting VM ${cloneVmid}...`)
      await deleteVM(server.host, server.token, cloneNode, cloneVmid)

      // Étape 3 : Marquer la session comme ended
      await updateGameSession(sessionId, {
        status: "ended",
        endedAt: new Date() as any,
      })

      return NextResponse.json({
        status: "ended",
        message: "VM nettoyée et session terminée",
      })
    } catch (err: any) {
      console.error(`[API /game/end] Erreur nettoyage VM ${cloneVmid}:`, err)
      // Même si le nettoyage échoue, marquer comme ended
      await updateGameSession(sessionId, { status: "ended", endedAt: new Date() as any })

      if (isProxmoxTimeoutError(err)) {
        return NextResponse.json(
          {
            status: "ended",
            warning: "Session terminée, mais Proxmox n'a pas répondu à temps",
            error: "Connexion Proxmox indisponible (timeout)",
            errorType: "PROXMOX_CONNECTION",
            errorCode: "ETIMEDOUT",
          },
          { status: 503 }
        )
      }

      return NextResponse.json(
        {
          status: "ended",
          warning: "Session marquée ended, mais nettoyage Proxmox a échoué",
          error: err.message,
        },
        { status: 503 }
      )
    }
  } catch (err: any) {
    console.error("[API /game/end] Erreur :", err)
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    )
  }
}
