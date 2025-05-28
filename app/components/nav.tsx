"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  LucideHome,
  LucideFileSearch,
  LucideUsers,
  LucideUpload,
  LucideDatabase,
  LucideSettings
} from "lucide-react"

export function MainNav() {
  const pathname = usePathname()

  const routes = [
    {
      href: "/",
      label: "Dashboard",
      icon: LucideHome,
      active: pathname === "/"
    },
    {
      href: "/case-analysis",
      label: "Case Analysis",
      icon: LucideFileSearch,
      active: pathname === "/case-analysis"
    },
    {
      href: "/cases",
      label: "Cases",
      icon: LucideUsers,
      active: pathname === "/cases"
    },
    {
      href: "/upload",
      label: "Upload",
      icon: LucideUpload,
      active: pathname === "/upload"
    },
    {
      href: "/forensics",
      label: "Forensics",
      icon: LucideDatabase,
      active: pathname === "/forensics"
    }
  ]

  return (
    <nav className="flex items-center space-x-4 lg:space-x-6 mx-6">
      {routes.map((route) => (
        <Button
          key={route.href}
          variant={route.active ? "default" : "ghost"}
          asChild
        >
          <Link
            href={route.href}
            className="flex items-center"
          >
            <route.icon className="h-4 w-4 mr-2" />
            {route.label}
          </Link>
        </Button>
      ))}
    </nav>
  )
} 