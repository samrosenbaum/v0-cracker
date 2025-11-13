import { NextRequest, NextResponse, after } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { processInterrogationQuestions } from '@/lib/workflows/interrogation-questions';
import { runBackgroundTask } from '@/lib/background-tasks';
import { resolveAnalysisEngineMetadata } from '@/lib/analysis-engine-metadata';

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
        message: 'Interrogation Question Generator endpoint is ready. Use POST method to run analysis.',
        endpoint: '/api/cases/[caseId]/interrogation-questions',
        method: 'POST',
        description: 'Generates targeted questions for re-interviewing suspects and witnesses'
      },
      { status: 200 }
    )
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const { caseId } = params;

    console.log('[Interrogation Questions API] Analysis requested for case:', caseId);

    const { metadata: initialMetadata, usingFallback } = resolveAnalysisEngineMetadata(
      'interrogation_questions',
      { requestedAt: new Date().toISOString() }
    );

    if (usingFallback) {
      console.warn(
        '[Interrogation Questions API] Anthropic API key missing. Scheduling heuristic fallback engine.'
      );
    }

    const { data: job, error: jobError } = await supabaseServer
      .from('processing_jobs')
      .insert({
        case_id: caseId,
        job_type: 'ai_analysis',
        status: 'pending',
        total_units: 4,
        completed_units: 0,
        failed_units: 0,
        metadata: initialMetadata,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('[Interrogation Questions API] Failed to create processing job:', jobError);
      return withCors(
        NextResponse.json(
          { error: 'Unable to schedule interrogation question generation job.' },
          { status: 500 }
        )
      );
    }

    // Trigger workflow in background after the response finishes
    runBackgroundTask(
      async () => {
        await processInterrogationQuestions({
          jobId: job.id,
          caseId,
          requestedAt: initialMetadata.requestedAt,
        });
      },
      {
        label: 'Interrogation Questions API',
        scheduler: after,
        onError: (error) => {
          console.error('[Interrogation Questions API] Workflow failed:', error);
          // Workflow will update job status to 'failed' internally
        },
      }
    );

    return withCors(
      NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: 'pending',
          message:
            'Interrogation question generation workflow has been triggered. Check processing job status for progress.',
          metadata: initialMetadata,
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('[Interrogation Questions API] Error:', error);
    return withCors(
      NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: 500 }
      )
    );
  }
}
