import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  // Get query parameters
  const searchParams = req.nextUrl.searchParams
  const sampleId = searchParams.get("sampleId")
  const matchType = searchParams.get("matchType")
  const source = searchParams.get("source")

  // Sample genetic matches data
  const geneticMatches = [
    {
      id: "MATCH-2023-0042",
      sampleId: "DNA-2023-0127",
      matchType: "Exact Match",
      matchSource: "CODIS",
      confidence: 98.7,
      matchDate: "2023-12-10",
      matchDetails: {
        codisId: "OFF-2018-45721",
        matchType: "Full Profile Match",
        database: "Offender",
        jurisdiction: "State",
        lociCompared: 20,
        lociMatched: 20,
      },
    },
    {
      id: "MATCH-2023-0043",
      sampleId: "DNA-2023-0130",
      matchType: "Partial Match",
      matchSource: "Internal Case",
      confidence: 76.2,
      matchDate: "2023-12-08",
      matchDetails: {
        relatedCaseId: "CS-2022-045",
        matchType: "Partial Profile Match",
        lociCompared: 20,
        lociMatched: 15,
      },
    },
    {
      id: "MATCH-2023-0044",
      sampleId: "DNA-2023-0127",
      matchType: "Familial Match",
      matchSource: "CODIS",
      confidence: 82.5,
      matchDate: "2023-12-07",
      matchDetails: {
        codisId: "OFF-2020-12876",
        matchType: "Familial Match",
        database: "Offender",
        jurisdiction: "State",
        lociCompared: 20,
        lociMatched: 17,
        relationshipProbability: "Sibling (76%)",
      },
    },
  ]

  // Filter the data based on query parameters
  let filteredMatches = [...geneticMatches]

  if (sampleId) {
    filteredMatches = filteredMatches.filter((match) => match.sampleId === sampleId)
  }

  if (matchType) {
    filteredMatches = filteredMatches.filter((match) => match.matchType.toLowerCase().includes(matchType.toLowerCase()))
  }

  if (source) {
    filteredMatches = filteredMatches.filter((match) => match.matchSource.toLowerCase().includes(source.toLowerCase()))
  }

  return NextResponse.json({
    success: true,
    count: filteredMatches.length,
    matches: filteredMatches,
  })
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()

    // Validate required fields
    if (!data.sampleId || !data.matchType || !data.matchSource) {
      return NextResponse.json(
        {
          error: "Sample ID, match type, and match source are required",
        },
        { status: 400 },
      )
    }

    // In a real application, this would save the match to a database
    // For this example, we'll just return a success response with a generated ID

    const newMatchId = `MATCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

    return NextResponse.json({
      success: true,
      message: "Genetic match recorded successfully",
      matchId: newMatchId,
      match: {
        id: newMatchId,
        sampleId: data.sampleId,
        matchType: data.matchType,
        matchSource: data.matchSource,
        confidence: data.confidence || 0,
        matchDate: new Date().toISOString().split("T")[0],
        matchDetails: data.matchDetails || {},
      },
    })
  } catch (error) {
    console.error("Error recording genetic match:", error)
    return NextResponse.json({ error: "Failed to record genetic match" }, { status: 500 })
  }
}
