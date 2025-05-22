import Link from "next/link"
import { AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div>
        <h1>Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/analysis/flags" className="block">
            <Card className="hover:bg-muted/50 transition-colors">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  Analysis Flags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>Review AI-identified suspects, evidence, and inconsistencies that need attention.</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </main>
  )
}
