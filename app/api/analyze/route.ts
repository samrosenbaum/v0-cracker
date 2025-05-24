import { type NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

// Configuration
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  'text/plain',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const caseId = (formData.get("caseId") as string) || "unknown";

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
- File Types: ${extractedTexts.map(f => f.type).join(", ")}
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
      "category": "timeline|witness|evidence|behavioral|connection",
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
      "type": "case|person|location|method|timeline",
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
      "riskLevel": "HIGH|MEDIUM|LOW"
    }
  ],
  "timelineAnalysis": {
    "criticalGaps": [
      {
        "startTime": "Time gap starts",
        "endTime": "Time gap ends", 
        "duration": "Length of gap",
        "significance": "Why this gap matters",
        "peopleInvolved": ["Person 1", "Person 2"],
        "recommendedAction": "How to investigate this gap"
      }
    ],
    "contradictions": [
      {
        "description": "What contradicts what",
        "sources": ["Source 1", "Source 2"],
        "significance": "Impact on case",
        "resolution": "How to resolve this contradiction"
      }
    ]
  },
  "statementAnalysis": {
    "credibilityScores": [
      {
        "person": "Person name",
        "credibilityScore": 65,
        "redFlags": ["Red flag 1", "Red flag 2"],
        "recommendation": "How to handle this person's statements"
      }
    ],
    "inconsistencies": [
      {
        "person": "Person with inconsistent statements",
        "inconsistency": "Description of inconsistency",
        "impact": "How this affects the investigation"
      }
    ]
  }
}`;

    const { text: aiResponse } = await generateText({
      model: openai("gpt-4o"),
      prompt: systemPrompt,
      maxTokens: 4000, // Add token limit to prevent excessive responses
    });

    let parsedResults;
    try {
      // Clean response in case there's extra text before/after JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
      parsedResults = JSON.parse(jsonString);
    } catch (e) {
      console.error("❌ JSON parse error:", e);
      console.error("🔍 Raw AI response:\n", aiResponse);

      // Return a structured error response
      parsedResults = {
        error: "Failed to parse AI response as valid JSON",
        raw: aiResponse,
        suspects: [],
        findings: [],
        connections: [],
        recommendations: [],
        timelineAnalysis: { criticalGaps: [], contradictions: [] },
        statementAnalysis: { credibilityScores: [], inconsistencies: [] }
      };
    }

    return NextResponse.json({
      success: true,
      caseId,
      filesAnalyzed: extractedTexts.map(f => ({ name: f.name, type: f.type, size: f.text.length })),
      analysis: parsedResults
    });

  } catch (error) {
    console.error("🚨 Unexpected error in analysis route:", error);
    
    // Provide more specific error information
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    
    return NextResponse.json({ 
      error: "Internal server error",
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 });
  }
}