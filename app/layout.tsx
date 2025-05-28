import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { MainNav } from "./components/nav"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Case Analysis Platform",
  description: "AI-powered case analysis and evidence management",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <header className="border-b">
          <div className="flex h-16 items-center">
            <MainNav />
          </div>
        </header>
        <main>
          {children}
        </main>
      </body>
    </html>
  )
}