/**
 * DÉPRÉCIÉ — ce script ne doit plus être utilisé.
 * Utilisez plutôt : node scripts/repair-scenarios.mjs
 * qui interroge Proxmox directement et réconcilie Firestore.
 */
console.error('Ce script est déprécié. Utilisez : node scripts/repair-scenarios.mjs')
process.exit(1)

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(resolve(__dir, '../.env'), 'utf8')
for (const line of envContent.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const i = t.indexOf('=')
  if (i === -1) continue
  let v = t.slice(i + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  process.env[t.slice(0, i).trim()] = v.replace(/\\n/g, '\n')
}

import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

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

// 1. Récupérer TOUS les scénarios (actifs et inactifs)
const scenariosSnap = await db.collection('scenarios').get()
const templatesSnap = await db.collection('proxmox_templates').get()

console.log('\n=== État actuel Firestore ===\n')

const templates = templatesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
const tMap = Object.fromEntries(templates.map(t => [t.id, t.name]))

const toDisable = []

for (const d of scenariosSnap.docs) {
  const data = d.data()
  const tName = tMap[data.proxmoxTemplateId] ?? '(inconnu)'
  const status = data.isActive ? 'ACTIF' : 'inactif'
  console.log(`  ${d.id} | ${status} | "${data.name}" | template: ${tName} | flags: ${data.flags?.length ?? 0}`)

  // Désactiver tout ce qui n'est PAS scenario-1 et qui est actif
  if (data.isActive && !tName.endsWith('scenario-1') && tName !== '(inconnu)') {
    toDisable.push({ id: d.id, name: data.name, reason: `template ${tName} indésirable` })
  }
  // Désactiver aussi les orphelins (template inconnu) s'ils sont actifs
  if (data.isActive && tName === '(inconnu)') {
    toDisable.push({ id: d.id, name: data.name, reason: 'template inconnu' })
  }
}

if (toDisable.length === 0) {
  console.log('\n✓ Aucun scénario parasite trouvé.\n')
} else {
  console.log('\n=== Désactivation ===\n')
  for (const sc of toDisable) {
    await db.collection('scenarios').doc(sc.id).update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    })
    console.log(`  ✓ Désactivé : "${sc.name}" (${sc.id}) — ${sc.reason}`)
  }
}

// 2. Désactiver les templates proxmox_templates pour scenario-2 (s'il y en a)
const toRemoveTemplates = templates.filter(t => t.name && !t.name.endsWith('scenario-1'))
if (toRemoveTemplates.length > 0) {
  console.log('\n=== Templates Proxmox parasites ===\n')
  for (const t of toRemoveTemplates) {
    // On ne supprime pas, on laisse juste un log (les templates n'ont pas isActive)
    console.log(`  ⚠ Template en DB : "${t.name}" (${t.id}) — si ce template n'existe pas sur Proxmox, il sera ignoré à la prochaine sync`)
  }
}

console.log('\n=== Résultat final ===\n')
const finalSnap = await db.collection('scenarios').where('isActive', '==', true).get()
finalSnap.docs.forEach(d => {
  const data = d.data()
  const tName = tMap[data.proxmoxTemplateId] ?? '(inconnu)'
  console.log(`  ✓ ACTIF : "${data.name}" | template: ${tName} | flags: ${data.flags?.length ?? 0}`)
})
console.log()
