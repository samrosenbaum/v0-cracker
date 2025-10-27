"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LucideNetwork,
  LucideZoomIn,
  LucideZoomOut,
  LucideMaximize,
  LucideMinimize,
  LucideRefreshCw,
  LucideFilter,
} from "lucide-react"

interface Node {
  id: string
  type: "evidence" | "suspect" | "victim" | "reference" | "codis" | "case"
  label: string
  caseId?: string
  confidence?: number
  x?: number
  y?: number
}

interface Link {
  source: string
  target: string
  type: "exact" | "partial" | "familial" | "case"
  strength: number
}

interface GeneticNetworkGraphProps {
  nodes?: Node[]
  links?: Link[]
  centerNode?: string
  width?: number
  height?: number
}

export function GeneticNetworkGraph({
  centerNode = "DNA-2023-0127",
  width = 800,
  height = 500,
}: GeneticNetworkGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [filterConfidence, setFilterConfidence] = useState(50)
  const [view, setView] = useState<"network" | "timeline" | "geographic">("network")

  // Sample data for demonstration
  const nodes: Node[] = [
    { id: "DNA-2023-0127", type: "evidence", label: "Crime Scene DNA", x: 400, y: 250 },
    { id: "DNA-2023-0128", type: "victim", label: "Victim DNA", x: 300, y: 200 },
    { id: "DNA-2023-0129", type: "suspect", label: "Suspect DNA", x: 500, y: 200 },
    { id: "OFF-2018-45721", type: "codis", label: "CODIS Match 1", x: 600, y: 300 },
    { id: "OFF-2020-12876", type: "codis", label: "CODIS Match 2", x: 200, y: 300 },
    { id: "CS-2023-089", type: "case", label: "Riverside Homicide", x: 400, y: 100 },
  ]

  const links: Link[] = [
    { source: "DNA-2023-0127", target: "OFF-2018-45721", type: "exact", strength: 0.98 },
    { source: "DNA-2023-0127", target: "OFF-2020-12876", type: "familial", strength: 0.82 },
    { source: "DNA-2023-0127", target: "CS-2023-089", type: "case", strength: 1 },
    { source: "DNA-2023-0128", target: "CS-2023-089", type: "case", strength: 1 },
    { source: "DNA-2023-0129", target: "CS-2023-089", type: "case", strength: 1 },
  ]

  // Filter links based on confidence threshold
  const filteredLinks = links.filter((link) => link.strength * 100 >= filterConfidence)

  // Get nodes that are connected by the filtered links
  const connectedNodeIds = new Set<string>()
  filteredLinks.forEach((link) => {
    connectedNodeIds.add(link.source.toString())
    connectedNodeIds.add(link.target.toString())
  })

  const filteredNodes = nodes.filter((node) => connectedNodeIds.has(node.id))

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const resetZoom = () => {
    setZoomLevel(100)
  }

  const getNodeTypeColor = (type: string) => {
    switch (type) {
      case "evidence":
        return "#ef4444" // red
      case "suspect":
        return "#f59e0b" // amber
      case "victim":
        return "#3b82f6" // blue
      case "reference":
        return "#8b5cf6" // purple
      case "codis":
        return "#10b981" // green
      case "case":
        return "#6b7280" // gray
      default:
        return "#6b7280"
    }
  }

  const getNodeTypeLabel = (type: string) => {
    switch (type) {
      case "evidence":
        return "Evidence Sample"
      case "suspect":
        return "Suspect Sample"
      case "victim":
        return "Victim Sample"
      case "reference":
        return "Reference Sample"
      case "codis":
        return "CODIS Match"
      case "case":
        return "Case"
      default:
        return type
    }
  }

  return (
    <Card className={isFullscreen ? "fixed inset-0 z-50 rounded-none" : "w-full"}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LucideNetwork className="h-5 w-5 text-primary" />
            <CardTitle>Genetic Network Analysis</CardTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            {isFullscreen ? <LucideMinimize className="h-4 w-4" /> : <LucideMaximize className="h-4 w-4" />}
          </Button>
        </div>
        <CardDescription>Interactive visualization of DNA evidence connections and relationships</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <Tabs value={view} onValueChange={setView as any} className="w-[400px]">
            <TabsList>
              <TabsTrigger value="network">Network View</TabsTrigger>
              <TabsTrigger value="timeline">Timeline View</TabsTrigger>
              <TabsTrigger value="geographic">Geographic View</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Min Confidence:</span>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={filterConfidence}
                onChange={(e) => setFilterConfidence(Number(e.target.value))}
                className="w-[100px]"
              />
              <span className="w-8 text-xs">{filterConfidence}%</span>
            </div>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <LucideFilter className="h-4 w-4" />
              Filters
            </Button>
          </div>
        </div>

        <div className="relative rounded-md border bg-muted/30">
          <div className="absolute right-2 top-2 flex flex-col gap-1 rounded-md border bg-background p-1 shadow-sm">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoomLevel(Math.min(400, zoomLevel + 25))}
            >
              <LucideZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setZoomLevel(Math.max(25, zoomLevel - 25))}
            >
              <LucideZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetZoom}>
              <LucideRefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <div className="absolute left-2 top-2 flex flex-wrap gap-2 rounded-md border bg-background p-2 shadow-sm">
            <div className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-red-500"></span>
              <span className="text-xs">Evidence</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-amber-500"></span>
              <span className="text-xs">Suspect</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-blue-500"></span>
              <span className="text-xs">Victim</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500"></span>
              <span className="text-xs">CODIS</span>
            </div>
          </div>

          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="cursor-move"
            style={{ minHeight: isFullscreen ? "calc(100vh - 200px)" : "500px", transform: `scale(${zoomLevel / 100})` }}
          >
            {/* Render links */}
            {filteredLinks.map((link, index) => {
              const sourceNode = filteredNodes.find(n => n.id === link.source)
              const targetNode = filteredNodes.find(n => n.id === link.target)
              if (!sourceNode || !targetNode) return null
              
              return (
                <line
                  key={index}
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={link.type === "exact" ? "#10b981" : link.type === "partial" ? "#f59e0b" : "#3b82f6"}
                  strokeWidth={link.strength * 3}
                />
              )
            })}
            
            {/* Render nodes */}
            {filteredNodes.map((node) => (
              <g key={node.id} transform={`translate(${node.x},${node.y})`}>
                <circle
                  r="15"
                  fill={getNodeTypeColor(node.type)}
                  stroke={node.id === centerNode ? "#000" : "#fff"}
                  strokeWidth={node.id === centerNode ? 3 : 1.5}
                  className="cursor-pointer"
                  onClick={() => setSelectedNode(node)}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="#fff"
                  fontSize="10px"
                  className="pointer-events-none"
                >
                  {node.type === "evidence" ? "E" : 
                   node.type === "suspect" ? "S" : 
                   node.type === "victim" ? "V" : 
                   node.type === "codis" ? "C" : "CS"}
                </text>
                <text
                  textAnchor="middle"
                  y="25"
                  fontSize="10px"
                  className="pointer-events-none"
                >
                  {node.label}
                </text>
              </g>
            ))}
          </svg>

          {selectedNode && (
            <div className="absolute bottom-2 right-2 w-64 rounded-md border bg-background p-3 shadow-md">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">{selectedNode.label}</h3>
                <Badge variant="outline">{getNodeTypeLabel(selectedNode.type)}</Badge>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ID:</span>
                  <span className="font-medium">{selectedNode.id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Type:</span>
                  <span className="font-medium">{selectedNode.type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connections:</span>
                  <span className="font-medium">
                    {filteredLinks.filter(link => 
                      link.source === selectedNode.id || link.target === selectedNode.id
                    ).length}
                  </span>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="outline">
                  View Details
                </Button>
              </div>
            </div>
          )}
        </div>

        {view === "network" && (
          <div className="mt-4 grid grid-cols-3 gap-4 text-center text-xs">
            <div className="rounded-md border p-2">
              <div className="font-medium">Total Nodes</div>
              <div className="mt-1 text-2xl">{filteredNodes.length}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="font-medium">Total Connections</div>
              <div className="mt-1 text-2xl">{filteredLinks.length}</div>
            </div>
            <div className="rounded-md border p-2">
              <div className="font-medium">Avg. Match Confidence</div>
              <div className="mt-1 text-2xl">
                {filteredLinks.length > 0 ? 
                  Math.round(filteredLinks.reduce((acc, link) => acc + link.strength * 100, 0) / filteredLinks.length) : 0}%
              </div>
            </div>
          </div>
        )}

        {view !== "network" && (
          <div className="mt-4 flex items-center justify-center rounded-md border p-8">
            <div className="text-center">
              <LucideNetwork className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
              <h3 className="text-sm font-medium">
                {view === "timeline" ? "Timeline View" : "Geographic View"} Coming Soon
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                This visualization is under development and will be available in a future update.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}