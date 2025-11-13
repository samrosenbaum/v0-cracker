import { NextRequest, NextResponse, after } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { processEvidenceGaps } from '@/lib/workflows/evidence-gaps';
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
        message: 'Evidence Gap Analysis endpoint is ready. Use POST method to run analysis.',
        endpoint: '/api/cases/[caseId]/evidence-gaps',
        method: 'POST',
        description: 'Identifies missing evidence that should have been collected'
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

    console.log('[Evidence Gaps API] Analysis requested for case:', caseId);

    const { metadata: initialMetadata, usingFallback } = resolveAnalysisEngineMetadata(
      'evidence_gaps',
      { requestedAt: new Date().toISOString() }
    );

    if (usingFallback) {
      console.warn(
        '[Evidence Gaps API] Anthropic API key missing. Scheduling heuristic fallback engine.'
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
      console.error('[Evidence Gaps API] Failed to create processing job:', jobError);
      return withCors(
        NextResponse.json(
          { error: 'Unable to schedule evidence gap analysis job.' },
          { status: 500 }
        )
      );
    }

    // Trigger workflow in background after response flushes
    runBackgroundTask(
      async () => {
        await processEvidenceGaps({
          jobId: job.id,
          caseId,
          requestedAt: initialMetadata.requestedAt,
        });
      },
      {
        label: 'Evidence Gaps API',
        scheduler: after,
        onError: (error) => {
          console.error('[Evidence Gaps API] Workflow failed:', error);
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
            'Evidence gap analysis workflow has been triggered. Check processing job status for progress.',
          metadata: initialMetadata,
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('[Evidence Gaps API] Error:', error);
    return withCors(
      NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: 500 }
      )
    );
  }
}
