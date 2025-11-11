import type { LucideIcon } from "lucide-react"
import {
  BarChart2,
  BookOpen,
  Brain,
  CandlestickChart,
  CircleDollarSign,
  ClipboardList,
  LayoutDashboard,
  LineChart,
  TrendingUp,
} from "lucide-react"

export type NavigationItem = {
  title: string
  href: string
  icon: LucideIcon
}

export const navigationItems: NavigationItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Trading Journal",
    href: "/journal",
    icon: BookOpen,
  },
  {
    title: "Strategies",
    href: "/strategies",
    icon: ClipboardList,
  },
  {
    title: "Performance",
    href: "/performance",
    icon: BarChart2,
  },
  {
    title: "Risk Analyzer",
    href: "/risk",
    icon: LineChart,
  },
  {
    title: "Options Flow",
    href: "/flow",
    icon: CandlestickChart,
  },
  {
    title: "Anti-Portfolio",
    href: "/anti-portfolio",
    icon: Brain,
  },
  {
    title: "Watchlists",
    href: "/watchlists",
    icon: TrendingUp,
  },
  {
    title: "Capital Allocation",
    href: "/capital",
    icon: CircleDollarSign,
  },
]
