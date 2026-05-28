/**
 * Dédoublonnage des templates Proxmox et scénarios dans Firestore.
 * - Supprime les templates dupliqués (même name, garde le plus ancien)
 * - Réassigne les scénarios vers le template canonical
 * - Supprime les scénarios dupliqués (même proxmoxTemplateId, garde celui avec des flags)
 */
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '../.env')
const envContent = readFileSync(envPath, 'utf8')
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
import { getFirestore } from 'firebase-admin/firestore'

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

// ─── Étape 1 : Dédoublonner les templates ─────────────────────────────────

const tmplSnap = await db.collection('proxmox_templates').get()
/** @type {Map<string, Array<{id: string, data: any}>>} groupés par name */
const tmplByName = new Map()

for (const d of tmplSnap.docs) {
  const data = d.data()
  const key = `${data.organizationId}::${data.name}`
  if (!tmplByName.has(key)) tmplByName.set(key, [])
  tmplByName.get(key).push({ id: d.id, data })
}

/** ID canonical pour chaque nom de template (le plus ancien = createdAt le plus petit) */
const canonicalTemplateId = new Map() // name → id canonical
const duplicateTemplateIds = new Set()

for (const [key, group] of tmplByName.entries()) {
  if (group.length <= 1) {
    canonicalTemplateId.set(key, group[0].id)
    continue
  }
  // Trier par createdAt croissant → garder le premier (le plus ancien)
  group.sort((a, b) => {
    const tA = a.data.createdAt?._seconds ?? 0
    const tB = b.data.createdAt?._seconds ?? 0
    return tA - tB
  })
  const canonical = group[0]
  canonicalTemplateId.set(key, canonical.id)
  console.log(`[Templates] Canonique pour "${key}" : ${canonical.id} (vmid=${canonical.data.vmid})`)
  for (const dup of group.slice(1)) {
    duplicateTemplateIds.add(dup.id)
    console.log(`  → Doublon à supprimer : ${dup.id} (vmid=${dup.data.vmid})`)
  }
}

// ─── Étape 2 : Réassigner les scénarios pointant vers des templates dupliqués ─

const scSnap = await db.collection('scenarios').get()
const batch1 = db.batch()
let reassignCount = 0

for (const d of scSnap.docs) {
  const data = d.data()
  if (!duplicateTemplateIds.has(data.proxmoxTemplateId)) continue

  // Trouver le template canonical pour ce proxmoxTemplateId dupliqué
  const dupTmpl = tmplSnap.docs.find(t => t.id === data.proxmoxTemplateId)
  if (!dupTmpl) continue
  const key = `${dupTmpl.data().organizationId}::${dupTmpl.data().name}`
  const canonical = canonicalTemplateId.get(key)
  if (!canonical) continue

  console.log(`[Scenarios] Réassignation scénario "${data.name}" (${d.id}) : ${data.proxmoxTemplateId} → ${canonical}`)
  batch1.update(d.ref, { proxmoxTemplateId: canonical })
  reassignCount++
}

if (reassignCount > 0) {
  await batch1.commit()
  console.log(`[Scenarios] ${reassignCount} scénario(s) réassigné(s)`)
}

// ─── Étape 3 : Dédoublonner les scénarios (même proxmoxTemplateId) ─────────

// Recharger les scénarios après réassignation
const scSnap2 = await db.collection('scenarios').where('isActive', '==', true).get()
/** @type {Map<string, Array<{id: string, data: any, ref: any}>>} */
const scByTemplate = new Map()

for (const d of scSnap2.docs) {
  const data = d.data()
  const key = `${data.organizationId}::${data.proxmoxTemplateId}`
  if (!scByTemplate.has(key)) scByTemplate.set(key, [])
  scByTemplate.get(key).push({ id: d.id, data, ref: d.ref })
}

const batch2 = db.batch()
let deleteCount = 0

for (const [key, group] of scByTemplate.entries()) {
  if (group.length <= 1) continue

  // Garder celui avec le plus de flags, sinon le plus ancien
  group.sort((a, b) => {
    const flagsA = a.data.flags?.length ?? 0
    const flagsB = b.data.flags?.length ?? 0
    if (flagsB !== flagsA) return flagsB - flagsA
    return (a.data.createdAt?._seconds ?? 0) - (b.data.createdAt?._seconds ?? 0)
  })

  const keeper = group[0]
  console.log(`[Scenarios] Garde "${keeper.data.name}" (${keeper.id}) pour template ${key}`)
  for (const dup of group.slice(1)) {
    console.log(`  → Scénario doublon supprimé (isActive=false) : ${dup.id}`)
    batch2.update(dup.ref, { isActive: false })
    deleteCount++
  }
}

if (deleteCount > 0) {
  await batch2.commit()
  console.log(`[Scenarios] ${deleteCount} scénario(s) doublon(s) désactivé(s)`)
}

// ─── Étape 4 : Supprimer les templates dupliqués ─────────────────────────

const batch3 = db.batch()
for (const id of duplicateTemplateIds) {
  console.log(`[Templates] Suppression du template doublon : ${id}`)
  batch3.delete(db.collection('proxmox_templates').doc(id))
}

if (duplicateTemplateIds.size > 0) {
  await batch3.commit()
  console.log(`[Templates] ${duplicateTemplateIds.size} template(s) dupliqué(s) supprimé(s)`)
}

console.log('\n✓ Nettoyage terminé')
