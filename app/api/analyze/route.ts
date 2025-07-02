import { type NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js';
import { QualityControlAnalyzer } from '../../lib/qualityControl';
import { AdvancedDocumentParser } from '../../lib/advancedParser';
import { generateEnhancedAnalysisPrompt, generateSimpleAnalysisPrompt, ENHANCED_JSON_STRUCTURE, SIMPLE_JSON_STRUCTURE } from '../../lib/enhancedAnalysisPrompt';


export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  console.log("🚀 API route hit - PDF analysis with enhanced quality control");
  
  // Extract access token from Authorization header
  const authHeader = req.headers.get("authorization");
  console.log("Auth header:", {
    present: !!authHeader,
    value: authHeader ? `${authHeader.substring(0, 20)}...` : null
  });
  
  const token = authHeader?.replace("Bearer ", "")
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

    // Enhanced document processing with debugging
    const extractedTexts = [];
    const parsedDocuments = [];
    let advancedParsingSuccessCount = 0;
    let advancedParsingFailureCount = 0;

    for (const file of allFiles) {
      console.log(`🔍 Processing file: ${file.name}, type: ${file.type}`);
      
      try {
        // Use your advanced parsing for better entity extraction
        console.log(`📄 Attempting advanced parsing: ${file.name}`);
        
        // Debug: Check if AdvancedDocumentParser is properly imported
        console.log("AdvancedDocumentParser available:", typeof AdvancedDocumentParser);
        console.log("parseDocument method available:", typeof AdvancedDocumentParser.parseDocument);
        
        const parsedDoc = await AdvancedDocumentParser.parseDocument(file);
        
        // Debug: Log the parsed document structure
        console.log(`📊 Advanced parsing SUCCESS for ${file.name}:`, {
          id: parsedDoc.id,
          type: parsedDoc.type,
          qualityScore: parsedDoc.qualityScore,
          entitiesCount: parsedDoc.entities?.length || 0,
          contentKeys: Object.keys(parsedDoc.content || {}),
          peopleCount: parsedDoc.content?.people?.length || 0,
          locationsCount: parsedDoc.content?.locations?.length || 0,
          datesCount: parsedDoc.content?.dates?.length || 0,
          vehiclesCount: parsedDoc.content?.vehicles?.length || 0,
          communicationsCount: parsedDoc.content?.communications?.length || 0,
          evidenceCount: parsedDoc.content?.evidence?.length || 0
        });
        
        parsedDocuments.push(parsedDoc);
        advancedParsingSuccessCount++;
        
        // Also create legacy format for backward compatibility
        extractedTexts.push({
          name: file.name,
          text: parsedDoc.content.rawText,
          type: file.type
        });
        
        console.log(`✅ Advanced parsing completed for ${file.name}: Quality=${parsedDoc.qualityScore}%, Entities=${parsedDoc.entities.length}`);
        
      } catch (error) {
        console.error(`❌ Advanced parsing FAILED for ${file.name}:`, {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorStack: error instanceof Error ? error.stack : 'No stack trace',
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size
        });
        
        advancedParsingFailureCount++;
        
        // Fallback to basic text extraction
        let text = "";
        try {
          if (file.type === 'application/pdf') {
            console.log("📄 Fallback: Processing PDF with pdf2json...");
            
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
              console.log(`📄 Fallback PDF extraction: ${text.length} chars`);
              
              if (!text || text.length < 10) {
                text = `[PDF FILE: ${file.name} - PDF processed but no readable text found]`;
              }
              
            } catch (pdfError: unknown) {
              console.error(`❌ Fallback PDF processing error:`, pdfError);
              const errorMessage = pdfError instanceof Error ? pdfError.message : 'Unknown PDF processing error';
              text = `[PDF FILE: ${file.name} - PDF processing failed: ${errorMessage}]`;
            }
            
          } else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            console.log("📝 Fallback: Processing DOCX...");
            try {
              const mammoth = await import('mammoth');
              const arrayBuffer = await file.arrayBuffer();
              const buffer = Buffer.from(arrayBuffer);
              const result = await mammoth.extractRawText({ buffer });
              text = result.value?.trim() || `[DOCX FILE: ${file.name} - No text found]`;
              console.log(`📝 Fallback DOCX text length: ${text.length}`);
            } catch (docxError: unknown) {
              console.error(`❌ Fallback DOCX error:`, docxError);
              const errorMessage = docxError instanceof Error ? docxError.message : 'Unknown DOCX processing error';
              text = `[DOCX FILE: ${file.name} - Processing failed: ${errorMessage}]`;
            }
            
          } else {
            console.log("📝 Fallback: Processing text file...");
            text = await file.text();
            console.log(`📝 Fallback text file length: ${text.length}`);
          }
        } catch (basicError) {
          console.error(`❌ Fallback extraction also failed for ${file.name}:`, basicError);
          text = `[ERROR: Could not process ${file.name}: ${basicError instanceof Error ? basicError.message : 'Unknown error'}]`;
        }
        
        extractedTexts.push({
          name: file.name,
          text: text,
          type: file.type
        });
        
        // Create minimal parsed document structure for failed parsing
        parsedDocuments.push({
          id: `doc_${Date.now()}_${file.name}`,
          filename: file.name,
          type: 'general_document' as any,
          content: { 
            rawText: text, 
            sections: [],
            tables: [],
            dates: [],
            locations: [],
            people: [],
            organizations: [],
            vehicles: [],
            communications: [],
            financials: [],
            evidence: []
          },
          metadata: {
            filename: file.name,
            fileSize: file.size,
            fileType: file.type,
            wordCount: text.split(/\s+/).length,
            pageCount: 1,
            extractedAt: new Date().toISOString(),
            language: 'en',
            encoding: 'utf-8'
          },
          entities: [],
          relationships: [],
          qualityScore: 30
        });
      }
    }

    // Debug: Log parsing statistics
    console.log(`📊 PARSING STATISTICS:`, {
      totalFiles: allFiles.length,
      advancedParsingSuccess: advancedParsingSuccessCount,
      advancedParsingFailures: advancedParsingFailureCount,
      advancedParsingRate: Math.round((advancedParsingSuccessCount / allFiles.length) * 100) + '%',
      totalParsedDocuments: parsedDocuments.length,
      documentsWithEntities: parsedDocuments.filter(doc => doc.entities?.length > 0).length,
      totalEntitiesExtracted: parsedDocuments.reduce((sum, doc) => sum + (doc.entities?.length || 0), 0)
    });

    // Debug: Check if any documents have rich entity data
    const documentsWithRichData = parsedDocuments.filter(doc => 
      doc.content?.people?.length > 0 || 
      doc.content?.locations?.length > 0 || 
      doc.content?.dates?.length > 0
    );

    console.log(`📈 RICH DATA CHECK:`, {
      documentsWithRichData: documentsWithRichData.length,
      richDataRate: Math.round((documentsWithRichData.length / parsedDocuments.length) * 100) + '%',
      sampleRichDocument: documentsWithRichData[0] ? {
        filename: documentsWithRichData[0].filename,
        people: documentsWithRichData[0].content?.people?.length || 0,
        locations: documentsWithRichData[0].content?.locations?.length || 0,
        dates: documentsWithRichData[0].content?.dates?.length || 0
      } : 'None'
    });

    // Infer case type for specialized analysis
    const inferCaseType = (parsedDocuments: any[]): string => {
      const allText = parsedDocuments.map(doc => doc.content.rawText.toLowerCase()).join(' ');
      
      if (allText.includes('homicide') || allText.includes('murder') || allText.includes('death')) {
        return 'homicide';
      }
      if (allText.includes('missing') || allText.includes('disappeared')) {
        return 'missing_person';
      }
      if (allText.includes('sexual assault') || allText.includes('rape')) {
        return 'sexual_assault';
      }
      if (allText.includes('robbery') || allText.includes('theft') || allText.includes('burglary')) {
        return 'property_crime';
      }
      if (allText.includes('drug') || allText.includes('narcotic')) {
        return 'drug_related';
      }
      
      return 'general_crime';
    };

    // Check if we have meaningful text (excluding error messages)
    const combinedText = extractedTexts
      .map(f => `--- ${f.name} ---\n${f.text}`)
      .join("\n\n");

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

    console.log("🤖 Starting enhanced Claude analysis...");

    try {
      const Anthropic = (await import('@anthropic-ai/sdk')).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      // Prepare comprehensive document summary using your parser's rich data
      const documentSummary = parsedDocuments.map(doc => ({
        filename: doc.filename,
        type: doc.type,
        qualityScore: doc.qualityScore,
        entityCount: doc.entities.length,
        wordCount: doc.metadata.wordCount,
        keyEntities: doc.entities.slice(0, 5).map((e: any) => `${e.type}: ${e.name}`),
        summary: doc.content.rawText.substring(0, 500) + "...",
        // Rich entity breakdown from your parser
        entityBreakdown: {
          people: doc.content.people.length,
          locations: doc.content.locations.length,
          dates: doc.content.dates.length,
          vehicles: doc.content.vehicles.length,
          communications: doc.content.communications.length,
          evidence: doc.content.evidence.length
        }
      }));

      // Create comprehensive analysis text using your structured data
      const combinedAnalysisText = parsedDocuments.map(doc => {
        const entitySummary = doc.entities.map((e: any) => 
          `${e.type.toUpperCase()}: ${e.name} (confidence: ${e.confidence}%)`
        ).join('\n');
        
        // Include structured data from your parser
        const structuredSummary = `
PEOPLE: ${doc.content.people.map((p: any) => `${p.firstName} ${p.lastName} (${p.role})`).join(', ')}
LOCATIONS: ${doc.content.locations.map((l: any) => l.originalText).join(', ')}
DATES: ${doc.content.dates.map((d: any) => `${d.originalText} (${d.type})`).join(', ')}
VEHICLES: ${doc.content.vehicles.map((v: any) => `${v.originalText}`).join(', ')}
COMMUNICATIONS: ${doc.content.communications.map((c: any) => `${c.type}: ${c.originalText}`).join(', ')}
EVIDENCE: ${doc.content.evidence.map((e: any) => `${e.type}: ${e.description}`).join(', ')}
`;
        
        return `
=== DOCUMENT: ${doc.filename} ===
TYPE: ${doc.type}
QUALITY SCORE: ${doc.qualityScore}%
EXTRACTED ENTITIES:
${entitySummary}

STRUCTURED DATA SUMMARY:
${structuredSummary}

FULL CONTENT:
${doc.content.rawText}

===================================
`;
      }).join('\n\n');

      // Limit text size
      let truncatedText = combinedAnalysisText;
      let truncated = false;
      const MAX_CHARS = 100000; // Increased for enhanced analysis
      if (combinedAnalysisText.length > MAX_CHARS) {
        truncatedText = combinedAnalysisText.substring(0, MAX_CHARS);
        truncated = true;
        console.warn(`⚠️ Combined text truncated from ${combinedAnalysisText.length} to ${MAX_CHARS} characters.`);
      }

      // Choose analysis type based on whether this is bulk analysis
      const caseType = inferCaseType(parsedDocuments);
      let systemPrompt: string;
      let jsonStructure: string;
      let analysisType: string;
      
      if (isBulkAnalysis) {
        // Use simple analysis for bulk analysis (better for suspect identification)
        console.log("🔍 Using SIMPLE analysis for bulk analysis (better suspect identification)");
        const simplePrompt = generateSimpleAnalysisPrompt(
          parsedDocuments,
          aiPrompt,
          caseType
        );
        
        systemPrompt = `${simplePrompt}

DOCUMENT ANALYSIS SUMMARY:
Total Documents: ${parsedDocuments.length}
Average Quality Score: ${Math.round(parsedDocuments.reduce((sum, doc) => sum + doc.qualityScore, 0) / parsedDocuments.length)}%
Total Entities Extracted: ${parsedDocuments.reduce((sum, doc) => sum + doc.entities.length, 0)}
Case Type: ${caseType}

DOCUMENTS OVERVIEW:
${JSON.stringify(documentSummary, null, 2)}

YOU MUST RESPOND WITH ONLY THE FOLLOWING JSON STRUCTURE:
${SIMPLE_JSON_STRUCTURE}`;

        jsonStructure = SIMPLE_JSON_STRUCTURE;
        analysisType = 'simple';
      } else {
        // Use enhanced analysis for single file analysis (better for pattern recognition)
        console.log("🔍 Using ENHANCED analysis for single file analysis (better pattern recognition)");
        const enhancedPrompt = generateEnhancedAnalysisPrompt(
          parsedDocuments,
          aiPrompt,
          caseType
        );
        
        systemPrompt = `${enhancedPrompt}

DOCUMENT ANALYSIS SUMMARY:
Total Documents: ${parsedDocuments.length}
Average Quality Score: ${Math.round(parsedDocuments.reduce((sum, doc) => sum + doc.qualityScore, 0) / parsedDocuments.length)}%
Total Entities Extracted: ${parsedDocuments.reduce((sum, doc) => sum + doc.entities.length, 0)}
Case Type: ${caseType}

DOCUMENTS OVERVIEW:
${JSON.stringify(documentSummary, null, 2)}

YOU MUST RESPOND WITH ONLY THE FOLLOWING JSON STRUCTURE:
${ENHANCED_JSON_STRUCTURE}`;

        jsonStructure = ENHANCED_JSON_STRUCTURE;
        analysisType = 'enhanced';
      }

      console.log(`${analysisType === 'simple' ? 'Simple' : 'Enhanced'} system prompt length:`, systemPrompt.length);

      const response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: isBulkAnalysis ? 6000 : 8000, // Less tokens for simple analysis
        temperature: 0.1,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: isBulkAnalysis ? 
            `Perform direct forensic analysis on the following case materials:

${truncatedText}

FOCUS ON:
1. Direct suspect identification and assessment
2. Evidence cataloging and analysis
3. Timeline reconstruction
4. Key findings and inconsistencies
5. Actionable investigative leads

Case ID: ${caseId}
Documents: ${extractedTexts.length}
${truncated ? 'NOTE: Case materials were truncated due to length.\n' : ''}

RESPOND WITH ONLY THE JSON STRUCTURE SPECIFIED IN THE SYSTEM PROMPT.` :
            `Perform comprehensive multi-document pattern analysis on the following case materials:

${truncatedText}

CRITICAL REQUIREMENTS:
1. Identify patterns that span multiple documents
2. Cross-reference all entities across documents  
3. Build comprehensive timeline from all sources
4. Detect inconsistencies and deception patterns
5. Generate high-value investigative leads
6. Focus on connections that would be missed in manual review

Case ID: ${caseId}
Documents: ${extractedTexts.length}
${truncated ? 'NOTE: Case materials were truncated due to length.\n' : ''}

RESPOND WITH ONLY THE JSON STRUCTURE SPECIFIED IN THE SYSTEM PROMPT.`
        }]
      });

      const aiResponse = response.content[0]?.type === 'text' ? response.content[0].text : '';
      console.log(`✅ ${analysisType === 'simple' ? 'Simple' : 'Enhanced'} Claude responded: ${aiResponse.length} chars`);
      console.log(`${analysisType === 'simple' ? 'Simple' : 'Enhanced'} response preview:`, aiResponse.substring(0, 500));

      // Enhanced JSON parsing with better error handling
      let parsedResults;
      try {
        // Clean the response more thoroughly
        let cleanedResponse = aiResponse.trim();
        
        // Remove any markdown formatting
        cleanedResponse = cleanedResponse
          .replace(/^```json\s*/i, '')
          .replace(/^```\s*/i, '')
          .replace(/\s*```$/i, '')
          .replace(/^\s*```.*$/gm, '');
        
        // Find the JSON object boundaries
        const firstBrace = cleanedResponse.indexOf('{');
        const lastBrace = cleanedResponse.lastIndexOf('}');
        
        if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
          throw new Error('No valid JSON object found in response');
        }
        
        const jsonString = cleanedResponse.substring(firstBrace, lastBrace + 1);
        console.log('Extracted JSON string (first 200 chars):', jsonString.substring(0, 200));

        // Parse the JSON
        const rawResults = JSON.parse(jsonString);
        
        // Transform results to legacy format for compatibility based on analysis type
        if (analysisType === 'simple') {
          // Simple analysis results are already in the right format
          parsedResults = {
            suspects: rawResults.suspects || [],
            findings: rawResults.findings || [],
            connections: rawResults.connections || [],
            recommendations: rawResults.recommendations || [],
            overlookedLeads: rawResults.overlookedLeads || [],
            enhancedAnalysis: rawResults,
            caseAssessment: {
              overallRisk: "MEDIUM",
              breakthroughPotential: 50,
              investigativePriority: 5
            }
          };
          
          console.log("✅ Successfully parsed simple analysis response");
          console.log("Simple structure:", {
            suspects: rawResults.suspects?.length || 0,
            findings: rawResults.findings?.length || 0,
            connections: rawResults.connections?.length || 0,
            recommendations: rawResults.recommendations?.length || 0,
            overlookedLeads: rawResults.overlookedLeads?.length || 0
          });
        } else {
          // Transform enhanced results to legacy format for compatibility
          parsedResults = {
            // Legacy format for existing UI components
            suspects: rawResults.entityNetwork?.people?.map((person: any) => ({
              id: person.id,
              name: person.name,
              confidence: person.suspicionLevel || 50,
              urgencyLevel: person.suspicionLevel > 80 ? 'HIGH' : 
                           person.suspicionLevel > 60 ? 'MEDIUM' : 'LOW',
              connections: person.connections?.map((c: any) => c.relationship) || [],
              redFlags: person.behaviorPatterns || [],
              notes: `Reliability: ${person.informationReliability}%. Patterns: ${person.behaviorPatterns?.join(', ') || 'None'}`,
              recommendedActions: rawResults.investigativeLeads
                ?.filter((lead: any) => lead.targetEntities?.includes(person.id))
                ?.map((lead: any) => lead.description) || []
            })) || [],
          
            findings: rawResults.crossDocumentPatterns?.map((pattern: any, index: number) => ({
              id: pattern.id || `finding_${index}`,
              title: pattern.title,
              description: pattern.description,
              category: pattern.type,
              priority: pattern.significance > 80 ? 'CRITICAL' : 
                       pattern.significance > 60 ? 'HIGH' : 
                       pattern.significance > 40 ? 'MEDIUM' : 'LOW',
              confidenceScore: pattern.confidence,
              evidenceStrength: pattern.significance,
              supportingEvidence: pattern.documentsInvolved || [],
              actionRequired: pattern.investigativeActions?.join('; ') || '',
              timeline: pattern.timeline || 'Unknown'
            })) || [],
            
            connections: rawResults.entityNetwork?.people?.flatMap((person: any) => 
              person.connections?.map((conn: any) => ({
                id: `${person.id}_${conn.toEntity}`,
                type: conn.relationship,
                entities: [person.name, conn.toEntity],
                description: conn.relationship,
                significance: `Evidence: ${conn.evidence?.join(', ') || 'None'}`,
                confidence: conn.strength
              })) || []
            ) || [],
            
            recommendations: rawResults.investigativeLeads?.map((lead: any) => ({
              action: lead.description,
              priority: lead.priority > 80 ? 'CRITICAL' : 
                       lead.priority > 60 ? 'HIGH' : 
                       lead.priority > 40 ? 'MEDIUM' : 'LOW',
              timeline: lead.timeline,
              rationale: lead.expectedOutcome,
              resources: lead.resources
            })) || [],
            
            overlookedLeads: rawResults.gapAnalysis?.map((gap: any) => ({
              type: gap.type,
              description: gap.description,
              recommendedAction: gap.suggestedActions?.join('; ') || '',
              rationale: `Criticality: ${gap.criticality}%, Obtainability: ${gap.obtainabilityScore}%`,
              urgency: gap.criticality > 80 ? 'CRITICAL' : 
                      gap.criticality > 60 ? 'HIGH' : 
                      gap.criticality > 40 ? 'MEDIUM' : 'LOW',
              resources: 'Standard investigative resources'
            })) || [],

            // Enhanced data for new components
            enhancedAnalysis: rawResults,
            
            // Include case assessment for legacy compatibility
            caseAssessment: rawResults.caseAssessment || {
              overallRisk: "MEDIUM",
              breakthroughPotential: 50,
              investigativePriority: 5
            }
          };
          
          console.log("✅ Successfully parsed enhanced analysis response");
          console.log("Enhanced structure:", {
            patterns: rawResults.crossDocumentPatterns?.length || 0,
            people: rawResults.entityNetwork?.people?.length || 0,
            timeline: rawResults.masterTimeline?.length || 0,
            leads: rawResults.investigativeLeads?.length || 0,
            breakthroughs: rawResults.breakthroughScenarios?.length || 0
          });
        }

      } catch (parseError) {
        console.error(`❌ ${analysisType === 'simple' ? 'Simple' : 'Enhanced'} parse error:`, parseError);
        console.error("Failed to parse response (first 1000 chars):", aiResponse.substring(0, 1000));
        
        return NextResponse.json({
          success: false,
          error: `Failed to parse ${analysisType === 'simple' ? 'simple' : 'enhanced'} AI response`,
          details: parseError instanceof Error ? parseError.message : "Unknown parsing error",
          debug: {
            responseLength: aiResponse.length,
            responsePreview: aiResponse.substring(0, 500),
            firstBraceIndex: aiResponse.indexOf('{'),
            lastBraceIndex: aiResponse.lastIndexOf('}'),
            containsJson: aiResponse.includes('{') && aiResponse.includes('}'),
            analysisType
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
            analysis_type: isBulkAnalysis ? 'bulk_analysis' : 'enhanced_analysis',
            analysis_data: parsedResults,
            confidence_score: overallConfidence,
            user_id: user.id,
            used_prompt: aiPrompt
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
          // Include rich parsing data
          advancedParsing: {
            totalEntitiesExtracted: parsedDocuments.reduce((sum, doc) => sum + doc.entities.length, 0),
            documentTypes: parsedDocuments.map(doc => doc.type),
            averageQualityScore: Math.round(parsedDocuments.reduce((sum, doc) => sum + doc.qualityScore, 0) / parsedDocuments.length),
            entityBreakdown: parsedDocuments.reduce((acc, doc) => ({
              people: acc.people + doc.content.people.length,
              locations: acc.locations + doc.content.locations.length,
              dates: acc.dates + doc.content.dates.length,
              vehicles: acc.vehicles + doc.content.vehicles.length,
              communications: acc.communications + doc.content.communications.length,
              evidence: acc.evidence + doc.content.evidence.length
            }), { people: 0, locations: 0, dates: 0, vehicles: 0, communications: 0, evidence: 0 }),
            parsingStatistics: {
              totalFiles: allFiles.length,
              advancedParsingSuccess: advancedParsingSuccessCount,
              advancedParsingFailures: advancedParsingFailureCount,
              advancedParsingRate: Math.round((advancedParsingSuccessCount / allFiles.length) * 100)
            }
          },
          aiModel: "claude-3-5-sonnet-20241022",
          processingTime: new Date().toISOString(),
          confidenceScore: overallConfidence,
          enhancedFeatures: {
            advancedParsing: true,
            entityExtraction: true,
            crossDocumentAnalysis: true,
            qualityControl: true,
            structuredDataExtraction: true
          }
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