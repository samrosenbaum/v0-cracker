import { type NextRequest, NextResponse } from "next/server";

export const runtime = 'nodejs';

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
    
    const systemPrompt = `You are Detective Sarah Chen, a veteran cold case investigator. Analyze the case materials and identify suspects, evidence, and leads.

Case ID: ${caseId}
Documents: ${extractedTexts.length}

CASE MATERIALS:
${combinedText}

Return valid JSON only:
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
  ]
}`;

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        temperature: 0.3,
        messages: [{ role: 'user', content: systemPrompt }]
      });

      const aiResponse = response.content[0]?.type === 'text' ? response.content[0].text : '';
      console.log(`✅ Claude responded: ${aiResponse.length} chars`);

      // Parse AI response
      let parsedResults;
      try {
        const cleanResponse = aiResponse.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
        const jsonString = jsonMatch ? jsonMatch[0] : cleanResponse;
        
        parsedResults = JSON.parse(jsonString);
        
        // Ensure arrays exist
        parsedResults.suspects = parsedResults.suspects || [];
        parsedResults.findings = parsedResults.findings || [];
        parsedResults.connections = parsedResults.connections || [];
        parsedResults.recommendations = parsedResults.recommendations || [];
        
        console.log("✅ Successfully parsed AI response");
        
      } catch (parseError) {
        console.error("❌ Parse error:", parseError);
        parsedResults = {
          error: "Could not parse AI response",
          suspects: [],
          findings: [{
            id: "PARSE_ERROR",
            title: "AI Response Parse Error",
            description: "AI analysis completed but response could not be parsed",
            category: "system",
            confidence: 0,
            priority: "LOW",
            supportingEvidence: ["Raw AI response available"],
            investigativeAction: "Manual review required"
          }],
          connections: [],
          recommendations: []
        };
      }

      return NextResponse.json({
        success: true,
        caseId,
        analysis: parsedResults,
        filesAnalyzed: extractedTexts.map(f => ({
          name: f.name,
          type: f.type,
          textLength: f.text.length,
          preview: f.text.substring(0, 200) + (f.text.length > 200 ? "..." : "")
        })),
        aiModel: "claude-3-5-sonnet-20241022",
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
}