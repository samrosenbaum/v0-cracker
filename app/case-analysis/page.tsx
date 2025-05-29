"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { LucideUpload, LucideFileText, LucideUsers, LucideAlertTriangle } from "lucide-react"
import { useRouter } from 'next/navigation'

export default function CaseAnalysis() {
  const [files, setFiles] = useState<FileList | null>(null)
  const [caseId, setCaseId] = useState("")
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!files || files.length === 0) {
      setError('Please select at least one file')
      return
    }

    setLoading(true)
    setError(null)

    const formData = new FormData()
    Array.from(files).forEach(file => {
      formData.append('files', file)
    })
    formData.append('caseId', new Date().toISOString())

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      })

      const contentType = response.headers.get("content-type");
      let result;
      if (contentType && contentType.includes("application/json")) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error("Non-JSON response: " + text);
      }

      console.log('Analysis result:', result)
      setAnalysis(result.analysis)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Cold Case Analysis Tool</h1>
        <p className="text-muted-foreground">AI-powered analysis for law enforcement investigations</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-md space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Upload Case Files
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.txt"
            onChange={(e) => setFiles(e.target.files)}
            className="block w-full text-sm border rounded p-2"
          />
        </div>

        {error && (
          <div className="text-red-500 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className={`w-full p-4 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 ${
            loading ? 'cursor-not-allowed' : ''
          }`}
        >
          {loading ? 'Analyzing...' : 'Analyze Files'}
        </button>
      </form>

      {/* Results Section */}
      {analysis && (
        <div className="grid gap-6 md:grid-cols-2 mt-8">
          {/* Suspects */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <LucideUsers className="mr-2 h-5 w-5" />
                Potential Suspects
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.suspects?.map((suspect: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{suspect.name}</h3>
                    <Badge variant="outline">
                      {suspect.confidence}% confidence
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{suspect.notes}</p>
                  <div className="text-xs text-muted-foreground">
                    Relevance: {suspect.relevance}%
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Findings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <LucideAlertTriangle className="mr-2 h-5 w-5" />
                Key Findings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {analysis.findings?.map((finding: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold">{finding.title}</h3>
                    <Badge 
                      variant={finding.priority === 'HIGH' ? 'destructive' : 'secondary'}
                    >
                      {finding.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{finding.description}</p>
                  <div className="text-xs text-muted-foreground">
                    Confidence: {finding.confidence}%
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Recommendations */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <LucideFileText className="mr-2 h-5 w-5" />
                Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analysis.recommendations?.map((rec: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold">{rec.action}</h3>
                      <Badge 
                        variant={rec.priority === 'HIGH' ? 'destructive' : 'secondary'}
                      >
                        {rec.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{rec.rationale}</p>
                    <div className="text-xs text-muted-foreground">
                      Timeline: {rec.timeline}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}