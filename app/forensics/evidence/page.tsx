"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DNAEvidenceTimeline } from "@/components/dna-visualizations/dna-evidence-timeline"
import { Button } from "@/components/ui/button"
import { LucideArrowLeft, LucidePlus } from "lucide-react"
import Link from "next/link"
import { supabase } from "@/lib/supabaseClient"
import { useRouter } from "next/navigation"

interface TimelineEvent {
  id: string
  date: string
  time?: string
  type: "collection" | "transfer" | "analysis" | "match" | "report" | "degradation" | "other"
  title: string
  description: string
  location?: string
  personnel?: string
  sampleId?: string
  caseId?: string
  status?: "completed" | "pending" | "failed"
  relatedEvents?: string[]
  tags?: string[]
  priority?: "low" | "medium" | "high"
}

export default function EvidencePage() {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data, error } = await supabase
          .from('evidence_events')
          .select('*')
          .order('date', { ascending: true })
          .order('time', { ascending: true })

        if (error) throw error

        // Transform the data to match the TimelineEvent interface
        const transformedEvents = data.map(event => ({
          id: event.id,
          date: event.date,
          time: event.time,
          type: event.type,
          title: event.title,
          description: event.description,
          location: event.location,
          personnel: event.personnel,
          sampleId: event.sample_id,
          caseId: event.case_id,
          status: event.status,
          relatedEvents: event.related_events,
          tags: event.tags,
          priority: event.priority
        }))

        setEvents(transformedEvents)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred while fetching events')
      } finally {
        setLoading(false)
      }
    }

    fetchEvents()
  }, [router])

  if (loading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-muted-foreground">Loading evidence timeline...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-[400px]">
          <p className="text-red-500">Error: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link href="/forensics">
            <Button variant="ghost" size="icon">
              <LucideArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Evidence Management</h1>
            <p className="text-muted-foreground">Track and manage all evidence in the case</p>
          </div>
        </div>
        <Link href="/forensics/evidence/add">
          <Button>
            <LucidePlus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </Link>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>DNA Evidence Timeline</CardTitle>
            <CardDescription>
              Comprehensive view of all DNA evidence activities and their chronological progression
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DNAEvidenceTimeline events={events} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evidence Collection Log</CardTitle>
            <CardDescription>
              Detailed log of all evidence collected and processed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              Evidence collection log coming soon...
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
} 