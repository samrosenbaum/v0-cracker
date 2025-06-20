import { type NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { QualityControlAnalyzer } from '../../lib/qualityControl';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log("🚀 API route hit - PDF analysis with quality control");
  
  // Extract access token from Authorization header
  const authHeader = req.headers.get("authorization");
  console.log("Auth header:", {
    present: !!authHeader,
    value: authHeader ? `${authHeader.substring(0, 20)}...` : null
  });
  
  const token = authHeader?.replace("Bearer ", "");
  console.log("Token:", {
    present: !!token,
    length: token?.length
  });

  // Initialize Supabase client with user context
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );

  try {
    // Verify user authentication
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log("User verification:", {
      hasUser: !!user,
      userError,
      userId: user?.id
    });

    if (!user) {
      console.error("Authentication failed:", userError);
      return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ 
        error: "AI service not configured" 
      }, { status: 500 });
    }

    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const caseId = (formData.get("caseId") as string) || "unknown";
    const isBulkAnalysis = formData.get("bulkAnalysis") === "true";
    
    // Fetch the case-specific AI prompt
    let aiPrompt = "";
    if (caseId && caseId !== "unknown") {
      const { data: caseData, error: caseError } = await supabase
        .from('cases')
        .select('ai_prompt')
        .eq('id', caseId)
        .single();
      if (!caseError && caseData?.ai_prompt) {
        aiPrompt = caseData.ai_prompt;
      }
    }

    // If this is a bulk analysis, fetch all existing files for this case
    let allFiles = [...files];
    if (isBulkAnalysis && caseId !== "unknown") {
      const folderPath = `${user.id}/${caseId}`;
      const { data: existingFiles, error: listError } = await supabase.storage
        .from('case-files')
        .list(folderPath);

      if (!listError && existingFiles) {
        // Download and process each existing file
        for (const file of existingFiles) {
          const { data: urlData } = await supabase.storage
            .from('case-files')
            .createSignedUrl(`${folderPath}/${file.name}`, 60);

          if (urlData?.signedUrl) {
            const fileRes = await fetch(urlData.signedUrl);
            const blob = await fileRes.blob();
            const existingFile = new File([blob], file.name, { type: blob.type });
            allFiles.push(existingFile);
          }
        }
      }
    }
    
    console.log(`✅ Found ${allFiles.length} files to analyze`);

    if (allFiles.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const extractedTexts = [];
    
    for (const file of allFiles) {
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
        
      } catch (error) {
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

      // Keep your sophisticated forensic analysis prompt
      const systemPrompt = `COLD CASE ANALYSIS SYSTEM

You are an expert forensic analyst using advanced investigative methodologies. Analyze police files to identify overlooked clues, patterns, connections, and viable investigative leads in cold cases.

ANALYSIS FRAMEWORK:

PRIMARY METHODOLOGIES:
- Reid Technique: Statement analysis for deception detection
- FBI Behavioral Analysis Unit: Offender profiling and behavioral indicators
- NCAVC Protocols: Violent crime analysis standards
- VICAP Integration: Pattern recognition across cases
- Locard's Exchange Principle: Physical evidence transfer analysis
- Geographic Profiling: Spatial relationship analysis

SUSPECT ANALYSIS CRITERIA:
OPPORTUNITY TRIAD:
1. Access: Geographic/temporal proximity to victim
2. Means: Physical capability, tools, specialized knowledge
3. Motive: Personal grievance, financial gain, psychological factors

BEHAVIORAL INDICATORS:
- Crime scene organization level (organized/disorganized)
- Signature behaviors vs. MO elements
- Escalation patterns in behavior
- Post-offense behavior changes
- Digital footprint anomalies

CRITICAL RED FLAGS:
TIMELINE DISCREPANCIES:
- Critical Gap: Unaccounted periods >30 minutes during key timeframes
- Digital vs. Witness: Phone/GPS data contradicting statements
- Alibi Integrity: Unverifiable or circular alibi chains

DECEPTION INDICATORS:
- Consistency Failures: Details changing across interviews
- Information Asymmetry: Over-detailed irrelevant info, vague critical details
- Memory Gaps: Suspicious amnesia during crucial periods
- Emotional Incongruence: Inappropriate emotional responses

EVIDENCE ANOMALIES:
- Chain of Custody: Gaps or irregularities in evidence handling
- Testing Gaps: Collected evidence never analyzed
- Missing Items: Referenced but unlocated evidence

CRITICAL: You MUST respond with ONLY a valid JSON object. No explanations, no markdown formatting, no text before or after the JSON. Start your response with { and end with }.`;

      const userPrompt = aiPrompt?.trim() ? `${aiPrompt.trim()}\n\n` : "";

      console.log("System prompt length:", systemPrompt.length);
      console.log("User prompt:", userPrompt);

      const response = await client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 4000,
        temperature: 0.1,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: `${userPrompt}

MISSION: Analyze these police files using forensic methodology to identify overlooked clues, patterns, connections, and viable investigative leads.

REQUIRED METRICS (For Every Finding):
- confidenceScore: 0-100
- evidenceStrength: 0-100
- urgencyLevel: CRITICAL/HIGH/MEDIUM/LOW
- specificAction: Detailed investigative step
- investigativePriority: 1-10

ANALYSIS PRIORITIES:
1. CRITICAL: Life safety, active threat, statute limitations
2. HIGH: Strong evidence potential, key witness availability
3. MEDIUM: Pattern confirmation, secondary evidence
4. LOW: Background information, administrative tasks

Execute comprehensive analysis following forensic framework. Identify every potential lead that could advance the investigation.

Case ID: ${caseId}
Documents: ${extractedTexts.length}
${truncated ? 'NOTE: Case materials were truncated due to length.\n' : ''}

CASE MATERIALS:
${truncatedText}

RESPOND WITH ONLY THIS JSON STRUCTURE:
{
  "caseAssessment": {
    "overallRisk": "CRITICAL|HIGH|MEDIUM|LOW",
    "breakthroughPotential": 0-100,
    "investigativePriority": 1-10
  },
  "suspects": [
    {
      "id": "S001",
      "name": "Name",
      "urgencyLevel": "CRITICAL|HIGH|MEDIUM|LOW", 
      "connections": ["connection1"],
      "redFlags": ["flag1"],
      "recommendedActions": ["action1"],
      "notes": "notes",
      "confidence": 0-100
    }
  ],
  "findings": [
    {
      "id": "F001",
      "title": "Finding title", 
      "description": "Description",
      "category": "suspect|evidence|timeline|statement|pattern",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW",
      "confidenceScore": 0-100,
      "evidenceStrength": 0-100,
      "supportingEvidence": ["evidence1"],
      "actionRequired": "action",
      "timeline": "IMMEDIATE|1-WEEK|1-MONTH|LONG-TERM"
    }
  ],
  "connections": [
    {
      "id": "C001",
      "type": "type",
      "entities": ["entity1", "entity2"],
      "description": "description",
      "significance": "significance", 
      "confidence": 0-100
    }
  ],
  "overlookedLeads": [
    {
      "type": "suspect|evidence|timeline|statement|digital|financial",
      "description": "description",
      "recommendedAction": "action",
      "rationale": "rationale",
      "urgency": "CRITICAL|HIGH|MEDIUM|LOW",
      "resources": "resources needed"
    }
  ],
  "recommendations": [
    {
      "action": "action",
      "priority": "CRITICAL|HIGH|MEDIUM|LOW", 
      "timeline": "timeline",
      "rationale": "rationale",
      "resources": "resources"
    }
  ]
}`
        }]
      });

      const aiResponse = response.content[0]?.type === 'text' ? response.content[0].text : '';
      console.log(`✅ Claude responded: ${aiResponse.length} chars`);
      console.log('Raw AI response (first 500 chars):', aiResponse.substring(0, 500));
      
      // Parse AI response
      let parsedResults;
      try {
        // Clean the response - remove any markdown formatting or extra text
        let cleanedResponse = aiResponse.trim();
        
        // Remove markdown code blocks if present
        if (cleanedResponse.startsWith('```json')) {
          cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanedResponse.startsWith('```')) {
          cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Find JSON object boundaries more carefully
        const firstBrace = cleanedResponse.indexOf('{');
        const lastBrace = cleanedResponse.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
          throw new Error('No complete JSON object found in response');
        }
        
        const jsonString = cleanedResponse.substring(firstBrace, lastBrace + 1);
        console.log('Extracted JSON string (first 200 chars):', jsonString.substring(0, 200));

        parsedResults = JSON.parse(jsonString);

        // Validate and ensure all required fields exist with defaults
        parsedResults = {
          caseAssessment: parsedResults.caseAssessment || {
            overallRisk: "MEDIUM",
            breakthroughPotential: 50,
            investigativePriority: 5
          },
          suspects: Array.isArray(parsedResults.suspects) ? parsedResults.suspects : [],
          findings: Array.isArray(parsedResults.findings) ? parsedResults.findings : [],
          connections: Array.isArray(parsedResults.connections) ? parsedResults.connections : [],
          recommendations: Array.isArray(parsedResults.recommendations) ? parsedResults.recommendations : [],
          overlookedLeads: Array.isArray(parsedResults.overlookedLeads) ? parsedResults.overlookedLeads : []
        };

        console.log("✅ Successfully parsed AI response");
        console.log("Parsed structure:", {
          suspects: parsedResults.suspects.length,
          findings: parsedResults.findings.length,
          connections: parsedResults.connections.length,
          recommendations: parsedResults.recommendations.length,
          overlookedLeads: parsedResults.overlookedLeads.length
        });
        
      } catch (parseError) {
        console.error("❌ Parse error:", parseError);
        console.error("Failed to parse response (first 1000 chars):", aiResponse.substring(0, 1000));
        
        return NextResponse.json({
          success: false,
          error: "Failed to parse AI response",
          details: parseError instanceof Error ? parseError.message : "Unknown parsing error",
          debug: {
            responseLength: aiResponse.length,
            responsePreview: aiResponse.substring(0, 500),
            firstBraceIndex: aiResponse.indexOf('{'),
            lastBraceIndex: aiResponse.lastIndexOf('}'),
            containsJson: aiResponse.includes('{') && aiResponse.includes('}'),
            startsWithMarkdown: aiResponse.trim().startsWith('```')
          }
        }, { status: 500 });
      }

      // After successful AI analysis and parsing
      try {
        // Calculate overall confidence score
        const confidenceScores = [
          ...parsedResults.findings?.map((f: any) => f.confidenceScore || 0) || [],
          ...parsedResults.suspects?.map((s: any) => s.confidence || 0) || [],
          ...parsedResults.connections?.map((c: any) => c.confidence || 0) || []
        ];
        
        const overallConfidence = confidenceScores.length > 0 
          ? Math.round(confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length)
          : 50;

        // Store analysis results
        const { data: analysisData, error: analysisError } = await supabase
          .from('case_analysis')
          .insert([{
            case_id: caseId,
            analysis_type: isBulkAnalysis ? 'bulk_analysis' : 'ai_analysis',
            analysis_data: parsedResults,
            confidence_score: overallConfidence,
            user_id: user.id,
            used_prompt: userPrompt
          }])
          .select()
          .single();

        if (analysisError) {
          console.error("Error storing analysis:", analysisError);
          return NextResponse.json({ 
            error: "Failed to store analysis results",
            details: analysisError.message 
          }, { status: 500 });
        }

        // 🆕 Run Quality Control Analysis
        console.log("🔍 Running quality control analysis...");
        const qualityFlags = QualityControlAnalyzer.analyzeResults(
          parsedResults, 
          analysisData.id, 
          caseId
        );

        // Store quality flags if any were generated
        let flagsStored = false;
        if (qualityFlags.length > 0) {
          flagsStored = await QualityControlAnalyzer.storeQualityFlags(qualityFlags, supabase);
          if (flagsStored) {
            console.log(`✅ Generated and stored ${qualityFlags.length} quality flags`);
          } else {
            console.error("❌ Failed to store quality flags");
          }
        } else {
          console.log("✅ No quality issues detected");
        }

        // Generate quality summary for response
        const qualitySummary = QualityControlAnalyzer.getQualitySummary(qualityFlags);

        return NextResponse.json({
          success: true,
          caseId,
          analysis: parsedResults,
          analysisId: analysisData?.id,
          quality: {
            ...qualitySummary,
            flagsStored,
            flags: qualityFlags // Include flags for immediate display
          },
          filesAnalyzed: extractedTexts.map(f => ({
            name: f.name,
            type: f.type,
            textLength: f.text.length,
            preview: f.text.substring(0, 200) + (f.text.length > 200 ? "..." : "")
          })),
          aiModel: "claude-3-haiku-20240307",
          processingTime: new Date().toISOString(),
          confidenceScore: overallConfidence
        });

      } catch (storageError) {
        console.error("🚨 Storage Error:", storageError);
        return NextResponse.json({ 
          error: "Failed to store analysis results",
          details: storageError instanceof Error ? storageError.message : "Unknown error"
        }, { status: 500 });
      }

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
}