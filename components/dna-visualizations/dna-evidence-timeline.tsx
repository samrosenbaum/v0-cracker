"use client"

import { useState, useRef, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import {
  LucideCalendar,
  LucideZoomIn,
  LucideZoomOut,
  LucideChevronLeft,
  LucideChevronRight,
  LucideFilter,
  LucideDownload,
  LucideSearch,
  LucideRefreshCw,
  LucideDna,
  LucideFileText,
  LucideUser,
  LucideMapPin,
  LucideAlertCircle,
  LucideCheckCircle,
  FlaskConicalIcon as LucideFlask,
} from "lucide-react"

interface TimelineEvent {
  id: string
  date: string
  time?: string
  type: "collection" | "transfer" | "analysis" | "match" | "report" | "degradation" | "other"
  title: string
  description: string
  location?: string
  personnel?: string
  sampleId?: string
  caseId?: string
  status?: "completed" | "pending" | "failed"
  relatedEvents?: string[]
  tags?: string[]
  priority?: "low" | "medium" | "high"
}

interface DNAEvidenceTimelineProps {
  events?: TimelineEvent[]
  caseId?: string
  startDate?: string
  endDate?: string
}

export function DNAEvidenceTimeline({
  events: propEvents,
  caseId = "CS-2023-089",
  startDate = "2023-11-01",
  endDate = "2023-12-31",
}: DNAEvidenceTimelineProps) {
  const [zoomLevel, setZoomLevel] = useState(100)
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)
  const [view, setView] = useState<"timeline" | "list" | "calendar">("timeline")
  const [filterType, setFilterType] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPriority, setFilterPriority] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentDateRange, setCurrentDateRange] = useState({ start: startDate, end: endDate })
  const timelineRef = useRef<HTMLDivElement>(null)

  // Sample data for demonstration
  const demoEvents: TimelineEvent[] = [
    {
      id: "EV-2023-001",
      date: "2023-11-15",
      time: "09:30",
      type: "collection",
      title: "Initial Crime Scene Evidence Collection",
      description: "Blood sample collected from park bench at Riverside Park, North Section.",
      location: "Riverside Park, North Section",
      personnel: "Officer J. Martinez",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "completed",
      tags: ["blood", "crime scene", "initial collection"],
      priority: "high",
    },
    {
      id: "EV-2023-002",
      date: "2023-11-15",
      time: "14:45",
      type: "transfer",
      title: "Evidence Transfer to Lab",
      description: "Blood sample transferred to Central Forensics Lab for processing.",
      personnel: "Officer J. Martinez",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-001"],
      tags: ["transfer", "chain of custody"],
      priority: "medium",
    },
    {
      id: "EV-2023-003",
      date: "2023-11-16",
      time: "08:15",
      type: "collection",
      title: "Victim Reference Sample Collection",
      description: "Reference sample collected from victim at City Hospital.",
      location: "City Hospital",
      personnel: "Dr. M. Chen",
      sampleId: "DNA-2023-0128",
      caseId: "CS-2023-089",
      status: "completed",
      tags: ["reference", "victim"],
      priority: "high",
    },
    {
      id: "EV-2023-004",
      date: "2023-11-16",
      time: "10:30",
      type: "transfer",
      title: "Victim Sample Transfer to Lab",
      description: "Victim reference sample transferred to Central Forensics Lab.",
      personnel: "Officer T. Wilson",
      sampleId: "DNA-2023-0128",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-003"],
      tags: ["transfer", "chain of custody"],
      priority: "medium",
    },
    {
      id: "EV-2023-005",
      date: "2023-11-17",
      time: "09:00",
      type: "analysis",
      title: "Initial DNA Extraction",
      description: "DNA extraction process initiated for crime scene blood sample.",
      personnel: "Tech L. Johnson",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-002"],
      tags: ["extraction", "processing"],
      priority: "medium",
    },
    {
      id: "EV-2023-006",
      date: "2023-11-17",
      time: "11:30",
      type: "collection",
      title: "Suspect Reference Sample Collection",
      description: "Reference sample collected from suspect John Doe at Police Station.",
      location: "Police Station",
      personnel: "Officer S. Rodriguez",
      sampleId: "DNA-2023-0129",
      caseId: "CS-2023-089",
      status: "completed",
      tags: ["reference", "suspect"],
      priority: "high",
    },
    {
      id: "EV-2023-007",
      date: "2023-11-17",
      time: "13:45",
      type: "transfer",
      title: "Suspect Sample Transfer to Lab",
      description: "Suspect reference sample transferred to Central Forensics Lab.",
      personnel: "Officer S. Rodriguez",
      sampleId: "DNA-2023-0129",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-006"],
      tags: ["transfer", "chain of custody"],
      priority: "medium",
    },
    {
      id: "EV-2023-008",
      date: "2023-11-18",
      time: "14:30",
      type: "analysis",
      title: "DNA Profile Generation",
      description: "STR profile generated from crime scene blood sample.",
      personnel: "Dr. A. Williams",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-005"],
      tags: ["STR profile", "analysis"],
      priority: "high",
    },
    {
      id: "EV-2023-009",
      date: "2023-11-19",
      time: "09:15",
      type: "analysis",
      title: "Victim DNA Profile Generation",
      description: "STR profile generated from victim reference sample.",
      personnel: "Dr. A. Williams",
      sampleId: "DNA-2023-0128",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-004"],
      tags: ["STR profile", "analysis", "victim"],
      priority: "medium",
    },
    {
      id: "EV-2023-010",
      date: "2023-11-20",
      time: "10:00",
      type: "analysis",
      title: "Crime Scene Sample CODIS Upload",
      description: "DNA profile from crime scene uploaded to CODIS database for comparison.",
      personnel: "Dr. A. Williams",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-008"],
      tags: ["CODIS", "database"],
      priority: "high",
    },
    {
      id: "EV-2023-011",
      date: "2023-11-21",
      time: "15:30",
      type: "analysis",
      title: "Suspect DNA Profile Generation",
      description: "STR profile generated from suspect reference sample.",
      personnel: "Tech B. Thompson",
      sampleId: "DNA-2023-0129",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-007"],
      tags: ["STR profile", "analysis", "suspect"],
      priority: "high",
    },
    {
      id: "EV-2023-012",
      date: "2023-11-22",
      time: "11:45",
      type: "analysis",
      title: "DNA Profile Comparison",
      description: "Comparison of crime scene DNA profile with suspect reference sample.",
      personnel: "Dr. A. Williams",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-008", "EV-2023-011"],
      tags: ["comparison", "analysis"],
      priority: "high",
    },
    {
      id: "EV-2023-013",
      date: "2023-11-25",
      time: "09:30",
      type: "report",
      title: "Preliminary DNA Analysis Report",
      description: "Preliminary report on DNA analysis findings and comparisons.",
      personnel: "Dr. A. Williams",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-012"],
      tags: ["report", "preliminary"],
      priority: "medium",
    },
    {
      id: "EV-2023-014",
      date: "2023-12-01",
      time: "14:00",
      type: "match",
      title: "CODIS Match Notification",
      description: "Notification received of CODIS match with offender database.",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-010"],
      tags: ["CODIS", "match", "offender"],
      priority: "high",
    },
    {
      id: "EV-2023-015",
      date: "2023-12-03",
      time: "10:15",
      type: "analysis",
      title: "CODIS Match Verification",
      description: "Verification of CODIS match with additional testing.",
      personnel: "Dr. A. Williams",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-014"],
      tags: ["verification", "CODIS"],
      priority: "high",
    },
    {
      id: "EV-2023-016",
      date: "2023-12-05",
      time: "16:30",
      type: "collection",
      title: "Additional Evidence Collection",
      description: "Additional DNA evidence collected from secondary crime scene location.",
      location: "Riverside Park, South Entrance",
      personnel: "Officer J. Martinez",
      sampleId: "DNA-2023-0135",
      caseId: "CS-2023-089",
      status: "completed",
      tags: ["secondary collection", "crime scene"],
      priority: "medium",
    },
    {
      id: "EV-2023-017",
      date: "2023-12-07",
      time: "09:00",
      type: "analysis",
      title: "Familial DNA Search",
      description: "Familial DNA search initiated in CODIS database.",
      personnel: "Dr. R. Garcia",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-015"],
      tags: ["familial", "CODIS", "search"],
      priority: "medium",
    },
    {
      id: "EV-2023-018",
      date: "2023-12-10",
      time: "11:30",
      type: "match",
      title: "Familial Match Identification",
      description: "Potential familial match identified in CODIS database.",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-017"],
      tags: ["familial", "match"],
      priority: "high",
    },
    {
      id: "EV-2023-019",
      date: "2023-12-12",
      time: "14:45",
      type: "report",
      title: "Comprehensive DNA Analysis Report",
      description: "Final comprehensive report on all DNA evidence and matches.",
      personnel: "Dr. A. Williams",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-013", "EV-2023-015", "EV-2023-018"],
      tags: ["report", "final", "comprehensive"],
      priority: "high",
    },
    {
      id: "EV-2023-020",
      date: "2023-12-15",
      time: "10:00",
      type: "other",
      title: "Evidence Review Meeting",
      description: "Team meeting to review all DNA evidence findings and plan next steps.",
      location: "Central Police Department, Conference Room B",
      caseId: "CS-2023-089",
      status: "completed",
      relatedEvents: ["EV-2023-019"],
      tags: ["meeting", "review"],
      priority: "medium",
    },
    {
      id: "EV-2023-021",
      date: "2023-12-20",
      time: "09:30",
      type: "analysis",
      title: "Advanced Y-STR Analysis",
      description: "Y-STR analysis initiated on crime scene sample for additional information.",
      personnel: "Dr. R. Garcia",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "pending",
      tags: ["Y-STR", "advanced analysis"],
      priority: "medium",
    },
    {
      id: "EV-2023-022",
      date: "2023-12-28",
      time: "15:00",
      type: "report",
      title: "Y-STR Analysis Report",
      description: "Report on Y-STR analysis findings and implications.",
      personnel: "Dr. R. Garcia",
      sampleId: "DNA-2023-0127",
      caseId: "CS-2023-089",
      status: "pending",
      relatedEvents: ["EV-2023-021"],
      tags: ["report", "Y-STR"],
      priority: "medium",
    },
  ]

  const events = propEvents || demoEvents

  // Filter events based on current filters
  const filteredEvents = events.filter((event) => {
    // Filter by type
    if (filterType !== "all" && event.type !== filterType) return false

    // Filter by status
    if (filterStatus !== "all" && event.status !== filterStatus) return false

    // Filter by priority
    if (filterPriority !== "all" && event.priority !== filterPriority) return false

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        event.title.toLowerCase().includes(query) ||
        event.description.toLowerCase().includes(query) ||
        (event.sampleId && event.sampleId.toLowerCase().includes(query)) ||
        (event.personnel && event.personnel.toLowerCase().includes(query)) ||
        (event.location && event.location.toLowerCase().includes(query))
      )
    }

    return true
  })

  // Sort events by date and time
  const sortedEvents = [...filteredEvents].sort((a, b) => {
    const dateA = new Date(`${a.date}T${a.time || "00:00"}`)
    const dateB = new Date(`${b.date}T${b.time || "00:00"}`)
    return dateA.getTime() - dateB.getTime()
  })

  // Group events by date for timeline view
  const eventsByDate = sortedEvents.reduce<Record<string, TimelineEvent[]>>((acc, event) => {
    if (!acc[event.date]) {
      acc[event.date] = []
    }
    acc[event.date].push(event)
    return acc
  }, {})

  // Get unique dates for timeline
  const timelineDates = Object.keys(eventsByDate).sort()

  // Get event type icon
  const getEventTypeIcon = (type: string) => {
    switch (type) {
      case "collection":
        return <LucideFlask className="h-4 w-4" />
      case "transfer":
        return <LucideMapPin className="h-4 w-4" />
      case "analysis":
        return <LucideDna className="h-4 w-4" />
      case "match":
        return <LucideCheckCircle className="h-4 w-4" />
      case "report":
        return <LucideFileText className="h-4 w-4" />
      case "degradation":
        return <LucideAlertCircle className="h-4 w-4" />
      default:
        return <LucideCalendar className="h-4 w-4" />
    }
  }

  // Get event type color
  const getEventTypeColor = (type: string) => {
    switch (type) {
      case "collection":
        return "bg-blue-500"
      case "transfer":
        return "bg-amber-500"
      case "analysis":
        return "bg-purple-500"
      case "match":
        return "bg-green-500"
      case "report":
        return "bg-slate-500"
      case "degradation":
        return "bg-red-500"
      default:
        return "bg-gray-500"
    }
  }

  // Get event status badge
  const getEventStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>
      case "pending":
        return <Badge className="bg-amber-500">Pending</Badge>
      case "failed":
        return <Badge className="bg-red-500">Failed</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  // Get event priority badge
  const getEventPriorityBadge = (priority: string) => {
    switch (priority) {
      case "high":
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            High Priority
          </Badge>
        )
      case "medium":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            Medium Priority
          </Badge>
        )
      case "low":
        return (
          <Badge variant="outline" className="border-green-500 text-green-500">
            Low Priority
          </Badge>
        )
      default:
        return null
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  // Handle zoom in/out
  const handleZoomIn = () => {
    setZoomLevel(Math.min(200, zoomLevel + 25))
  }

  const handleZoomOut = () => {
    setZoomLevel(Math.max(50, zoomLevel - 25))
  }

  const handleResetZoom = () => {
    setZoomLevel(100)
  }

  // Handle event selection
  const handleEventClick = (eventId: string) => {
    setSelectedEvent(eventId === selectedEvent ? null : eventId)
  }

  // Get selected event details
  const selectedEventDetails = selectedEvent ? events.find((event) => event.id === selectedEvent) : null

  // Get related events for the selected event
  const relatedEvents = selectedEventDetails?.relatedEvents
    ? events.filter((event) => selectedEventDetails.relatedEvents?.includes(event.id))
    : []

  // Scroll to selected event
  useEffect(() => {
    if (selectedEvent && timelineRef.current) {
      const eventElement = document.getElementById(`event-${selectedEvent}`)
      if (eventElement) {
        timelineRef.current.scrollTo({
          top: eventElement.offsetTop - 100,
          behavior: "smooth",
        })
      }
    }
  }, [selectedEvent])

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LucideCalendar className="h-5 w-5 text-primary" />
            <CardTitle>DNA Evidence Timeline</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <LucideDownload className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        <CardDescription>
          Interactive timeline of DNA evidence collection, processing, and analysis for case {caseId}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={view} onValueChange={setView as any} className="w-[300px]">
            <TabsList>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="list">List View</TabsTrigger>
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <div className="relative">
              <LucideSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search events..."
                className="w-full pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" onClick={handleZoomIn}>
              <LucideZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomOut}>
              <LucideZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleResetZoom}>
              <LucideRefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="collection">Collection</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="analysis">Analysis</SelectItem>
              <SelectItem value="match">Match</SelectItem>
              <SelectItem value="report">Report</SelectItem>
              <SelectItem value="degradation">Degradation</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" className="flex items-center gap-1">
            <LucideFilter className="h-4 w-4" />
            More Filters
          </Button>

          <div className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
            <span>
              Showing {sortedEvents.length} of {events.length} events
            </span>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <LucideChevronLeft className="h-4 w-4 mr-1" />
              Previous Month
            </Button>
            <div className="text-sm font-medium">
              {new Date(currentDateRange.start).toLocaleDateString("en-US", { month: "long", year: "numeric" })} -{" "}
              {new Date(currentDateRange.end).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </div>
            <Button variant="outline" size="sm">
              Next Month
              <LucideChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              Today
            </Button>
            <Button variant="outline" size="sm">
              This Week
            </Button>
            <Button variant="outline" size="sm">
              This Month
            </Button>
          </div>
        </div>

        <div className="mb-2 flex flex-wrap gap-2">
          <div className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded-full bg-blue-500`}></span>
            <span className="text-xs">Collection</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded-full bg-amber-500`}></span>
            <span className="text-xs">Transfer</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded-full bg-purple-500`}></span>
            <span className="text-xs">Analysis</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded-full bg-green-500`}></span>
            <span className="text-xs">Match</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded-full bg-slate-500`}></span>
            <span className="text-xs">Report</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded-full bg-red-500`}></span>
            <span className="text-xs">Degradation</span>
          </div>
          <div className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded-full bg-gray-500`}></span>
            <span className="text-xs">Other</span>
          </div>
        </div>

        {view === "timeline" && (
          <div
            className="relative mt-4 rounded-md border bg-muted/30 p-4"
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top left" }}
          >
            <div className="absolute left-[60px] top-0 bottom-0 w-px bg-border"></div>

            <div className="space-y-8" ref={timelineRef} style={{ maxHeight: "600px", overflowY: "auto" }}>
              {timelineDates.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  No events found matching the current filters.
                </div>
              ) : (
                timelineDates.map((date) => (
                  <div key={date} className="relative">
                    <div className="sticky top-0 z-10 mb-4 flex items-center bg-muted/30 py-2">
                      <div className="w-[60px] text-right text-sm font-medium">{formatDate(date).split(",")[0]}</div>
                      <div className="ml-8 text-sm font-medium">{formatDate(date).split(",").slice(1).join(",")}</div>
                    </div>

                    <div className="space-y-4">
                      {eventsByDate[date].map((event) => (
                        <div
                          key={event.id}
                          id={`event-${event.id}`}
                          className={`relative flex ${selectedEvent === event.id ? "bg-muted/50 rounded-md" : ""}`}
                          onClick={() => handleEventClick(event.id)}
                        >
                          <div className="w-[60px] pt-1 text-right text-xs text-muted-foreground">
                            {event.time || ""}
                          </div>

                          <div className="relative ml-8">
                            <div
                              className={`absolute -left-[17px] top-1 flex h-6 w-6 items-center justify-center rounded-full ${getEventTypeColor(
                                event.type,
                              )} text-white`}
                            >
                              {getEventTypeIcon(event.type)}
                            </div>

                            <div
                              className={`ml-4 rounded-md border p-3 ${
                                selectedEvent === event.id ? "border-primary ring-2 ring-primary ring-opacity-50" : ""
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <h3 className="font-medium">{event.title}</h3>
                                {event.status && getEventStatusBadge(event.status)}
                              </div>

                              <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>

                              <div className="mt-2 flex flex-wrap gap-2">
                                {event.sampleId && (
                                  <Badge variant="outline" className="text-xs">
                                    Sample: {event.sampleId}
                                  </Badge>
                                )}
                                {event.personnel && (
                                  <Badge variant="outline" className="text-xs">
                                    Personnel: {event.personnel}
                                  </Badge>
                                )}
                                {event.location && (
                                  <Badge variant="outline" className="text-xs">
                                    Location: {event.location}
                                  </Badge>
                                )}
                                {event.priority && getEventPriorityBadge(event.priority)}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === "list" && (
          <div className="mt-4 rounded-md border">
            <div className="grid grid-cols-12 p-3 text-sm font-medium text-muted-foreground bg-muted/50">
              <div className="col-span-2">Date & Time</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-3">Title</div>
              <div className="col-span-2">Sample ID</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>
            <div className="divide-y">
              {sortedEvents.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground">
                  No events found matching the current filters.
                </div>
              ) : (
                sortedEvents.map((event) => (
                  <div
                    key={event.id}
                    className={`grid grid-cols-12 p-3 text-sm ${selectedEvent === event.id ? "bg-muted/50" : ""}`}
                    onClick={() => handleEventClick(event.id)}
                  >
                    <div className="col-span-2">
                      {new Date(event.date).toLocaleDateString()}{" "}
                      {event.time && <span className="text-muted-foreground">{event.time}</span>}
                    </div>
                    <div className="col-span-2">
                      <div className="flex items-center gap-1">
                        <span className={`inline-block h-3 w-3 rounded-full ${getEventTypeColor(event.type)}`}></span>
                        <span className="capitalize">{event.type}</span>
                      </div>
                    </div>
                    <div className="col-span-3 font-medium">{event.title}</div>
                    <div className="col-span-2">{event.sampleId || "-"}</div>
                    <div className="col-span-2">{event.status && getEventStatusBadge(event.status)}</div>
                    <div className="col-span-1 text-right">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideSearch className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {view === "calendar" && (
          <div className="mt-4 flex items-center justify-center rounded-md border p-8">
            <div className="text-center">
              <LucideCalendar className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <h3 className="text-sm font-medium">Calendar View Coming Soon</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                This visualization is under development and will be available in a future update.
              </p>
            </div>
          </div>
        )}

        {selectedEventDetails && (
          <div className="mt-6 rounded-md border p-4">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-medium">{selectedEventDetails.title}</h3>
              <div className="flex items-center gap-2">
                <Badge className={getEventTypeColor(selectedEventDetails.type)}>
                  <span className="capitalize">{selectedEventDetails.type}</span>
                </Badge>
                {selectedEventDetails.status && getEventStatusBadge(selectedEventDetails.status)}
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div>
                  <h4 className="mb-2 text-sm font-medium">Event Details</h4>
                  <div className="rounded-md border p-3">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Event ID:</span>
                        <span className="text-sm font-medium">{selectedEventDetails.id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Date:</span>
                        <span className="text-sm font-medium">
                          {new Date(selectedEventDetails.date).toLocaleDateString()}
                        </span>
                      </div>
                      {selectedEventDetails.time && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Time:</span>
                          <span className="text-sm font-medium">{selectedEventDetails.time}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Case ID:</span>
                        <span className="text-sm font-medium">{selectedEventDetails.caseId}</span>
                      </div>
                      {selectedEventDetails.sampleId && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Sample ID:</span>
                          <span className="text-sm font-medium">{selectedEventDetails.sampleId}</span>
                        </div>
                      )}
                      {selectedEventDetails.personnel && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Personnel:</span>
                          <span className="text-sm font-medium">{selectedEventDetails.personnel}</span>
                        </div>
                      )}
                      {selectedEventDetails.location && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Location:</span>
                          <span className="text-sm font-medium">{selectedEventDetails.location}</span>
                        </div>
                      )}
                      {selectedEventDetails.priority && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Priority:</span>
                          <span className="text-sm font-medium capitalize">{selectedEventDetails.priority}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="mb-2 text-sm font-medium">Description</h4>
                  <div className="rounded-md border p-3">
                    <p className="text-sm">{selectedEventDetails.description}</p>
                  </div>
                </div>

                {selectedEventDetails.tags && selectedEventDetails.tags.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedEventDetails.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {relatedEvents.length > 0 && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Related Events</h4>
                    <div className="space-y-2">
                      {relatedEvents.map((event) => (
                        <div
                          key={event.id}
                          className="flex items-center justify-between rounded-md border p-2"
                          onClick={() => handleEventClick(event.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-full ${getEventTypeColor(
                                event.type,
                              )} text-white`}
                            >
                              {getEventTypeIcon(event.type)}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{event.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {new Date(event.date).toLocaleDateString()} {event.time && `at ${event.time}`}
                              </div>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedEventDetails.sampleId && (
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Sample Information</h4>
                    <div className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <span>Sample ID: {selectedEventDetails.sampleId}</span>
                        <Button variant="outline" size="sm">
                          View Sample Details
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="mb-2 text-sm font-medium">Actions</h4>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <LucideFileText className="h-4 w-4" />
                      Generate Report
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <LucideUser className="h-4 w-4" />
                      Assign Personnel
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <LucideDna className="h-4 w-4" />
                      View DNA Profile
                    </Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <LucideDownload className="h-4 w-4" />
                      Export Details
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
