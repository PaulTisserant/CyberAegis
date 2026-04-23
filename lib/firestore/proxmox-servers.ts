import { db } from "@/lib/firebase"
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  query,
  where,
  Timestamp,
  type Unsubscribe,
  onSnapshot,
} from "firebase/firestore"
import type { ProxmoxServer } from "@/lib/types"

const COL = "proxmox_servers"

export async function getProxmoxServers(organizationId: string): Promise<ProxmoxServer[]> {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProxmoxServer))
}

export async function getProxmoxServer(id: string): Promise<ProxmoxServer | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as ProxmoxServer
}

export function subscribeProxmoxServers(
  organizationId: string,
  callback: (items: ProxmoxServer[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId)
  )
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as ProxmoxServer))
      callback(items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()))
    },
    onError
  )
}

export async function createProxmoxServer(
  data: Omit<ProxmoxServer, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return ref.id
}

export async function updateProxmoxServer(
  id: string,
  data: Partial<Omit<ProxmoxServer, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}
