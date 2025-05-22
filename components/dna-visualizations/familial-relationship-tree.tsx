"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LucideUsers, LucideZoomIn, LucideZoomOut, LucideDownload } from "lucide-react"

interface Person {
  id: string
  name: string
  gender: "male" | "female" | "unknown"
  type: "suspect" | "victim" | "witness" | "codis" | "unknown"
  dnaId?: string
  matchConfidence?: number
}

interface Relationship {
  type: "parent" | "child" | "sibling" | "spouse" | "unknown"
  from: string
  to: string
  confidence: number
}

interface FamilialRelationshipTreeProps {
  centerPerson?: string
  people?: Person[]
  relationships?: Relationship[]
}

export function FamilialRelationshipTree({
  centerPerson = "P001",
  people: propPeople,
  relationships: propRelationships,
}: FamilialRelationshipTreeProps) {
  const [zoomLevel, setZoomLevel] = useState(100)
  const [selectedPerson, setSelectedPerson] = useState<string | null>(null)
  const [view, setView] = useState<"tree" | "list">("tree")

  // Sample data for demonstration
  const demoPeople: Person[] = [
    {
      id: "P001",
      name: "John Doe",
      gender: "male",
      type: "suspect",
      dnaId: "DNA-2023-0129",
      matchConfidence: 98.7,
    },
    {
      id: "P002",
      name: "Jane Doe",
      gender: "female",
      type: "unknown",
      matchConfidence: 0,
    },
    {
      id: "P003",
      name: "Robert Doe",
      gender: "male",
      type: "codis",
      dnaId: "OFF-2018-45721",
      matchConfidence: 82.5,
    },
    {
      id: "P004",
      name: "Mary Doe",
      gender: "female",
      type: "unknown",
      matchConfidence: 0,
    },
    {
      id: "P005",
      name: "Thomas Doe",
      gender: "male",
      type: "codis",
      dnaId: "OFF-2020-12876",
      matchConfidence: 76.2,
    },
    {
      id: "P006",
      name: "Sarah Johnson",
      gender: "female",
      type: "unknown",
      matchConfidence: 0,
    },
    {
      id: "P007",
      name: "Michael Doe",
      gender: "male",
      type: "unknown",
      matchConfidence: 65.3,
    },
    {
      id: "P008",
      name: "Unknown",
      gender: "unknown",
      type: "unknown",
      matchConfidence: 0,
    },
  ]

  const demoRelationships: Relationship[] = [
    { type: "spouse", from: "P001", to: "P002", confidence: 99 },
    { type: "parent", from: "P001", to: "P005", confidence: 99.5 },
    { type: "parent", from: "P002", to: "P005", confidence: 99.5 },
    { type: "parent", from: "P003", to: "P001", confidence: 99.5 },
    { type: "parent", from: "P004", to: "P001", confidence: 99.5 },
    { type: "sibling", from: "P001", to: "P007", confidence: 82.5 },
    { type: "parent", from: "P003", to: "P007", confidence: 99.5 },
    { type: "parent", from: "P004", to: "P007", confidence: 99.5 },
    { type: "spouse", from: "P005", to: "P006", confidence: 99 },
    { type: "parent", from: "P005", to: "P008", confidence: 99.5 },
    { type: "parent", from: "P006", to: "P008", confidence: 99.5 },
  ]

  const people = propPeople || demoPeople
  const relationships = propRelationships || demoRelationships

  const getPersonById = (id: string) => people.find((p) => p.id === id)

  const getRelationshipLabel = (type: string) => {
    switch (type) {
      case "parent":
        return "Parent of"
      case "child":
        return "Child of"
      case "sibling":
        return "Sibling of"
      case "spouse":
        return "Spouse of"
      default:
        return "Related to"
    }
  }

  const getRelationshipsForPerson = (personId: string) => {
    return relationships.filter((r) => r.from === personId || r.to === personId)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "suspect":
        return "bg-amber-500"
      case "victim":
        return "bg-blue-500"
      case "witness":
        return "bg-purple-500"
      case "codis":
        return "bg-green-500"
      default:
        return "bg-gray-500"
    }
  }

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 95) return "bg-green-500"
    if (confidence >= 80) return "bg-amber-500 text-white"
    if (confidence >= 60) return "bg-orange-500 text-white"
    return "bg-red-500 text-white"
  }

  // Recursive function to render a person and their relationships in the tree view
  const renderPersonNode = (
    personId: string,
    level = 0,
    parentId: string | null = null,
    relationshipType: string | null = null,
  ) => {
    const person = getPersonById(personId)
    if (!person) return null

    const childRelationships = relationships.filter(
      (r) => r.from === personId && r.to !== parentId && r.type !== "spouse",
    )
    const spouseRelationships = relationships.filter(
      (r) => (r.from === personId || r.to === personId) && r.type === "spouse",
    )

    return (
      <div
        key={personId}
        className={`relative mb-4 ${level > 0 ? "ml-8 border-l pl-4" : ""}`}
        style={{ marginLeft: level > 0 ? `${level * 2}rem` : 0 }}
      >
        <div
          className={`relative rounded-md border p-3 ${
            selectedPerson === personId ? "border-primary ring-2 ring-primary ring-opacity-50" : ""
          } ${personId === centerPerson ? "border-black dark:border-white" : ""}`}
          onClick={() => setSelectedPerson(personId === selectedPerson ? null : personId)}
        >
          {relationshipType && (
            <div className="absolute -left-4 -top-3 rounded-full bg-background px-2 py-1 text-xs font-medium">
              {getRelationshipLabel(relationshipType)}
            </div>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  person.gender === "male"
                    ? "bg-blue-100 text-blue-600"
                    : person.gender === "female"
                      ? "bg-pink-100 text-pink-600"
                      : "bg-gray-100 text-gray-600"
                }`}
              >
                {person.gender === "male" ? "♂" : person.gender === "female" ? "♀" : "?"}
              </div>
              <div>
                <div className="font-medium">{person.name}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <span>ID: {person.id}</span>
                  {person.dnaId && <span>• DNA: {person.dnaId}</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge className={getTypeColor(person.type)}>{person.type}</Badge>
              {person.matchConfidence > 0 && (
                <Badge className={getConfidenceBadge(person.matchConfidence)}>{person.matchConfidence}%</Badge>
              )}
            </div>
          </div>
        </div>

        {/* Render spouses */}
        {spouseRelationships.map((rel) => {
          const spouseId = rel.from === personId ? rel.to : rel.from
          const spouse = getPersonById(spouseId)
          if (!spouse) return null

          return (
            <div key={`spouse-${spouseId}`} className="ml-4 mt-2">
              <div className="flex items-center">
                <div className="h-6 w-6 border-b border-l"></div>
                <div className="ml-2 text-xs font-medium">Spouse</div>
              </div>
              <div
                className={`mt-2 rounded-md border p-3 ${
                  selectedPerson === spouseId ? "border-primary ring-2 ring-primary ring-opacity-50" : ""
                }`}
                onClick={() => setSelectedPerson(spouseId === selectedPerson ? null : spouseId)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        spouse.gender === "male"
                          ? "bg-blue-100 text-blue-600"
                          : spouse.gender === "female"
                            ? "bg-pink-100 text-pink-600"
                            : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {spouse.gender === "male" ? "♂" : spouse.gender === "female" ? "♀" : "?"}
                    </div>
                    <div>
                      <div className="font-medium">{spouse.name}</div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>ID: {spouse.id}</span>
                        {spouse.dnaId && <span>• DNA: {spouse.dnaId}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={getTypeColor(spouse.type)}>{spouse.type}</Badge>
                    {spouse.matchConfidence > 0 && (
                      <Badge className={getConfidenceBadge(spouse.matchConfidence)}>{spouse.matchConfidence}%</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Render children */}
        {childRelationships.length > 0 && (
          <div className="mt-4">
            <div className="mb-2 ml-4 flex items-center">
              <div className="h-6 w-6 border-b border-l"></div>
              <div className="ml-2 text-xs font-medium">Children</div>
            </div>
            <div className="space-y-2">
              {childRelationships.map((rel) => renderPersonNode(rel.to, level + 1, personId, rel.type))}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LucideUsers className="h-5 w-5 text-primary" />
            <CardTitle>Familial Relationship Analysis</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}>
              <LucideZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))}>
              <LucideZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <LucideDownload className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <CardDescription>Visualize familial relationships and genetic connections between individuals</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Tabs value={view} onValueChange={setView as any} className="w-[300px]">
            <TabsList>
              <TabsTrigger value="tree">Family Tree</TabsTrigger>
              <TabsTrigger value="list">Relationship List</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div
          className="rounded-md border p-4"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: "top left" }}
        >
          {view === "tree" ? (
            <div className="min-h-[500px]">{renderPersonNode(centerPerson)}</div>
          ) : (
            <div className="space-y-4">
              {people.map((person) => (
                <div
                  key={person.id}
                  className={`rounded-md border p-4 ${
                    selectedPerson === person.id ? "border-primary ring-2 ring-primary ring-opacity-50" : ""
                  } ${person.id === centerPerson ? "border-black dark:border-white" : ""}`}
                  onClick={() => setSelectedPerson(person.id === selectedPerson ? null : person.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${
                          person.gender === "male"
                            ? "bg-blue-100 text-blue-600"
                            : person.gender === "female"
                              ? "bg-pink-100 text-pink-600"
                              : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {person.gender === "male" ? "♂" : person.gender === "female" ? "♀" : "?"}
                      </div>
                      <div>
                        <div className="font-medium">{person.name}</div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <span>ID: {person.id}</span>
                          {person.dnaId && <span>• DNA: {person.dnaId}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge className={getTypeColor(person.type)}>{person.type}</Badge>
                      {person.matchConfidence > 0 && (
                        <Badge className={getConfidenceBadge(person.matchConfidence)}>{person.matchConfidence}%</Badge>
                      )}
                    </div>
                  </div>

                  {getRelationshipsForPerson(person.id).length > 0 && (
                    <div className="mt-3 space-y-2">
                      <div className="text-xs font-medium">Relationships:</div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {getRelationshipsForPerson(person.id).map((rel, idx) => {
                          const relatedPersonId = rel.from === person.id ? rel.to : rel.from
                          const relatedPerson = getPersonById(relatedPersonId)
                          if (!relatedPerson) return null

                          return (
                            <div key={idx} className="flex items-center justify-between rounded-md border p-2 text-sm">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">
                                  {rel.from === person.id
                                    ? getRelationshipLabel(rel.type)
                                    : getRelationshipLabel(
                                        rel.type === "parent" ? "child" : rel.type === "child" ? "parent" : rel.type,
                                      )}
                                </Badge>
                                <span>{relatedPerson.name}</span>
                              </div>
                              <Badge className={getConfidenceBadge(rel.confidence)}>{rel.confidence}%</Badge>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedPerson && (
          <div className="mt-4 rounded-md border p-4">
            <h3 className="mb-2 text-sm font-medium">Selected Person Details</h3>
            {(() => {
              const person = getPersonById(selectedPerson)
              if (!person) return <div>No details available</div>

              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-md border p-2 text-center">
                      <div className="text-xs text-muted-foreground">Name</div>
                      <div className="font-medium">{person.name}</div>
                    </div>
                    <div className="rounded-md border p-2 text-center">
                      <div className="text-xs text-muted-foreground">ID</div>
                      <div className="font-medium">{person.id}</div>
                    </div>
                    <div className="rounded-md border p-2 text-center">
                      <div className="text-xs text-muted-foreground">Type</div>
                      <div className="font-medium">{person.type}</div>
                    </div>
                    <div className="rounded-md border p-2 text-center">
                      <div className="text-xs text-muted-foreground">Gender</div>
                      <div className="font-medium">{person.gender}</div>
                    </div>
                  </div>

                  {person.dnaId && (
                    <div className="rounded-md border p-3">
                      <div className="mb-1 text-xs font-medium">DNA Sample</div>
                      <div className="flex items-center justify-between">
                        <span>{person.dnaId}</span>
                        <Button size="sm" variant="outline">
                          View DNA Profile
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="outline">View Full Profile</Button>
                    <Button>Set as Center Person</Button>
                  </div>
                </div>
              )
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
