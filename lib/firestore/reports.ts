import { db } from "@/lib/firebase"
import {
  collection,
  doc,
  addDoc,
  getDocs,
  getDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore"
import type { Report } from "@/lib/types"

const COL = "reports"

export async function getReports(organizationId: string): Promise<Report[]> {
  const q = query(
    collection(db, COL),
    where("organizationId", "==", organizationId)
  )
  const snap = await getDocs(q)
  const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Report))
  return items.sort((a, b) => b.generatedAt.toMillis() - a.generatedAt.toMillis())
}

export async function getReport(id: string): Promise<Report | null> {
  const snap = await getDoc(doc(db, COL, id))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() } as Report
}

export async function createReport(
  data: Omit<Report, "id" | "generatedAt">
): Promise<string> {
  const ref = await addDoc(collection(db, COL), {
    ...data,
    generatedAt: Timestamp.now(),
  })
  return ref.id
}
