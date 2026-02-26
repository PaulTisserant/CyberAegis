"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import {
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User as FirebaseUser,
} from "firebase/auth"
import { doc, getDoc } from "firebase/firestore"
import { auth, db } from "@/lib/firebase"
import { updateLastLogin } from "@/lib/firestore/users"
import type { AuthUser } from "@/lib/types"

interface AuthContextType {
  user: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onIdTokenChanged se déclenche aussi à chaque renouvellement automatique du token (chaque heure)
    const unsub = onIdTokenChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          // Rafraîchir le cookie de session avec le nouveau JWT
          const idToken = await fbUser.getIdToken()
          fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
          }).catch(() => null)

          const snap = await getDoc(doc(db, "users", fbUser.uid))
          if (snap.exists()) {
            setUser({
              uid: fbUser.uid,
              email: fbUser.email ?? "",
              ...(snap.data() as Omit<AuthUser, "uid" | "email">),
            })
            // Mise à jour silencieuse de lastLogin
            updateLastLogin(fbUser.uid).catch(() => null)
          } else {
            setUser(null)
          }
        } catch {
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })
    return () => unsub()
  }, [])

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password)
  }

  const signOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => null)
    await fbSignOut(auth)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider")
  return ctx
}
