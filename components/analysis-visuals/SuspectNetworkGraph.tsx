"use client"

import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LucideNetwork,
  LucideZoomIn,
  LucideZoomOut,
  LucideMaximize,
  LucideMinimize,
  LucideRefreshCw,
  LucideFilter,
  LucideUser,
  LucideMapPin,
  LucideAlertCircle,
  LucideCheckCircle,
  LucideDna,
  LucideFileText,
  LucideSearch,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Suspect {
  id: string
  name: string
  role?: string
  confidence?: number
  connections?: string[]
  location?: string
  evidence?: string[]
  notes?: string
  status?: "active" | "cleared" | "arrested"
  priority?: "high" | "medium" | "low"
}

interface SuspectNetworkGraphProps {
  suspects: Suspect[]
  caseId?: string
  className?: string
}

export default function SuspectNetworkGraph({ suspects, caseId, className = '' }: SuspectNetworkGraphProps) {
  const [view, setView] = useState<"network" | "list">("network")
  const [selectedSuspect, setSelectedSuspect] = useState<Suspect | null>(null)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPriority, setFilterPriority] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)

  // Memoize the filtered suspects to prevent unnecessary recalculations
  const filteredSuspects = useMemo(() => {
    return suspects.filter(suspect => {
      const matchesStatus = filterStatus === "all" || suspect.status === filterStatus;
      const matchesPriority = filterPriority === "all" || suspect.priority === filterPriority;
      const matchesSearch = searchQuery === "" || 
        suspect.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        suspect.notes?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesStatus && matchesPriority && matchesSearch;
    });
  }, [suspects, filterStatus, filterPriority, searchQuery]);

  // Memoize the handlers to prevent unnecessary re-renders
  const handleStatusChange = useCallback((value: string) => {
    setFilterStatus(value);
  }, []);

  const handlePriorityChange = useCallback((value: string) => {
    setFilterPriority(value);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 10, 200));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 10, 50));
  }, []);

  const handleResetZoom = useCallback(() => {
    setZoomLevel(100);
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Get suspect status badge
  const getSuspectStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-red-500">Active</Badge>
      case "cleared":
        return <Badge className="bg-green-500">Cleared</Badge>
      case "arrested":
        return <Badge className="bg-amber-500">Arrested</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  // Get suspect priority badge
  const getSuspectPriorityBadge = (priority: string) => {
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

  return (
    <div className={cn('w-full h-full flex flex-col', className)}>
      {/* Filters and search */}
      <div className="flex flex-wrap gap-2 items-center mb-2">
        <Select value={filterStatus} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
            <SelectItem value="arrested">Arrested</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={handlePriorityChange}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="All Priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px]">
          <LucideSearch className="absolute left-2 top-2.5 w-4 h-4 text-gray-400" />
          <Input
            className="pl-8 pr-2 py-1 text-sm"
            placeholder="Search suspects..."
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>
      {/* Legend */}
      <div className="flex gap-3 mb-2">
        <span className="flex items-center gap-1 text-xs"><span className="inline-block w-3 h-3 rounded-full bg-red-500"></span>Active</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block w-3 h-3 rounded-full bg-green-500"></span>Cleared</span>
        <span className="flex items-center gap-1 text-xs"><span className="inline-block w-3 h-3 rounded-full bg-amber-500"></span>Arrested</span>
      </div>
      {/* Main content area (scrollable) */}
      <div className="flex-1 overflow-y-auto space-y-4">
        {view === 'network' ? (
          <div className="flex items-center justify-center w-full h-full bg-muted rounded-md border overflow-y-auto">
            <div className="flex flex-col items-center justify-center w-full h-full">
              <LucideNetwork className="w-10 h-10 text-gray-400 mb-2" />
              <span className="font-semibold text-gray-700">Network Visualization Coming Soon</span>
              <span className="text-xs text-gray-400 mt-1">Network visualization will be available in the next update.</span>
            </div>
          </div>
        ) : (
          filteredSuspects.length === 0 ? (
            <div className="text-center text-gray-400">No suspects found.</div>
          ) : (
            filteredSuspects.map((suspect) => (
              <div key={`suspect-${suspect.id}`} className="bg-white rounded-lg shadow-sm p-4 flex flex-col gap-2 border">
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${suspect.status === 'active' ? 'bg-red-500' : suspect.status === 'cleared' ? 'bg-green-500' : 'bg-amber-500'}`}></span>
                  <span className="font-semibold text-base">{suspect.name}</span>
                  {suspect.role && <span className="ml-2 text-xs text-gray-500">({suspect.role})</span>}
                  {suspect.priority && (
                    <Badge variant={suspect.priority === 'high' ? 'destructive' : suspect.priority === 'medium' ? 'default' : 'secondary'} className="ml-2 text-xs">
                      {suspect.priority.charAt(0).toUpperCase() + suspect.priority.slice(1)}
                    </Badge>
                  )}
                  {suspect.confidence !== undefined && (
                    <span className="ml-2 text-xs text-gray-400">Confidence: {suspect.confidence}%</span>
                  )}
                </div>
                {suspect.notes && <div className="text-sm text-gray-700 mt-1">{suspect.notes}</div>}
                {suspect.connections && suspect.connections.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs font-medium text-gray-500">Connections:</span>
                    {suspect.connections.map((conn: string) => (
                      <Badge key={conn} variant="outline" className="text-xs">{conn}</Badge>
                    ))}
                  </div>
                )}
                {suspect.evidence && suspect.evidence.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1">
                    <span className="text-xs font-medium text-gray-500">Evidence:</span>
                    {suspect.evidence.map((ev: string) => (
                      <Badge key={ev} variant="secondary" className="text-xs">{ev}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
} 