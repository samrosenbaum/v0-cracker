import type { Metadata } from 'next'
// import { Inter } from 'next/font/google'
import './globals.css'

// const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "FreshEyes Intelligence Platform",
  description: "AI-powered investigative intelligence for modern casework",
  // Icons removed - files not yet created
  // icons: {
  //   icon: "/fresheyes-favicon.svg",
  //   shortcut: "/fresheyes-favicon.png",
  //   apple: "/fresheyes-apple-touch.png",
  // },
  // openGraph: {
  //   title: "FreshEyes Intelligence Platform",
  //   description: "AI-powered investigative intelligence for modern casework",
  //   images: ["/fresheyes-og.png"],
  // },
  // twitter: {
  //   card: "summary_large_image",
  //   title: "FreshEyes Intelligence Platform",
  //   description: "AI-powered investigative intelligence for modern casework",
  //   images: ["/fresheyes-og.png"],
  // },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans">{children}</body>
    </html>
  )
}