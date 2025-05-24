import { type NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  "text/plain",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "audio/mpeg",
  "audio/wav",
];

async function extractText(file: File): Promise<{ name: string; type: string; text: string }> {
  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const contentType = file.type;
  let text = "";

  if (contentType.startsWith("text/")) {
    text = await file.text();
  } else {
    const response = await generateText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract useful investigative text from this file.`,
            },
            {
              type: "image",
              image: `data:${contentType};base64,${base64}`,
            },
          ],
        },
      ],
    });
    text = response.text;
  }

  return { name: file.name, type: contentType, text };
}

function buildAnalysisPrompt(caseId: string, files: { name: string; type: string; text: string }[]) {
  return `You are an AI crime analyst. Analyze the following files for case ${caseId}:

${files
    .map((f, i) => `--- File ${i + 1}: ${f.name} (${f.type}) ---\n${f.text}`)
    .join("\n\n")}

Return JSON with suspects, findings, timelineAnalysis, statementAnalysis, and recommendations.`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("file") as File[];
    const caseId = (formData.get("caseId") as string) || "unknown";

    if (!files.length) return NextResponse.json({ error: "No files uploaded" }, { status: 400 });

    const validFiles = files.filter(
      (file) => file.size <= MAX_FILE_SIZE && ALLOWED_FILE_TYPES.includes(file.type)
    );

    const parsedFiles = await Promise.all(validFiles.map(extractText));

    const prompt = buildAnalysisPrompt(caseId, parsedFiles);
    const { text: rawAIOutput } = await generateText({ model: openai("gpt-4o"), prompt, maxTokens: 8000 });

    const jsonMatch = rawAIOutput.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    for (const file of parsedFiles) {
      await supabase.from("case_documents").insert({
        case_id: caseId,
        file_name: file.name,
        file_type: file.type,
        document_type: "uploaded",
        content: file.text,
      });
    }

    await supabase.from("case_analyses").insert({
      case_id: caseId,
      analysis_type: "full_case",
      main_analysis: parsed,
      ai_model: "gpt-4o",
      confidence_score: parsed?.caseStrategy?.successProbability || 50,
    });

    for (const suspect of parsed?.suspects || []) {
      await supabase.from("suspects").insert({
        case_id: caseId,
        full_name: suspect.name,
        confidence_score: suspect.confidence || 50,
        relevance_score: suspect.relevance || 50,
        motive_score: suspect.motiveScore || 0,
        means_score: suspect.meansScore || 0,
        opportunity_score: suspect.opportunityScore || 0,
        connections: suspect.connections || [],
        urgency_level: suspect.urgencyLevel?.toLowerCase() || "medium",
      });
    }

    for (const finding of parsed?.findings || []) {
      await supabase.from("findings").insert({
        case_id: caseId,
        finding_id: finding.id,
        title: finding.title,
        description: finding.description,
        category: finding.category,
        priority: finding.priority,
        urgency_level: finding.urgencyLevel,
        confidence_score: finding.confidence,
        evidence_strength: finding.evidenceStrength,
        supporting_evidence: finding.supportingEvidence || [],
        investigative_action: finding.investigativeAction,
        potential_impact: finding.potentialImpact,
      });
    }

    return NextResponse.json({ success: true, caseId, filesProcessed: parsedFiles.length, analysis: parsed });
  } catch (error) {
    console.error("/api/process error:", error);
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 });
  }
}
