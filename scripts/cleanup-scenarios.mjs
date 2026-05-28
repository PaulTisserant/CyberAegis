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

// Désactiver le doublon "Cyberaegis Scenario 1" sans flags
await db.collection('scenarios').doc('fG2GKPMH2R4FhZbTg17O').update({
  isActive: false,
  updatedAt: FieldValue.serverTimestamp(),
})
// Désactiver "phishing" sans template
await db.collection('scenarios').doc('JWnaV2l3sUIG7VQaAs3a').update({
  isActive: false,
  updatedAt: FieldValue.serverTimestamp(),
})

console.log('✓ Doublon "Cyberaegis Scenario 1" (fG2GKPMH2R4FhZbTg17O) désactivé')
console.log('✓ Scénario "phishing" sans template (JWnaV2l3sUIG7VQaAs3a) désactivé')
console.log('\nScénario actif restant :')
console.log('  1w4z8FFYnSfEPopvuYDZ  →  "Cyberaegis Scenario 1"  →  3 flags configurés')
