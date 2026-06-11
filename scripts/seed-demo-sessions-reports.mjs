/**
 * Seed massif de sessions + rapports pour demo.
 * Usage: node scripts/seed-demo-sessions-reports.mjs
 */

import { readFileSync } from "fs"
import { resolve, dirname } from "path"
import { fileURLToPath } from "url"

// Charger le .env
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

import { initializeApp, cert, getApps } from "firebase-admin/app"
import { getFirestore, Timestamp, FieldValue } from "firebase-admin/firestore"

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

const SESSION_COUNT = 18
const MIN_PLAYERS = 4
const MAX_PLAYERS = 8

const FIRST_NAMES = [
  "Lina", "Marc", "Sonia", "Nora", "Ilyes", "Yanis", "Clara", "Noah", "Emma", "Hugo",
  "Jade", "Louis", "Lea", "Paul", "Mila", "Tom", "Anais", "Luca", "Ines", "Leo",
]
const LAST_NAMES = [
  "Martin", "Bernard", "Thomas", "Petit", "Robert", "Richard", "Durand", "Dubois", "Moreau", "Laurent",
]

const WEIGHT_BY_DIFFICULTY = {
  Facile: 1,
  Moyen: 2,
  Difficile: 4,
  Expert: 7,
}
const BASE_POINTS = 50

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick(arr) {
  return arr[randInt(0, arr.length - 1)]
}

function slug(s) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

function buildFallbackFlags() {
  return [
    { id: "flag_entry", label: "Point d'entree", difficulty: "Facile", order: 0, points: 50, weight: 1 },
    { id: "flag_priv", label: "Escalade de privileges", difficulty: "Moyen", order: 1, points: 100, weight: 2 },
    { id: "flag_data", label: "Exfiltration des donnees", difficulty: "Difficile", order: 2, points: 200, weight: 4 },
  ]
}

async function main() {
  const activeScenarioSnap = await db
    .collection("scenarios")
    .where("isActive", "==", true)
    .limit(1)
    .get()

  if (activeScenarioSnap.empty) {
    console.error("Aucun scenario actif trouve. Active un scenario puis relance.")
    process.exit(1)
  }

  const scenarioDoc = activeScenarioSnap.docs[0]
  const scenario = scenarioDoc.data()
  const scenarioId = scenarioDoc.id
  const scenarioName = scenario.name ?? "Scenario"
  const organizationId = scenario.organizationId

  const usersSnap = await db
    .collection("users")
    .where("organizationId", "==", organizationId)
    .limit(50)
    .get()

  const availableUsers = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const createdBy = availableUsers[0]?.id ?? "demo-admin"

  const scenarioFlagsRaw = Array.isArray(scenario.flags) && scenario.flags.length > 0
    ? scenario.flags
    : buildFallbackFlags()

  const scenarioFlags = scenarioFlagsRaw
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((f, idx) => ({
      id: f.id ?? `flag-${idx + 1}`,
      label: f.label ?? `Flag ${idx + 1}`,
      difficulty: f.difficulty ?? "Facile",
      order: f.order ?? idx,
      points: f.points ?? (WEIGHT_BY_DIFFICULTY[f.difficulty] ?? 1) * BASE_POINTS,
      weight: f.weight ?? (WEIGHT_BY_DIFFICULTY[f.difficulty] ?? 1),
    }))

  console.log(`Scenario cible: ${scenarioName} (${scenarioId})`)
  console.log(`Organisation : ${organizationId}`)
  console.log(`Creation de ${SESSION_COUNT} sessions + rapports...`)

  for (let i = 0; i < SESSION_COUNT; i += 1) {
    const daysAgo = randInt(1, 90)
    const startAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    startAt.setHours(randInt(8, 19), randInt(0, 59), randInt(0, 59), 0)

    const sessionName = `Demo ${scenarioName} #${String(i + 1).padStart(2, "0")}`
    const playerCount = randInt(MIN_PLAYERS, MAX_PLAYERS)

    const sessionRef = await db.collection("sessions").add({
      name: sessionName,
      scenarioId,
      scenarioName,
      date: startAt.toISOString(),
      status: "FINISHED",
      players: playerCount,
      organizationId,
      createdBy,
      createdAt: Timestamp.fromDate(startAt),
      updatedAt: FieldValue.serverTimestamp(),
    })

    const playerDatas = []

    for (let p = 0; p < playerCount; p += 1) {
      const u = availableUsers[p % Math.max(1, availableUsers.length)]
      const firstName = u?.firstName ?? pick(FIRST_NAMES)
      const lastName = u?.lastName ?? pick(LAST_NAMES)
      const displayName = `${firstName} ${lastName}`
      const userId = u?.id ?? `demo-${slug(displayName)}-${p + 1}`
      const email = u?.email ?? `${slug(firstName)}.${slug(lastName)}@demo.local`

      const totalFlags = scenarioFlags.length
      const foundCount = randInt(Math.max(1, Math.floor(totalFlags * 0.5)), totalFlags)
      const selectedFlags = scenarioFlags.slice(0, foundCount)

      let score = 0
      let elapsed = 0
      const submittedFlags = selectedFlags.map((f) => {
        const delta = randInt(40, 420)
        elapsed += delta
        score += f.points
        return {
          flagId: f.id,
          submittedAt: Timestamp.fromDate(new Date(startAt.getTime() + elapsed * 1000)),
          timeSincePrevious: delta,
          difficulty: f.difficulty,
          weight: f.weight,
          points: f.points,
        }
      })

      const progress = Math.round((foundCount / Math.max(1, totalFlags)) * 100)
      const finished = foundCount === totalFlags
      const durationSeconds = elapsed + randInt(30, 300)
      const joinedAt = Timestamp.fromDate(startAt)
      const completedAt = Timestamp.fromDate(new Date(startAt.getTime() + durationSeconds * 1000))

      await sessionRef.collection("players").add({
        userId,
        displayName,
        email,
        score,
        progress,
        joinedAt,
        completedAt,
        status: finished ? "FINISHED" : "PLAYING",
        submittedFlags,
        lastFlagAt: submittedFlags.at(-1)?.submittedAt ?? joinedAt,
        flagsTotal: totalFlags,
      })

      playerDatas.push({
        userId,
        displayName,
        score,
        progress,
        status: finished ? "FINISHED" : "PLAYING",
        flagsFound: foundCount,
        totalFlags,
        durationSeconds,
        submittedFlags,
      })
    }

    const totalPlayers = playerDatas.length
    const finishedCount = playerDatas.filter((p) => p.status === "FINISHED").length
    const completionRate = totalPlayers > 0 ? Math.round((finishedCount / totalPlayers) * 100) : 0
    const averageScore = totalPlayers > 0
      ? Math.round(playerDatas.reduce((acc, p) => acc + p.score, 0) / totalPlayers)
      : 0
    const averageDuration = totalPlayers > 0
      ? Math.round(playerDatas.reduce((acc, p) => acc + p.durationSeconds, 0) / totalPlayers / 60)
      : 0
    const maxScore = scenarioFlags.reduce((acc, f) => acc + f.points, 0)

    await db.collection("reports").add({
      sessionId: sessionRef.id,
      sessionName,
      organizationId,
      type: "Session",
      generatedAt: FieldValue.serverTimestamp(),
      data: {
        totalPlayers,
        completionRate,
        averageScore,
        averageDuration,
        totalFlags: scenarioFlags.length,
        maxScore,
        flags: scenarioFlags.map((f) => ({
          id: f.id,
          label: f.label,
          difficulty: f.difficulty,
          points: f.points,
          order: f.order,
        })),
        players: playerDatas,
      },
    })

    console.log(`- ${sessionName}: ${playerCount} joueur(s), rapport genere`) 
  }

  console.log("\nTermine. Tu peux ouvrir /app/sessions et /app/reports.")
}

main().catch((err) => {
  console.error("Erreur:", err)
  process.exit(1)
})
