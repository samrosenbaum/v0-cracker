import type React from "react"
import type { Metadata } from "next"
<<<<<<< HEAD
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ColdCaseAI - AI-Powered Cold Case Analysis",
  description:
    "Upload case files and let our AI analyze patterns, connections, and potential suspects that may have been overlooked in complex investigations.",
    generator: 'v0.dev'
=======
import "./globals.css"

export const metadata: Metadata = {
  title: "v0 App",
  description: "Created with v0",
  generator: "v0.dev",
>>>>>>> 526dca4 (Add AI graph structure output (entities, events, links))
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
<<<<<<< HEAD
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
=======
      <body>{children}</body>
>>>>>>> 526dca4 (Add AI graph structure output (entities, events, links))
    </html>
  )
}
