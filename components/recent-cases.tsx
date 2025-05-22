import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export function RecentCases() {
  const cases = [
    {
      id: "CS-2023-089",
      title: "Riverside Homicide",
      date: "2023-11-15",
      status: "In Progress",
      matches: 7,
      priority: "High",
    },
    {
      id: "CS-2023-076",
      title: "Downtown Disappearance",
      date: "2023-10-28",
      status: "In Progress",
      matches: 4,
      priority: "Medium",
    },
    {
      id: "CS-2023-064",
      title: "Harbor District Assault",
      date: "2023-09-12",
      status: "Completed",
      matches: 12,
      priority: "Medium",
    },
    {
      id: "CS-2023-052",
      title: "Westside Burglary Series",
      date: "2023-08-05",
      status: "Completed",
      matches: 9,
      priority: "Low",
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Cases</CardTitle>
        <CardDescription>View your most recent case analyses</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {cases.map((caseItem) => (
            <div key={caseItem.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{caseItem.title}</h4>
                  <Badge
                    variant={
                      caseItem.priority === "High"
                        ? "destructive"
                        : caseItem.priority === "Medium"
                          ? "default"
                          : "secondary"
                    }
                  >
                    {caseItem.priority}
                  </Badge>
                </div>
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span>ID: {caseItem.id}</span>
                  <span>Date: {caseItem.date}</span>
                  <span>Potential Matches: {caseItem.matches}</span>
                </div>
              </div>
              <Link href={`/cases/${caseItem.id}`}>
                <Button variant="outline" size="sm">
                  View Details
                </Button>
              </Link>
            </div>
          ))}
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
