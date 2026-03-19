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
import type { GameSession } from "@/lib/types"

const COL = "game_sessions"

export async function getGameSessions(organizationId: string): Promise<GameSession[]> {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId)
  )
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as GameSession))
}

export async function getGameSession(id: string): Promise<GameSession | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as GameSession
}

export function subscribeGameSessions(
  organizationId: string,
  callback: (items: GameSession[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId)
  )
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as GameSession))
      callback(items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()))
    },
    onError
  )
}

export async function createGameSession(
  data: Omit<GameSession, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return ref.id
}

export async function updateGameSession(
  id: string,
  data: Partial<Omit<GameSession, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}
