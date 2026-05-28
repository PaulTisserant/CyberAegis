import { NextRequest, NextResponse } from "next/server"
import { FieldValue } from "firebase-admin/firestore"
import { getAdminDb } from "@/lib/firebase-admin"
import { adminGetGameSession as getGameSession, adminUpdateGameSession as updateGameSession, adminGetScenarioWithProxmox as getScenarioWithProxmox, adminGenerateSessionReport } from "@/lib/firestore/admin-sync"
import { deleteVM, isProxmoxTimeoutError, stopVM } from "@/lib/proxmox-api"

/**
 * Efface `gameSessionId` + `vmStatus` sur toute Session parente qui pointe sur ce gameSession,
 * et passe son status à FINISHED. Rend `/api/game/end` idempotent.
 */
async function clearParentSessionLink(gameSessionId: string): Promise<void> {
  try {
    const db = getAdminDb()
    const snap = await db
      .collection("sessions")
      .where("gameSessionId", "==", gameSessionId)
      .get()
    if (snap.empty) return
    const batch = db.batch()
    for (const docSnap of snap.docs) {
      batch.update(docSnap.ref, {
        gameSessionId: FieldValue.delete(),
        vmStatus: FieldValue.delete(),
        status: "FINISHED",
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
    await batch.commit()

    // Générer les rapports pour chaque session parente terminée
    for (const docSnap of snap.docs) {
      const sessionData = docSnap.data()
      try {
        await adminGenerateSessionReport(docSnap.id, sessionData.organizationId ?? "")
        console.log(`[API /game/end] Rapport généré pour session ${docSnap.id}`)
      } catch (err) {
        console.warn(`[API /game/end] Echec génération rapport session ${docSnap.id}:`, err)
      }
    }
  } catch (err) {
    console.warn("[API /game/end] Echec clearParentSessionLink :", err)
  }
}

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

    // Récupérer l'ID de la session de jeu (query param ou body)
    let sessionId: string | null = new URL(request.url).searchParams.get("sessionId")
    if (!sessionId) {
      const body = await request.json().catch(() => ({} as Record<string, unknown>))
      sessionId = typeof body.sessionId === "string" ? body.sessionId : null
    }
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId requis" }, { status: 400 })
    }

    const gameSession = await getGameSession(sessionId)
    if (!gameSession) {
      return NextResponse.json({ error: "Session introuvable" }, { status: 404 })
    }

    const { cloneVmid, cloneNode } = gameSession
    if (!cloneVmid || !cloneNode) {
      // Session n'a jamais eu de VM clonée (erreur au démarrage) ou déjà nettoyée
      await updateGameSession(sessionId, { status: "ended", endedAt: new Date() as any })
      await clearParentSessionLink(sessionId)
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
      // Même sans serveur, marquer comme ended et nettoyer les références
      await getAdminDb().collection("game_sessions").doc(sessionId).update({
        status: "ended",
        endedAt: FieldValue.serverTimestamp(),
        cloneVmid: FieldValue.delete(),
        cloneNode: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      await clearParentSessionLink(sessionId)
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
        // Continuer malgré l'erreur (VM peut déjà être arrêtée ou absente)
      }

      // Attendre 1s après arrêt
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Étape 2 : Supprimer la VM
      console.log(`[Game] Deleting VM ${cloneVmid}...`)
      try {
        await deleteVM(server.host, server.token, cloneNode, cloneVmid)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        // VM introuvable sur Proxmox (déjà supprimée ou jamais créée) → on continue
        if (msg.includes("does not exist") || msg.includes("HTTP 500") || msg.includes("HTTP 404")) {
          console.warn(`[Game] VM ${cloneVmid} introuvable sur Proxmox, ignoré : ${msg}`)
        } else {
          throw err
        }
      }

      // Étape 3 : Marquer la session comme ended ET nettoyer les références VM
      // pour rendre /api/game/end idempotent (un 2e appel ne retentera pas le delete).
      await getAdminDb().collection("game_sessions").doc(sessionId).update({
        status: "ended",
        endedAt: FieldValue.serverTimestamp(),
        cloneVmid: FieldValue.delete(),
        cloneNode: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      await clearParentSessionLink(sessionId)

      return NextResponse.json({
        status: "ended",
        message: "VM nettoyée et session terminée",
      })
    } catch (err: any) {
      console.error(`[API /game/end] Erreur nettoyage VM ${cloneVmid}:`, err)
      // Même si le nettoyage échoue, marquer comme ended et nettoyer les références
      await getAdminDb().collection("game_sessions").doc(sessionId).update({
        status: "ended",
        endedAt: FieldValue.serverTimestamp(),
        cloneVmid: FieldValue.delete(),
        cloneNode: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      await clearParentSessionLink(sessionId)

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
