import Link from "next/link"
import { LucideAlertCircle } from "lucide-react"

export default function AnalysisPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Analysis Dashboard</h1>

      <div className="mb-4">
        <Link
          href="/analysis/flags"
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          <LucideAlertCircle className="h-4 w-4" />
          <span>View Analysis Flags</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white rounded-md shadow-md p-4">
          <h2 className="text-lg font-semibold mb-2">Metric 1</h2>
          <p>Data for Metric 1 goes here.</p>
        </div>
        <div className="bg-white rounded-md shadow-md p-4">
          <h2 className="text-lg font-semibold mb-2">Metric 2</h2>
          <p>Data for Metric 2 goes here.</p>
        </div>
        <div className="bg-white rounded-md shadow-md p-4">
          <h2 className="text-lg font-semibold mb-2">Metric 3</h2>
          <p>Data for Metric 3 goes here.</p>
        </div>
      </div>
    </div>
  )
}
