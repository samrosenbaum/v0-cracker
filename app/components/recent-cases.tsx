import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"

export function RecentCases() {
  const recentCases = [
    {
      id: "CASE-001",
      title: "Burglary at 456 Oak Street",
      status: "In Progress",
      date: "2024-03-15",
      priority: "High"
    },
    {
      id: "CASE-002", 
      title: "Missing Person - Sarah Johnson",
      status: "Active",
      date: "2024-03-14",
      priority: "Critical"
    },
    {
      id: "CASE-003",
      title: "Vehicle Theft - Blue Honda Civic",
      status: "Under Review",
      date: "2024-03-13",
      priority: "Medium"
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Cases</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recentCases.map(caseItem => (
            <div 
              key={caseItem.id}
              className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
            >
              <div>
                <p className="font-medium">{caseItem.title}</p>
                <p className="text-sm text-muted-foreground">
                  {caseItem.id} • {caseItem.date}
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
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
} 