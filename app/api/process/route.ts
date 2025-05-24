import { type NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_FILE_TYPES = [
  'text/plain', 'application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg', 'image/png', 'image/tiff', 'audio/mpeg', 'audio/wav',
  'video/mp4', 'video/quicktime'
];

async function extractTextFromFile(file: File) {
  const result = {
    name: file.name,
    type: file.type,
    size: file.size,
    text: '',
    metadata: {},
    analysis: {}
  };

  try {
    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    if (file.type.startsWith('text/')) {
      result.text = await file.text();
    } else if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
      const promptText = file.type === 'application/pdf'
        ? "Extract all text from this PDF document."
        : "Analyze this image for case-related evidence.";

      const { text } = await generateText({
        model: openai("gpt-4o"),
        messages: [{
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image", image: `data:${file.type};base64,${base64}` }
          ]
        }]
      });
      result.text = text;
      result.analysis.type = file.type.startsWith('image/') ? 'visual_analysis' : 'pdf_extraction';
    } else if (file.type.startsWith('audio/')) {
      result.text = "Audio transcription required (not implemented)";
      result.analysis.type = 'audio';
    } else if (file.type.startsWith('video/')) {
      result.text = "Video file uploaded - processing not implemented.";
      result.analysis.type = 'video';
    }
  } catch (error) {
    console.error(`Error processing file ${file.name}:`, error);
    result.text = `Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }

  return result;
}

function createAdvancedAnalysisPrompt(caseId, files) {
  return `You are a forensic AI. Analyze the following case documents. Case ID: ${caseId}

${files.map((f, i) => `\n--- Document ${i + 1}: ${f.name} ---\n${f.text}`).join('\n')}`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];
    const caseId = (formData.get("caseId") as string) || "unknown";

    if (files.length === 0) return NextResponse.json({ error: "No files provided" }, { status: 400 });

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE)
        return NextResponse.json({ error: `File ${file.name} too large.` }, { status: 400 });
      if (!ALLOWED_FILE_TYPES.includes(file.type))
        return NextResponse.json({ error: `File type ${file.type} not allowed.` }, { status: 400 });
    }

    const processedFiles = await Promise.all(files.map(extractTextFromFile));

    const { data: evidenceRecords, error: dbError } = await supabase.from('evidence').insert(
      processedFiles.map(file => ({
        case_id: caseId,
        type: 'document',
        subtype: file.type,
        description: file.name,
        digital_files: [file.name],
        analysis_results: file.analysis,
        analyzed: true
      }))
    ).select();

    if (dbError) console.error('Supabase insert error:', dbError);

    const prompt = createAdvancedAnalysisPrompt(caseId, processedFiles);
    const { text: aiResponse } = await generateText({ model: openai("gpt-4o"), prompt, maxTokens: 8000 });

    let analysisResults;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const jsonString = jsonMatch ? jsonMatch[0] : aiResponse;
      analysisResults = JSON.parse(jsonString);
    } catch (e) {
      analysisResults = { error: "Failed to parse AI response", raw: aiResponse };
    }

    await supabase.from('ai_analyses').insert({
      case_id: caseId,
      analysis_type: 'document',
      results: analysisResults
    });

    return NextResponse.json({
      success: true,
      caseId,
      filesProcessed: processedFiles.length,
      analysis: analysisResults,
      evidenceRecordsCreated: evidenceRecords?.length || 0
    });
  } catch (error) {
    console.error("Unhandled error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
