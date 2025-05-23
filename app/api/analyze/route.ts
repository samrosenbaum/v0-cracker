import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const files = formData.getAll("files") as File[]
    const caseId = (formData.get("caseId") as string) || "unknown"

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    console.log(`Processing ${files.length} files for case ${caseId}`)

    const { text: analysisResults } = await generateText({
      model: openai("gpt-4o"),
      prompt: `
        You are an AI assistant specialized in analyzing cold case files. 
        Analyze the following case information and identify potential suspects, 
        patterns, and connections that might have been overlooked.
        
        Case ID: ${caseId}
        Number of documents: ${files.length}
        Document types: ${files.map((f) => f.type).join(", ")}

        Generate a detailed analysis that includes:
        1. Potential suspects that might have been overlooked
        2. Key findings and patterns
        3. Possible connections to other cases
        4. Recommended next steps for investigators

        Format the response as JSON with the following structure:
        {
          "suspects": [
            { "id": "POI-001", "name": "Example Name", "relevance": 85, "notes": "Reason for suspicion" }
          ],
          "findings": [
            { "id": "KF-001", "title": "Finding Title", "description": "Details", "priority": "High/Medium/Low" }
          ],
          "connections": [
            { "caseId": "CS-XXXX-XXX", "description": "Connection details", "confidence": 75 }
          ],
          "recommendations": [
            "Recommendation 1", "Recommendation 2"
          ]
        }

        Only return valid JSON. Do not include commentary or explanation outside the JSON.
      `,
    })

    // Parse the AI-generated analysis
    let parsedResults
    try {
      parsedResults = JSON.parse(analysisResults)
    } catch (e) {
      console.error("❌ Failed to parse AI results:\n", analysisResults)
      parsedResults = {
        error: "Failed to parse analysis results",
        rawResults: analysisResults,
      }
    }

    return NextResponse.json({
      success: true,
      caseId,
      filesProcessed: files.length,
      analysisResults: parsedResults,
    })
  } catch (error) {
    console.error("Error processing analysis:", error)
    return NextResponse.json({ error: "Failed to process analysis" }, { status: 500 })
  }
}
