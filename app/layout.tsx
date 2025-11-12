import type { Metadata } from 'next'
// import { Inter } from 'next/font/google'
import './globals.css'
import TopNavigation from '@/components/TopNavigation'

// const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "FreshEyes Intelligence Platform",
  description: "AI-powered investigative intelligence for modern casework",
  icons: {
    icon: "/fresh-eyes-logo.png",
    shortcut: "/fresh-eyes-logo.png",
    apple: "/fresh-eyes-logo.png",
  },
  openGraph: {
    title: "FreshEyes Intelligence Platform",
    description: "AI-powered investigative intelligence for modern casework",
    images: ["/fresh-eyes-logo.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "FreshEyes Intelligence Platform",
    description: "AI-powered investigative intelligence for modern casework",
    images: ["/fresh-eyes-logo.png"],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">
        <TopNavigation />
        {children}
      </body>
    </html>
  )
}