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
import type { Session, Player } from "@/lib/types"

const COL = "sessions"

export async function getSessions(organizationId: string): Promise<Session[]> {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId)
  )
  const snap = await getDocs(q)
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session))
  return items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())
}

export async function getSession(id: string): Promise<Session | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Session
}

export function subscribeSessions(
  organizationId: string,
  callback: (items: Session[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId)
  )
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Session))
      callback(items.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()))
    },
    onError
  )
}

export function subscribeSessionPlayers(
  sessionId: string,
  callback: (players: Player[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, COL, sessionId, "players")
  )
  return onSnapshot(
    q,
    (snap) => {
      const players = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Player))
      callback(players.sort((a, b) => b.score - a.score))
    },
    onError
  )
}

export async function createSession(
  data: Omit<Session, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  })
  return ref.id
}

export async function updateSession(
  id: string,
  data: Partial<Omit<Session, "id" | "createdAt" | "organizationId">>
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    ...data,
    updatedAt: Timestamp.now(),
  })
}

export async function startSession(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: "RUNNING",
    updatedAt: Timestamp.now(),
  })
}

export async function finishSession(id: string): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    status: "FINISHED",
    updatedAt: Timestamp.now(),
  })
}

export async function joinSession(
  sessionId: string,
  player: Omit<Player, "id" | "joinedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL, sessionId, "players"), {
    ...player,
    joinedAt: Timestamp.now(),
  })
  return ref.id
}

export async function updatePlayerProgress(
  sessionId: string,
  playerId: string,
  score: number,
  progress: number
): Promise<void> {
  await updateDoc(doc(db, COL, sessionId, "players", playerId), {
    score,
    progress,
    ...(progress >= 100
      ? { status: "FINISHED", completedAt: Timestamp.now() }
      : { status: "PLAYING" }),
  })
}
