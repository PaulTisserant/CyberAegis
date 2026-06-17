/**
 * Configure les flags du scénario 1 (cyberaegis-scenario-1, VMID 201)
 * Usage : node scripts/set-flags-scenario1.mjs
 */

import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

// ─── Charger le .env ──────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(resolve(__dir, "../.env"), "utf8")
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
import { getFirestore } from "firebase-admin/firestore"

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

// ─── Scénario cible ───────────────────────────────────────────────────────────
// Scénario actif "Cyberaegis Scenario 1" (vmid=201, org principale)
const SCENARIO_ID = "lP3oGLf9P4uYyrehYw4O"

// ─── Flags ────────────────────────────────────────────────────────────────────
const BASE_POINTS = 50
const WEIGHTS = { Facile: 1, Moyen: 2, Difficile: 4, Expert: 7 }

const FLAGS = [
  {
    id: "flag_env_exposed",
    label: "La variable d'environnement exposée",
    value: "flag{env_exposed}",
    difficulty: "Facile",
    hint: "Cherche dans le partage réseau au niveau des dossiers de développement.",
  },
  {
    id: "flag_compta_pass",
    label: "Le mot de passe du serveur comptabilité",
    value: "flag{C0mpta-123!}",
    difficulty: "Moyen",
    hint: "Josianne a mentionné à la machine à café qu'elle stocke ses mots de passe dans son dossier personnel.",
  },
  {
    id: "flag_marc_erp",
    label: "Le mot de passe ERP de Marc",
    value: "flag{marc-erp-523}",
    difficulty: "Difficile",
    hint: "Accède au serveur de la comptabilité — Marc y stocke ses identifiants ERP.",
  },
]

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const docRef = db.collection("scenarios").doc(SCENARIO_ID)
  const snap = await docRef.get()

  if (!snap.exists) {
    console.error(`❌ Scénario "${SCENARIO_ID}" introuvable dans Firestore.`)
    process.exit(1)
  }

  const scenarioName = snap.data().name
  const existingFlags = snap.data().flags ?? []
  console.log(`\n▶ Scénario : "${scenarioName}" (${SCENARIO_ID})`)
  console.log(`  Flags existants : ${existingFlags.length}`)

  const normalized = FLAGS.map((f, i) => {
    const weight = WEIGHTS[f.difficulty] ?? 1
    return {
      id: f.id,
      label: f.label,
      value: f.value,
      difficulty: f.difficulty,
      weight,
      points: weight * BASE_POINTS,
      hint: f.hint ?? null,
      order: i,
    }
  })

  await docRef.update({
    flags: normalized,
    updatedAt: new Date(),
  })

  console.log(`\n✅ ${normalized.length} flags enregistrés :`)
  normalized.forEach((f) => {
    console.log(`  [${f.difficulty.padEnd(10)}] ${f.value}  →  "${f.label}"  (${f.points} pts)`)
  })
  console.log()
}

main().catch((err) => {
  console.error("❌ Erreur :", err.message)
  process.exit(1)
})
