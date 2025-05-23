<<<<<<< HEAD
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { LucideArrowLeft, LucideUser, LucideCalendar, LucideMapPin, LucideLink, LucideAlertCircle } from "lucide-react"
import Link from "next/link"

export default function AnalysisPage() {
  // Sample data for demonstration
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{caseDetails.title}</h1>
            <div className="flex flex-wrap gap-2 mt-2 text-sm text-muted-foreground">
              <div className="flex items-center">
                <span className="font-medium mr-2">Case ID:</span> {caseDetails.id}
              </div>
              <div className="flex items-center">
                <LucideCalendar className="mr-1 h-4 w-4" />
                <span>{caseDetails.date}</span>
              </div>
              <div className="flex items-center">
                <LucideMapPin className="mr-1 h-4 w-4" />
                <span>{caseDetails.location}</span>
              </div>
            </div>
          </div>
          <Badge className="self-start md:self-center" variant="outline">
            {caseDetails.status}
          </Badge>
        </div>

        <Tabs defaultValue="suspects" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="suspects">Potential Suspects</TabsTrigger>
            <TabsTrigger value="findings">Key Findings</TabsTrigger>
            <TabsTrigger value="connections">Case Connections</TabsTrigger>
          </TabsList>

          <TabsContent value="suspects" className="mt-6">
            <div className="grid gap-6">
              {potentialSuspects.map((suspect) => (
                <Card key={suspect.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <LucideUser className="h-5 w-5 text-muted-foreground" />
                        <CardTitle className="text-lg">{suspect.name}</CardTitle>
                      </div>
                      <Badge variant={suspect.relevance > 80 ? "destructive" : "default"}>
                        {suspect.relevance}% Relevance
                      </Badge>
                    </div>
                    <CardDescription>
                      ID: {suspect.id} • {suspect.connections} Case Connections
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{suspect.notes}</p>
                    <div className="flex justify-end mt-4">
                      <Button variant="outline" size="sm">
                        View Full Profile
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="findings" className="mt-6">
            <div className="grid gap-6">
              {keyFindings.map((finding) => (
                <Card key={finding.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{finding.title}</CardTitle>
                      <Badge variant={finding.priority === "High" ? "destructive" : "default"}>
                        {finding.priority} Priority
                      </Badge>
                    </div>
                    <CardDescription>Finding ID: {finding.id}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{finding.description}</p>
                    <div className="flex justify-end mt-4">
                      <Button variant="outline" size="sm">
                        Explore Details
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="connections" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Case Connections</CardTitle>
                <CardDescription>Potential connections to other cases identified by AI analysis.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <LucideLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium">Case CS-2019-042: Westside Assault</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Similar victim profile, location pattern, and method. 76% confidence in connection.
                      </p>
                      <Button variant="link" className="px-0 h-auto mt-1">
                        View Case Details
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <LucideLink className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <h4 className="font-medium">Case CS-2021-103: Downtown Homicide</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Forensic evidence similarities and potential suspect overlap. 64% confidence in connection.
                      </p>
                      <Button variant="link" className="px-0 h-auto mt-1">
                        View Case Details
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 border rounded-lg">
                    <LucideAlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <h4 className="font-medium">Cold Case Series: Riverside Incidents (2015-2020)</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        AI has identified a potential series connection with 5 cold cases from the Riverside area. High
                        priority review recommended.
                      </p>
                      <Button variant="link" className="px-0 h-auto mt-1">
                        View Series Analysis
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex justify-between mt-4">
          <Button variant="outline">Export Analysis Report</Button>
          <Button>Request Further Analysis</Button>
=======
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
>>>>>>> 526dca4 (Add AI graph structure output (entities, events, links))
        </div>
      </div>
    </div>
  )
}
