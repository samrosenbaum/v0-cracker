"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { LucideArrowLeft, LucideUser, LucideCalendar, LucideMapPin, LucideLink, LucideAlertCircle, LucideUpload } from "lucide-react"
import Link from "next/link"

export default function AnalysisPage() {
  const [parsedText, setParsedText] = useState("")
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    setUploading(true)

    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    const result = await res.json()
    setParsedText(result.content || "No content found")
    setUploading(false)
  }

  const caseDetails = {
    id: "CS-2023-089",
    title: "Riverside Homicide",
    date: "2023-11-15",
    location: "Riverside Park, North Section",
    status: "Analysis Complete",
    lastUpdated: "2023-12-10",
  }

  const potentialSuspects = [
    {
      id: "POI-001",
      name: "John Doe",
      relevance: 87,
      connections: 5,
      notes:
        "Mentioned in multiple witness statements. Location data places subject near crime scene on the night of the incident.",
    },
    {
      id: "POI-002",
      name: "Jane Smith",
      relevance: 72,
      connections: 3,
      notes: "Previous connection to victim. Inconsistent alibi detected across statements.",
    },
    {
      id: "POI-003",
      name: "Robert Johnson",
      relevance: 65,
      connections: 4,
      notes: "Pattern of behavior matches similar cases. Financial transactions show suspicious activity.",
    },
  ]

  const keyFindings = [
    {
      id: "KF-001",
      title: "Timeline Inconsistency",
      description: "Witness statements indicate a 45-minute gap in the timeline that was not previously identified.",
      priority: "High",
    },
    {
      id: "KF-002",
      title: "Evidence Connection",
      description: "Fiber evidence from scene matches description in an unrelated case from 2019.",
      priority: "Medium",
    },
    {
      id: "KF-003",
      title: "Witness Reliability",
      description: "Statistical analysis suggests Witness #3 may have provided unreliable testimony.",
      priority: "Medium",
    },
    {
      id: "KF-004",
      title: "Location Pattern",
      description: "Crime scene location matches pattern of three other unsolved cases from the past decade.",
      priority: "High",
    },
  ]

  return (
    <div className="container py-8">
      <Link href="/" className="flex items-center text-sm mb-6 hover:underline">
        <LucideArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Link>

      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Upload Case File</CardTitle>
            <CardDescription>
              Upload a .pdf, .docx, or .txt file to analyze its contents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="flex flex-col gap-4" encType="multipart/form-data">
              <input
                type="file"
                name="file"
                accept=".pdf,.doc,.docx,.txt"
                required
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-white hover:file:bg-primary/90"
              />
              <Button type="submit" className="flex items-center gap-2" disabled={uploading}>
                <LucideUpload className="h-4 w-4" />
                {uploading ? "Analyzing..." : "Analyze File"}
              </Button>
            </form>
            {parsedText && (
              <div className="mt-6 border p-4 rounded bg-muted">
                <h2 className="text-lg font-bold mb-2">Parsed File Content</h2>
                <pre className="whitespace-pre-wrap text-sm">{parsedText}</pre>
              </div>
            )}
          </CardContent>
        </Card>

        {/* --- Rest of your tabs and findings layout goes here --- */}
        {/* You don’t need to change the rest unless you want to style or link parsed data to findings */}
      </div>
    </div>
  )
}
