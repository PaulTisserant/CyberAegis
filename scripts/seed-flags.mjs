/**
 * Script de seeding des flags pour un scénario Proxmox
 * Usage : node scripts/seed-flags.mjs
 *
 * Ce script :
 *  1. Liste les scénarios disponibles dans Firestore
 *  2. Ajoute 3 flags au premier scénario trouvé (ou à celui précisé dans SCENARIO_ID)
 */

import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

// ─── Charger le .env manuellement ────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, "../.env")
const envContent = readFileSync(envPath, "utf8")
for (const line of envContent.split("\n")) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#")) continue
  const eqIdx = trimmed.indexOf("=")
  if (eqIdx === -1) continue
  const key = trimmed.slice(0, eqIdx).trim()
  let val = trimmed.slice(eqIdx + 1).trim()
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  process.env[key] = val.replace(/\\n/g, "\n")
}

// ─── Init Firebase Admin ──────────────────────────────────────────────────────
import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getFirestore, FieldValue } from "firebase-admin/firestore"

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY,
    }),
  })
}
const db = getFirestore()

// ─── Configuration ────────────────────────────────────────────────────────────
//
// Si tu veux cibler un scénario précis, mets son ID Firestore ici.
// Sinon laisse "" pour prendre le premier trouvé automatiquement.
const SCENARIO_ID = ""

// Les 3 flags à configurer — adapte les valeurs (value) à ceux dans ta VM
const FLAGS = [
  {
    id: "flag_env",
    label: "Le fichier de configuration du serveur",
    value: "FLAG{env_exposed}",          // ← chaîne exacte cachée dans la VM
    difficulty: "Facile",
    hint: "Cherche dans les fichiers .env ou de configuration à la racine du projet.",
  },
  {
    id: "flag_registry",
    label: "La clé secrète dans le registre Windows",
    value: "FLAG{reg1stry_secret}",      // ← chaîne exacte cachée dans la VM
    difficulty: "Moyen",
    hint: "Cherche dans HKCU\\Software ou HKLM\\Software.",
  },
  {
    id: "flag_logs",
    label: "Le mot de passe dans les logs",
    value: "FLAG{l0gs_never_lie}",       // ← chaîne exacte cachée dans la VM
    difficulty: "Difficile",
    hint: "Cherche dans C:\\logs\\ ou dans l'observateur d'événements.",
  },
]

// ─── Weights / points ─────────────────────────────────────────────────────────
const BASE_POINTS = 50
const WEIGHTS = { Facile: 1, Moyen: 2, Difficile: 4, Expert: 7 }

function computeFlag(f, order) {
  const weight = WEIGHTS[f.difficulty] ?? 1
  return {
    id: f.id,
    label: f.label,
    value: f.value,
    difficulty: f.difficulty,
    weight,
    points: weight * BASE_POINTS,
    hint: f.hint ?? null,
    order,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  // 1. Trouver le scénario
  let scenarioId = SCENARIO_ID
  let scenarioName = ""

  if (!scenarioId) {
    const snap = await db.collection("scenarios").where("isActive", "==", true).limit(10).get()
    if (snap.empty) {
      console.error("❌ Aucun scénario trouvé dans Firestore. Lance d'abord la sync Proxmox.")
      process.exit(1)
    }
    // Afficher la liste
    console.log("\n📋 Scénarios disponibles :")
    snap.docs.forEach((d, i) => {
      const data = d.data()
      console.log(`  [${i + 1}] ${d.id}  →  "${data.name}"  (${data.flags?.length ?? 0} flags existants)`)
    })
    // Prendre le premier
    const first = snap.docs[0]
    scenarioId = first.id
    scenarioName = first.data().name
    console.log(`\n▶ Cible automatique : "${scenarioName}" (${scenarioId})`)
  } else {
    const doc = await db.collection("scenarios").doc(scenarioId).get()
    if (!doc.exists) {
      console.error(`❌ Scénario ${scenarioId} introuvable.`)
      process.exit(1)
    }
    scenarioName = doc.data().name
    console.log(`▶ Cible forcée : "${scenarioName}" (${scenarioId})`)
  }

  // 2. Construire les flags normalisés
  const normalized = FLAGS.map((f, i) => computeFlag(f, i))

  // 3. Écrire dans Firestore
  await db.collection("scenarios").doc(scenarioId).update({
    flags: normalized,
    updatedAt: FieldValue.serverTimestamp(),
  })

  // 4. Résumé
  console.log(`\n✅ ${normalized.length} flags configurés sur "${scenarioName}" :\n`)
  const totalPts = normalized.reduce((a, f) => a + f.points, 0)
  normalized.forEach((f) => {
    console.log(`  ${f.order + 1}. [${f.difficulty} · ${f.points}pts]  ${f.label}`)
    console.log(`     value  = ${f.value}`)
    if (f.hint) console.log(`     indice = ${f.hint}`)
  })
  console.log(`\n  Total max : ${totalPts} pts\n`)
}

main().catch((err) => {
  console.error("❌ Erreur :", err.message)
  process.exit(1)
})
