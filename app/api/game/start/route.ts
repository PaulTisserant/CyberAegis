import { NextRequest, NextResponse } from "next/server"
import { adminGetScenarioWithProxmox, adminCreateGameSession, adminUpdateGameSession } from "@/lib/firestore/admin-sync"
import { cloneTemplate, isProxmoxTimeoutError, startVM } from "@/lib/proxmox-api"

/**
 * POST /api/game/start
 * Démarre une nouvelle partie :
 * 1. Clone le template VM Proxmox
 * 2. Démarre la VM clonée
 * 3. Crée une GameSession en DB
 */
export async function POST(request: NextRequest) {
  try {
    // Récupérer et vérifier l'utilisateur connecté
    const authHeader = request.headers.get("Authorization")
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    }

    const token = authHeader.substring(7)
    let userId: string, organizationId: string

    try {
      // Vérifier le token JWT Firebase côté client (simple validation)
      // Note: pour une sécurité maximale, utiliser firebase-admin en production
      const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString())
      userId = payload.uid || payload.sub
      organizationId = payload.organization_id || ""

      if (!userId ) {
        return NextResponse.json({ error: "Token JWT invalide" }, { status: 401 })
      }
    } catch {
      return NextResponse.json({ error: "Token invalide" }, { status: 401 })
    }

    // Charger le scénario
    const { scenarioId } = await request.json()
    if (!scenarioId) {
      return NextResponse.json({ error: "scenarioId requis" }, { status: 400 })
    }

    const scenarioData = await adminGetScenarioWithProxmox(scenarioId)
    if (!scenarioData || !scenarioData.scenario) {
      return NextResponse.json({ error: "Scénario introuvable" }, { status: 404 })
    }

    const { scenario, template, server } = scenarioData
    if (!template || !server) {
      return NextResponse.json(
        { error: "Configuration Proxmox incomplète pour ce scénario" },
        { status: 500 }
      )
    }

    // Générer un VMID unique (pour l'instant : simple random, à améliorer)
    const cloneVmid = 1000 + Math.floor(Math.random() * 9000)

    // Récupérer l'organizationId depuis la DB du scénario
    const actualOrgId = scenario.organizationId

    // Créer la GameSession en DB (avant d'appeler Proxmox)
    const gameSessionId = await adminCreateGameSession({
      scenarioId,
      playerId: userId,
      status: "cloning",
      organizationId: actualOrgId,
    })

    try {
      // Étape 1 : Cloner le template
      console.log(
        `[Game] Cloning template ${template.vmid} → ${cloneVmid} (session ${gameSessionId})`
      )
      await cloneTemplate(
        server.host,
        server.token,
        server.node,
        template.vmid,
        cloneVmid,
        gameSessionId
      )

      // Attendre ~2s (clone lié est quasi-instantané)
      await new Promise((resolve) => setTimeout(resolve, 2000))

      // Étape 2 : Démarrer la VM clonée
      console.log(`[Game] Starting cloned VM ${cloneVmid}`)
      await startVM(server.host, server.token, server.node, cloneVmid)

      // Mettre à jour la GameSession avec les infos du clone
      await adminUpdateGameSession(gameSessionId, {
        cloneVmid,
        cloneNode: server.node,
        status: "starting",
      })

      return NextResponse.json({
        sessionId: gameSessionId,
        status: "starting",
        message: "VM clonée et démarrage en cours...",
      })
    } catch (err: any) {
      // Si erreur lors du clone/start, marquer la session comme erreur
      await adminUpdateGameSession(gameSessionId, { status: "error" })

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

      throw err
    }
  } catch (err: any) {
    console.error("[API /game/start] Erreur :", err)
    return NextResponse.json(
      { error: err.message || "Erreur serveur" },
      { status: 500 }
    )
  }
}
