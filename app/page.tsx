import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FileUpload } from "@/components/file-upload"
import { DashboardStats } from "@/components/dashboard-stats"
import { RecentCases } from "@/components/recent-cases"
import { LucideFileSearch, LucideUsers, LucideBarChart2, LucideFileText } from "lucide-react"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <LucideFileSearch className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold">ColdCaseAI</h1>
          </div>
          <nav className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium">
              Dashboard
            </Link>
            <Link href="/cases" className="text-sm font-medium">
              Cases
            </Link>
            <Link href="/analysis" className="text-sm font-medium">
              Analysis
            </Link>
            <Button size="sm">Sign In</Button>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <section className="container py-12">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="flex flex-col justify-center space-y-4">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                AI-Powered Cold Case Analysis
              </h1>
              <p className="max-w-[600px] text-gray-500 md:text-xl/relaxed lg:text-base/relaxed xl:text-xl/relaxed">
                Upload case files and let our AI analyze patterns, connections, and potential suspects that may have
                been overlooked in complex investigations.
              </p>
              <div className="flex flex-col gap-2 min-[400px]:flex-row">
                <Link href="/upload">
                  <Button size="lg">Upload Case Files</Button>
                </Link>
                <Link href="/how-it-works">
                  <Button size="lg" variant="outline">
                    How It Works
                  </Button>
                </Link>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <Card className="w-full">
                <CardHeader>
                  <CardTitle>Quick Upload</CardTitle>
                  <CardDescription>Upload case files for immediate AI analysis</CardDescription>
                </CardHeader>
                <CardContent>
                  <FileUpload />
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <section className="container py-12 border-t">
          <h2 className="text-2xl font-bold tracking-tighter mb-8">How ColdCaseAI Works</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <LucideFileText className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Document Processing</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">
                  Upload case files in various formats. Our system processes and extracts key information from witness
                  statements, reports, and evidence logs.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <LucideBarChart2 className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Pattern Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">
                  Advanced AI algorithms analyze the data to identify patterns, connections, and inconsistencies that
                  human investigators might miss.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <LucideUsers className="h-8 w-8 text-primary mb-2" />
                <CardTitle>Suspect Identification</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-500">
                  The system identifies potential persons of interest by analyzing relationships, timelines, and
                  behavioral patterns across case documents.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>
        <section className="container py-12 border-t">
          <h2 className="text-2xl font-bold tracking-tighter mb-8">Dashboard Overview</h2>
          <DashboardStats />
          <div className="mt-8">
            <RecentCases />
          </div>
        </section>
      </main>
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-sm text-gray-500">&copy; {new Date().getFullYear()} ColdCaseAI. All rights reserved.</p>
          <div className="flex gap-4 text-sm text-gray-500">
            <Link href="/terms">Terms</Link>
            <Link href="/privacy">Privacy</Link>
            <Link href="/contact">Contact</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
