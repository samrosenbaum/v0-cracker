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
    
    // Get the file and add it properly
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput.files?.length) {
      formData.append("files", fileInput.files[0])
      formData.append("caseId", "CASE-" + Date.now())
    }
    
    setUploading(true)

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
      })

      const result = await res.json()
      console.log("Analysis result:", result)
      
      if (result.success) {
        setParsedText(JSON.stringify(result.analysis, null, 2))
      } else {
        setParsedText(result.error || "Analysis failed")
      }
    } catch (error) {
      console.error("Upload error:", error)
      setParsedText("Error occurred during analysis")
    }
    
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

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Case Analysis: {caseDetails.title}</h1>
            <p className="text-muted-foreground mt-2">
              AI-powered analysis of case files and evidence patterns
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{caseDetails.status}</Badge>
            <span className="text-sm text-muted-foreground">
              Last updated: {caseDetails.lastUpdated}
            </span>
          </div>
        </div>

        <Tabs defaultValue="suspects" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="suspects">Potential Suspects</TabsTrigger>
            <TabsTrigger value="findings">Key Findings</TabsTrigger>
            <TabsTrigger value="timeline">Timeline Analysis</TabsTrigger>
            <TabsTrigger value="evidence">Evidence Review</TabsTrigger>
          </TabsList>

          <TabsContent value="suspects" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Potential Suspects</CardTitle>
                <CardDescription>
                  AI-identified persons of interest based on case file analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {potentialSuspects.map((suspect) => (
                    <div key={suspect.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <LucideUser className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">{suspect.name}</h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={suspect.relevance > 80 ? "destructive" : "secondary"}>
                            {suspect.relevance}% relevance
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {suspect.connections} connections
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{suspect.notes}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="findings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Key Findings</CardTitle>
                <CardDescription>
                  Important patterns and inconsistencies discovered through AI analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {keyFindings.map((finding) => (
                    <div key={finding.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <LucideAlertCircle className="h-5 w-5 text-primary" />
                          <h3 className="font-semibold">{finding.title}</h3>
                        </div>
                        <Badge variant={finding.priority === "High" ? "destructive" : "secondary"}>
                          {finding.priority} Priority
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{finding.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Timeline Analysis</CardTitle>
                <CardDescription>
                  Chronological analysis of events and identified gaps
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-12">
                  Timeline analysis will be displayed here once case files are processed.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidence" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Evidence Review</CardTitle>
                <CardDescription>
                  Physical and digital evidence analysis results
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-center text-muted-foreground py-12">
                  Evidence analysis will be displayed here once case files are processed.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}