import { NextRequest, NextResponse, after } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { processSimilarCases } from '@/lib/workflows/similar-cases';
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
        message: 'Similar Cases Finder endpoint is ready. Use POST method to run analysis.',
        endpoint: '/api/cases/[caseId]/similar-cases',
        method: 'POST',
        description: 'Finds patterns across similar unsolved cases in the database'
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

    console.log('[Similar Cases API] Analysis requested for case:', caseId);

    const { metadata: initialMetadata, usingFallback } = resolveAnalysisEngineMetadata(
      'similar_cases',
      { requestedAt: new Date().toISOString() }
    );

    if (usingFallback) {
      console.warn('[Similar Cases API] Anthropic API key missing. Scheduling heuristic fallback engine.');
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
      console.error('[Similar Cases API] Failed to create processing job:', jobError);
      return withCors(
        NextResponse.json(
          { error: 'Unable to schedule similar cases analysis job.' },
          { status: 500 }
        )
      );
    }

    // Trigger workflow in background after the response completes
    runBackgroundTask(
      async () => {
        await processSimilarCases({
          jobId: job.id,
          caseId,
          requestedAt: initialMetadata.requestedAt,
        });
      },
      {
        label: 'Similar Cases API',
        scheduler: after,
        onError: (error) => {
          console.error('[Similar Cases API] Workflow failed:', error);
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
            'Similar cases analysis workflow has been triggered. Check processing job status for progress.',
          metadata: initialMetadata,
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('[Similar Cases API] Error:', error);
    return withCors(
      NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: 500 }
      )
    );
  }
}
