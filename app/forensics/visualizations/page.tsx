import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DNAProfileComparison } from "@/components/dna-visualizations/dna-profile-comparison"
import { GeneticNetworkGraph } from "@/components/dna-visualizations/genetic-network-graph"
import { FamilialRelationshipTree } from "@/components/dna-visualizations/familial-relationship-tree"
import { DNAStatisticsDashboard } from "@/components/dna-visualizations/dna-statistics-dashboard"
import { LucideArrowLeft, LucideDna } from "lucide-react"
import Link from "next/link"

export default function ForensicVisualizationsPage() {
  return (
    <div className="container py-8">
      <Link href="/forensics" className="flex items-center text-sm mb-6 hover:underline">
        <LucideArrowLeft className="mr-2 h-4 w-4" />
        Back to Forensics
      </Link>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">DNA Evidence Visualizations</h1>
            <p className="text-muted-foreground mt-2">
              Interactive visualizations for DNA evidence analysis and relationship mapping
            </p>
          </div>
        </div>

        <Tabs defaultValue="profile" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="profile">Profile Comparison</TabsTrigger>
            <TabsTrigger value="network">Network Analysis</TabsTrigger>
            <TabsTrigger value="familial">Familial Relationships</TabsTrigger>
            <TabsTrigger value="statistics">Statistics Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <LucideDna className="h-5 w-5 text-primary" />
                    <CardTitle>DNA Profile Visualization</CardTitle>
                  </div>
                  <CardDescription>
                    Compare DNA profiles to identify matches and analyze genetic markers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-6">
                    DNA profile comparison allows investigators to visually compare genetic markers between evidence
                    samples and reference samples or CODIS matches. This visualization helps identify exact matches,
                    partial matches, and familial relationships.
                  </p>

                  <DNAProfileComparison />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="network" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Genetic Network Visualization</CardTitle>
                  <CardDescription>
                    Visualize connections between DNA samples, cases, and potential suspects
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-6">
                    The genetic network graph visualizes relationships between DNA samples, cases, and individuals. This
                    interactive visualization helps investigators identify connections that might not be apparent in
                    tabular data, revealing potential links between seemingly unrelated cases.
                  </p>

                  <GeneticNetworkGraph />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="familial" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Familial Relationship Analysis</CardTitle>
                  <CardDescription>
                    Visualize family trees and genetic relationships between individuals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-6">
                    Familial relationship analysis helps investigators understand genetic connections between
                    individuals. This visualization creates family trees based on DNA evidence, showing parent-child
                    relationships, siblings, and other familial connections that may be relevant to an investigation.
                  </p>

                  <FamilialRelationshipTree />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="statistics" className="mt-6">
            <div className="grid gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>DNA Statistics Dashboard</CardTitle>
                  <CardDescription>
                    Statistical analysis of DNA evidence, match rates, and population genetics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-6">
                    The DNA statistics dashboard provides investigators with key metrics and trends related to DNA
                    evidence. This includes match confidence distributions, match types, trends over time, and
                    population statistics that help contextualize the significance of DNA evidence in investigations.
                  </p>

                  <DNAStatisticsDashboard />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
