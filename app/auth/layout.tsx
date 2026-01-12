import type React from "react"
import Link from "next/link"

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <nav className="border-b border-border px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
              CA
            </div>
            <span className="text-xl font-bold text-foreground">CyberAegis</span>
          </Link>
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
