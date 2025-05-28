"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { LucideSearch, LucideDatabase, LucideHardDrive, LucideSmartphone, LucideWifi } from "lucide-react"

export default function ForensicsPage() {
  const [searchTerm, setSearchTerm] = useState("")

  // Mock data - replace with real API call
  const evidenceItems = [
    {
      id: "DE-001",
      type: "Computer",
      description: "Dell Laptop - Suspect's Personal Computer",
      status: "In Analysis",
      dateCollected: "2024-03-15",
      assignedTo: "Tech Johnson",
      findings: ["Encrypted files found", "Browser history recovered"]
    },
    {
      id: "DE-002",
      type: "Mobile",
      description: "iPhone 13 - Victim's Device",
      status: "Completed",
      dateCollected: "2024-03-14",
      assignedTo: "Tech Chen",
      findings: ["Call logs extracted", "Location data analyzed"]
    },
    {
      id: "DE-003",
      type: "Network",
      description: "Router Log Analysis",
      status: "Pending",
      dateCollected: "2024-03-13",
      assignedTo: "Tech Williams",
      findings: []
    }
  ]

  const filteredEvidence = evidenceItems.filter(item =>
    item.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.type.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getEvidenceIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'computer':
        return <LucideHardDrive className="h-8 w-8" />
      case 'mobile':
        return <LucideSmartphone className="h-8 w-8" />
      case 'network':
        return <LucideWifi className="h-8 w-8" />
      default:
        return <LucideDatabase className="h-8 w-8" />
    }
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Digital Forensics</h1>
        <p className="text-muted-foreground">Manage and analyze digital evidence</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <LucideHardDrive className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Computer Evidence</h3>
                <p className="text-2xl font-bold">12</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <LucideSmartphone className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Mobile Devices</h3>
                <p className="text-2xl font-bold">8</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <LucideWifi className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Network Analysis</h3>
                <p className="text-2xl font-bold">5</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <LucideDatabase className="h-8 w-8 text-primary" />
              <div>
                <h3 className="font-semibold">Total Evidence</h3>
                <p className="text-2xl font-bold">25</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Input
          placeholder="Search evidence items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
        <LucideSearch className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
      </div>

      {/* Evidence List */}
      <div className="space-y-4">
        {filteredEvidence.map(item => (
          <Card key={item.id} className="hover:bg-accent/50 transition-colors">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className="text-primary">
                  {getEvidenceIcon(item.type)}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        {item.description}
                        <Badge variant={
                          item.status === "Completed" ? "default" :
                          item.status === "In Analysis" ? "secondary" : "outline"
                        }>
                          {item.status}
                        </Badge>
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        ID: {item.id} • Collected: {item.dateCollected} • Assigned to: {item.assignedTo}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                  {item.findings.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Key Findings:</h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {item.findings.map((finding, index) => (
                          <li key={index}>{finding}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
