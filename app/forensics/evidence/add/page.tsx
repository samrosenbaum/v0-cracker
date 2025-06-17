"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { LucideArrowLeft } from "lucide-react"
import Link from "next/link"

export default function AddEvidencePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData(e.currentTarget)
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login')
        return
      }

      const eventData = {
        case_id: formData.get('caseId'),
        date: formData.get('date'),
        time: formData.get('time'),
        type: formData.get('type'),
        title: formData.get('title'),
        description: formData.get('description'),
        location: formData.get('location'),
        personnel: formData.get('personnel'),
        sample_id: formData.get('sampleId'),
        status: formData.get('status'),
        priority: formData.get('priority'),
        tags: formData.get('tags')?.toString().split(',').map(tag => tag.trim()),
        user_id: user.id
      }

      const { error } = await supabase
        .from('evidence_events')
        .insert([eventData])

      if (error) throw error

      router.push('/forensics/evidence')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while adding the event')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container py-8">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/forensics/evidence">
          <Button variant="ghost" size="icon">
            <LucideArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Add Evidence Event</h1>
          <p className="text-muted-foreground">Record a new evidence-related event</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
          <CardDescription>
            Fill in the details of the evidence event
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="caseId">Case ID</Label>
                <Input
                  id="caseId"
                  name="caseId"
                  required
                  placeholder="e.g., CS-2023-089"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">Event Type</Label>
                <Select name="type" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="collection">Collection</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="analysis">Analysis</SelectItem>
                    <SelectItem value="match">Match</SelectItem>
                    <SelectItem value="report">Report</SelectItem>
                    <SelectItem value="degradation">Degradation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <Input
                  id="time"
                  name="time"
                  type="time"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  name="title"
                  required
                  placeholder="Brief title of the event"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="sampleId">Sample ID</Label>
                <Input
                  id="sampleId"
                  name="sampleId"
                  placeholder="e.g., DNA-2023-0127"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  name="location"
                  placeholder="Where the event occurred"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="personnel">Personnel</Label>
                <Input
                  id="personnel"
                  name="personnel"
                  placeholder="Who handled the evidence"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select name="status">
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Select name="priority">
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                required
                placeholder="Detailed description of the event"
                className="min-h-[100px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                placeholder="Comma-separated tags (e.g., blood, crime scene, initial collection)"
              />
            </div>

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/forensics/evidence')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Adding...' : 'Add Event'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
} 