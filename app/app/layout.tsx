import type React from "react"
import AppLayoutClient from "./AppLayoutClient"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayoutClient>{children}</AppLayoutClient>
}
