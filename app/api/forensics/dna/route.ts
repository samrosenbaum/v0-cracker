import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  // Get query parameters
  const searchParams = req.nextUrl.searchParams
  const caseId = searchParams.get("caseId")
  const sampleType = searchParams.get("type")
  const status = searchParams.get("status")

  // Sample DNA profiles data
  const dnaProfiles = [
    {
      id: "DNA-2023-0127",
      caseId: "CS-2023-089",
      type: "Crime Scene",
      collectionDate: "2023-11-16",
      status: "Processed",
      location: "Riverside Park, North Section",
      notes: "Blood sample from crime scene, collected from park bench",
      processingLab: "Central Forensics Lab",
      chainOfCustody: [
        { date: "2023-11-16", action: "Collected", by: "Officer J. Martinez" },
        { date: "2023-11-16", action: "Transferred to Lab", by: "Officer J. Martinez" },
        { date: "2023-11-17", action: "Received by Lab", by: "Tech L. Johnson" },
        { date: "2023-11-19", action: "Processing Complete", by: "Dr. A. Williams" },
      ],
    },
    {
      id: "DNA-2023-0128",
      caseId: "CS-2023-089",
      type: "Victim",
      collectionDate: "2023-11-16",
      status: "Processed",
      location: "City Hospital",
      notes: "Reference sample from victim",
      processingLab: "Central Forensics Lab",
      chainOfCustody: [
        { date: "2023-11-16", action: "Collected", by: "Dr. M. Chen" },
        { date: "2023-11-16", action: "Transferred to Lab", by: "Officer T. Wilson" },
        { date: "2023-11-17", action: "Received by Lab", by: "Tech L. Johnson" },
        { date: "2023-11-18", action: "Processing Complete", by: "Dr. A. Williams" },
      ],
    },
    {
      id: "DNA-2023-0129",
      caseId: "CS-2023-089",
      type: "Suspect",
      collectionDate: "2023-11-17",
      status: "In Analysis",
      location: "Police Station",
      notes: "Reference sample from suspect John Doe",
      processingLab: "Central Forensics Lab",
      chainOfCustody: [
        { date: "2023-11-17", action: "Collected", by: "Officer S. Rodriguez" },
        { date: "2023-11-17", action: "Transferred to Lab", by: "Officer S. Rodriguez" },
        { date: "2023-11-18", action: "Received by Lab", by: "Tech B. Thompson" },
      ],
    },
    {
      id: "DNA-2023-0130",
      caseId: "CS-2023-076",
      type: "Unknown",
      collectionDate: "2023-10-29",
      status: "Processed",
      location: "Downtown Alley",
      notes: "Hair sample found at scene",
      processingLab: "Central Forensics Lab",
      chainOfCustody: [
        { date: "2023-10-29", action: "Collected", by: "Officer D. Brown" },
        { date: "2023-10-29", action: "Transferred to Lab", by: "Officer D. Brown" },
        { date: "2023-10-30", action: "Received by Lab", by: "Tech L. Johnson" },
        { date: "2023-11-02", action: "Processing Complete", by: "Dr. R. Garcia" },
      ],
    },
    {
      id: "DNA-2023-0131",
      caseId: "CS-2023-064",
      type: "Reference",
      collectionDate: "2023-09-13",
      status: "Degraded",
      location: "Harbor District",
      notes: "Sample degraded due to environmental exposure",
      processingLab: "Central Forensics Lab",
      chainOfCustody: [
        { date: "2023-09-13", action: "Collected", by: "Officer M. Johnson" },
        { date: "2023-09-13", action: "Transferred to Lab", by: "Officer M. Johnson" },
        { date: "2023-09-14", action: "Received by Lab", by: "Tech B. Thompson" },
        { date: "2023-09-16", action: "Sample Degraded", by: "Dr. A. Williams" },
      ],
    },
  ]

  // Filter the data based on query parameters
  let filteredProfiles = [...dnaProfiles]

  if (caseId) {
    filteredProfiles = filteredProfiles.filter((profile) => profile.caseId === caseId)
  }

  if (sampleType) {
    filteredProfiles = filteredProfiles.filter((profile) => profile.type.toLowerCase() === sampleType.toLowerCase())
  }

  if (status) {
    filteredProfiles = filteredProfiles.filter((profile) => profile.status.toLowerCase() === status.toLowerCase())
  }

  return NextResponse.json({
    success: true,
    count: filteredProfiles.length,
    profiles: filteredProfiles,
  })
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json()

    // Validate required fields
    if (!data.caseId || !data.type) {
      return NextResponse.json({ error: "Case ID and sample type are required" }, { status: 400 })
    }

    // In a real application, this would save the DNA profile to a database
    // For this example, we'll just return a success response with a generated ID

    const newProfileId = `DNA-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`

    return NextResponse.json({
      success: true,
      message: "DNA profile created successfully",
      profileId: newProfileId,
      profile: {
        id: newProfileId,
        caseId: data.caseId,
        type: data.type,
        collectionDate: data.collectionDate || new Date().toISOString().split("T")[0],
        status: "Pending",
        location: data.location || "Not specified",
        notes: data.notes || "",
        processingLab: data.processingLab || "Central Forensics Lab",
        chainOfCustody: [
          {
            date: new Date().toISOString().split("T")[0],
            action: "Collected",
            by: data.collectedBy || "Unknown",
          },
        ],
      },
    })
  } catch (error) {
    console.error("Error creating DNA profile:", error)
    return NextResponse.json({ error: "Failed to create DNA profile" }, { status: 500 })
  }
}
