import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import MainNavigation from '@/components/MainNavigation'

export const metadata: Metadata = {
  title: "ColdCase AI - Forensic Analysis Platform",
  description: "AI-powered cold case analysis and investigation platform",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="retro-theme" suppressHydrationWarning>
        <MainNavigation />
        <main className="min-h-screen bg-gray-50">
          {children}
        </main>
      </body>
    </html>
  )
}