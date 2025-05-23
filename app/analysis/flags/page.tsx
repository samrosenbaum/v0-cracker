<<<<<<< HEAD
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { AnalysisFlagsDashboard } from "@/components/analysis-review/analysis-flags-dashboard"
import { LucideArrowLeft, LucideAlertCircle, LucideRefreshCw, LucideFileText } from "lucide-react"
import Link from "next/link"

export default function AnalysisFlagsPage() {
  return (
    <div className="container py-8">
      <Link href="/analysis" className="flex items-center text-sm mb-6 hover:underline">
        <LucideArrowLeft className="mr-2 h-4 w-4" />
        Back to Analysis
      </Link>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analysis Flags & Review Items</h1>
            <p className="text-muted-foreground mt-2">
              AI-identified potential suspects, evidence for re-examination, and inconsistencies requiring review
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="flex items-center gap-1">
              <LucideRefreshCw className="h-4 w-4" />
              Refresh Analysis
            </Button>
            <Button variant="outline" className="flex items-center gap-1">
              <LucideFileText className="h-4 w-4" />
              Generate Report
            </Button>
            <Button>Review All Flags</Button>
          </div>
        </div>

        <Tabs defaultValue="flags" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="flags">Analysis Flags</TabsTrigger>
            <TabsTrigger value="insights">Key Insights</TabsTrigger>
            <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          </TabsList>

          <TabsContent value="flags" className="mt-6">
            <AnalysisFlagsDashboard />
          </TabsContent>

          <TabsContent value="insights" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Key Case Insights</CardTitle>
                <CardDescription>
                  AI-generated insights based on comprehensive analysis of case evidence and data
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="rounded-md border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <LucideAlertCircle className="h-4 w-4" />
                      </div>
                      <h3 className="text-lg font-medium">Timeline Analysis</h3>
                    </div>
                    <p className="mb-3 text-muted-foreground">
                      The 45-minute gap in the victim's timeline is statistically significant. In 78% of similar cases,
                      this type of gap indicated victim interaction with the perpetrator. Recommend focusing
                      investigation resources on this time period.
                    </p>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm">
                        View Full Analysis
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <LucideAlertCircle className="h-4 w-4" />
                      </div>
                      <h3 className="text-lg font-medium">Suspect Profile Analysis</h3>
                    </div>
                    <p className="mb-3 text-muted-foreground">
                      Based on evidence patterns, witness statements, and forensic analysis, the perpetrator profile
                      suggests an individual with local knowledge, access to the area without arousing suspicion, and
                      possible prior connection to the victim. This narrows the suspect pool significantly.
                    </p>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm">
                        View Full Analysis
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-md border p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600">
                        <LucideAlertCircle className="h-4 w-4" />
                      </div>
                      <h3 className="text-lg font-medium">Evidence Pattern Recognition</h3>
                    </div>
                    <p className="mb-3 text-muted-foreground">
                      The pattern of evidence collection and preservation shows three key items with unusually high
                      evidentiary value that haven't been fully analyzed. Statistical analysis suggests these items have
                      a 65% higher likelihood of containing case-critical information compared to other evidence.
                    </p>
                    <div className="flex justify-end">
                      <Button variant="outline" size="sm">
                        View Full Analysis
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recommendations" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Investigation Recommendations</CardTitle>
                <CardDescription>
                  Prioritized recommendations based on AI analysis of case evidence and patterns
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="rounded-md border-l-4 border-l-red-500 bg-red-50 p-4 dark:bg-red-950/20">
                    <h3 className="mb-2 text-lg font-medium">Critical Priority</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-2">
                        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600">
                          <span className="text-xs font-bold">1</span>
                        </div>
                        <div>
                          <p className="font-medium">Re-interview Suspect's Alibi Witness</p>
                          <p className="text-sm text-muted-foreground">
                            Focus on the specific inconsistencies regarding restaurant details. Prepare detailed
                            questions about the layout, staff, and timing discrepancies.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600">
                          <span className="text-xs font-bold">2</span>
                        </div>
                        <div>
                          <p className="font-medium">Resolve Weapon Type Inconsistency</p>
                          <p className="text-sm text-muted-foreground">
                            Request independent analysis from a third forensic expert to resolve the contradiction
                            between serrated vs. smooth-edged weapon findings.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-red-600">
                          <span className="text-xs font-bold">3</span>
                        </div>
                        <div>
                          <p className="font-medium">Investigate 45-Minute Timeline Gap</p>
                          <p className="text-sm text-muted-foreground">
                            Canvas for additional witnesses and check for surveillance cameras in the surrounding area
                            that might cover this critical time period.
                          </p>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-md border-l-4 border-l-orange-500 bg-orange-50 p-4 dark:bg-orange-950/20">
                    <h3 className="mb-2 text-lg font-medium">High Priority</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-2">
                        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                          <span className="text-xs font-bold">1</span>
                        </div>
                        <div>
                          <p className="font-medium">Confirm DNA Match with Additional Testing</p>
                          <p className="text-sm text-muted-foreground">
                            Conduct confirmatory testing on the partial DNA match between crime scene evidence and
                            suspect John Doe to increase confidence level above 90%.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                          <span className="text-xs font-bold">2</span>
                        </div>
                        <div>
                          <p className="font-medium">Investigate Case Connection</p>
                          <p className="text-sm text-muted-foreground">
                            Conduct joint analysis with Case CS-2019-042 to identify additional connections and
                            potential evidence that might strengthen both investigations.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                          <span className="text-xs font-bold">3</span>
                        </div>
                        <div>
                          <p className="font-medium">Resolve Phone Location Contradiction</p>
                          <p className="text-sm text-muted-foreground">
                            Verify phone data accuracy and re-interview witnesses to resolve the contradiction between
                            victim's phone location and witness statements.
                          </p>
                        </div>
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-md border-l-4 border-l-amber-500 bg-amber-50 p-4 dark:bg-amber-950/20">
                    <h3 className="mb-2 text-lg font-medium">Medium Priority</h3>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-2">
                        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                          <span className="text-xs font-bold">1</span>
                        </div>
                        <div>
                          <p className="font-medium">Reanalyze Degraded DNA Sample</p>
                          <p className="text-sm text-muted-foreground">
                            Submit sample DNA-2023-0131 for analysis using new amplification techniques that could
                            potentially yield usable results from the degraded sample.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                          <span className="text-xs font-bold">2</span>
                        </div>
                        <div>
                          <p className="font-medium">Enhance Partial Fingerprint</p>
                          <p className="text-sm text-muted-foreground">
                            Submit the partial fingerprint from the victim's wallet for advanced digital enhancement and
                            reanalysis using the latest techniques.
                          </p>
                        </div>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="mt-1 flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                          <span className="text-xs font-bold">3</span>
                        </div>
                        <div>
                          <p className="font-medium">Interview New Witness</p>
                          <p className="text-sm text-muted-foreground">
                            Conduct detailed interview with Michael Chen regarding the suspicious vehicle he observed
                            near the crime scene and cross-reference with existing witness statements.
                          </p>
                        </div>
                      </li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Analysis Methodology</CardTitle>
              <CardDescription>How the AI identifies and prioritizes flags for review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Multi-Factor Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    The system uses a multi-factor analysis approach that evaluates evidence, statements, timelines, and
                    forensic data against established patterns from solved cases. Each flag is generated based on
                    statistical significance, pattern matching, and logical inconsistencies.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Confidence Scoring</h3>
                  <p className="text-sm text-muted-foreground">
                    Each flag includes a confidence score based on the strength of supporting evidence, statistical
                    relevance, and correlation with known patterns. Higher confidence scores indicate stronger evidence
                    supporting the flag's significance.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Severity Classification</h3>
                  <p className="text-sm text-muted-foreground">
                    Flags are classified by severity based on their potential impact on the case, with critical flags
                    representing issues that could fundamentally alter the investigation's direction or outcome if
                    addressed.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Continuous Learning</h3>
                  <p className="text-sm text-muted-foreground">
                    The system continuously learns from investigator feedback and case outcomes to improve flag accuracy
                    and relevance. When flags are verified or dismissed, this information is used to refine future
                    analysis.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best Practices for Review</CardTitle>
              <CardDescription>Recommendations for effective flag review and investigation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Prioritize by Impact</h3>
                  <p className="text-sm text-muted-foreground">
                    Focus first on critical and high-severity flags, particularly those with high confidence scores.
                    These represent the issues most likely to have significant impact on the case if addressed properly.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Cross-Reference Related Flags</h3>
                  <p className="text-sm text-muted-foreground">
                    Look for patterns and connections between different flags. Often, multiple flags may be related to
                    the same underlying issue or evidence, and addressing them together can yield more comprehensive
                    results.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Document Review Actions</h3>
                  <p className="text-sm text-muted-foreground">
                    For each flag reviewed, document the actions taken, findings, and any changes to the flag's status.
                    This creates an audit trail and helps other investigators understand the reasoning behind decisions.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Regular Review Cycles</h3>
                  <p className="text-sm text-muted-foreground">
                    Establish regular review cycles for all active flags, particularly those marked as "In Review." This
                    ensures that flags don't remain unaddressed for extended periods and that new information is
                    incorporated into the investigation promptly.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
=======
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FlagsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      setUser(user);
      setLoading(false);
    };
    checkAuth();
  }, [router]);

  if (loading) return <p className="p-6 text-center">Loading flags...</p>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">AI Flags & Alerts</h1>
      <p className="text-gray-700">This is where your AI-generated warnings, alerts, or analysis flags will appear.</p>
      {/* You can map your Supabase data here */}
    </div>
  );
>>>>>>> 526dca4 (Add AI graph structure output (entities, events, links))
}
