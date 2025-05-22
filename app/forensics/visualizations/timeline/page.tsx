import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DNAEvidenceTimeline } from "@/components/dna-visualizations/dna-evidence-timeline"
import { LucideArrowLeft, LucideCalendar } from "lucide-react"
import Link from "next/link"

export default function DNATimelinePage() {
  return (
    <div className="container py-8">
      <Link href="/forensics/visualizations" className="flex items-center text-sm mb-6 hover:underline">
        <LucideArrowLeft className="mr-2 h-4 w-4" />
        Back to Visualizations
      </Link>

      <div className="flex flex-col gap-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">DNA Evidence Timeline</h1>
            <p className="text-muted-foreground mt-2">
              Interactive chronological visualization of DNA evidence collection, processing, and analysis
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <LucideCalendar className="h-5 w-5 text-primary" />
              <CardTitle>Timeline Visualization</CardTitle>
            </div>
            <CardDescription>
              Track the complete lifecycle of DNA evidence from collection to analysis and reporting
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="mb-6">
              The DNA evidence timeline provides a comprehensive chronological view of all activities related to DNA
              evidence in a case. This visualization helps investigators track the complete chain of custody, processing
              steps, and analysis results over time. Use the filters and search functionality to focus on specific
              aspects of the evidence lifecycle.
            </p>

            <DNAEvidenceTimeline />
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Timeline Usage Guide</CardTitle>
              <CardDescription>How to effectively use the DNA evidence timeline</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Filtering Events</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the filters at the top of the timeline to focus on specific event types, statuses, or
                    priorities. You can also search for specific text within event details to quickly find relevant
                    information.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Viewing Event Details</h3>
                  <p className="text-sm text-muted-foreground">
                    Click on any event in the timeline to view its complete details, including related events, sample
                    information, and available actions. This helps you understand the context and relationships between
                    different evidence handling steps.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Timeline Navigation</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the zoom controls to adjust the timeline view, or switch between timeline, list, and calendar
                    views depending on your preferred visualization method. The date range controls allow you to focus
                    on specific time periods.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Exporting Data</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the export button to download the timeline data in various formats for reports or presentations.
                    You can export the entire timeline or just the currently filtered view.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best Practices</CardTitle>
              <CardDescription>Recommendations for effective timeline analysis</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2">Identify Gaps in Processing</h3>
                  <p className="text-sm text-muted-foreground">
                    Look for unusual time gaps between related events that might indicate delays or issues in evidence
                    processing. These gaps could represent opportunities for process improvement or might highlight
                    potential chain of custody concerns.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Track Sample Relationships</h3>
                  <p className="text-sm text-muted-foreground">
                    Use the related events feature to understand how different samples and analyses are connected. This
                    helps build a comprehensive picture of the evidence and its significance to the case.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Monitor Processing Status</h3>
                  <p className="text-sm text-muted-foreground">
                    Regularly review pending events to ensure all DNA evidence is being processed in a timely manner.
                    High-priority items should be tracked closely to prevent delays in critical analyses.
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-medium mb-2">Document Timeline Observations</h3>
                  <p className="text-sm text-muted-foreground">
                    When you identify significant patterns or issues in the timeline, document these observations for
                    case reports and team discussions. The timeline can be a valuable tool for case reviews and process
                    improvement.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
