import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const COOKIE_NAME = "__session"
/** Durée de vie du cookie : 7 jours (le token Firebase expire en 1h mais est
 *  rafraîchi automatiquement côté client ; l'AuthContext met à jour le cookie. */
const MAX_AGE = 60 * 60 * 24 * 7

export async function POST(request: NextRequest) {
  const body = await request.json() as { idToken?: string }
  const { idToken } = body

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "Token manquant" }, { status: 400 })
  }

  const response = NextResponse.json({ status: "ok" })
  response.cookies.set({
    name: COOKIE_NAME,
    value: idToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  })
  return response
}

export async function DELETE() {
  const response = NextResponse.json({ status: "ok" })
  response.cookies.delete(COOKIE_NAME)
  return response
}
