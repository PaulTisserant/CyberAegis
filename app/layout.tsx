import type React from "react"
import type { Metadata, Viewport } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const geist = Geist({ subsets: ["latin"] })
const geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "CyberAegis - Plateforme d'Escape Game Cybersécurité SaaS",
  description:
    "Plateforme SaaS d'escape game cybersécurité pour sensibiliser vos équipes aux enjeux de sécurité informatique avec CyberAegis.",
  keywords: "cybersécurité, escape game, formation, SaaS, sensibilisation, CyberAegis",
  icons: {
    icon: "/icon.svg",
  },
    generator: 'v0.app'
}

export const viewport: Viewport = {
  themeColor: "#0f172a",
  colorScheme: "dark light",
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${geist.className} antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
