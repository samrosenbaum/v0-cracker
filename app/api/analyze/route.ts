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

    const combinedText = extractedTexts.map(f => `--- ${f.name} (${f.type}) ---\n${f.text}`).join("\n\n");

    const systemPrompt = `
You are a cold case investigation assistant trained in methodologies from the FBI, DOJ, and behavioral analysts.

Use these frameworks:
- Cold Case Checklist (verify original reports, forensic docs, physical evidence)
- Crime Scene Best Practices (scene handling, logs, contamination prevention)
- Criminal Profiling (C-R-I-M-E model)

Analyze the following documents and generate:
1. Suspects with relevance scores
2. Key findings
3. Connections to other cases
4. Investigative recommendations

Case ID: ${caseId}
Documents: ${extractedTexts.length}
Types: ${extractedTexts.map(f => f.type).join(", ")}

Content:
${combinedText}

Return ONLY this valid JSON:

{
  "suspects": [...],
  "findings": [...],
  "connections": [...],
  "recommendations": [...]
}
`;

    const { text: aiResponse } = await generateText({
      model: openai("gpt-4o"),
      prompt: systemPrompt
    });

    let parsedResults;
    try {
      parsedResults = JSON.parse(aiResponse);
    } catch (e) {
      console.error("❌ JSON parse error:", e);
      console.error("🔍 Raw AI response:\n", aiResponse);

      parsedResults = {
        error: "Failed to parse AI response. See raw output below.",
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
    console.error("🚨 Unexpected error in analysis route:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
