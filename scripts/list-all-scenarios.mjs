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

const [sc, tmpl] = await Promise.all([
  db.collection('scenarios').get(),
  db.collection('proxmox_templates').get(),
])

const tMap = Object.fromEntries(tmpl.docs.map(d => [d.id, { name: d.data().name, vmid: d.data().vmid, org: d.data().organizationId }]))

console.log('\nTous les scénarios (actifs et inactifs) :')
sc.docs.forEach(d => {
  const data = d.data()
  const t = tMap[data.proxmoxTemplateId]
  const tInfo = t ? `"${t.name}" vmid=${t.vmid} org=${t.org}` : `(template ${data.proxmoxTemplateId} INTROUVABLE)`
  console.log(`  [${data.isActive ? 'ACTIF  ' : 'inactif'}] ID=${d.id} org=${data.organizationId}`)
  console.log(`     Nom     : "${data.name}"`)
  console.log(`     Template: ${tInfo}`)
  console.log(`     Flags   : ${data.flags?.length ?? 0}`)
  console.log()
})
