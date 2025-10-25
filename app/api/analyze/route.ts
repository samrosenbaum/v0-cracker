import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DocumentParsingService } from "@/app/lib/services/document-parsing-service";
import { PromptService } from "@/app/lib/services/prompt-service";
import { QualityService } from "@/app/lib/services/quality-service";
import { AnalysisPersistenceService } from "@/app/lib/services/persistence-service";
import { BackgroundJobService } from "@/app/lib/services/background-job-service";

export const runtime = "nodejs";

const parsingService = new DocumentParsingService();
const promptService = new PromptService();
const qualityService = new QualityService();

const MAX_ANALYSIS_CHARS = 100_000;

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI service not configured" }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Supabase client not configured" }, { status: 500 });
  }

  const cookieStore = cookies();
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.replace("Bearer ", "") : undefined;
  const cookieToken = cookieStore.get("sb-access-token")?.value;
  const accessToken = bearerToken ?? cookieToken;

  const supabase = createClient(
    supabaseUrl,
    supabaseAnonKey,
    accessToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        }
      : undefined,
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser(accessToken);

  if (authError || !user) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }

  const formData = await req.formData();
  const files = formData.getAll("files") as File[];
  const caseId = (formData.get("caseId") as string) || "unknown";
  const isBulkAnalysis = formData.get("bulkAnalysis") === "true";

  if (files.length === 0) {
    return NextResponse.json({ error: "No files provided" }, { status: 400 });
  }

  const persistenceService = new AnalysisPersistenceService(supabase);
  const backgroundJobService = new BackgroundJobService(supabase);

  const aiPrompt = (await persistenceService.getCasePrompt(caseId)) ?? "";
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  if (
    backgroundJobService.shouldEnqueue({
      fileCount: files.length,
      totalBytes,
      isBulkAnalysis,
    })
  ) {
    try {
      const storedFiles = await persistenceService.persistUploadedFiles({
        caseId,
        userId: user.id,
        files,
      });

      const enqueuedJob = await backgroundJobService.enqueueAnalysisJob({
        caseId,
        userId: user.id,
        files: storedFiles,
        isBulkAnalysis,
        aiPrompt,
      });

      if (enqueuedJob) {
        return NextResponse.json({
          success: true,
          enqueued: true,
          job: enqueuedJob,
        });
      }
    } catch (error) {
      console.error("Failed to enqueue background analysis job", error);
    }
  }

  let analysisFiles = [...files];
  if (isBulkAnalysis && caseId !== "unknown") {
    const existingFiles = await persistenceService.fetchExistingFilesForCase(caseId, user.id);
    analysisFiles = analysisFiles.concat(existingFiles);
  }

  if (analysisFiles.length === 0) {
    return NextResponse.json({ error: "No files available for analysis" }, { status: 400 });
  }

  const parsingResult = await parsingService.parse(analysisFiles);

  if (parsingResult.meaningfulText.length < 20) {
    return NextResponse.json(
      {
        success: false,
        error: "No readable text content found",
        debug: {
          extractedTexts: parsingResult.extractedTexts.map((file) => ({
            name: file.name,
            textLength: file.text.length,
            preview: file.text.substring(0, 200),
          })),
          combinedLength: parsingResult.combinedText.length,
          meaningfulLength: parsingResult.meaningfulText.length,
        },
      },
      { status: 400 },
    );
  }

  const promptContext = promptService.createPrompt({
    parsedDocuments: parsingResult.parsedDocuments,
    aiPrompt,
    caseType: parsingResult.caseType,
    isBulkAnalysis,
  });

  const combinedAnalysisText = promptService.buildCombinedAnalysisText(parsingResult.parsedDocuments);
  const truncated = combinedAnalysisText.length > MAX_ANALYSIS_CHARS;
  const truncatedText = truncated
    ? combinedAnalysisText.substring(0, MAX_ANALYSIS_CHARS)
    : combinedAnalysisText;

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const userContent = isBulkAnalysis
    ? `Perform direct forensic analysis on the following case materials:

${truncatedText}

FOCUS ON:
1. Direct suspect identification and assessment
2. Evidence cataloging and analysis
3. Timeline reconstruction
4. Key findings and inconsistencies
5. Actionable investigative leads

Case ID: ${caseId}
Documents: ${parsingResult.extractedTexts.length}
${truncated ? "NOTE: Case materials were truncated due to length.\n" : ""}

RESPOND WITH ONLY THE JSON STRUCTURE SPECIFIED IN THE SYSTEM PROMPT.`
    : `Perform comprehensive multi-document pattern analysis on the following case materials:

${truncatedText}

CRITICAL REQUIREMENTS:
1. Identify patterns that span multiple documents
2. Cross-reference all entities across documents
3. Build comprehensive timeline from all sources
4. Detect inconsistencies and deception patterns
5. Generate high-value investigative leads
6. Focus on connections that would be missed in manual review

Case ID: ${caseId}
Documents: ${parsingResult.extractedTexts.length}
${truncated ? "NOTE: Case materials were truncated due to length.\n" : ""}

RESPOND WITH ONLY THE JSON STRUCTURE SPECIFIED IN THE SYSTEM PROMPT.`;

  let parsedResults: any;
  let aiResponse = "";

  try {
    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: promptContext.maxTokens,
      temperature: 0.1,
      system: promptContext.systemPrompt,
      messages: [
        {
          role: "user",
          content: userContent,
        },
      ],
    });

    aiResponse = response.content
      .map((chunk) => ("text" in chunk ? chunk.text : ""))
      .join("");

    parsedResults = JSON.parse(aiResponse);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Failed to parse ${promptContext.analysisType === "simple" ? "simple" : "enhanced"} AI response`,
        details: error instanceof Error ? error.message : "Unknown parsing error",
        debug: {
          responseLength: aiResponse.length,
          responsePreview: aiResponse.substring(0, 500),
          firstBraceIndex: aiResponse.indexOf("{"),
          lastBraceIndex: aiResponse.lastIndexOf("}"),
          containsJson: aiResponse.includes("{") && aiResponse.includes("}"),
          analysisType: promptContext.analysisType,
        },
      },
      { status: 500 },
    );
  }

  try {
    const confidenceScores = [
      ...(parsedResults.findings?.map((finding: { confidenceScore?: number }) => finding.confidenceScore || 0) ?? []),
      ...(parsedResults.suspects?.map((suspect: { confidence?: number }) => suspect.confidence || 0) ?? []),
      ...(parsedResults.connections?.map((connection: { confidence?: number }) => connection.confidence || 0) ?? []),
    ];

    const overallConfidence =
      confidenceScores.length > 0
        ? Math.round(confidenceScores.reduce((a: number, b: number) => a + b, 0) / confidenceScores.length)
        : 50;

    const analysisRecord = await persistenceService.saveAnalysisResult({
      caseId,
      analysisData: parsedResults,
      confidenceScore: overallConfidence,
      userId: user.id,
      usedPrompt: aiPrompt,
      analysisType: isBulkAnalysis ? "bulk_analysis" : "enhanced_analysis",
    });

    const qualityFlags = qualityService.evaluate(parsedResults, analysisRecord.id, caseId);
    const flagsStored = await persistenceService.storeQualityFlags(qualityFlags);
    const qualitySummary = qualityService.summarize(qualityFlags);

    return NextResponse.json({
      success: true,
      caseId,
      analysis: parsedResults,
      analysisId: analysisRecord?.id,
      quality: {
        ...qualitySummary,
        flagsStored,
        flags: qualityFlags,
      },
      filesAnalyzed: parsingResult.extractedTexts.map((file) => ({
        name: file.name,
        type: file.type,
        textLength: file.text.length,
        preview: `${file.text.substring(0, 200)}${file.text.length > 200 ? "..." : ""}`,
      })),
      advancedParsing: {
        totalEntitiesExtracted: parsingResult.parsedDocuments.reduce(
          (sum, doc) => sum + doc.entities.length,
          0,
        ),
        documentTypes: parsingResult.parsedDocuments.map((doc) => doc.type),
        averageQualityScore: Math.round(
          parsingResult.parsedDocuments.reduce((sum, doc) => sum + doc.qualityScore, 0) /
            Math.max(parsingResult.parsedDocuments.length, 1),
        ),
        entityBreakdown: parsingResult.parsedDocuments.reduce(
          (acc, doc) => ({
            people: acc.people + doc.content.people.length,
            locations: acc.locations + doc.content.locations.length,
            dates: acc.dates + doc.content.dates.length,
            vehicles: acc.vehicles + doc.content.vehicles.length,
            communications: acc.communications + doc.content.communications.length,
            evidence: acc.evidence + doc.content.evidence.length,
          }),
          { people: 0, locations: 0, dates: 0, vehicles: 0, communications: 0, evidence: 0 },
        ),
        parsingStatistics: parsingResult.stats,
      },
      aiModel: "claude-3-5-sonnet-20241022",
      processingTime: new Date().toISOString(),
      confidenceScore: overallConfidence,
      enhancedFeatures: {
        advancedParsing: true,
        entityExtraction: true,
        crossDocumentAnalysis: true,
        qualityControl: true,
        structuredDataExtraction: true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to store analysis results",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
