"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  LucideFileSearch, 
  LucideUsers, 
  LucideAlertTriangle, 
  LucideCheckCircle,
  LucideActivity,
  LucideClock,
  LucideTarget
} from "lucide-react"
import Link from "next/link"

export default function LawEnforcementDashboard() {
  const activeCases = [
    { id: "CS-2024-001", title: "Downtown Homicide", priority: "CRITICAL", daysOpen: 45, suspects: 3 },
    { id: "CS-2024-002", title: "Missing Person", priority: "HIGH", daysOpen: 12, suspects: 1 },
    { id: "CS-2023-089", title: "Riverside Homicide", priority: "MEDIUM", daysOpen: 180, suspects: 7 },
  ]

  const recentAlerts = [
    { type: "DNA Match", case: "CS-2024-001", confidence: 98.7, time: "2 hours ago" },
    { type: "New Evidence", case: "CS-2024-002", confidence: 85.3, time: "4 hours ago" },
    { type: "Pattern Match", case: "CS-2023-089", confidence: 76.8, time: "1 day ago" },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Law Enforcement Dashboard</h1>
          <p className="text-muted-foreground">Active investigations and AI insights</p>
        </div>
        <Link href="/cases/new">
          <Button>
            <LucideFileSearch className="mr-2 h-4 w-4" />
            New Case
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cases</CardTitle>
            <LucideActivity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">24</div>
            <p className="text-xs text-muted-foreground">+3 this week</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI Alerts</CardTitle>
            <LucideAlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Require review</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Solved This Month</CardTitle>
            <LucideCheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">67% success rate</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Resolution</CardTitle>
            <LucideClock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">45</div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="cases" className="space-y-4">
        <TabsList>
          <TabsTrigger value="cases">Active Cases</TabsTrigger>
          <TabsTrigger value="alerts">AI Alerts</TabsTrigger>
          <TabsTrigger value="forensics">Forensics Queue</TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>High Priority Cases</CardTitle>
              <CardDescription>Cases requiring immediate attention</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activeCases.map((case_) => (
                  <div key={case_.id} className="flex items-center justify-between border-b pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{case_.title}</span>
                        <Badge variant={
                          case_.priority === 'CRITICAL' ? 'destructive' : 
                          case_.priority === 'HIGH' ? 'default' : 'secondary'
                        }>
                          {case_.priority}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Case: {case_.id}</span>
                        <span>Open: {case_.daysOpen} days</span>
                        <span>Suspects: {case_.suspects}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/cases/${case_.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                      <Link href={`/analysis/flags?case=${case_.id}`}>
                        <Button size="sm">
                          <LucideTarget className="mr-1 h-3 w-3" />
                          Analyze
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent AI Alerts</CardTitle>
              <CardDescription>AI-detected patterns and matches requiring review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentAlerts.map((alert, i) => (
                  <div key={i} className="flex items-center justify-between border-b pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{alert.type}</Badge>
                        <span className="font-medium">{alert.case}</span>
                        <Badge className={
                          alert.confidence > 95 ? "bg-green-500" :
                          alert.confidence > 80 ? "bg-amber-500" : "bg-red-500"
                        }>
                          {alert.confidence}% confidence
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">{alert.time}</div>
                    </div>
                    <Button variant="outline" size="sm">Review</Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="forensics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Forensics Processing Queue</CardTitle>
              <CardDescription>DNA and evidence analysis status</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/forensics">
                <Button className="w-full">
                  View Full Forensics Dashboard
                </Button>
              </Link>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}