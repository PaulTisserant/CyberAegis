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
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore"
import type { User } from "@/lib/types"

const COL = "users"

export async function getUsers(organizationId: string): Promise<User[]> {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId),
    where("isActive", "==", true)
  )
  const snap = await getDocs(q)
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as User))
  return items.sort((a, b) => a.lastName.localeCompare(b.lastName, "fr"))
}

export function subscribeUsers(
  organizationId: string,
  callback: (items: User[]) => void,
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
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as User))
      callback(items.sort((a, b) => a.lastName.localeCompare(b.lastName, "fr")))
    },
    onError
  )
}

export async function getUser(uid: string): Promise<User | null> {
  const snap = await getDoc(doc(db, COL, uid))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as User
}

export async function createUser(
  uid: string,
  data: Omit<User, "id" | "createdAt">
): Promise<void> {
  await updateDoc(doc(db, COL, uid), {}).catch(async () => {
    // Le document n'existe pas, on le crée avec l'uid comme ID
    const { setDoc } = await import("firebase/firestore")
    await setDoc(doc(db, COL, uid), {
      ...data,
      createdAt: Timestamp.now(),
    })
  })
}

export async function updateUser(
  uid: string,
  data: Partial<Omit<User, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  await updateDoc(doc(db, COL, uid), data)
}

export async function updateLastLogin(uid: string): Promise<void> {
  await updateDoc(doc(db, COL, uid), {
    lastLogin: Timestamp.now(),
  })
}

export async function deactivateUser(uid: string): Promise<void> {
  await updateDoc(doc(db, COL, uid), { isActive: false })
}

export async function addUserToOrganization(
  data: Omit<User, "id" | "createdAt" | "lastLogin" | "isActive">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
    isActive: true,
  })
  return ref.id
}
