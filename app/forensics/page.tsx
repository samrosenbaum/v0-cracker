import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  LucideArrowLeft,
  LucideDna,
  LucideDatabase,
  LucideFingerprint,
  LucideSearch,
  LucideAlertCircle,
  LucideCheckCircle2,
  LucideBarChart2,
} from "lucide-react"

export default function ForensicsPage() {
  return (
    <div className="container py-8">
      <Link href="/" className="flex items-center text-sm mb-6 hover:underline">
        <LucideArrowLeft className="mr-2 h-4 w-4" />
        Back to Home
      </Link>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Forensic Evidence Management</h1>
          <p className="text-muted-foreground mt-2">
            Manage DNA profiles, forensic evidence, and integrate with external genetic databases.
          </p>
        </div>
        <div>
          <Link href="/forensics/visualizations">
            <Button className="flex items-center gap-2">
              <LucideBarChart2 className="h-4 w-4" />
              DNA Visualizations
            </Button>
          </Link>
        </div>
      </div>

      {/* The rest of the forensics page content remains the same */}
      {/* This is just a stub to link to the visualizations page */}
      <div className="text-center py-12 text-muted-foreground">
        Click the "DNA Visualizations" button to access the interactive DNA evidence visualizations.
      </div>

      <Tabs defaultValue="dna" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dna">DNA Profiles</TabsTrigger>
          <TabsTrigger value="codis">CODIS Integration</TabsTrigger>
          <TabsTrigger value="other">Other Forensics</TabsTrigger>
          <TabsTrigger value="matches">Genetic Matches</TabsTrigger>
        </TabsList>

        <TabsContent value="dna" className="mt-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>DNA Evidence Repository</CardTitle>
              <CardDescription>
                Manage and categorize DNA evidence collected from crime scenes and suspects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <LucideSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search DNA profiles..." className="w-full pl-9" />
                  </div>
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="reference">Reference Samples</SelectItem>
                    <SelectItem value="crime_scene">Crime Scene</SelectItem>
                    <SelectItem value="suspect">Suspect</SelectItem>
                    <SelectItem value="victim">Victim</SelectItem>
                    <SelectItem value="unknown">Unknown</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="all_cases">
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filter by case" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_cases">All Cases</SelectItem>
                    <SelectItem value="CS-2023-089">CS-2023-089</SelectItem>
                    <SelectItem value="CS-2023-076">CS-2023-076</SelectItem>
                    <SelectItem value="CS-2023-064">CS-2023-064</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <div className="grid grid-cols-12 p-4 text-sm font-medium text-muted-foreground bg-muted/50">
                  <div className="col-span-2">Sample ID</div>
                  <div className="col-span-2">Case ID</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Collection Date</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                <Separator />

                {/* Sample 1 */}
                <div className="grid grid-cols-12 p-4 items-center text-sm">
                  <div className="col-span-2 font-medium">DNA-2023-0127</div>
                  <div className="col-span-2">CS-2023-089</div>
                  <div className="col-span-2">
                    <Badge variant="outline">Crime Scene</Badge>
                  </div>
                  <div className="col-span-2">2023-11-16</div>
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <Badge className="bg-green-500">Processed</Badge>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideSearch className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideDatabase className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <Separator />

                {/* Sample 2 */}
                <div className="grid grid-cols-12 p-4 items-center text-sm">
                  <div className="col-span-2 font-medium">DNA-2023-0128</div>
                  <div className="col-span-2">CS-2023-089</div>
                  <div className="col-span-2">
                    <Badge variant="outline">Victim</Badge>
                  </div>
                  <div className="col-span-2">2023-11-16</div>
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <Badge className="bg-green-500">Processed</Badge>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideSearch className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideDatabase className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <Separator />

                {/* Sample 3 */}
                <div className="grid grid-cols-12 p-4 items-center text-sm">
                  <div className="col-span-2 font-medium">DNA-2023-0129</div>
                  <div className="col-span-2">CS-2023-089</div>
                  <div className="col-span-2">
                    <Badge variant="outline">Suspect</Badge>
                  </div>
                  <div className="col-span-2">2023-11-17</div>
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <Badge className="bg-amber-500 text-white">In Analysis</Badge>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideSearch className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideDatabase className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <Separator />

                {/* Sample 4 */}
                <div className="grid grid-cols-12 p-4 items-center text-sm">
                  <div className="col-span-2 font-medium">DNA-2023-0130</div>
                  <div className="col-span-2">CS-2023-076</div>
                  <div className="col-span-2">
                    <Badge variant="outline">Unknown</Badge>
                  </div>
                  <div className="col-span-2">2023-10-29</div>
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <Badge className="bg-green-500">Processed</Badge>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideSearch className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideDatabase className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <Separator />

                {/* Sample 5 */}
                <div className="grid grid-cols-12 p-4 items-center text-sm">
                  <div className="col-span-2 font-medium">DNA-2023-0131</div>
                  <div className="col-span-2">CS-2023-064</div>
                  <div className="col-span-2">
                    <Badge variant="outline">Reference</Badge>
                  </div>
                  <div className="col-span-2">2023-09-13</div>
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <Badge className="bg-red-500 text-white">Degraded</Badge>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideSearch className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <LucideDatabase className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 py-4">
                <div className="text-sm text-muted-foreground">
                  Showing <strong>5</strong> of <strong>12</strong> entries
                </div>
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
                <Button variant="outline" size="sm">
                  Next
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>DNA Profile Details</CardTitle>
                <CardDescription>Select a DNA profile from the list to view detailed information.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground">
                No DNA profile selected
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Evidence Chain of Custody</CardTitle>
                <CardDescription>Track the complete chain of custody for selected evidence.</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground">
                No evidence selected
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="codis" className="mt-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>CODIS Database Integration</CardTitle>
              <CardDescription>
                Search and compare DNA profiles against the Combined DNA Index System (CODIS) database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="sample-id">DNA Sample ID</Label>
                    <Input id="sample-id" placeholder="Enter DNA sample ID" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="search-type">Search Type</Label>
                    <Select defaultValue="standard">
                      <SelectTrigger id="search-type">
                        <SelectValue placeholder="Select search type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard Search</SelectItem>
                        <SelectItem value="familial">Familial Search</SelectItem>
                        <SelectItem value="partial">Partial Match</SelectItem>
                        <SelectItem value="mitochondrial">Mitochondrial DNA</SelectItem>
                        <SelectItem value="y-str">Y-STR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="database-selection">Database Selection</Label>
                    <Select defaultValue="all_databases">
                      <SelectTrigger id="database-selection">
                        <SelectValue placeholder="Select databases" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all_databases">All Databases</SelectItem>
                        <SelectItem value="offender">Offender</SelectItem>
                        <SelectItem value="forensic">Forensic</SelectItem>
                        <SelectItem value="missing_persons">Missing Persons</SelectItem>
                        <SelectItem value="unidentified_human">Unidentified Human Remains</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="pt-2">
                    <Button className="w-full">Search CODIS Database</Button>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h3 className="font-medium mb-2">CODIS Integration Status</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Connection Status:</span>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <LucideCheckCircle2 className="h-3 w-3 text-green-500" />
                        Connected
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Authentication:</span>
                      <Badge variant="outline" className="flex items-center gap-1">
                        <LucideCheckCircle2 className="h-3 w-3 text-green-500" />
                        Authenticated
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">API Version:</span>
                      <span className="text-sm">v3.2.1</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Last Sync:</span>
                      <span className="text-sm">2023-12-10 08:45 AM</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Search Quota:</span>
                      <span className="text-sm">87/100 remaining today</span>
                    </div>

                    <Separator />

                    <div className="pt-2">
                      <Button variant="outline" size="sm" className="w-full">
                        Test Connection
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              <Separator className="my-6" />

              <div>
                <h3 className="font-medium mb-4">Recent CODIS Search Results</h3>
                <div className="rounded-md border">
                  <div className="grid grid-cols-12 p-4 text-sm font-medium text-muted-foreground bg-muted/50">
                    <div className="col-span-2">Sample ID</div>
                    <div className="col-span-2">Search Date</div>
                    <div className="col-span-2">Search Type</div>
                    <div className="col-span-2">Database</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-2 text-right">Actions</div>
                  </div>
                  <Separator />

                  {/* Search Result 1 */}
                  <div className="grid grid-cols-12 p-4 items-center text-sm">
                    <div className="col-span-2 font-medium">DNA-2023-0127</div>
                    <div className="col-span-2">2023-12-10</div>
                    <div className="col-span-2">Standard</div>
                    <div className="col-span-2">All Databases</div>
                    <div className="col-span-2">
                      <Badge className="bg-green-500">Match Found</Badge>
                    </div>
                    <div className="col-span-2 text-right">
                      <Button variant="outline" size="sm">
                        View Results
                      </Button>
                    </div>
                  </div>
                  <Separator />

                  {/* Search Result 2 */}
                  <div className="grid grid-cols-12 p-4 items-center text-sm">
                    <div className="col-span-2 font-medium">DNA-2023-0129</div>
                    <div className="col-span-2">2023-12-09</div>
                    <div className="col-span-2">Familial</div>
                    <div className="col-span-2">Offender</div>
                    <div className="col-span-2">
                      <Badge className="bg-amber-500 text-white">Processing</Badge>
                    </div>
                    <div className="col-span-2 text-right">
                      <Button variant="outline" size="sm" disabled>
                        View Results
                      </Button>
                    </div>
                  </div>
                  <Separator />

                  {/* Search Result 3 */}
                  <div className="grid grid-cols-12 p-4 items-center text-sm">
                    <div className="col-span-2 font-medium">DNA-2023-0130</div>
                    <div className="col-span-2">2023-12-05</div>
                    <div className="col-span-2">Standard</div>
                    <div className="col-span-2">Forensic</div>
                    <div className="col-span-2">
                      <Badge variant="secondary">No Match</Badge>
                    </div>
                    <div className="col-span-2 text-right">
                      <Button variant="outline" size="sm">
                        View Results
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>CODIS Match Details</CardTitle>
              <CardDescription>Detailed information about the selected CODIS match.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center p-8 border rounded-lg mb-6">
                <div className="text-center space-y-2">
                  <LucideDna className="h-12 w-12 text-primary mx-auto" />
                  <h3 className="font-medium">DNA-2023-0127 Match Details</h3>
                  <p className="text-sm text-muted-foreground">Match found in CODIS Offender Database</p>
                  <Badge className="mt-2 bg-green-500">98.7% Match Confidence</Badge>
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <h3 className="font-medium mb-4">Match Information</h3>
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">CODIS ID:</span>
                      <span className="font-medium">OFF-2018-45721</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Match Type:</span>
                      <span className="font-medium">Full Profile Match</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Match Date:</span>
                      <span className="font-medium">2023-12-10</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Database:</span>
                      <span className="font-medium">Offender</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Jurisdiction:</span>
                      <span className="font-medium">State</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loci Compared:</span>
                      <span className="font-medium">20</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Loci Matched:</span>
                      <span className="font-medium">20</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-4">Next Steps</h3>
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                      <LucideAlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-sm">Confirmation Required</h4>
                        <p className="text-xs text-muted-foreground mt-1">
                          This match requires confirmation through additional testing before proceeding with legal
                          action.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button className="w-full">Request Offender Information</Button>
                      <Button variant="outline" className="w-full">
                        Export Match Report
                      </Button>
                      <Button variant="secondary" className="w-full">
                        Add to Case File
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="other" className="mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LucideFingerprint className="h-5 w-5 text-primary" />
                  <CardTitle>Fingerprint Analysis</CardTitle>
                </div>
                <CardDescription>Manage fingerprint evidence and integration with AFIS.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Fingerprint Samples:</span>
                    <span className="font-medium">47</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">AFIS Connection Status:</span>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <LucideCheckCircle2 className="h-3 w-3 text-green-500" />
                      Connected
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pending Analyses:</span>
                    <span className="font-medium">3</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Recent Matches:</span>
                    <span className="font-medium">2</span>
                  </div>

                  <Separator />

                  <div className="pt-2">
                    <Button className="w-full">Manage Fingerprint Evidence</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <LucideDatabase className="h-5 w-5 text-primary" />
                  <CardTitle>Ballistics Database</CardTitle>
                </div>
                <CardDescription>Manage ballistic evidence and NIBIN integration.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Ballistic Samples:</span>
                    <span className="font-medium">23</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">NIBIN Connection Status:</span>
                    <Badge variant="outline" className="flex items-center gap-1">
                      <LucideCheckCircle2 className="h-3 w-3 text-green-500" />
                      Connected
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Pending Analyses:</span>
                    <span className="font-medium">1</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Recent Matches:</span>
                    <span className="font-medium">0</span>
                  </div>

                  <Separator />

                  <div className="pt-2">
                    <Button className="w-full">Manage Ballistic Evidence</Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Other Forensic Evidence Types</CardTitle>
                <CardDescription>
                  Manage additional types of forensic evidence collected from crime scenes.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-medium">T</span>
                      </div>
                      <h3 className="font-medium">Toxicology</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">12 samples in database</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Manage
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-medium">H</span>
                      </div>
                      <h3 className="font-medium">Hair & Fiber</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">28 samples in database</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Manage
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-medium">S</span>
                      </div>
                      <h3 className="font-medium">Soil & Trace</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">9 samples in database</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Manage
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-medium">D</span>
                      </div>
                      <h3 className="font-medium">Digital Forensics</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">17 devices in database</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Manage
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-medium">I</span>
                      </div>
                      <h3 className="font-medium">Impression Evidence</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">14 samples in database</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Manage
                    </Button>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-primary font-medium">+</span>
                      </div>
                      <h3 className="font-medium">Add New Type</h3>
                    </div>
                    <p className="text-sm text-muted-foreground mb-3">Create custom evidence type</p>
                    <Button variant="outline" size="sm" className="w-full">
                      Create
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="matches" className="mt-6">
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Genetic Match Analysis</CardTitle>
              <CardDescription>View and analyze genetic matches across cases and external databases.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="flex-1">
                  <div className="relative">
                    <LucideSearch className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input type="search" placeholder="Search matches..." className="w-full pl-9" />
                  </div>
                </div>
                <Select defaultValue="all">
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Match type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Match Types</SelectItem>
                    <SelectItem value="exact">Exact Matches</SelectItem>
                    <SelectItem value="partial">Partial Matches</SelectItem>
                    <SelectItem value="familial">Familial Matches</SelectItem>
                    <SelectItem value="codis">CODIS Matches</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="w-full md:w-auto">
                  Filter Options
                </Button>
              </div>

              <div className="rounded-md border">
                <div className="grid grid-cols-12 p-4 text-sm font-medium text-muted-foreground bg-muted/50">
                  <div className="col-span-2">Match ID</div>
                  <div className="col-span-2">Sample ID</div>
                  <div className="col-span-2">Match Type</div>
                  <div className="col-span-2">Match Source</div>
                  <div className="col-span-2">Confidence</div>
                  <div className="col-span-2 text-right">Actions</div>
                </div>
                <Separator />

                {/* Match 1 */}
                <div className="grid grid-cols-12 p-4 items-center text-sm">
                  <div className="col-span-2 font-medium">MATCH-2023-0042</div>
                  <div className="col-span-2">DNA-2023-0127</div>
                  <div className="col-span-2">
                    <Badge variant="outline">Exact Match</Badge>
                  </div>
                  <div className="col-span-2">CODIS</div>
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <Badge className="bg-green-500">98.7%</Badge>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
                <Separator />

                {/* Match 2 */}
                <div className="grid grid-cols-12 p-4 items-center text-sm">
                  <div className="col-span-2 font-medium">MATCH-2023-0043</div>
                  <div className="col-span-2">DNA-2023-0130</div>
                  <div className="col-span-2">
                    <Badge variant="outline">Partial Match</Badge>
                  </div>
                  <div className="col-span-2">Internal Case</div>
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <Badge className="bg-amber-500 text-white">76.2%</Badge>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
                <Separator />

                {/* Match 3 */}
                <div className="grid grid-cols-12 p-4 items-center text-sm">
                  <div className="col-span-2 font-medium">MATCH-2023-0044</div>
                  <div className="col-span-2">DNA-2023-0127</div>
                  <div className="col-span-2">
                    <Badge variant="outline">Familial Match</Badge>
                  </div>
                  <div className="col-span-2">CODIS</div>
                  <div className="col-span-2">
                    <div className="flex items-center">
                      <Badge className="bg-amber-500 text-white">82.5%</Badge>
                    </div>
                  </div>
                  <div className="col-span-2 text-right">
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Match Visualization</CardTitle>
                <CardDescription>Visual representation of genetic matches and their relationships.</CardDescription>
              </CardHeader>
              <CardContent className="h-[300px] flex items-center justify-center bg-muted/30 rounded-lg">
                <div className="text-center">
                  <LucideDna className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Select a match to view visualization</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Match Statistics</CardTitle>
                <CardDescription>Statistical analysis of genetic matches across cases.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Matches:</span>
                    <span className="font-medium">27</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">CODIS Matches:</span>
                    <span className="font-medium">12</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Internal Case Matches:</span>
                    <span className="font-medium">8</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Cross-Case Matches:</span>
                    <span className="font-medium">7</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">High Confidence &gt;90%:</span>
                    <span className="font-medium">14</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Medium Confidence 70-90%:</span>
                    <span className="font-medium">9</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Low Confidence &lt;70%:</span>
                    <span className="font-medium">4</span>
                  </div>

                  <Separator />

                  <div className="pt-2">
                    <Button variant="outline" className="w-full">
                      Generate Match Report
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
