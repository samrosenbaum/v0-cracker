"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LucideSearch, LucideFilter, LucideArrowUpDown } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

export default function CasesPage() {
  const [searchTerm, setSearchTerm] = useState("")
  const [sortBy, setSortBy] = useState("date") // date, priority, status
  const [filterStatus, setFilterStatus] = useState("all") // all, active, closed
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCases = async () => {
      const { data, error } = await supabase.from('cases').select('*').order('created_at', { ascending: false });
      setCases(data || []);
      setLoading(false);
    };
    fetchCases();
  }, []);

  const filteredCases = cases.filter(case_ => {
    const matchesSearch = (case_.title?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
                         (case_.description?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === "all" || (case_.status?.toLowerCase() === filterStatus.toLowerCase())
    return matchesSearch && matchesStatus
  })

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Cases Overview</h1>
          <p className="text-muted-foreground">Manage and track investigation cases</p>
        </div>
        <Link href="/cases/new">
          <Button>New Case</Button>
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <Input
            placeholder="Search cases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          <LucideSearch className="absolute left-3 top-2.5 h-5 w-5 text-muted-foreground" />
        </div>
        
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setFilterStatus(filterStatus === "all" ? "active" : "all")}
        >
          <LucideFilter className="h-4 w-4" />
          {filterStatus === "all" ? "All Status" : "Active Only"}
        </Button>
        
        <Button
          variant="outline"
          className="flex items-center gap-2"
          onClick={() => setSortBy(sortBy === "date" ? "priority" : "date")}
        >
          <LucideArrowUpDown className="h-4 w-4" />
          Sort by {sortBy === "date" ? "Date" : "Priority"}
        </Button>
      </div>

      {/* Cases List */}
      <div className="space-y-4">
        {loading ? (
          <div>Loading...</div>
        ) : filteredCases.length === 0 ? (
          <div>No cases found. Click "New Case" to create your first case.</div>
        ) : (
          filteredCases.map(case_ => (
            <Link href={`/cases/${case_.id}`} key={case_.id}>
              <Card className="hover:bg-accent transition-colors cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{case_.title}</h3>
                      <p className="text-sm text-muted-foreground">{case_.description}</p>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={case_.status === "Active" ? "default" : "secondary"}>
                        {case_.status}
                      </Badge>
                      <Badge variant={case_.priority === "Critical" ? "destructive" : "outline"}>
                        {case_.priority}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Assigned to: {case_.assignedTo || "-"}</span>
                    <span>Last updated: {case_.lastUpdated || case_.created_at?.slice(0,10) || "-"}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
} 