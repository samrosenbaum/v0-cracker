import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import Link from "next/link"
import { Button } from "./ui/button"

interface Case {
  id: string;
  title?: string;
  case_number?: string;
  status?: string;
  priority?: string;
  incident_date?: string;
  created_at?: string;
}

interface RecentCasesProps {
  cases: Case[];
  loading?: boolean;
}

export function RecentCases({ cases = [], loading = false }: RecentCasesProps) {
  const recentCases = cases.slice(0, 4)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Cases</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading ? (
            <div>Loading...</div>
          ) : recentCases.length === 0 ? (
            <div>No cases found.</div>
          ) : (
            recentCases.map(caseItem => (
              <div 
                key={caseItem.id}
                className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="font-medium">{caseItem.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {caseItem.case_number || caseItem.id} • {caseItem.incident_date || caseItem.created_at?.slice(0,10)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{caseItem.status}</Badge>
                  <Badge 
                    variant={
                      caseItem.priority === "Critical" 
                        ? "destructive" 
                        : caseItem.priority === "High"
                        ? "default"
                        : "secondary"
                    }
                  >
                    {caseItem.priority}
                  </Badge>
                </div>
                <Link href={`/cases/${caseItem.id}`}>
                  <Button variant="outline" size="sm">View Details</Button>
                </Link>
              </div>
            ))
          )}
        </div>
        <div className="mt-4 flex justify-end">
          <Link href="/cases">
            <Button variant="ghost">View All Cases</Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
} 