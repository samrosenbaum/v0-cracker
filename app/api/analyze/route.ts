import { type NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from '@ai-sdk/anthropic';

// Add this right after the imports, before the Claude call:
console.log("🔍 Environment check:");
console.log("- NODE_ENV:", process.env.NODE_ENV);
console.log("- ANTHROPIC_API_KEY exists:", !!process.env.ANTHROPIC_API_KEY);
console.log("- ANTHROPIC_API_KEY length:", process.env.ANTHROPIC_API_KEY?.length || 0);
console.log("- ANTHROPIC_API_KEY starts with sk-ant:", process.env.ANTHROPIC_API_KEY?.startsWith('sk-ant-') || false);

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'text/plain',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export async function POST(req: NextRequest) {
  console.log("🚀 API route hit - starting analysis");
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const caseId = (formData.get("caseId") as string) || "unknown";
    console.log(`✅ Found ${files.length} files, caseId: ${caseId}`);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    // Validate files
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ 
          error: `File ${file.name} exceeds maximum size of ${MAX_FILE_SIZE / 1024 / 1024}MB` 
        }, { status: 400 });
      }
      
      if (!ALLOWED_FILE_TYPES.includes(file.type)) {
        return NextResponse.json({ 
          error: `File type ${file.type} not allowed for file ${file.name}` 
        }, { status: 400 });
      }
    }

    const extractedTexts = [];
    for (const file of files) {
      console.log(`🔍 Processing file: ${file.name}, type: ${file.type}`);
      try {
        let text = "";
        if (file.type === 'application/pdf') {
          console.log(`📄 Processing PDF file: ${file.name}`);
          const pdfParse = (await import('pdf-parse')).default; // Ensure .default is used
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const pdfData = await pdfParse(buffer); // Pass the buffer directly
          text = pdfData.text || `[PDF FILE: ${file.name} - No text content found]`;
          console.log(`📄 PDF text extracted, length: ${text.length}`);
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          console.log(`📄 Processing DOCX file: ${file.name}`);
          const mammoth = await import('mammoth');
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const result = await mammoth.extractRawText({ buffer });
          text = result.value || `[DOCX FILE: ${file.name} - No text content found]`;
          console.log(`📄 Extracted ${text.length} characters from DOCX: ${file.name}`);
        } else {
          console.log(`📄 Processing text file: ${file.name}`);
          text = await file.text();
          console.log(`📄 Extracted ${text.length} characters from text file: ${file.name}`);
        }
        extractedTexts.push({ name: file.name, text, type: file.type });
      } catch (error) {
        console.error(`❌ Error extracting text from ${file.name}:`, error);
        extractedTexts.push({
          name: file.name,
          text: `[ERROR: Could not extract text from ${file.name}]`,
          type: file.type,
        });
      }
    }
    console.log("✅ Text extraction completed");

    const combinedText = extractedTexts
      .map(f => `--- ${f.name} (${f.type}) ---\n${f.text}`)
      .join("\n\n");
    console.log(`📝 Combined text length: ${combinedText.length}`);

    const systemPrompt = `
        You are Detective Sarah Chen, a veteran cold case investigator with 25+ years of experience solving complex homicides and missing persons cases. You have personally solved over 150 cold cases using advanced analytical techniques.

        CRITICAL ANALYSIS PRIORITIES (in order of importance):
        1. TIMELINE INCONSISTENCIES - Look for gaps, conflicts, impossible sequences
        2. WITNESS CONTRADICTIONS - Compare all statements for inconsistencies  
        3. EVIDENCE CHAIN GAPS - Identify missing or unanalyzed evidence
        4. SUSPECT BEHAVIORAL PATTERNS - Profile potential perpetrators
        5. MOTIVE-MEANS-OPPORTUNITY ANALYSIS - Classic investigative triad
        6. OVERLOOKED CONNECTIONS - People, places, events investigators may have missed

        ANALYSIS METHODOLOGY:
        - Apply the Reid Technique for statement analysis
        - Use the FBI's Behavioral Analysis Unit profiling methods
        - Follow NCAVC (National Center for Analysis of Violent Crime) protocols
        - Cross-reference against VICAP pattern indicators

        For EVERY finding you identify, you MUST provide:
        - Confidence Score (0-100): How certain are you this is significant?
        - Evidence Strength (0-100): How strong is the supporting evidence?
        - Urgency Level: CRITICAL/HIGH/MEDIUM/LOW
        - Specific Action Required: Exactly what should investigators do next?
        - Risk Assessment: Could this lead to case breakthrough?

        SUSPECT IDENTIFICATION CRITERIA:
        - Access to victim (geographic/temporal proximity)
        - Means to commit the crime (physical capability, tools, knowledge)
        - Motive (personal, financial, psychological)
        - Opportunity window analysis
        - Behavioral indicators from crime scene
        - Connection patterns to victim or location

        TIMELINE ANALYSIS - Flag these RED FLAGS:
        - Gaps longer than 30 minutes during critical periods
        - Witness statements that contradict phone/digital records
        - Alibis that cannot be independently verified
        - Movement patterns that don't make logical sense
        - Multiple witnesses placing same person in different locations

        STATEMENT ANALYSIS - Look for DECEPTION INDICATORS:
        - Inconsistent details between multiple interviews
        - Overly specific details about irrelevant information
        - Missing details about critical time periods
        - Emotional responses that don't match content
        - Changes in linguistic patterns during critical topics

        Case Information:
        - Case ID: ${caseId}
        - Documents Analyzed: ${extractedTexts.length}
        - Analysis Date: ${new Date().toISOString()}

        CASE MATERIALS TO ANALYZE:
        ${combinedText}

        RETURN ONLY VALID JSON in this EXACT format:

        {
          "suspects": [
            {
              "name": "Full name of suspect",
              "relevance": 85,
              "confidence": 92,
              "evidenceStrength": 78,
              "connections": ["Connection 1", "Connection 2"],
              "motiveScore": 80,
              "meansScore": 90,
              "opportunityScore": 85,
              "notes": "Detailed explanation of why this person is a suspect",
              "recommendedActions": ["Specific action 1", "Specific action 2"],
              "urgencyLevel": "HIGH",
              "riskFactors": ["Risk factor 1", "Risk factor 2"]
            }
          ],
          "findings": [
            {
              "id": "FINDING-001",
              "title": "Specific finding title",
              "description": "Detailed description of what was found",
              "category": "timeline",
              "confidence": 88,
              "evidenceStrength": 82,
              "priority": "CRITICAL",
              "supportingEvidence": ["Evidence item 1", "Evidence item 2"],
              "investigativeAction": "Specific action investigators should take",
              "potentialImpact": "How this could affect the case",
              "urgencyLevel": "HIGH"
            }
          ],
          "connections": [
            {
              "type": "case",
              "description": "Description of the connection",
              "confidence": 75,
              "relatedCases": ["Case ID if applicable"],
              "significance": "Why this connection matters",
              "recommendedAction": "What to do about this connection"
            }
          ],
          "recommendations": [
            {
              "priority": "CRITICAL",
              "action": "Specific action to take",
              "rationale": "Why this action is recommended",
              "expectedOutcome": "What this might reveal",
              "resources": "What resources are needed",
              "timeline": "How quickly this should be done",
              "riskLevel": "HIGH"
            }
          ]
        }`;
    console.log("🤖 Starting Claude analysis..."); // Add this log
    // Explicitly pass the API key
    const anthropicClient = anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    console.log("🔑 API Key configured for Anthropic client:", !!process.env.ANTHROPIC_API_KEY); // Log if key was present during init

    const { text: aiResponse } = await generateText({
      model: anthropicClient("claude-3-5-sonnet-20241022"),
      prompt: systemPrompt,
      maxTokens: 4000, // Add token limit to prevent excessive responses
    });
    console.log("✅ Claude analysis completed");

    let parsedResults;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
      parsedResults = JSON.parse(jsonString);
      console.log("✅ Successfully parsed Claude response");
    } catch (e) {
      console.error("❌ JSON parse error:", e);
      console.error("🔍 Raw Claude response:\n", aiResponse); // Note the escaped 'n' for newline

      parsedResults = {
        error: "Failed to parse Claude response as valid JSON",
        raw: aiResponse,
        suspects: [],
        findings: [],
        connections: [],
        recommendations: []
      };
    }

    return NextResponse.json({
      success: true,
      caseId, // Assuming caseId is available in scope
      filesAnalyzed: extractedTexts.map(f => ({ 
        name: f.name, 
        type: f.type, 
        size: f.text.length, // Use the actual length of the extracted text
        preview: f.text.substring(0, 200) // Provide a preview of the text
      })),
      analysis: parsedResults, // Assuming parsedResults contains Claude's analysis
      aiModel: "claude-3-5-sonnet-20241022" // Hardcode or dynamically set the model used
    });

  } catch (error) {
    console.error("🚨 Unexpected error in analysis route:", error);
    
    // Provide more specific error information
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error occurred",
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : 'No stack') : undefined
    }, { status: 500 });
  }
}