"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LucideUpload, LucideFileText, LucideUsers, LucideAlertTriangle } from "lucide-react"

type Analysis = {
  id: string
  case_id: string
  analysis_type: string
  analysis_data: any
  confidence_score: number
  created_at: string
}

export default function CaseAnalysis() {
  const [analyses, setAnalyses] = useState<Analysis[]>([])
  const [selected, setSelected] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<FileList | null>(null)
  const [caseId, setCaseId] = useState("")

  // Fetch analyses for the logged-in user
  useEffect(() => {
    const fetchAnalyses = async () => {
      setLoading(true)
      setError(null)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        setError("Not logged in")
        setLoading(false)
        return
      }
      const { data, error } = await supabase
        .from("case_analysis")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
      if (error) {
        setError(error.message)
      } else {
        setAnalyses(data as Analysis[])
      }
      setLoading(false)
    }
    fetchAnalyses()
  }, [])

  // Handle file upload and analysis
  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!files || files.length === 0) {
      setError("Please select at least one file")
      return
    }
    setUploading(true)
    setError(null)
    const formData = new FormData()
    Array.from(files).forEach(file => formData.append("files", file))
    formData.append("caseId", caseId || new Date().toISOString())
    try {
      // Get the user's access token
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${session?.access_token ?? ""}`,
        },
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Failed to analyze")
      if (result.analysis && result.analysisId) {
        const newAnalysis = {
          id: result.analysisId,
          case_id: caseId || new Date().toISOString(),
          analysis_type: "ai_analysis",
          analysis_data: result.analysis,
          confidence_score: result.analysis.confidence_score || null,
          created_at: new Date().toISOString(),
        }
        setAnalyses(prev => [newAnalysis, ...prev])
        setSelected(newAnalysis)
      } else {
        setError("No structured results returned.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-3xl font-bold mb-2">Case Analyses</h1>
      <p className="text-muted-foreground mb-6">View and manage all your AI-powered case analyses.</p>

      {/* Upload Form */}
      <form onSubmit={handleUpload} className="mb-8 flex flex-col md:flex-row gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Case ID (optional)</label>
          <input
            type="text"
            value={caseId}
            onChange={e => setCaseId(e.target.value)}
            placeholder="Enter existing or new case ID"
            className="block w-full text-sm border rounded p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Upload Files</label>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            onChange={e => setFiles(e.target.files)}
            className="block w-full text-sm border rounded p-2"
          />
        </div>
        <Button type="submit" disabled={uploading} className="h-10">
          <LucideUpload className="mr-2 h-4 w-4" />
          {uploading ? "Analyzing..." : "Analyze Files"}
        </Button>
      </form>

      {error && <div className="text-red-500 mb-4">{error}</div>}

      {/* Analyses List */}
      {loading ? (
        <div>Loading analyses...</div>
      ) : analyses.length === 0 ? (
        <div>No analyses found. Upload files to get started!</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {analyses.map(a => (
            <Card
              key={a.id}
              className={`cursor-pointer border-2 ${selected?.id === a.id ? "border-blue-500" : "border-transparent"}`}
              onClick={() => setSelected(a)}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideFileText className="h-5 w-5" />
                  Case: <span className="font-mono">{a.case_id}</span>
                  <Badge variant="secondary">{a.analysis_type}</Badge>
                </CardTitle>
                <div className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Findings: {a.analysis_data?.findings?.length ?? 0}</Badge>
                  <Badge variant="outline">Suspects: {a.analysis_data?.suspects?.length ?? 0}</Badge>
                  <Badge variant="outline">Confidence: {a.confidence_score ?? "?"}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Analysis Details */}
      {selected && (
        <div className="mt-10">
          <Button onClick={() => setSelected(null)} variant="secondary" className="mb-4">
            Back to list
          </Button>
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="font-mono">{selected.case_id}</span> — {selected.analysis_type}
              </CardTitle>
              <div className="text-xs text-muted-foreground">
                {new Date(selected.created_at).toLocaleString()}
              </div>
            </CardHeader>
            <CardContent>
              {/* Suspects */}
              <h2 className="font-semibold mt-4 mb-2 flex items-center">
                <LucideUsers className="mr-2 h-5 w-5" /> Suspects
              </h2>
              {selected.analysis_data?.suspects?.length ? (
                <ul className="mb-4">
                  {selected.analysis_data.suspects.map((s: any, i: number) => (
                    <li key={i} className="mb-2 border rounded p-2">
                      <div className="font-semibold">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.notes}</div>
                      <div className="text-xs">Confidence: {s.confidence}%</div>
                    </li>
                  ))}
                </ul>
              ) : <div className="text-muted-foreground mb-4">No suspects found.</div>}

              {/* Findings */}
              <h2 className="font-semibold mt-4 mb-2 flex items-center">
                <LucideAlertTriangle className="mr-2 h-5 w-5" /> Findings
              </h2>
              {selected.analysis_data?.findings?.length ? (
                <ul className="mb-4">
                  {selected.analysis_data.findings.map((f: any, i: number) => (
                    <li key={i} className="mb-2 border rounded p-2">
                      <div className="font-semibold">{f.title}</div>
                      <div className="text-xs text-muted-foreground">{f.description}</div>
                      <div className="text-xs">Confidence: {f.confidence}%</div>
                    </li>
                  ))}
                </ul>
              ) : <div className="text-muted-foreground mb-4">No findings found.</div>}

              {/* Recommendations */}
              <h2 className="font-semibold mt-4 mb-2 flex items-center">
                <LucideFileText className="mr-2 h-5 w-5" /> Recommendations
              </h2>
              {selected.analysis_data?.recommendations?.length ? (
                <ul className="mb-4">
                  {selected.analysis_data.recommendations.map((r: any, i: number) => (
                    <li key={i} className="mb-2 border rounded p-2">
                      <div className="font-semibold">{r.action}</div>
                      <div className="text-xs text-muted-foreground">{r.rationale}</div>
                      <div className="text-xs">Priority: {r.priority}</div>
                    </li>
                  ))}
                </ul>
              ) : <div className="text-muted-foreground mb-4">No recommendations found.</div>}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}