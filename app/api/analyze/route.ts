<<<<<<< HEAD
import { type NextRequest, NextResponse } from "next/server"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

export async function POST(req: NextRequest) {
  try {
    // In a real application, you would process uploaded files here
    // For this example, we'll simulate the analysis with sample data

    // Extract case details from the request
    const formData = await req.formData()
    const files = formData.getAll("files") as File[]
    const caseId = (formData.get("caseId") as string) || "unknown"

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 })
    }

    // Log the files being processed
    console.log(`Processing ${files.length} files for case ${caseId}`)

    // In a real application, you would:
    // 1. Store the files in a secure location
    // 2. Extract text from the files (OCR for images, text extraction for PDFs)
    // 3. Process the text with AI models

    // Simulate AI analysis with the AI SDK
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
      `,
    })

    // Parse the AI-generated analysis
    // In a real application, you would validate and process this data
    let parsedResults
    try {
      parsedResults = JSON.parse(analysisResults)
    } catch (e) {
      console.error("Failed to parse AI results:", e)
      parsedResults = {
        error: "Failed to parse analysis results",
        rawResults: analysisResults,
      }
    }

    // Return the analysis results
    return NextResponse.json({
      success: true,
      caseId,
      filesProcessed: files.length,
      analysisResults: parsedResults,
    })
  } catch (error) {
    console.error("Error processing analysis:", error)
    return NextResponse.json({ error: "Failed to process analysis" }, { status: 500 })
=======
import { type NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const caseId = (formData.get("caseId") as string) || "unknown";

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const extractedTexts = await Promise.all(
      files.map(async (file) => ({
        name: file.name,
        text: await file.text(),
        type: file.type
      }))
    );

    const combinedText = extractedTexts
      .map(f => `--- ${f.name} (${f.type}) ---\n${f.text}`)
      .join("\n\n");

    const systemPrompt = `
You are a cold case investigation assistant trained in methodologies from the FBI, DOJ, and professional behavioral analysts. You apply structured logic and investigative best practices to analyze unresolved cases.

You use the following frameworks:

--- COLD CASE CHECKLIST REVIEW ---
- Verify original reports and forensic documentation
- Confirm physical evidence and supporting materials
- Identify missing or untested evidence
- Assess motive, staging, and suspect behavior

--- CRIME SCENE BEST PRACTICES ---
- Evaluate scene handling, documentation, chain of custody
- Detect missing diagrams, photos, or logs
- Identify collection gaps or inconsistencies

--- CRIME PROFILING FRAMEWORK ---
C – Crime Scene Evaluation  
R – Relevance of Research  
I – Investigative Opinion  
M – Methods of Investigation  
E – Evaluation of Findings

--- ANALYSIS CONTEXT ---
Case ID: ${caseId}  
Number of Documents: ${extractedTexts.length}  
Document Types: ${extractedTexts.map(f => f.type).join(", ")}

--- DOCUMENT CONTENT ---
${combinedText}

--- RETURN FORMAT ---
Respond with structured JSON like the following format:

{
  "suspects": [...],
  "findings": [...],
  "connections": [...],
  "recommendations": [...],

  "entities": [
    { "id": "E001", "type": "person", "name": "Jane Smith", "role": "witness", "linkedTo": ["CASE-1", "EV001"] },
    { "id": "E002", "type": "location", "name": "Lake Berryessa", "linkedTo": ["EV001"] }
  ],
  "events": [
    { "id": "EV001", "title": "Stabbing at Lake Berryessa", "date": "1969-09-27", "participants": ["E002", "E003", "E004"], "notes": "Zodiac wore hood, wrote on victim’s car" }
  ],
  "links": [
    { "source": "E003", "target": "EV001", "type": "victim" },
    { "source": "E004", "target": "EV001", "type": "suspect" },
    { "source": "E005", "target": "E003", "type": "alibi_conflict" }
  ]
}

Be objective, factual, and structured. If any required information is missing, leave the array empty or clearly explain the omission.
`;

    const { text: aiResponse } = await generateText({
      model: openai("gpt-4o"),
      prompt: systemPrompt
    });

    let parsedResults;
    try {
      parsedResults = JSON.parse(aiResponse);
    } catch (e) {
      parsedResults = {
        error: "Failed to parse AI response. Here's the raw output:",
        raw: aiResponse
      };
    }

    return NextResponse.json({
      success: true,
      caseId,
      filesAnalyzed: extractedTexts.map(f => f.name),
      analysis: parsedResults
    });

  } catch (error) {
    console.error("Analysis error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
>>>>>>> 526dca4 (Add AI graph structure output (entities, events, links))
  }
}
