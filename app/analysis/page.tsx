"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { 
  LucideArrowLeft, 
  LucideUser, 
  LucideCalendar, 
  LucideMapPin, 
  LucideLink, 
  LucideAlertCircle, 
  LucideUpload,
  LucideLoader2,
  LucideFileText,
  LucideCheckCircle,
  LucideXCircle,
  LucideDownload,
  LucideBrain,
  LucideEye,
  LucideNetwork,
  LucideTarget
} from "lucide-react"
import Link from "next/link"
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

interface AnalysisResult {
  caseAssessment?: {
    overallRisk: string;
    breakthroughPotential: number;
    investigativePriority: number;
  };
  suspects: Array<{
    id: string;
    name: string;
    urgencyLevel: string;
    connections: string[];
    redFlags: string[];
    recommendedActions: string[];
    notes: string;
    confidence: number;
  }>;
  findings: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    confidenceScore: number;
    evidenceStrength: number;
    supportingEvidence: string[];
    actionRequired: string;
    timeline: string;
  }>;
  connections: Array<{
    id: string;
    type: string;
    entities: string[];
    description: string;
    significance: string;
    confidence: number;
  }>;
  overlookedLeads: Array<{
    type: string;
    description: string;
    recommendedAction: string;
    rationale: string;
    urgency: string;
    resources: string;
  }>;
  recommendations: Array<{
    action: string;
    priority: string;
    timeline: string;
    rationale: string;
    resources: string;
  }>;
}

export default function AnalysisPage() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [activeTab, setActiveTab] = useState("upload")
  const [user, setUser] = useState<any>(null)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUser(user)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setUploadedFiles(files)
    setError("")
    setSuccess("")
  }

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    
    if (uploadedFiles.length === 0) {
      setError("Please select at least one file to analyze")
      return
    }

    if (!user) {
      setError("You must be logged in to analyze files")
      return
    }
    
    setUploading(true)
    setError("")
    setSuccess("")
    setUploadProgress(0)

    try {
      const formData = new FormData()
      
      // Add all selected files
      uploadedFiles.forEach(file => {
        formData.append("files", file)
      })
      
      formData.append("caseId", "STANDALONE-" + Date.now())
      
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error("Authentication required")
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval)
            return prev
          }
          return prev + 10
        })
      }, 1000)

      const res = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        headers: {
          "Authorization": `Bearer ${session.access_token}`
        }
      })

      clearInterval(progressInterval)
      setUploadProgress(100)

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `HTTP ${res.status}: ${res.statusText}`)
      }

      const result = await res.json()
      console.log("Analysis result:", result)
      
      if (result.success && result.analysis) {
        setAnalysisResult(result.analysis)
        setSuccess(`Successfully analyzed ${uploadedFiles.length} file(s)`)
        setActiveTab("suspects") // Switch to results
      } else {
        throw new Error(result.error || "Analysis failed - no results returned")
      }
    } catch (error) {
      console.error("Upload error:", error)
      setError(error instanceof Error ? error.message : "Unknown error occurred")
    } finally {
      setUploading(false)
      setUploadProgress(0)
    }
  }

  const downloadResults = () => {
    if (!analysisResult) return
    
    const dataStr = JSON.stringify(analysisResult, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `analysis-results-${new Date().toISOString().split('T')[0]}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toUpperCase()) {
      case 'CRITICAL': return 'destructive'
      case 'HIGH': return 'destructive'
      case 'MEDIUM': return 'secondary'
      case 'LOW': return 'outline'
      default: return 'secondary'
    }
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600'
    if (confidence >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  return (
    <div className="container py-8 max-w-6xl mx-auto">
      <Link href="/" className="flex items-center text-sm mb-6 hover:underline">
        <LucideArrowLeft className="mr-2 h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quick Case Analysis</h1>
            <p className="text-muted-foreground mt-2">
              Upload case files for immediate AI-powered forensic analysis
            </p>
          </div>
          {analysisResult && (
            <div className="flex items-center gap-2">
              <Button onClick={downloadResults} variant="outline" size="sm">
                <LucideDownload className="mr-2 h-4 w-4" />
                Download Results
              </Button>
              <Badge variant="outline" className="bg-green-50">
                <LucideCheckCircle className="mr-1 h-3 w-3" />
                Analysis Complete
              </Badge>
            </div>
          )}
        </div>

        {/* Alert Messages */}
        {error && (
          <Alert variant="destructive">
            <LucideXCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <LucideCheckCircle className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Success</AlertTitle>
            <AlertDescription className="text-green-700">{success}</AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="upload">Upload</TabsTrigger>
            <TabsTrigger value="suspects" disabled={!analysisResult}>Suspects</TabsTrigger>
            <TabsTrigger value="findings" disabled={!analysisResult}>Findings</TabsTrigger>
            <TabsTrigger value="connections" disabled={!analysisResult}>Connections</TabsTrigger>
            <TabsTrigger value="leads" disabled={!analysisResult}>Leads</TabsTrigger>
            <TabsTrigger value="recommendations" disabled={!analysisResult}>Actions</TabsTrigger>
          </TabsList>

          {/* Upload Tab */}
          <TabsContent value="upload" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideUpload className="h-5 w-5" />
                  Upload Case Files
                </CardTitle>
                <CardDescription>
                  Upload PDF, DOCX, or TXT files for comprehensive forensic analysis. Multiple files can be analyzed together.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                    <input
                      type="file"
                      onChange={handleFileSelect}
                      accept=".pdf,.doc,.docx,.txt"
                      multiple
                      className="hidden"
                      id="file-upload"
                    />
                    <label 
                      htmlFor="file-upload" 
                      className="cursor-pointer flex flex-col items-center gap-2"
                    >
                      <LucideFileText className="h-12 w-12 text-gray-400" />
                      <p className="text-lg font-medium">Choose files to analyze</p>
                      <p className="text-sm text-gray-500">
                        PDF, DOCX, TXT files up to 10MB each
                      </p>
                    </label>
                  </div>

                  {/* Selected Files Display */}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="font-medium">Selected Files:</h4>
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                          <LucideFileText className="h-4 w-4" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-gray-500">
                            ({(file.size / 1024 / 1024).toFixed(2)} MB)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Progress Bar */}
                  {uploading && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Analyzing files...</span>
                        <span>{uploadProgress}%</span>
                      </div>
                      <Progress value={uploadProgress} className="h-2" />
                    </div>
                  )}

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={uploading || uploadedFiles.length === 0}
                    size="lg"
                  >
                    {uploading ? (
                      <>
                        <LucideLoader2 className="mr-2 h-4 w-4 animate-spin" />
                        Analyzing Files...
                      </>
                    ) : (
                      <>
                        <LucideBrain className="mr-2 h-4 w-4" />
                        Analyze {uploadedFiles.length} File{uploadedFiles.length !== 1 ? 's' : ''}
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Suspects Tab */}
          <TabsContent value="suspects" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideUser className="h-5 w-5" />
                  Potential Suspects
                  {analysisResult?.suspects && (
                    <Badge variant="outline">{analysisResult.suspects.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  AI-identified persons of interest based on forensic analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysisResult?.suspects?.length ? (
                  <div className="space-y-4">
                    {analysisResult.suspects.map((suspect) => (
                      <div key={suspect.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <LucideTarget className="h-5 w-5 text-primary" />
                            <h3 className="font-semibold text-lg">{suspect.name}</h3>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={getPriorityColor(suspect.urgencyLevel)}>
                              {suspect.urgencyLevel}
                            </Badge>
                            <span className={`text-sm font-medium ${getConfidenceColor(suspect.confidence)}`}>
                              {suspect.confidence}% confidence
                            </span>
                          </div>
                        </div>
                        
                        <p className="text-gray-700 mb-3">{suspect.notes}</p>
                        
                        {suspect.connections?.length > 0 && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-900 mb-1">Connections:</h4>
                            <div className="flex flex-wrap gap-1">
                              {suspect.connections.map((connection, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {connection}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {suspect.redFlags?.length > 0 && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-red-700 mb-1">Red Flags:</h4>
                            <div className="flex flex-wrap gap-1">
                              {suspect.redFlags.map((flag, idx) => (
                                <Badge key={idx} variant="destructive" className="text-xs">
                                  {flag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {suspect.recommendedActions?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-900 mb-1">Recommended Actions:</h4>
                            <ul className="text-sm text-gray-600 list-disc list-inside">
                              {suspect.recommendedActions.map((action, idx) => (
                                <li key={idx}>{action}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No suspects identified in the analysis.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Findings Tab */}
          <TabsContent value="findings" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideAlertCircle className="h-5 w-5" />
                  Key Findings
                  {analysisResult?.findings && (
                    <Badge variant="outline">{analysisResult.findings.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Critical discoveries and patterns identified through AI analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysisResult?.findings?.length ? (
                  <div className="space-y-4">
                    {analysisResult.findings.map((finding) => (
                      <div key={finding.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">{finding.title}</h3>
                          <div className="flex items-center gap-2">
                            <Badge variant={getPriorityColor(finding.priority)}>
                              {finding.priority}
                            </Badge>
                            <Badge variant="outline">
                              {finding.category}
                            </Badge>
                          </div>
                        </div>
                        
                        <p className="text-gray-700 mb-3">{finding.description}</p>
                        
                        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                          <div>
                            <span className="font-medium">Confidence: </span>
                            <span className={getConfidenceColor(finding.confidenceScore)}>
                              {finding.confidenceScore}%
                            </span>
                          </div>
                          <div>
                            <span className="font-medium">Evidence Strength: </span>
                            <span className={getConfidenceColor(finding.evidenceStrength)}>
                              {finding.evidenceStrength}%
                            </span>
                          </div>
                        </div>

                        {finding.supportingEvidence?.length > 0 && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-900 mb-1">Supporting Evidence:</h4>
                            <div className="flex flex-wrap gap-1">
                              {finding.supportingEvidence.map((evidence, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {evidence}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="bg-gray-50 p-3 rounded">
                          <h4 className="text-sm font-medium text-gray-900 mb-1">Required Action:</h4>
                          <p className="text-sm text-gray-700">{finding.actionRequired}</p>
                          <p className="text-xs text-gray-500 mt-1">Timeline: {finding.timeline}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No key findings identified in the analysis.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Connections Tab */}
          <TabsContent value="connections" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideNetwork className="h-5 w-5" />
                  Connections & Patterns
                  {analysisResult?.connections && (
                    <Badge variant="outline">{analysisResult.connections.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Relationships and patterns discovered between entities
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysisResult?.connections?.length ? (
                  <div className="space-y-4">
                    {analysisResult.connections.map((connection) => (
                      <div key={connection.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">{connection.type}</h3>
                          <Badge variant="secondary">
                            {connection.confidence}% confidence
                          </Badge>
                        </div>
                        
                        <p className="text-gray-700 mb-3">{connection.description}</p>
                        
                        {connection.entities?.length > 0 && (
                          <div className="mb-3">
                            <h4 className="text-sm font-medium text-gray-900 mb-1">Connected Entities:</h4>
                            <div className="flex flex-wrap gap-1">
                              {connection.entities.map((entity, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  {entity}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="bg-blue-50 p-3 rounded">
                          <h4 className="text-sm font-medium text-blue-900 mb-1">Significance:</h4>
                          <p className="text-sm text-blue-700">{connection.significance}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No significant connections identified.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Overlooked Leads Tab */}
          <TabsContent value="leads" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideEye className="h-5 w-5" />
                  Overlooked Leads
                  {analysisResult?.overlookedLeads && (
                    <Badge variant="outline">{analysisResult.overlookedLeads.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Potential investigative leads that may have been missed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysisResult?.overlookedLeads?.length ? (
                  <div className="space-y-4">
                    {analysisResult.overlookedLeads.map((lead, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg capitalize">{lead.type}</h3>
                          <Badge variant={getPriorityColor(lead.urgency)}>
                            {lead.urgency}
                          </Badge>
                        </div>
                        
                        <p className="text-gray-700 mb-3">{lead.description}</p>
                        
                        <div className="space-y-3">
                          <div className="bg-yellow-50 p-3 rounded">
                            <h4 className="text-sm font-medium text-yellow-900 mb-1">Rationale:</h4>
                            <p className="text-sm text-yellow-700">{lead.rationale}</p>
                          </div>
                          
                          <div className="bg-green-50 p-3 rounded">
                            <h4 className="text-sm font-medium text-green-900 mb-1">Recommended Action:</h4>
                            <p className="text-sm text-green-700">{lead.recommendedAction}</p>
                          </div>
                          
                          {lead.resources && (
                            <div className="bg-gray-50 p-3 rounded">
                              <h4 className="text-sm font-medium text-gray-900 mb-1">Resources Needed:</h4>
                              <p className="text-sm text-gray-700">{lead.resources}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No overlooked leads identified.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <LucideTarget className="h-5 w-5" />
                  Recommended Actions
                  {analysisResult?.recommendations && (
                    <Badge variant="outline">{analysisResult.recommendations.length}</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Strategic recommendations for advancing the investigation
                </CardDescription>
              </CardHeader>
              <CardContent>
                {analysisResult?.recommendations?.length ? (
                  <div className="space-y-4">
                    {analysisResult.recommendations.map((rec, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold text-lg">{rec.action}</h3>
                          <div className="flex gap-2">
                            <Badge variant={getPriorityColor(rec.priority)}>
                              {rec.priority}
                            </Badge>
                            <Badge variant="outline">
                              {rec.timeline}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="space-y-3">
                          <div className="bg-blue-50 p-3 rounded">
                            <h4 className="text-sm font-medium text-blue-900 mb-1">Rationale:</h4>
                            <p className="text-sm text-blue-700">{rec.rationale}</p>
                          </div>
                          
                          {rec.resources && (
                            <div className="bg-gray-50 p-3 rounded">
                              <h4 className="text-sm font-medium text-gray-900 mb-1">Resources Required:</h4>
                              <p className="text-sm text-gray-700">{rec.resources}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-gray-500 py-8">No specific recommendations provided.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}