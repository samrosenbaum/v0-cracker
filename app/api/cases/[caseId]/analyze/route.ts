import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { sendInngestEvent } from '@/lib/inngest-client';
import { hasSupabaseServiceConfig } from '@/lib/environment';
import { listCaseDocuments, getStorageObject, addCaseAnalysis, getCaseById } from '@/lib/demo-data';
import { analyzeCaseDocuments } from '@/lib/ai-analysis';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function withCors(response: NextResponse) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  return withCors(
    NextResponse.json(
      {
        message: 'Analysis endpoint is ready. Use POST method to run analysis.',
        endpoint: '/api/cases/[caseId]/analyze',
        method: 'POST',
        description: 'Analyzes case documents and extracts timeline events and conflicts (async job)'
      },
      { status: 200 }
    )
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  const useSupabase = hasSupabaseServiceConfig();
  let resolvedCaseId = '';

  const runFallbackAnalysis = async (caseId: string) => {
    const documents = listCaseDocuments(caseId).map((doc) => {
      const storage = doc.storage_path
        ? getStorageObject('case-files', doc.storage_path)
        : null;
      const content =
        storage?.content || (typeof doc.metadata?.extracted_text === 'string' ? doc.metadata.extracted_text : '');

      return {
        content: content || `Summary unavailable for ${doc.file_name}.`,
        filename: doc.file_name,
        type: doc.document_type,
      };
    });

    if (!documents.length) {
      return withCors(
        NextResponse.json(
          {
            error: 'No documents available for analysis. Upload files or configure Supabase connection.',
          },
          { status: 400 }
        )
      );
    }

    const analysis = await analyzeCaseDocuments(documents, caseId);
    const now = new Date().toISOString();

    addCaseAnalysis({
      case_id: caseId,
      analysis_type: 'timeline_and_conflicts',
      analysis_data: analysis,
      confidence_score: 0.72,
      created_at: now,
      updated_at: now,
      used_prompt: 'Fallback heuristic timeline and conflict analysis',
    });

    return withCors(
      NextResponse.json(
        {
          success: true,
          mode: 'instant',
          analysis,
          message: 'Generated using local analysis engine.',
        },
        { status: 200 }
      )
    );
  };

  try {
    // Handle both sync and async params for Next.js 14/15 compatibility
    const params = await Promise.resolve(context.params);
    const { caseId } = params;
    resolvedCaseId = caseId;

    if (!useSupabase) {
      const caseExists = getCaseById(caseId);
      if (!caseExists) {
        return withCors(
          NextResponse.json(
            { error: `Case ${caseId} not found in local dataset.` },
            { status: 404 }
          )
        );
      }
      return runFallbackAnalysis(caseId);
    }

    // Create processing job record
    const now = new Date().toISOString();
    const initialMetadata = {
      analysisType: 'timeline_and_conflicts',
      requestedAt: now,
    };

    const { data: job, error: jobError } = await supabaseServer
      .from('processing_jobs')
      .insert({
        case_id: caseId,
        job_type: 'ai_analysis',
        status: 'pending',
        total_units: 5, // Fetch, Extract, Analyze, Save Events, Save Conflicts
        completed_units: 0,
        failed_units: 0,
        progress_percentage: 0,
        metadata: initialMetadata,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('[Timeline Analysis API] Failed to create processing job:', jobError);
      return withCors(
        NextResponse.json(
          { error: 'Unable to schedule timeline analysis job.' },
          { status: 500 }
        )
      );
    }

    // Trigger Inngest background job
    await sendInngestEvent('analysis/timeline', {
      jobId: job.id,
      caseId,
    });

    // Return immediately with job ID
    return withCors(
      NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: 'pending',
          message:
            'Timeline analysis has been scheduled. Check processing job status for progress.',
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('[Timeline Analysis API] Error:', error);
    if (resolvedCaseId) {
      try {
        return await runFallbackAnalysis(resolvedCaseId);
      } catch (fallbackError) {
        console.error('[Timeline Analysis API] Fallback also failed:', fallbackError);
      }
    }
    return withCors(
      NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: 500 }
      )
    );
  }
}
