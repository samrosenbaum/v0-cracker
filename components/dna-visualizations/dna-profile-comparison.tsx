"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { LucideDna, LucideZoomIn, LucideDownload } from "lucide-react"

interface DNAMarker {
  locus: string
  sample1Value: string
  sample2Value: string
  match: boolean
}

interface DNAProfileComparisonProps {
  sample1Id?: string
  sample2Id?: string
  comparisonData?: {
    markers: DNAMarker[]
    matchPercentage: number
    totalLoci: number
    matchedLoci: number
  }
}

export function DNAProfileComparison({
  sample1Id = "DNA-2023-0127",
  sample2Id = "OFF-2018-45721",
  comparisonData,
}: DNAProfileComparisonProps) {
  const [selectedView, setSelectedView] = useState("visual")
  const [zoomedLocus, setZoomedLocus] = useState<string | null>(null)

  // Sample data for demonstration
  const demoData = {
    markers: [
      { locus: "D3S1358", sample1Value: "15,18", sample2Value: "15,18", match: true },
      { locus: "vWA", sample1Value: "17,19", sample2Value: "17,19", match: true },
      { locus: "FGA", sample1Value: "20,23", sample2Value: "20,23", match: true },
      { locus: "D8S1179", sample1Value: "12,13", sample2Value: "12,13", match: true },
      { locus: "D21S11", sample1Value: "29,31", sample2Value: "29,31", match: true },
      { locus: "D18S51", sample1Value: "12,15", sample2Value: "12,15", match: true },
      { locus: "D5S818", sample1Value: "11,12", sample2Value: "11,12", match: true },
      { locus: "D13S317", sample1Value: "11,12", sample2Value: "11,12", match: true },
      { locus: "D7S820", sample1Value: "10,11", sample2Value: "10,11", match: true },
      { locus: "D16S539", sample1Value: "9,10", sample2Value: "9,10", match: true },
      { locus: "TH01", sample1Value: "7,9.3", sample2Value: "7,9.3", match: true },
      { locus: "TPOX", sample1Value: "8,11", sample2Value: "8,11", match: true },
      { locus: "CSF1PO", sample1Value: "10,12", sample2Value: "10,12", match: true },
      { locus: "D2S1338", sample1Value: "19,23", sample2Value: "19,23", match: true },
      { locus: "D19S433", sample1Value: "13,14", sample2Value: "13,14", match: true },
      { locus: "D1S1656", sample1Value: "15,17.3", sample2Value: "15,17.3", match: true },
      { locus: "D12S391", sample1Value: "18,19", sample2Value: "18,19", match: true },
      { locus: "D2S441", sample1Value: "10,14", sample2Value: "10,14", match: true },
      { locus: "D10S1248", sample1Value: "13,15", sample2Value: "13,15", match: true },
      { locus: "D22S1045", sample1Value: "15,16", sample2Value: "15,16", match: true },
    ],
    matchPercentage: 100,
    totalLoci: 20,
    matchedLoci: 20,
  }

  const data = comparisonData || demoData

  const handleZoomLocus = (locus: string) => {
    setZoomedLocus(locus === zoomedLocus ? null : locus)
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LucideDna className="h-5 w-5 text-primary" />
            <CardTitle>DNA Profile Comparison</CardTitle>
          </div>
          <Badge className={data.matchPercentage === 100 ? "bg-green-500" : "bg-amber-500"}>
            {data.matchPercentage}% Match
          </Badge>
        </div>
        <CardDescription>
          Comparing {sample1Id} (Evidence) with {sample2Id} (CODIS)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center justify-between">
          <Tabs value={selectedView} onValueChange={setSelectedView} className="w-[400px]">
            <TabsList>
              <TabsTrigger value="visual">Visual Comparison</TabsTrigger>
              <TabsTrigger value="table">Tabular Data</TabsTrigger>
              <TabsTrigger value="stats">Statistics</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-1">
              <LucideDownload className="h-4 w-4" />
              Export
            </Button>
            <Select defaultValue="str">
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Profile Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="str">STR Profile</SelectItem>
                <SelectItem value="snp">SNP Profile</SelectItem>
                <SelectItem value="y-str">Y-STR Profile</SelectItem>
                <SelectItem value="mito">Mitochondrial</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="visual" className="mt-0">
          <div className="rounded-md border p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium">STR Loci Comparison</h3>
                <p className="text-xs text-muted-foreground">
                  {data.matchedLoci} of {data.totalLoci} loci matched
                </p>
              </div>
              <div className="text-sm text-muted-foreground">
                <span className="inline-block h-3 w-3 rounded-full bg-green-500 mr-1"></span> Match
                <span className="inline-block h-3 w-3 rounded-full bg-red-500 mx-1 ml-3"></span> Mismatch
              </div>
            </div>

            <div className="grid grid-cols-5 gap-2">
              {data.markers.map((marker) => (
                <div
                  key={marker.locus}
                  className={`relative cursor-pointer rounded-md border p-2 transition-all ${
                    marker.match ? "bg-green-50" : "bg-red-50"
                  } ${zoomedLocus === marker.locus ? "col-span-5 row-span-2" : ""}`}
                  onClick={() => handleZoomLocus(marker.locus)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{marker.locus}</span>
                    {zoomedLocus !== marker.locus && (
                      <span className={`h-2 w-2 rounded-full ${marker.match ? "bg-green-500" : "bg-red-500"}`}></span>
                    )}
                    {zoomedLocus !== marker.locus && (
                      <LucideZoomIn className="absolute right-1 top-1 h-3 w-3 text-gray-400" />
                    )}
                  </div>

                  {zoomedLocus === marker.locus ? (
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-medium mb-2">Evidence Sample ({sample1Id})</h4>
                        <div className="flex flex-col gap-2">
                          <div className="rounded-md bg-background p-2">
                            <div className="text-sm font-mono">{marker.sample1Value}</div>
                            <div className="mt-2 flex gap-1">
                              {marker.sample1Value.split(",").map((allele, i) => (
                                <div
                                  key={i}
                                  className="flex h-8 w-12 items-center justify-center rounded bg-primary/10 text-xs font-medium"
                                >
                                  {allele}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="h-40 rounded-md bg-background p-2">
                            {/* DNA Electropherogram visualization would go here */}
                            <div className="h-full w-full flex items-center justify-center">
                              <div className="text-xs text-muted-foreground">Electropherogram Visualization</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-medium mb-2">CODIS Sample ({sample2Id})</h4>
                        <div className="flex flex-col gap-2">
                          <div className="rounded-md bg-background p-2">
                            <div className="text-sm font-mono">{marker.sample2Value}</div>
                            <div className="mt-2 flex gap-1">
                              {marker.sample2Value.split(",").map((allele, i) => (
                                <div
                                  key={i}
                                  className="flex h-8 w-12 items-center justify-center rounded bg-primary/10 text-xs font-medium"
                                >
                                  {allele}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="h-40 rounded-md bg-background p-2">
                            {/* DNA Electropherogram visualization would go here */}
                            <div className="h-full w-full flex items-center justify-center">
                              <div className="text-xs text-muted-foreground">Electropherogram Visualization</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1 text-xs">{marker.sample1Value}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-0">
          <div className="rounded-md border">
            <div className="grid grid-cols-4 p-3 text-sm font-medium text-muted-foreground bg-muted/50">
              <div>Locus</div>
              <div>Evidence Sample</div>
              <div>CODIS Sample</div>
              <div className="text-right">Status</div>
            </div>
            <div className="divide-y">
              {data.markers.map((marker) => (
                <div key={marker.locus} className="grid grid-cols-4 p-3 text-sm">
                  <div className="font-medium">{marker.locus}</div>
                  <div className="font-mono">{marker.sample1Value}</div>
                  <div className="font-mono">{marker.sample2Value}</div>
                  <div className="text-right">
                    <Badge variant={marker.match ? "default" : "destructive"} className="font-mono">
                      {marker.match ? "MATCH" : "MISMATCH"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="stats" className="mt-0">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border p-4">
              <h3 className="text-sm font-medium mb-3">Match Statistics</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Overall Match:</span>
                    <span className="font-medium">{data.matchPercentage}%</span>
                  </div>
                  <div className="mt-2 h-2 w-full rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary" style={{ width: `${data.matchPercentage}%` }}></div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Loci Compared:</span>
                  <span className="font-medium">{data.totalLoci}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Loci Matched:</span>
                  <span className="font-medium">{data.matchedLoci}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Random Match Probability:</span>
                  <span className="font-medium">1 in 1.7 trillion</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Combined Paternity Index:</span>
                  <span className="font-medium">N/A</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span>Likelihood Ratio:</span>
                  <span className="font-medium">1.7 × 10¹²</span>
                </div>
              </div>
            </div>

            <div className="rounded-md border p-4">
              <h3 className="text-sm font-medium mb-3">Population Statistics</h3>
              <div className="h-[220px] flex items-center justify-center">
                <div className="text-center text-sm text-muted-foreground">
                  <LucideZoomIn className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                  <p>Select a specific locus to view population statistics</p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </CardContent>
    </Card>
  )
}
