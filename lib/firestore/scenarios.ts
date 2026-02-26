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
import type { Scenario } from "@/lib/types"

const COL = "scenarios"

export async function getScenarios(organizationId: string): Promise<Scenario[]> {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId),
    where("isActive", "==", true)
  )
  const snap = await getDocs(q)
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Scenario))
  return items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
}

export async function getScenario(id: string): Promise<Scenario | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Scenario
}

export function subscribeScenarios(
  organizationId: string,
  callback: (items: Scenario[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId),
    where("isActive", "==", true)
  )
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Scenario))
      callback(items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()))
    },
    onError
  )
}

export async function createScenario(
  data: Omit<Scenario, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return ref.id
}

export async function updateScenario(
  id: string,
  data: Partial<Omit<Scenario, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function deleteScenario(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    isActive: false,
    updatedAt: Timestamp.now(),
  })
}
