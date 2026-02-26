import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Chemins publics accessibles sans authentification.
 * Toute autre route (hors assets Next.js) est protégée.
 */
const PUBLIC_PATHS = [
  "/",
  "/features",
  "/pricing",
  "/security",
  "/contact",
  "/auth/login",
  "/auth/register",
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const session = request.cookies.get("__session")

  // Laisser passer les assets statiques et l'API de session
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth/session") ||
    pathname.includes(".")
  ) {
    return NextResponse.next()
  }

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  )

  // Utilisateur connecté tentant d'accéder aux pages auth → rediriger vers /app
  if (session && (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register"))) {
    return NextResponse.redirect(new URL("/app", request.url))
  }

  // Tentative d'accès à une route protégée sans session → rediriger vers /auth/login
  if (!isPublic && !session) {
    const loginUrl = new URL("/auth/login", request.url)
    loginUrl.searchParams.set("redirect", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
