"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { LucideBarChart2, LucideDownload, LucideRefreshCw } from "lucide-react"
import { useEffect, useRef } from "react"
import Chart from "chart.js/auto"

export function DNAStatisticsDashboard() {
  const matchConfidenceChartRef = useRef<HTMLCanvasElement>(null)
  const matchTypeChartRef = useRef<HTMLCanvasElement>(null)
  const matchTrendChartRef = useRef<HTMLCanvasElement>(null)
  const populationDistChartRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let matchConfidenceChart: Chart | null = null
    let matchTypeChart: Chart | null = null
    let matchTrendChart: Chart | null = null
    let populationDistChart: Chart | null = null

    if (matchConfidenceChartRef.current) {
      matchConfidenceChart = new Chart(matchConfidenceChartRef.current, {
        type: "bar",
        data: {
          labels: ["95-100%", "90-95%", "80-90%", "70-80%", "60-70%", "<60%"],
          datasets: [
            {
              label: "Number of Matches",
              data: [14, 6, 9, 5, 3, 2],
              backgroundColor: [
                "rgba(16, 185, 129, 0.7)", // green
                "rgba(16, 185, 129, 0.5)", // lighter green
                "rgba(245, 158, 11, 0.7)", // amber
                "rgba(245, 158, 11, 0.5)", // lighter amber
                "rgba(239, 68, 68, 0.7)", // red
                "rgba(239, 68, 68, 0.5)", // lighter red
              ],
              borderColor: [
                "rgba(16, 185, 129, 1)",
                "rgba(16, 185, 129, 1)",
                "rgba(245, 158, 11, 1)",
                "rgba(245, 158, 11, 1)",
                "rgba(239, 68, 68, 1)",
                "rgba(239, 68, 68, 1)",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              display: false,
            },
            title: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Number of Matches",
              },
            },
            x: {
              title: {
                display: true,
                text: "Confidence Range",
              },
            },
          },
        },
      })
    }

    if (matchTypeChartRef.current) {
      matchTypeChart = new Chart(matchTypeChartRef.current, {
        type: "doughnut",
        data: {
          labels: ["Exact Match", "Partial Match", "Familial Match", "Mitochondrial", "Y-STR"],
          datasets: [
            {
              label: "Match Types",
              data: [18, 12, 8, 3, 2],
              backgroundColor: [
                "rgba(16, 185, 129, 0.7)", // green
                "rgba(245, 158, 11, 0.7)", // amber
                "rgba(59, 130, 246, 0.7)", // blue
                "rgba(139, 92, 246, 0.7)", // purple
                "rgba(107, 114, 128, 0.7)", // gray
              ],
              borderColor: [
                "rgba(16, 185, 129, 1)",
                "rgba(245, 158, 11, 1)",
                "rgba(59, 130, 246, 1)",
                "rgba(139, 92, 246, 1)",
                "rgba(107, 114, 128, 1)",
              ],
              borderWidth: 1,
              hoverOffset: 4,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "right",
            },
          },
        },
      })
    }

    if (matchTrendChartRef.current) {
      matchTrendChart = new Chart(matchTrendChartRef.current, {
        type: "line",
        data: {
          labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
          datasets: [
            {
              label: "CODIS Matches",
              data: [2, 3, 1, 4, 2, 5, 3, 6, 4, 7, 5, 8],
              borderColor: "rgba(16, 185, 129, 1)",
              backgroundColor: "rgba(16, 185, 129, 0.1)",
              tension: 0.3,
              fill: true,
            },
            {
              label: "Internal Matches",
              data: [1, 2, 3, 2, 4, 3, 5, 4, 6, 5, 7, 6],
              borderColor: "rgba(59, 130, 246, 1)",
              backgroundColor: "rgba(59, 130, 246, 0.1)",
              tension: 0.3,
              fill: true,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "top",
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Number of Matches",
              },
            },
            x: {
              title: {
                display: true,
                text: "Month",
              },
            },
          },
        },
      })
    }

    if (populationDistChartRef.current) {
      populationDistChart = new Chart(populationDistChartRef.current, {
        type: "bar",
        data: {
          labels: ["D3S1358", "vWA", "FGA", "D8S1179", "D21S11", "D18S51", "D5S818"],
          datasets: [
            {
              label: "Caucasian",
              data: [0.15, 0.22, 0.18, 0.12, 0.25, 0.19, 0.14],
              backgroundColor: "rgba(59, 130, 246, 0.7)",
              borderColor: "rgba(59, 130, 246, 1)",
              borderWidth: 1,
            },
            {
              label: "African American",
              data: [0.18, 0.19, 0.22, 0.15, 0.21, 0.23, 0.17],
              backgroundColor: "rgba(245, 158, 11, 0.7)",
              borderColor: "rgba(245, 158, 11, 1)",
              borderWidth: 1,
            },
            {
              label: "Hispanic",
              data: [0.16, 0.21, 0.19, 0.14, 0.23, 0.18, 0.15],
              backgroundColor: "rgba(16, 185, 129, 0.7)",
              borderColor: "rgba(16, 185, 129, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: "top",
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Allele Frequency",
              },
            },
            x: {
              title: {
                display: true,
                text: "STR Locus",
              },
            },
          },
        },
      })
    }

    return () => {
      if (matchConfidenceChart) matchConfidenceChart.destroy()
      if (matchTypeChart) matchTypeChart.destroy()
      if (matchTrendChart) matchTrendChart.destroy()
      if (populationDistChart) populationDistChart.destroy()
    }
  }, [])

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LucideBarChart2 className="h-5 w-5 text-primary" />
            <CardTitle>DNA Statistics Dashboard</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <LucideRefreshCw className="h-4 w-4" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <LucideDownload className="h-4 w-4" />
              Export
            </Button>
          </div>
        </div>
        <CardDescription>Statistical analysis of DNA evidence and genetic matches</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs defaultValue="matches" className="w-[400px]">
            <TabsList>
              <TabsTrigger value="matches">Match Statistics</TabsTrigger>
              <TabsTrigger value="population">Population Data</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <Select defaultValue="all">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Case Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cases</SelectItem>
                <SelectItem value="CS-2023-089">CS-2023-089</SelectItem>
                <SelectItem value="CS-2023-076">CS-2023-076</SelectItem>
                <SelectItem value="CS-2023-064">CS-2023-064</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="2023">
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2023">2023</SelectItem>
                <SelectItem value="2022">2022</SelectItem>
                <SelectItem value="2021">2021</SelectItem>
                <SelectItem value="all">All Years</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="matches" className="mt-0">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Match Confidence Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <canvas ref={matchConfidenceChartRef}></canvas>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Match Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <canvas ref={matchTypeChartRef}></canvas>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Match Trends (2023)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <canvas ref={matchTrendChartRef}></canvas>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Match Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                  <div className="rounded-md border p-4 text-center">
                    <div className="text-sm text-muted-foreground">Total Matches</div>
                    <div className="mt-1 text-3xl font-bold">43</div>
                    <div className="mt-1 text-xs text-green-600">+12% from last month</div>
                  </div>
                  <div className="rounded-md border p-4 text-center">
                    <div className="text-sm text-muted-foreground">CODIS Matches</div>
                    <div className="mt-1 text-3xl font-bold">27</div>
                    <div className="mt-1 text-xs text-green-600">+8% from last month</div>
                  </div>
                  <div className="rounded-md border p-4 text-center">
                    <div className="text-sm text-muted-foreground">Avg. Confidence</div>
                    <div className="mt-1 text-3xl font-bold">87.3%</div>
                    <div className="mt-1 text-xs text-green-600">+2.1% from last month</div>
                  </div>
                  <div className="rounded-md border p-4 text-center">
                    <div className="text-sm text-muted-foreground">High Confidence</div>
                    <div className="mt-1 text-3xl font-bold">20</div>
                    <div className="mt-1 text-xs text-muted-foreground">46.5% of total</div>
                  </div>
                </div>

                <div className="mt-4 rounded-md border">
                  <div className="grid grid-cols-5 p-3 text-sm font-medium text-muted-foreground bg-muted/50">
                    <div>Case</div>
                    <div>Sample ID</div>
                    <div>Match Type</div>
                    <div>Confidence</div>
                    <div className="text-right">Date</div>
                  </div>
                  <div className="divide-y">
                    <div className="grid grid-cols-5 p-3 text-sm">
                      <div>CS-2023-089</div>
                      <div>DNA-2023-0127</div>
                      <div>
                        <Badge className="bg-green-500">Exact</Badge>
                      </div>
                      <div>98.7%</div>
                      <div className="text-right">2023-12-10</div>
                    </div>
                    <div className="grid grid-cols-5 p-3 text-sm">
                      <div>CS-2023-089</div>
                      <div>DNA-2023-0127</div>
                      <div>
                        <Badge className="bg-blue-500">Familial</Badge>
                      </div>
                      <div>82.5%</div>
                      <div className="text-right">2023-12-07</div>
                    </div>
                    <div className="grid grid-cols-5 p-3 text-sm">
                      <div>CS-2023-076</div>
                      <div>DNA-2023-0130</div>
                      <div>
                        <Badge className="bg-amber-500">Partial</Badge>
                      </div>
                      <div>76.2%</div>
                      <div className="text-right">2023-12-08</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="population" className="mt-0">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="md:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">STR Allele Frequency by Population</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <canvas ref={populationDistChartRef}></canvas>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Population Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-sm font-medium">Random Match Probability</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">Caucasian</div>
                        <div className="text-sm font-medium">1 in 1.7 trillion</div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">African American</div>
                        <div className="text-sm font-medium">1 in 2.1 trillion</div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">Hispanic</div>
                        <div className="text-sm font-medium">1 in 1.9 trillion</div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">Asian</div>
                        <div className="text-sm font-medium">1 in 1.8 trillion</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-sm font-medium">Likelihood Ratio Statistics</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Likelihood Ratio:</span>
                        <span className="text-sm font-medium">1.7 × 10¹²</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Combined Paternity Index:</span>
                        <span className="text-sm font-medium">99.9999%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Sibling Index:</span>
                        <span className="text-sm font-medium">1.2 × 10⁴</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Database Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-sm font-medium">CODIS Database Size</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">Offender</div>
                        <div className="text-sm font-medium">14.3 million</div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">Forensic</div>
                        <div className="text-sm font-medium">4.1 million</div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">Missing Persons</div>
                        <div className="text-sm font-medium">58,000</div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2 text-center">
                        <div className="text-xs text-muted-foreground">Total</div>
                        <div className="text-sm font-medium">18.5 million</div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-md border p-3">
                    <div className="mb-2 text-sm font-medium">CODIS Success Metrics</div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Investigations Aided:</span>
                        <span className="text-sm font-medium">615,400+</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Hit Rate (Offender):</span>
                        <span className="text-sm font-medium">42.3%</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Hit Rate (Forensic):</span>
                        <span className="text-sm font-medium">27.8%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </CardContent>
    </Card>
  )
}
