"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
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
import * as d3 from "d3"

interface Node {
  id: string
  type: "evidence" | "suspect" | "victim" | "reference" | "codis" | "case"
  label: string
  caseId?: string
  confidence?: number
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
  nodes: propNodes,
  links: propLinks,
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
  let simulation: any // Declare the simulation variable

  // Sample data for demonstration
  const demoNodes: Node[] = [
    { id: "DNA-2023-0127", type: "evidence", label: "Crime Scene DNA" },
    { id: "DNA-2023-0128", type: "victim", label: "Victim DNA" },
    { id: "DNA-2023-0129", type: "suspect", label: "Suspect DNA" },
    { id: "OFF-2018-45721", type: "codis", label: "CODIS Match 1" },
    { id: "OFF-2020-12876", type: "codis", label: "CODIS Match 2" },
    { id: "CS-2023-089", type: "case", label: "Riverside Homicide" },
    { id: "CS-2022-045", type: "case", label: "Downtown Assault" },
    { id: "DNA-2022-0587", type: "evidence", label: "Related Evidence" },
    { id: "DNA-2022-0588", type: "suspect", label: "Related Suspect" },
    { id: "DNA-2022-0589", type: "victim", label: "Related Victim" },
    { id: "OFF-2019-34521", type: "codis", label: "CODIS Match 3" },
    { id: "DNA-2021-0432", type: "reference", label: "Reference Sample" },
  ]

  const demoLinks: Link[] = [
    { source: "DNA-2023-0127", target: "OFF-2018-45721", type: "exact", strength: 0.98 },
    { source: "DNA-2023-0127", target: "OFF-2020-12876", type: "familial", strength: 0.82 },
    { source: "DNA-2023-0127", target: "CS-2023-089", type: "case", strength: 1 },
    { source: "DNA-2023-0128", target: "CS-2023-089", type: "case", strength: 1 },
    { source: "DNA-2023-0129", target: "CS-2023-089", type: "case", strength: 1 },
    { source: "DNA-2022-0587", target: "CS-2022-045", type: "case", strength: 1 },
    { source: "DNA-2022-0588", target: "CS-2022-045", type: "case", strength: 1 },
    { source: "DNA-2022-0589", target: "CS-2022-045", type: "case", strength: 1 },
    { source: "DNA-2023-0127", target: "DNA-2022-0587", type: "partial", strength: 0.76 },
    { source: "OFF-2018-45721", target: "OFF-2019-34521", type: "familial", strength: 0.65 },
    { source: "DNA-2021-0432", target: "OFF-2018-45721", type: "exact", strength: 0.99 },
    { source: "DNA-2022-0588", target: "OFF-2020-12876", type: "partial", strength: 0.72 },
  ]

  const nodes = propNodes || demoNodes
  const links = propLinks || demoLinks

  // Filter links based on confidence threshold
  const filteredLinks = links.filter((link) => link.strength * 100 >= filterConfidence)

  // Get nodes that are connected by the filtered links
  const connectedNodeIds = new Set<string>()
  filteredLinks.forEach((link) => {
    connectedNodeIds.add(link.source.toString())
    connectedNodeIds.add(link.target.toString())
  })

  const filteredNodes = nodes.filter((node) => connectedNodeIds.has(node.id))

  useEffect(() => {
    if (!svgRef.current) return

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove()

    const svg = d3.select(svgRef.current)
    const g = svg.append("g")

    // Create a simulation with forces
    simulation = d3
      .forceSimulation(filteredNodes as d3.SimulationNodeDatum[])
      .force(
        "link",
        d3
          .forceLink(filteredLinks)
          .id((d: any) => d.id)
          .distance((d: any) => 100 * (1 - d.strength))
          .strength((d: any) => d.strength),
      )
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(30))

    // Define arrow markers for links
    svg
      .append("defs")
      .selectAll("marker")
      .data(["exact", "partial", "familial", "case"])
      .enter()
      .append("marker")
      .attr("id", (d) => `arrow-${d}`)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 20)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("fill", (d) => {
        switch (d) {
          case "exact":
            return "#10b981" // green
          case "partial":
            return "#f59e0b" // amber
          case "familial":
            return "#3b82f6" // blue
          case "case":
            return "#6b7280" // gray
          default:
            return "#6b7280"
        }
      })
      .attr("d", "M0,-5L10,0L0,5")

    // Create links
    const link = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(filteredLinks)
      .enter()
      .append("line")
      .attr("stroke", (d) => {
        switch (d.type) {
          case "exact":
            return "#10b981" // green
          case "partial":
            return "#f59e0b" // amber
          case "familial":
            return "#3b82f6" // blue
          case "case":
            return "#6b7280" // gray
          default:
            return "#6b7280"
        }
      })
      .attr("stroke-width", (d) => Math.max(1, d.strength * 3))
      .attr("marker-end", (d) => `url(#arrow-${d.type})`)

    // Create node groups
    const node = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(filteredNodes)
      .enter()
      .append("g")
      .call(d3.drag<SVGGElement, Node>().on("start", dragstarted).on("drag", dragged).on("end", dragended) as any)
      .on("click", (event, d) => {
        setSelectedNode(d)
        event.stopPropagation()
      })

    // Add circles to nodes
    node
      .append("circle")
      .attr("r", 15)
      .attr("fill", (d) => {
        switch (d.type) {
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
      })
      .attr("stroke", (d) => (d.id === centerNode ? "#000" : "#fff"))
      .attr("stroke-width", (d) => (d.id === centerNode ? 3 : 1.5))

    // Add icons to nodes
    node
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "#fff")
      .attr("font-size", "10px")
      .text((d) => {
        switch (d.type) {
          case "evidence":
            return "E"
          case "suspect":
            return "S"
          case "victim":
            return "V"
          case "reference":
            return "R"
          case "codis":
            return "C"
          case "case":
            return "CS"
          default:
            return ""
        }
      })

    // Add labels to nodes
    node
      .append("text")
      .attr("dy", 25)
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .text((d) => d.label)
      .attr("pointer-events", "none")

    // Update positions on simulation tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`)
    })

    // Zoom functionality
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        g.attr("transform", event.transform)
        setZoomLevel(Math.round(event.transform.k * 100))
      })

    svg.call(zoom)

    // Clear selection when clicking on the background
    svg.on("click", () => setSelectedNode(null))

    return () => {
      simulation.stop()
    }
  }, [filteredNodes, filteredLinks, width, height, centerNode])

  useEffect(() => {
    const scale = zoomLevel / 100
    const transform = d3.zoomIdentity.scale(scale)
    if (svgRef.current) {
      d3.select(svgRef.current).call(d3.zoom().transform, transform)
    }
  }, [zoomLevel])

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen)
  }

  const resetZoom = () => {
    setZoomLevel(100)
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

  function dragstarted(event: any) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    event.subject.fx = event.subject.x
    event.subject.fy = event.subject.y
  }

  function dragged(event: any) {
    event.subject.fx = event.x
    event.subject.fy = event.y
  }

  function dragended(event: any) {
    if (!event.active) simulation.alphaTarget(0)
    event.subject.fx = null
    event.subject.fy = null
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
              <Slider
                className="w-[100px]"
                value={[filterConfidence]}
                min={0}
                max={100}
                step={5}
                onValueChange={(value) => setFilterConfidence(value[0])}
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
              <span className="inline-block h-3 w-3 rounded-full bg-purple-500"></span>
              <span className="text-xs">Reference</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-green-500"></span>
              <span className="text-xs">CODIS</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded-full bg-gray-500"></span>
              <span className="text-xs">Case</span>
            </div>
          </div>

          <svg
            ref={svgRef}
            width={width}
            height={height}
            className="cursor-move"
            style={{ minHeight: isFullscreen ? "calc(100vh - 200px)" : "500px" }}
          ></svg>

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
                {selectedNode.caseId && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Case:</span>
                    <span className="font-medium">{selectedNode.caseId}</span>
                  </div>
                )}
                {selectedNode.confidence && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Match Confidence:</span>
                    <span className="font-medium">{selectedNode.confidence}%</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Connections:</span>
                  <span className="font-medium">
                    {
                      filteredLinks.filter(
                        (link) =>
                          link.source.toString() === selectedNode.id || link.target.toString() === selectedNode.id,
                      ).length
                    }
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
                {Math.round(filteredLinks.reduce((acc, link) => acc + link.strength * 100, 0) / filteredLinks.length)}%
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
