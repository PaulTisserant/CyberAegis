import { db } from "@/lib/firebase"
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  Timestamp,
  type Unsubscribe,
  onSnapshot,
} from "firebase/firestore"
import type { ProxmoxTemplate } from "@/lib/types"

const COL = "proxmox_templates"

export async function getProxmoxTemplates(organizationId: string): Promise<ProxmoxTemplate[]> {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProxmoxTemplate))
}

export async function getProxmoxTemplate(id: string): Promise<ProxmoxTemplate | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as ProxmoxTemplate
}

export function subscribeProxmoxTemplates(
  organizationId: string,
  callback: (items: ProxmoxTemplate[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId)
  )
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProxmoxTemplate))
      callback(items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()))
    },
    onError
  )
}

export async function createProxmoxTemplate(
  data: Omit<ProxmoxTemplate, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return ref.id
}

export async function updateProxmoxTemplate(
  id: string,
  data: Partial<Omit<ProxmoxTemplate, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function deleteProxmoxTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, COL, id))
}
