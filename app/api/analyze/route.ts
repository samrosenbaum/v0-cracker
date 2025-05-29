import { type NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  console.log("🚀 API route hit - PDF analysis with pdfjs-dist");
  
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ 
        error: "AI service not configured" 
      }, { status: 500 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const caseId = (formData.get("caseId") as string) || "unknown";
    
    console.log(`✅ Found ${files.length} files`);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const extractedTexts = [];
    
    for (const file of files) {
      console.log(`🔍 Processing file: ${file.name}, type: ${file.type}`);
      let text = "";
      
      try {
        if (file.type === 'application/pdf') {
          console.log("📄 Processing PDF with pdf2json...");
          
          try {
            // Import pdf2json
            const PDFParser = (await import('pdf2json')).default;
            const pdfParser = new PDFParser();
            
            // Get PDF data
            const arrayBuffer = await file.arrayBuffer();
            const pdfData = Buffer.from(arrayBuffer);
            
            console.log(`📄 PDF buffer size: ${pdfData.length} bytes`);
            
            // Parse PDF
            const pdfText = await new Promise<string>((resolve, reject) => {
              pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
                try {
                  const text = decodeURIComponent(
                    pdfData.Pages
                      .map((page: any) => 
                        page.Texts
                          .map((text: any) => 
                            text.R
                              .map((r: any) => r.T)
                              .join(' ')
                          )
                          .join(' ')
                      )
                      .join(' ')
                  );
                  resolve(text);
                } catch (err) {
                  reject(err);
                }
              });
              
              pdfParser.on('pdfParser_dataError', (errData: any) => {
                reject(new Error(`PDF parsing error: ${errData.parserError}`));
              });
              
              pdfParser.parseBuffer(pdfData);
            });
            
            text = pdfText.trim();
            console.log(`📄 Total extracted text length: ${text.length}`);
            console.log(`📄 First 200 chars: "${text.substring(0, 200)}"`);
            
            if (!text || text.length < 10) {
              text = `[PDF FILE: ${file.name} - PDF processed but no readable text found]`;
            }
            
          } catch (pdfError: unknown) {
            console.error(`❌ PDF processing error:`, pdfError);
            const errorMessage = pdfError instanceof Error ? pdfError.message : 'Unknown PDF processing error';
            text = `[PDF FILE: ${file.name} - PDF processing failed: ${errorMessage}]`;
          }
          
        } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
          console.log("📝 Processing DOCX...");
          try {
            const mammoth = await import('mammoth');
            const arrayBuffer = await file.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const result = await mammoth.extractRawText({ buffer });
            text = result.value?.trim() || `[DOCX FILE: ${file.name} - No text found]`;
            console.log(`📝 DOCX text length: ${text.length}`);
          } catch (docxError: unknown) {
            console.error(`❌ DOCX error:`, docxError);
            const errorMessage = docxError instanceof Error ? docxError.message : 'Unknown DOCX processing error';
            text = `[DOCX FILE: ${file.name} - Processing failed: ${errorMessage}]`;
          }
          
        } else {
          console.log("📝 Processing text file...");
          text = await file.text();
          console.log(`📝 Text file length: ${text.length}`);
        }
        
        extractedTexts.push({
          name: file.name,
          text: text,
          type: file.type
        });
        
      } catch (error: unknown) {
        console.error(`❌ Error processing ${file.name}:`, error);
        extractedTexts.push({
          name: file.name,
          text: `[ERROR: Could not process ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}]`,
          type: file.type
        });
      }
    }

    const combinedText = extractedTexts
      .map(f => `--- ${f.name} ---\n${f.text}`)
      .join("\n\n");

    console.log(`📝 Combined text length: ${combinedText.length}`);
    console.log(`📝 Combined preview: "${combinedText.substring(0, 300)}"`);

    // Check if we have meaningful text (excluding error messages)
    const meaningfulText = combinedText.replace(/\[.*?FILE:.*?\]/g, '').trim();
    if (meaningfulText.length < 20) {
      return NextResponse.json({
        success: false,
        error: "No readable text content found",
        debug: {
          extractedTexts: extractedTexts.map(f => ({
            name: f.name,
            textLength: f.text.length,
            preview: f.text.substring(0, 200)
          })),
          combinedLength: combinedText.length,
          meaningfulLength: meaningfulText.length
        }
      }, { status: 400 });
    }

    console.log("🤖 Starting Claude analysis...");
    
    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      let truncatedText = combinedText;
      let truncated = false;
      const MAX_CHARS = 64000;
      if (combinedText.length > MAX_CHARS) {
        truncatedText = combinedText.substring(0, MAX_CHARS);
        truncated = true;
        console.warn(`⚠️ Combined text truncated from ${combinedText.length} to ${MAX_CHARS} characters.`);
      }

      const response = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{
          role: 'user',
          content: `
Respond with ONLY valid JSON. Do not include any explanation, markdown, or extra text.

You may be given: DNA reports, interview transcripts, detective notes, timelines, autopsy reports, lab results, and other case materials. Consider all sources for overlooked clues, patterns, or inconsistencies.

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

Identify any patterns across the materials (e.g., repeated names, locations, or behaviors) and flag any discrepancies in statements, timelines, or evidence. Highlight when a suspect has changed their story or when a timeline does not make sense.

Cross-reference all materials. If a suspect is mentioned in multiple documents, or if evidence is referenced but not tested, flag this for review.

Additionally, include a section "overlookedLeads" with an array of objects, each describing a clue, suspect, or piece of evidence that may have been missed or deserves re-examination. For each, provide:
- type: (e.g., suspect, evidence, timeline, statement)
- description: What was overlooked or should be revisited
- recommendedAction: What law enforcement should do next
- rationale: Why this is important

Case ID: ${caseId}
Documents: ${extractedTexts.length}
${truncated ? '\nNOTE: The case materials were truncated due to length.\n' : ''}
CASE MATERIALS:
${truncatedText}

The JSON should have this structure:
{
  "suspects": [
    {
      "name": "Person name",
      "relevance": 90,
      "confidence": 85,
      "connections": ["How they connect to case"],
      "notes": "Why they are suspicious",
      "recommendedActions": ["Specific investigative action"],
      "urgencyLevel": "HIGH"
    }
  ],
  "findings": [
    {
      "id": "F001", 
      "title": "Finding title",
      "description": "What was discovered",
      "category": "evidence",
      "confidence": 90,
      "priority": "CRITICAL",
      "supportingEvidence": ["Supporting evidence"],
      "investigativeAction": "Action to take"
    }
  ],
  "connections": [
    {
      "type": "person",
      "description": "Connection description", 
      "confidence": 80,
      "significance": "Why this matters"
    }
  ],
  "recommendations": [
    {
      "priority": "HIGH",
      "action": "Recommended action",
      "rationale": "Why recommended",
      "timeline": "When to complete"
    }
  ],
  "overlookedLeads": [
    {
      "type": "suspect|evidence|timeline|statement",
      "description": "What was overlooked or should be revisited",
      "recommendedAction": "What law enforcement should do next",
      "rationale": "Why this is important"
    }
  ]
}

IMPORTANT:
- Output ONLY the JSON object.
- DO NOT include any commentary, explanation, or markdown.
- Do NOT wrap the JSON in triple backticks or any markdown formatting.
- Ensure the JSON is valid and parsable. Do not leave trailing commas or use single quotes.
- If you cannot answer, return an empty JSON object with the correct structure.
`
        }]
      });

      const aiResponse = response.content[0]?.type === 'text' ? response.content[0].text : '';
      console.log(`✅ Claude responded: ${aiResponse.length} chars`);
      
      // Parse AI response
      let parsedResults;
      try {
        // Find the first JSON object in the response
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error('No JSON object found in response:', aiResponse);
          throw new Error('No JSON object found in response');
        }
        const jsonString = jsonMatch[0].trim();
        console.log('Attempting to parse JSON:', jsonString);

        parsedResults = JSON.parse(jsonString);

        // Ensure arrays exist and are valid
        parsedResults = {
          suspects: Array.isArray(parsedResults.suspects) ? parsedResults.suspects : [],
          findings: Array.isArray(parsedResults.findings) ? parsedResults.findings : [],
          connections: Array.isArray(parsedResults.connections) ? parsedResults.connections : [],
          recommendations: Array.isArray(parsedResults.recommendations) ? parsedResults.recommendations : [],
          overlookedLeads: Array.isArray(parsedResults.overlookedLeads) ? parsedResults.overlookedLeads : []
        };

        console.log("✅ Successfully parsed AI response:", JSON.stringify(parsedResults, null, 2));
      } catch (parseError) {
        console.error("❌ Parse error:", parseError);
        console.error("Failed to parse response:", aiResponse);
        return NextResponse.json({
          success: false,
          error: "Failed to parse AI response",
          details: parseError instanceof Error ? parseError.message : "Unknown parsing error",
          debug: {
            rawResponse: aiResponse
          }
        }, { status: 500 });
      }

      // After successful AI analysis and parsing
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
        }

        // Store analysis results in Supabase
        const { data: analysisData, error: analysisError } = await supabase
          .from('case_analysis')
          .insert([{
            case_id: caseId,
            analysis_type: 'ai_analysis',
            analysis_data: parsedResults,
            confidence_score: Math.max(
              ...parsedResults.findings.map((f: any) => f.confidence || 0),
              ...parsedResults.suspects.map((s: any) => s.confidence || 0),
              ...parsedResults.connections.map((c: any) => c.confidence || 0)
            ),
            user_id: user.id
          }])
          .select()
          .single();

        if (analysisError) {
          console.error("Error storing analysis:", analysisError);
          // Continue with the response even if storage fails
        }

        return NextResponse.json({
          success: true,
          caseId,
          analysis: parsedResults,
          analysisId: analysisData?.id,
          filesAnalyzed: extractedTexts.map(f => ({
            name: f.name,
            type: f.type,
            textLength: f.text.length,
            preview: f.text.substring(0, 200) + (f.text.length > 200 ? "..." : "")
          })),
          aiModel: "claude-3-haiku-20240307",
          processingTime: new Date().toISOString()
        });

      } catch (aiError) {
        console.error("🚨 AI Error:", aiError);
        return NextResponse.json({ 
          error: "AI analysis failed",
          details: aiError instanceof Error ? aiError.message : "Unknown error"
        }, { status: 500 });
      }

    } catch (error) {
      console.error("🚨 System Error:", error);
      return NextResponse.json({ 
        error: "System error",
        details: error instanceof Error ? error.message : "Unknown error"
      }, { status: 500 });
    }

  } catch (error) {
    console.error("🚨 System Error:", error);
    return NextResponse.json({ 
      error: "System error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}