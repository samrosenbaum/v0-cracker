import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { LucideFileSearch, LucideUsers, LucideBarChart2, LucideCheckCircle } from "lucide-react"
import { useMemo } from 'react';

interface Case {
  id: string;
  title?: string;
  status?: string;
  suspects_count?: number;
  critical_leads_count?: number;
}

interface DashboardStatsProps {
  cases: Case[];
  loading?: boolean;
}

export function DashboardStats({ cases = [], loading = false }: DashboardStatsProps) {
  // Compute stats
  const totalCases = cases.length;
  const suspects = useMemo(() => cases.reduce((acc, c) => acc + (c.suspects_count || 0), 0), [cases]);
  const resolvedCases = useMemo(() => cases.filter(c => c.status && c.status.toLowerCase() === 'resolved').length, [cases]);
  const criticalLeads = useMemo(() => cases.reduce((acc, c) => acc + (c.critical_leads_count || 0), 0), [cases]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Cases</CardTitle>
          <LucideFileSearch className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{loading ? '...' : totalCases}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Suspects Identified</CardTitle>
          <LucideUsers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{loading ? '...' : suspects}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Critical Leads</CardTitle>
          <LucideBarChart2 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{loading ? '...' : criticalLeads}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cases Resolved</CardTitle>
          <LucideCheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{loading ? '...' : resolvedCases}</div>
        </CardContent>
      </Card>
    </div>
  )
} 