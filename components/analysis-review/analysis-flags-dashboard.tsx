"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  LucideAlertCircle,
  LucideAlertTriangle,
  LucideArrowUpRight,
  LucideCheckCircle2,
  LucideChevronRight,
  LucideCircleX,
  LucideFilter,
  LucideSearch,
  LucideUser,
  LucideFileText,
  LucideCalendarClock,
  LucideDna,
  LucideMessageSquare,
  LucideEye,
  LucideRefreshCw,
} from "lucide-react"

// Types
interface FlaggedItem {
  id: string
  type: "suspect" | "evidence" | "witness" | "timeline" | "connection" | "inconsistency"
  title: string
  description: string
  confidence: number // 0-100
  severity: "critical" | "high" | "medium" | "low"
  status: "new" | "in_review" | "verified" | "dismissed" | "resolved"
  dateIdentified: string
  lastUpdated: string
  caseId: string
  relatedItems?: string[]
  assignedTo?: string
  tags?: string[]
  aiConfidence?: number // 0-100, AI's confidence in this flag
  evidenceStrength?: number // 0-100, strength of supporting evidence
  actionRecommendation?: string
  notes?: string
}

interface SuspectFlag extends FlaggedItem {
  type: "suspect"
  suspectId: string
  suspectName: string
  matchType: "dna" | "fingerprint" | "witness" | "circumstantial" | "multiple"
  priorHistory?: boolean
  locationMatch?: boolean
  timelineMatch?: boolean
  motive?: boolean
  opportunity?: boolean
  physicalEvidence?: boolean
}

interface EvidenceFlag extends FlaggedItem {
  type: "evidence"
  evidenceId: string
  evidenceType: "dna" | "fingerprint" | "weapon" | "trace" | "digital" | "document" | "other"
  reanalysisReason: "technology" | "degradation" | "partial" | "contamination" | "oversight" | "other"
  originalAnalysisDate?: string
  locationFound?: string
  custodyIssues?: boolean
}

interface WitnessFlag extends FlaggedItem {
  type: "witness"
  witnessId: string
  witnessName: string
  statementIssue: "inconsistency" | "omission" | "contradiction" | "new_information" | "credibility" | "other"
  statementDate?: string
  relationToVictim?: string
  relationToSuspect?: string
}

interface TimelineFlag extends FlaggedItem {
  type: "timeline"
  timelineIssue: "gap" | "contradiction" | "alibi" | "new_evidence" | "other"
  timeStart?: string
  timeEnd?: string
  involvedParties?: string[]
}

interface ConnectionFlag extends FlaggedItem {
  type: "connection"
  connectionType: "case" | "suspect" | "victim" | "method" | "location" | "other"
  connectedCaseId?: string
  similarityScore?: number
  connectionBasis?: string[]
}

interface InconsistencyFlag extends FlaggedItem {
  type: "inconsistency"
  inconsistencyType: "statement" | "evidence" | "report" | "timeline" | "other"
  conflictingItems?: string[]
  impactLevel?: "critical" | "significant" | "minor"
}

type Flag = SuspectFlag | EvidenceFlag | WitnessFlag | TimelineFlag | ConnectionFlag | InconsistencyFlag

interface AnalysisFlagsDashboardProps {
  caseId?: string
  flags?: Flag[]
  onFlagStatusChange?: (flagId: string, newStatus: string) => void
  onFlagAssign?: (flagId: string, assignedTo: string) => void
}

export function AnalysisFlagsDashboard({
  caseId = "CS-2023-089",
  flags: propFlags,
  onFlagStatusChange,
  onFlagAssign,
}: AnalysisFlagsDashboardProps) {
  const [activeTab, setActiveTab] = useState("all")
  const [selectedFlag, setSelectedFlag] = useState<string | null>(null)
  const [filterSeverity, setFilterSeverity] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterType, setFilterType] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<string>("severity")

  // Sample data for demonstration
  const demoFlags: Flag[] = [
    {
      id: "FLAG-001",
      type: "suspect",
      suspectId: "POI-001",
      suspectName: "John Doe",
      matchType: "dna",
      title: "DNA Match with Crime Scene Evidence",
      description:
        "Partial DNA profile from crime scene blood sample (DNA-2023-0127) matches suspect with 87% confidence. Suspect has no alibi for the time of the incident.",
      confidence: 87,
      severity: "high",
      status: "new",
      dateIdentified: "2023-12-10",
      lastUpdated: "2023-12-10",
      caseId: "CS-2023-089",
      relatedItems: ["DNA-2023-0127", "POI-001"],
      tags: ["dna", "blood", "no_alibi"],
      aiConfidence: 92,
      evidenceStrength: 85,
      actionRecommendation: "Conduct follow-up interview and collect reference sample for confirmatory testing",
      priorHistory: true,
      locationMatch: true,
      timelineMatch: true,
      motive: false,
      opportunity: true,
      physicalEvidence: true,
    },
    {
      id: "FLAG-002",
      type: "evidence",
      evidenceId: "DNA-2023-0131",
      evidenceType: "dna",
      reanalysisReason: "technology",
      title: "Degraded DNA Sample Eligible for New Analysis",
      description:
        "Sample DNA-2023-0131 was previously marked as degraded, but new amplification techniques could potentially yield usable results. Sample is from a key location in the crime scene.",
      confidence: 65,
      severity: "medium",
      status: "new",
      dateIdentified: "2023-12-11",
      lastUpdated: "2023-12-11",
      caseId: "CS-2023-089",
      relatedItems: ["DNA-2023-0131"],
      tags: ["degraded", "reanalysis", "new_technology"],
      aiConfidence: 78,
      evidenceStrength: 60,
      actionRecommendation: "Submit sample for analysis using MinION sequencing technology",
      originalAnalysisDate: "2023-09-16",
      locationFound: "Harbor District",
    },
    {
      id: "FLAG-003",
      type: "witness",
      witnessId: "WIT-003",
      witnessName: "Sarah Johnson",
      statementIssue: "inconsistency",
      title: "Witness Statement Timeline Inconsistency",
      description:
        "Witness #3 (Sarah Johnson) provided testimony that contradicts the established timeline. She claimed to see the victim at 10:30 PM, but security footage shows victim was at a different location at that time.",
      confidence: 92,
      severity: "high",
      status: "in_review",
      dateIdentified: "2023-12-08",
      lastUpdated: "2023-12-12",
      caseId: "CS-2023-089",
      relatedItems: ["WIT-003", "VID-2023-008"],
      assignedTo: "Det. Rodriguez",
      tags: ["inconsistency", "timeline", "security_footage"],
      aiConfidence: 95,
      evidenceStrength: 90,
      actionRecommendation: "Re-interview witness with specific questions about timeline discrepancy",
      statementDate: "2023-11-20",
      relationToVictim: "Neighbor",
    },
    {
      id: "FLAG-004",
      type: "timeline",
      timelineIssue: "gap",
      title: "Critical Timeline Gap (45 Minutes)",
      description:
        "There is a 45-minute gap in the victim's timeline between 9:15 PM and 10:00 PM on the night of the incident. No witness accounts or evidence documents the victim's whereabouts during this period.",
      confidence: 88,
      severity: "critical",
      status: "in_review",
      dateIdentified: "2023-12-07",
      lastUpdated: "2023-12-12",
      caseId: "CS-2023-089",
      assignedTo: "Det. Martinez",
      tags: ["timeline", "gap", "critical_period"],
      aiConfidence: 90,
      evidenceStrength: 85,
      actionRecommendation:
        "Canvas for additional witnesses and check for surveillance cameras in the surrounding area that might cover this time period",
      timeStart: "2023-11-15T21:15:00",
      timeEnd: "2023-11-15T22:00:00",
      involvedParties: ["Victim"],
    },
    {
      id: "FLAG-005",
      type: "connection",
      connectionType: "case",
      title: "Similar MO to Cold Case CS-2019-042",
      description:
        "Analysis identified significant similarities in modus operandi between this case and cold case CS-2019-042 from 2019. Both cases involve similar victim profiles, location patterns, and method of attack.",
      confidence: 76,
      severity: "high",
      status: "verified",
      dateIdentified: "2023-12-09",
      lastUpdated: "2023-12-13",
      caseId: "CS-2023-089",
      relatedItems: ["CS-2019-042"],
      assignedTo: "Det. Williams",
      tags: ["case_connection", "pattern", "serial"],
      aiConfidence: 82,
      evidenceStrength: 75,
      actionRecommendation: "Conduct joint analysis of both cases and check for DNA cross-matching",
      connectedCaseId: "CS-2019-042",
      similarityScore: 76,
      connectionBasis: ["victim_profile", "location", "method", "timing"],
    },
    {
      id: "FLAG-006",
      type: "inconsistency",
      inconsistencyType: "evidence",
      title: "Contradictory Forensic Reports",
      description:
        "Initial forensic report indicated the weapon was a serrated blade, but new analysis of wound patterns suggests a smooth-edged weapon. This contradicts key evidence and may affect suspect profiles.",
      confidence: 83,
      severity: "critical",
      status: "new",
      dateIdentified: "2023-12-12",
      lastUpdated: "2023-12-12",
      caseId: "CS-2023-089",
      relatedItems: ["REP-2023-015", "REP-2023-022"],
      tags: ["contradiction", "weapon", "forensic"],
      aiConfidence: 88,
      evidenceStrength: 80,
      actionRecommendation: "Request independent analysis from secondary forensic expert",
      conflictingItems: ["REP-2023-015", "REP-2023-022"],
      impactLevel: "critical",
    },
    {
      id: "FLAG-007",
      type: "suspect",
      suspectId: "POI-003",
      suspectName: "Robert Johnson",
      matchType: "circumstantial",
      title: "Suspect Financial Activity Correlation",
      description:
        "Suspect made unusual cash withdrawals and purchases in the vicinity of the crime scene within 24 hours of the incident. Pattern matches previous cases with similar MO.",
      confidence: 72,
      severity: "medium",
      status: "new",
      dateIdentified: "2023-12-11",
      lastUpdated: "2023-12-11",
      caseId: "CS-2023-089",
      relatedItems: ["POI-003", "FIN-2023-007"],
      tags: ["financial", "pattern", "location"],
      aiConfidence: 75,
      evidenceStrength: 65,
      actionRecommendation: "Obtain complete financial records and conduct detailed movement analysis",
      priorHistory: true,
      locationMatch: true,
      timelineMatch: true,
      motive: true,
      opportunity: true,
      physicalEvidence: false,
    },
    {
      id: "FLAG-008",
      type: "evidence",
      evidenceId: "FNGR-2023-012",
      evidenceType: "fingerprint",
      reanalysisReason: "partial",
      title: "Partial Fingerprint Eligible for Enhanced Analysis",
      description:
        "Partial fingerprint found on victim's personal item was initially deemed insufficient for identification. New enhancement techniques could potentially improve the quality for AFIS matching.",
      confidence: 68,
      severity: "medium",
      status: "in_review",
      dateIdentified: "2023-12-10",
      lastUpdated: "2023-12-13",
      caseId: "CS-2023-089",
      relatedItems: ["FNGR-2023-012"],
      assignedTo: "Tech Johnson",
      tags: ["fingerprint", "partial", "enhancement"],
      aiConfidence: 72,
      evidenceStrength: 60,
      actionRecommendation: "Submit for advanced digital enhancement and reanalysis",
      originalAnalysisDate: "2023-11-18",
      locationFound: "Victim's wallet",
    },
    {
      id: "FLAG-009",
      type: "witness",
      witnessId: "WIT-007",
      witnessName: "Michael Chen",
      statementIssue: "new_information",
      title: "Witness With Potentially Critical New Information",
      description:
        "New witness (Michael Chen) came forward claiming to have seen a suspicious vehicle near the crime scene at the estimated time of the incident. Details match partial description from another witness.",
      confidence: 75,
      severity: "high",
      status: "new",
      dateIdentified: "2023-12-13",
      lastUpdated: "2023-12-13",
      caseId: "CS-2023-089",
      relatedItems: ["WIT-007", "WIT-002"],
      tags: ["new_witness", "vehicle", "corroboration"],
      aiConfidence: 80,
      evidenceStrength: 70,
      actionRecommendation: "Conduct detailed interview and cross-reference with existing witness statements",
      statementDate: "2023-12-12",
    },
    {
      id: "FLAG-010",
      type: "timeline",
      timelineIssue: "contradiction",
      title: "Victim's Phone Activity Contradicts Timeline",
      description:
        "Victim's phone records show activity in a location 5 miles from where witnesses placed the victim at the same time. This contradiction affects the established timeline and potential suspect interactions.",
      confidence: 85,
      severity: "high",
      status: "new",
      dateIdentified: "2023-12-12",
      lastUpdated: "2023-12-12",
      caseId: "CS-2023-089",
      relatedItems: ["PHONE-2023-003", "WIT-001", "WIT-004"],
      tags: ["phone", "location", "contradiction"],
      aiConfidence: 88,
      evidenceStrength: 82,
      actionRecommendation: "Verify phone data accuracy and re-interview witnesses with this new information",
      timeStart: "2023-11-15T20:30:00",
      timeEnd: "2023-11-15T21:15:00",
      involvedParties: ["Victim"],
    },
    {
      id: "FLAG-011",
      type: "connection",
      connectionType: "suspect",
      title: "Suspect Connected to Multiple Similar Cases",
      description:
        "Suspect John Doe has been identified as a person of interest in three other cases with similar characteristics over the past 5 years. None resulted in charges, but pattern is significant.",
      confidence: 78,
      severity: "high",
      status: "verified",
      dateIdentified: "2023-12-11",
      lastUpdated: "2023-12-14",
      caseId: "CS-2023-089",
      relatedItems: ["POI-001", "CS-2018-127", "CS-2020-089", "CS-2022-156"],
      assignedTo: "Det. Williams",
      tags: ["pattern", "serial", "suspect_history"],
      aiConfidence: 85,
      evidenceStrength: 75,
      actionRecommendation: "Conduct comprehensive analysis of all connected cases and suspect movements",
      connectionType: "suspect",
      similarityScore: 82,
      connectionBasis: ["suspect", "method", "victim_type"],
    },
    {
      id: "FLAG-012",
      type: "inconsistency",
      inconsistencyType: "statement",
      title: "Suspect Alibi Witness Inconsistency",
      description:
        "Suspect's alibi witness provided details that contradict known facts about the location they claim to have been together. Specific details about the restaurant layout and staff don't match reality.",
      confidence: 90,
      severity: "critical",
      status: "in_review",
      dateIdentified: "2023-12-13",
      lastUpdated: "2023-12-14",
      caseId: "CS-2023-089",
      relatedItems: ["POI-002", "WIT-009"],
      assignedTo: "Det. Rodriguez",
      tags: ["alibi", "false_statement", "contradiction"],
      aiConfidence: 92,
      evidenceStrength: 88,
      actionRecommendation: "Re-interview alibi witness with specific questions about inconsistencies",
      conflictingItems: ["STMT-2023-009", "LOC-2023-003"],
      impactLevel: "critical",
    },
  ]

  const flags = propFlags || demoFlags

  // Handle flag status change
  const handleStatusChange = (flagId: string, newStatus: string) => {
    if (onFlagStatusChange) {
      onFlagStatusChange(flagId, newStatus)
    }
  }

  // Handle flag assignment
  const handleAssign = (flagId: string, assignedTo: string) => {
    if (onFlagAssign) {
      onFlagAssign(flagId, assignedTo)
    }
  }

  // Filter flags based on current filters and search query
  const filteredFlags = flags.filter((flag) => {
    // Filter by tab
    if (activeTab !== "all" && flag.type !== activeTab) {
      return false
    }

    // Filter by severity
    if (filterSeverity !== "all" && flag.severity !== filterSeverity) {
      return false
    }

    // Filter by status
    if (filterStatus !== "all" && flag.status !== filterStatus) {
      return false
    }

    // Filter by type
    if (filterType !== "all" && flag.type !== filterType) {
      return false
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      return (
        flag.title.toLowerCase().includes(query) ||
        flag.description.toLowerCase().includes(query) ||
        (flag.tags && flag.tags.some((tag) => tag.toLowerCase().includes(query)))
      )
    }

    return true
  })

  // Sort flags based on current sort option
  const sortedFlags = [...filteredFlags].sort((a, b) => {
    switch (sortBy) {
      case "severity":
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        return severityOrder[a.severity] - severityOrder[b.severity]
      case "confidence":
        return b.confidence - a.confidence
      case "date":
        return new Date(b.dateIdentified).getTime() - new Date(a.dateIdentified).getTime()
      default:
        return 0
    }
  })

  // Get the selected flag details
  const selectedFlagDetails = selectedFlag ? flags.find((flag) => flag.id === selectedFlag) : null

  // Get flag type icon
  const getFlagTypeIcon = (type: string) => {
    switch (type) {
      case "suspect":
        return <LucideUser className="h-4 w-4" />
      case "evidence":
        return <LucideDna className="h-4 w-4" />
      case "witness":
        return <LucideMessageSquare className="h-4 w-4" />
      case "timeline":
        return <LucideCalendarClock className="h-4 w-4" />
      case "connection":
        return <LucideArrowUpRight className="h-4 w-4" />
      case "inconsistency":
        return <LucideAlertTriangle className="h-4 w-4" />
      default:
        return <LucideAlertCircle className="h-4 w-4" />
    }
  }

  // Get flag severity badge
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return <Badge className="bg-red-500">Critical</Badge>
      case "high":
        return <Badge className="bg-orange-500">High</Badge>
      case "medium":
        return <Badge className="bg-amber-500">Medium</Badge>
      case "low":
        return <Badge className="bg-green-500">Low</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  // Get flag status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "new":
        return (
          <Badge variant="outline" className="border-blue-500 text-blue-500">
            New
          </Badge>
        )
      case "in_review":
        return (
          <Badge variant="outline" className="border-amber-500 text-amber-500">
            In Review
          </Badge>
        )
      case "verified":
        return (
          <Badge variant="outline" className="border-green-500 text-green-500">
            Verified
          </Badge>
        )
      case "dismissed":
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            Dismissed
          </Badge>
        )
      case "resolved":
        return (
          <Badge variant="outline" className="border-purple-500 text-purple-500">
            Resolved
          </Badge>
        )
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  // Get confidence level color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-500"
    if (confidence >= 75) return "text-blue-500"
    if (confidence >= 60) return "text-amber-500"
    return "text-red-500"
  }

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Get flag type label
  const getFlagTypeLabel = (type: string) => {
    switch (type) {
      case "suspect":
        return "Suspect"
      case "evidence":
        return "Evidence"
      case "witness":
        return "Witness"
      case "timeline":
        return "Timeline"
      case "connection":
        return "Connection"
      case "inconsistency":
        return "Inconsistency"
      default:
        return type
    }
  }

  // Render specific details based on flag type
  const renderFlagTypeSpecificDetails = (flag: Flag) => {
    switch (flag.type) {
      case "suspect":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <h4 className="text-sm font-medium mb-2">Suspect Information</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Suspect ID:</span>
                  <span className="text-sm font-medium">{flag.suspectId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Name:</span>
                  <span className="text-sm font-medium">{flag.suspectName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Match Type:</span>
                  <span className="text-sm font-medium capitalize">{flag.matchType}</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border p-3">
              <h4 className="text-sm font-medium mb-2">Evidence Factors</h4>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2">
                  {flag.priorHistory ? (
                    <LucideCheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <LucideCircleX className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Prior History</span>
                </div>
                <div className="flex items-center gap-2">
                  {flag.locationMatch ? (
                    <LucideCheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <LucideCircleX className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Location Match</span>
                </div>
                <div className="flex items-center gap-2">
                  {flag.timelineMatch ? (
                    <LucideCheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <LucideCircleX className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Timeline Match</span>
                </div>
                <div className="flex items-center gap-2">
                  {flag.motive ? (
                    <LucideCheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <LucideCircleX className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Motive</span>
                </div>
                <div className="flex items-center gap-2">
                  {flag.opportunity ? (
                    <LucideCheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <LucideCircleX className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Opportunity</span>
                </div>
                <div className="flex items-center gap-2">
                  {flag.physicalEvidence ? (
                    <LucideCheckCircle2 className="h-4 w-4 text-green-500" />
                  ) : (
                    <LucideCircleX className="h-4 w-4 text-red-500" />
                  )}
                  <span className="text-sm">Physical Evidence</span>
                </div>
              </div>
            </div>
          </div>
        )

      case "evidence":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <h4 className="text-sm font-medium mb-2">Evidence Information</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Evidence ID:</span>
                  <span className="text-sm font-medium">{flag.evidenceId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Evidence Type:</span>
                  <span className="text-sm font-medium capitalize">{flag.evidenceType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Reanalysis Reason:</span>
                  <span className="text-sm font-medium capitalize">{flag.reanalysisReason}</span>
                </div>
                {flag.originalAnalysisDate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Original Analysis:</span>
                    <span className="text-sm font-medium">{formatDate(flag.originalAnalysisDate)}</span>
                  </div>
                )}
                {flag.locationFound && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Location Found:</span>
                    <span className="text-sm font-medium">{flag.locationFound}</span>
                  </div>
                )}
                {flag.custodyIssues !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Custody Issues:</span>
                    <span className="text-sm font-medium">{flag.custodyIssues ? "Yes" : "No"}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case "witness":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <h4 className="text-sm font-medium mb-2">Witness Information</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Witness ID:</span>
                  <span className="text-sm font-medium">{flag.witnessId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Name:</span>
                  <span className="text-sm font-medium">{flag.witnessName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Statement Issue:</span>
                  <span className="text-sm font-medium capitalize">{flag.statementIssue.replace(/_/g, " ")}</span>
                </div>
                {flag.statementDate && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Statement Date:</span>
                    <span className="text-sm font-medium">{formatDate(flag.statementDate)}</span>
                  </div>
                )}
                {flag.relationToVictim && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Relation to Victim:</span>
                    <span className="text-sm font-medium">{flag.relationToVictim}</span>
                  </div>
                )}
                {flag.relationToSuspect && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Relation to Suspect:</span>
                    <span className="text-sm font-medium">{flag.relationToSuspect}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case "timeline":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <h4 className="text-sm font-medium mb-2">Timeline Issue</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Issue Type:</span>
                  <span className="text-sm font-medium capitalize">{flag.timelineIssue.replace(/_/g, " ")}</span>
                </div>
                {flag.timeStart && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Start Time:</span>
                    <span className="text-sm font-medium">
                      {new Date(flag.timeStart).toLocaleString("en-US", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
                {flag.timeEnd && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">End Time:</span>
                    <span className="text-sm font-medium">
                      {new Date(flag.timeEnd).toLocaleString("en-US", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                )}
                {flag.involvedParties && flag.involvedParties.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Involved Parties:</span>
                    <span className="text-sm font-medium">{flag.involvedParties.join(", ")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case "connection":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <h4 className="text-sm font-medium mb-2">Connection Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Connection Type:</span>
                  <span className="text-sm font-medium capitalize">{flag.connectionType}</span>
                </div>
                {flag.connectedCaseId && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Connected Case:</span>
                    <span className="text-sm font-medium">{flag.connectedCaseId}</span>
                  </div>
                )}
                {flag.similarityScore !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Similarity Score:</span>
                    <span className="text-sm font-medium">{flag.similarityScore}%</span>
                  </div>
                )}
                {flag.connectionBasis && flag.connectionBasis.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Connection Basis:</span>
                    <span className="text-sm font-medium capitalize">
                      {flag.connectionBasis.map((basis) => basis.replace(/_/g, " ")).join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      case "inconsistency":
        return (
          <div className="space-y-4">
            <div className="rounded-md border p-3">
              <h4 className="text-sm font-medium mb-2">Inconsistency Details</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Inconsistency Type:</span>
                  <span className="text-sm font-medium capitalize">{flag.inconsistencyType}</span>
                </div>
                {flag.conflictingItems && flag.conflictingItems.length > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Conflicting Items:</span>
                    <span className="text-sm font-medium">{flag.conflictingItems.join(", ")}</span>
                  </div>
                )}
                {flag.impactLevel && (
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Impact Level:</span>
                    <span className="text-sm font-medium capitalize">{flag.impactLevel}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LucideAlertCircle className="h-5 w-5 text-primary" />
            <CardTitle>Analysis Flags & Review Items</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <LucideRefreshCw className="h-4 w-4" />
              Refresh Analysis
            </Button>
          </div>
        </div>
        <CardDescription>
          AI-identified potential suspects, evidence for re-examination, and inconsistencies for case {caseId}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="all" className="flex-1">
                All Flags ({flags.length})
              </TabsTrigger>
              <TabsTrigger value="suspect" className="flex-1">
                Suspects ({flags.filter((f) => f.type === "suspect").length})
              </TabsTrigger>
              <TabsTrigger value="evidence" className="flex-1">
                Evidence ({flags.filter((f) => f.type === "evidence").length})
              </TabsTrigger>
              <TabsTrigger value="witness" className="flex-1">
                Witnesses ({flags.filter((f) => f.type === "witness").length})
              </TabsTrigger>
              <TabsTrigger value="timeline" className="flex-1">
                Timeline ({flags.filter((f) => f.type === "timeline").length})
              </TabsTrigger>
              <TabsTrigger value="connection" className="flex-1">
                Connections ({flags.filter((f) => f.type === "connection").length})
              </TabsTrigger>
              <TabsTrigger value="inconsistency" className="flex-1">
                Inconsistencies ({flags.filter((f) => f.type === "inconsistency").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <LucideSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search flags..."
              className="w-full pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="in_review">In Review</SelectItem>
                <SelectItem value="verified">Verified</SelectItem>
                <SelectItem value="dismissed">Dismissed</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="severity">Severity</SelectItem>
                <SelectItem value="confidence">Confidence</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="flex items-center gap-1">
              <LucideFilter className="h-4 w-4" />
              More Filters
            </Button>
          </div>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Showing {sortedFlags.length} of {flags.length} flags
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="md:col-span-1 lg:col-span-2">
            <div className="rounded-md border">
              {sortedFlags.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No flags found matching the current filters.
                </div>
              ) : (
                <div className="divide-y">
                  {sortedFlags.map((flag) => (
                    <div
                      key={flag.id}
                      className={`p-4 ${selectedFlag === flag.id ? "bg-muted/50" : ""}`}
                      onClick={() => setSelectedFlag(flag.id === selectedFlag ? null : flag.id)}
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className={`flex h-6 w-6 items-center justify-center rounded-full ${
                              flag.severity === "critical"
                                ? "bg-red-100 text-red-600"
                                : flag.severity === "high"
                                  ? "bg-orange-100 text-orange-600"
                                  : flag.severity === "medium"
                                    ? "bg-amber-100 text-amber-600"
                                    : "bg-green-100 text-green-600"
                            }`}
                          >
                            {getFlagTypeIcon(flag.type)}
                          </div>
                          <div className="font-medium">{flag.title}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getSeverityBadge(flag.severity)}
                          {getStatusBadge(flag.status)}
                        </div>
                      </div>

                      <p className="mb-3 text-sm text-muted-foreground">{flag.description}</p>

                      <div className="mb-3 flex flex-wrap gap-2">
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getFlagTypeIcon(flag.type)}
                          <span className="capitalize">{getFlagTypeLabel(flag.type)}</span>
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`flex items-center gap-1 ${getConfidenceColor(flag.confidence)}`}
                        >
                          <LucideCheckCircle2 className="h-3 w-3" />
                          {flag.confidence}% Confidence
                        </Badge>
                        {flag.tags &&
                          flag.tags.slice(0, 2).map((tag, index) => (
                            <Badge key={index} variant="secondary" className="capitalize">
                              {tag.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        {flag.tags && flag.tags.length > 2 && (
                          <Badge variant="secondary">+{flag.tags.length - 2} more</Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-4">
                          <span>ID: {flag.id}</span>
                          <span>Identified: {formatDate(flag.dateIdentified)}</span>
                          {flag.assignedTo && <span>Assigned: {flag.assignedTo}</span>}
                        </div>
                        <Button variant="ghost" size="sm" className="gap-1 text-xs">
                          <LucideChevronRight className="h-4 w-4" />
                          Details
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="md:col-span-1">
            {selectedFlagDetails ? (
              <div className="rounded-md border">
                <div className="border-b p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="font-medium">{selectedFlagDetails.title}</h3>
                    <div className="flex items-center gap-2">{getSeverityBadge(selectedFlagDetails.severity)}</div>
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedFlagDetails.description}</p>
                </div>

                <div className="p-4">
                  <div className="mb-4 grid grid-cols-2 gap-4">
                    <div className="rounded-md bg-muted/30 p-3 text-center">
                      <div className="text-xs text-muted-foreground">Confidence</div>
                      <div className={`text-lg font-bold ${getConfidenceColor(selectedFlagDetails.confidence)}`}>
                        {selectedFlagDetails.confidence}%
                      </div>
                    </div>
                    <div className="rounded-md bg-muted/30 p-3 text-center">
                      <div className="text-xs text-muted-foreground">Status</div>
                      <div className="text-sm font-medium">{getStatusBadge(selectedFlagDetails.status)}</div>
                    </div>
                    {selectedFlagDetails.aiConfidence && (
                      <div className="rounded-md bg-muted/30 p-3 text-center">
                        <div className="text-xs text-muted-foreground">AI Confidence</div>
                        <div className={`text-lg font-bold ${getConfidenceColor(selectedFlagDetails.aiConfidence)}`}>
                          {selectedFlagDetails.aiConfidence}%
                        </div>
                      </div>
                    )}
                    {selectedFlagDetails.evidenceStrength && (
                      <div className="rounded-md bg-muted/30 p-3 text-center">
                        <div className="text-xs text-muted-foreground">Evidence Strength</div>
                        <div
                          className={`text-lg font-bold ${getConfidenceColor(selectedFlagDetails.evidenceStrength)}`}
                        >
                          {selectedFlagDetails.evidenceStrength}%
                        </div>
                      </div>
                    )}
                  </div>

                  {renderFlagTypeSpecificDetails(selectedFlagDetails)}

                  {selectedFlagDetails.actionRecommendation && (
                    <div className="mb-4 rounded-md border-l-4 border-l-primary bg-primary/5 p-3">
                      <h4 className="text-sm font-medium mb-1">Recommended Action</h4>
                      <p className="text-sm">{selectedFlagDetails.actionRecommendation}</p>
                    </div>
                  )}

                  {selectedFlagDetails.relatedItems && selectedFlagDetails.relatedItems.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Related Items</h4>
                      <div className="space-y-2">
                        {selectedFlagDetails.relatedItems.map((item, index) => (
                          <div key={index} className="flex items-center justify-between rounded-md border p-2 text-sm">
                            <span>{item}</span>
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                              View
                              <LucideChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedFlagDetails.notes && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2">Notes</h4>
                      <div className="rounded-md border p-3">
                        <p className="text-sm">{selectedFlagDetails.notes}</p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Update Status</span>
                      <Select
                        value={selectedFlagDetails.status}
                        onValueChange={(value) => handleStatusChange(selectedFlagDetails.id, value)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="new">New</SelectItem>
                          <SelectItem value="in_review">In Review</SelectItem>
                          <SelectItem value="verified">Verified</SelectItem>
                          <SelectItem value="dismissed">Dismissed</SelectItem>
                          <SelectItem value="resolved">Resolved</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Assign To</span>
                      <Select
                        value={selectedFlagDetails.assignedTo || "Unassigned"}
                        onValueChange={(value) => handleAssign(selectedFlagDetails.id, value)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Assign To" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Unassigned">Unassigned</SelectItem>
                          <SelectItem value="Det. Martinez">Det. Martinez</SelectItem>
                          <SelectItem value="Det. Rodriguez">Det. Rodriguez</SelectItem>
                          <SelectItem value="Det. Williams">Det. Williams</SelectItem>
                          <SelectItem value="Tech Johnson">Tech Johnson</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="outline" size="sm" className="gap-1">
                      <LucideFileText className="h-4 w-4" />
                      Add to Report
                    </Button>
                    <Button size="sm" className="gap-1">
                      <LucideEye className="h-4 w-4" />
                      Review Details
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-md border p-8 text-center">
                <div>
                  <LucideAlertCircle className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                  <h3 className="text-sm font-medium">Select a Flag to View Details</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click on any flag from the list to view detailed information and take action.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
