/**
 * Script de réparation complète :
 * 1. Interroge Proxmox pour obtenir la liste réelle des templates VM
 * 2. Corrige les noms de templates dans Firestore
 * 3. Active les scénarios dont le vmid existe sur Proxmox
 * 4. Désactive les scénarios dont le vmid n'existe plus sur Proxmox
 * 5. Corrige les noms de scénarios corrompus
 */
import https from 'https'
import { URL } from 'url'
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

// ─── Appel Proxmox ─────────────────────────────────────────────────────────

function proxmoxGet(host, token, path) {
  return new Promise((resolve, reject) => {
    const url = new URL(`https://${host}/api2/json${path}`)
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname + url.search,
        method: 'GET',
        headers: { Authorization: token },
        rejectUnauthorized: process.env.PROXMOX_TLS_INSECURE === 'true' ? false : true,
        timeout: 12000,
      },
      res => {
        let raw = ''
        res.on('data', c => raw += c)
        res.on('end', () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            return reject(new Error(`HTTP ${res.statusCode}: ${raw}`))
          }
          try { resolve(JSON.parse(raw).data) } catch { resolve(null) }
        })
      }
    )
    req.on('error', reject)
    req.setTimeout(12000, () => req.destroy(new Error('Timeout Proxmox')))
    req.end()
  })
}

const host = process.env.PROXMOX_HOST
const token = process.env.PROXMOX_TOKEN
const node = process.env.PROXMOX_NODE
const prefix = (process.env.PROXMOX_TEMPLATE_PREFIX ?? '').toLowerCase()

if (!host || !token || !node || !prefix) {
  console.error('Variables PROXMOX_* manquantes dans .env')
  process.exit(1)
}

// ─── Récupérer les templates VM Proxmox ────────────────────────────────────

console.log(`\nConnexion à Proxmox ${host} nœud ${node}...`)
const vms = await proxmoxGet(host, token, `/nodes/${node}/qemu`)
const proxmoxTemplates = vms.filter(vm => vm.template === 1 && (vm.name ?? '').toLowerCase().startsWith(prefix))

console.log(`\nTemplates trouvés sur Proxmox (préfixe "${prefix}") :`)
if (proxmoxTemplates.length === 0) {
  console.log('  (aucun)')
} else {
  proxmoxTemplates.forEach(vm => console.log(`  vmid=${vm.vmid}  name="${vm.name}"`))
}

const proxmoxVmids = new Set(proxmoxTemplates.map(vm => vm.vmid))
const vmidToName = Object.fromEntries(proxmoxTemplates.map(vm => [vm.vmid, vm.name]))

// ─── Charger Firestore ──────────────────────────────────────────────────────

const [tmplSnap, scSnap] = await Promise.all([
  db.collection('proxmox_templates').get(),
  db.collection('scenarios').get(),
])

const templates = tmplSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
const scenarios = scSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))

console.log('\n─── Réparation des templates ──────────────────────────────────')

// Corriger les noms de templates dont le vmid existe sur Proxmox
for (const tmpl of templates) {
  const proxmoxName = vmidToName[tmpl.vmid]
  if (proxmoxName && tmpl.name !== proxmoxName) {
    console.log(`  Correction template ${tmpl.id} : "${tmpl.name}" → "${proxmoxName}" (vmid=${tmpl.vmid})`)
    await tmpl.ref.update({ name: proxmoxName, updatedAt: FieldValue.serverTimestamp() })
  }
}

console.log('\n─── Réparation des scénarios ──────────────────────────────────')

// Construire la map templateId → vmid et templateId → correctName
const templateById = Object.fromEntries(templates.map(t => [t.id, t]))

for (const sc of scenarios) {
  const tmpl = templateById[sc.proxmoxTemplateId]
  if (!tmpl) {
    // Template introuvable : désactiver si actif
    if (sc.isActive) {
      console.log(`  Désactivation "${sc.name}" (${sc.id}) — template introuvable`)
      await sc.ref.update({ isActive: false, updatedAt: FieldValue.serverTimestamp() })
    }
    continue
  }

  const proxmoxName = vmidToName[tmpl.vmid]
  const vmidExistsOnProxmox = proxmoxVmids.has(tmpl.vmid)

  if (!vmidExistsOnProxmox) {
    // VM supprimée de Proxmox → désactiver
    if (sc.isActive) {
      console.log(`  Désactivation "${sc.name}" (${sc.id}) — vmid=${tmpl.vmid} absent de Proxmox`)
      await sc.ref.update({ isActive: false, updatedAt: FieldValue.serverTimestamp() })
    }
    continue
  }

  // VM présente sur Proxmox → corriger le nom du scénario si nécessaire
  const expectedName = proxmoxName
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')

  const updates = {}

  if (!sc.isActive) {
    console.log(`  Réactivation "${sc.name}" (${sc.id}) — vmid=${tmpl.vmid} présent sur Proxmox`)
    updates.isActive = true
  }

  if (sc.name !== expectedName) {
    console.log(`  Renommage scénario (${sc.id}) : "${sc.name}" → "${expectedName}"`)
    updates.name = expectedName
  }

  if (Object.keys(updates).length > 0) {
    await sc.ref.update({ ...updates, updatedAt: FieldValue.serverTimestamp() })
  }
}

// ─── Dédoublonner : désactiver les scénarios en double pour le même templateId ─

console.log('\n─── Dédoublonnage des scénarios actifs ────────────────────────')

// Recharger après corrections
const scSnap2 = await db.collection('scenarios').where('isActive', '==', true).get()
/** @type {Map<string, Array>} */
const byTemplate = new Map()
for (const d of scSnap2.docs) {
  const key = `${d.data().organizationId}::${d.data().proxmoxTemplateId}`
  if (!byTemplate.has(key)) byTemplate.set(key, [])
  byTemplate.get(key).push({ id: d.id, ref: d.ref, ...d.data() })
}

for (const [key, group] of byTemplate.entries()) {
  if (group.length <= 1) continue
  // Garder celui avec le plus de flags, sinon le plus ancien
  group.sort((a, b) => ((b.flags?.length ?? 0) - (a.flags?.length ?? 0)) || ((a.createdAt?._seconds ?? 0) - (b.createdAt?._seconds ?? 0)))
  const keeper = group[0]
  for (const dup of group.slice(1)) {
    console.log(`  Doublon désactivé : "${dup.name}" (${dup.id}) — garde ${keeper.id}`)
    await dup.ref.update({ isActive: false, updatedAt: FieldValue.serverTimestamp() })
  }
}

// ─── Résultat final ─────────────────────────────────────────────────────────

console.log('\n─── État final ────────────────────────────────────────────────')
const finalSnap = await db.collection('scenarios').where('isActive', '==', true).get()
if (finalSnap.empty) {
  console.log('  (aucun scénario actif)')
} else {
  finalSnap.docs.forEach(d => {
    const data = d.data()
    const tmpl = templateById[data.proxmoxTemplateId]
    const vmid = tmpl?.vmid ?? '?'
    console.log(`  ✓ ACTIF [vmid=${vmid}] "${data.name}" — ${data.flags?.length ?? 0} flag(s)`)
  })
}
console.log()
