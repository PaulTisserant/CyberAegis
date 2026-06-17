/**
 * Supprime les templates proxmox_templates orphelins :
 * - templates d'une org qui n'existe plus / n'est pas l'org active
 * - templates avec le même vmid qu'un autre template de la même org (doublons)
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

// Récupérer les orgs valides (celles qui ont des utilisateurs actifs)
const usersSnap = await db.collection('users').where('isActive', '==', true).get()
const activeOrgs = new Set(usersSnap.docs.map(d => d.data().organizationId).filter(Boolean))
console.log('Orgs actives :', [...activeOrgs])

// Récupérer tous les templates
const tmplSnap = await db.collection('proxmox_templates').get()
const batch = db.batch()
let deleteCount = 0

// Par org, trouver les doublons de vmid
const seenVmids = new Map() // `orgId::vmid` → templateId (canonical)

for (const d of tmplSnap.docs) {
  const data = d.data()

  // Supprimer si l'org n'est plus active
  if (!activeOrgs.has(data.organizationId)) {
    console.log(`Suppression template org morte : ${d.id} (org=${data.organizationId}, name="${data.name}")`)
    batch.delete(d.ref)
    deleteCount++
    continue
  }

  const key = `${data.organizationId}::${data.vmid}`
  if (seenVmids.has(key)) {
    // Doublon : vérifier lequel a un scénario lié
    console.log(`Doublon détecté : ${d.id} (vmid=${data.vmid}, org=${data.organizationId})`)
    batch.delete(d.ref)
    deleteCount++
  } else {
    seenVmids.set(key, d.id)
  }
}

if (deleteCount > 0) {
  await batch.commit()
  console.log(`\n✓ ${deleteCount} template(s) supprimé(s)`)
} else {
  console.log('\n✓ Aucun template orphelin trouvé')
}
