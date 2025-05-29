import Link from "next/link"

export function MainNav() {
  return (
    <nav className="flex items-center space-x-4 lg:space-x-6">
      <Link
        href="/"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Home
      </Link>
      <Link
        href="/case-analysis"
        className="text-sm font-medium transition-colors hover:text-primary"
      >
        Case Analysis
      </Link>
    </nav>
  )
} 