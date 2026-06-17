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
  db.collection('scenarios').where('isActive', '==', true).get(),
  db.collection('proxmox_templates').get(),
])

const tMap = Object.fromEntries(tmpl.docs.map(d => [d.id, d.data().name]))

console.log('\nScénarios + templates Proxmox liés :')
sc.docs.forEach(d => {
  const data = d.data()
  const tName = tMap[data.proxmoxTemplateId] ?? '(template inconnu)'
  const fCount = data.flags?.length ?? 0
  console.log(`  ID: ${d.id}`)
  console.log(`     Nom     : "${data.name}"`)
  console.log(`     Template: ${tName}`)
  console.log(`     Flags   : ${fCount}`)
  if (data.flags?.length) {
    data.flags.forEach(f => console.log(`       - ${f.id} [${f.difficulty}] "${f.label}" = ${f.value}`))
  }
  console.log()
})
