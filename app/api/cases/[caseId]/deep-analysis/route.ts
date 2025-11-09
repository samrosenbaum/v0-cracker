import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { sendInngestEvent } from '@/lib/inngest-client';

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
        message: 'Deep Analysis endpoint is ready. Use POST method to run analysis.',
        endpoint: '/api/cases/[caseId]/deep-analysis',
        method: 'POST',
        description: 'Performs comprehensive cold case analysis with 8 analytical dimensions (async job)'
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
    // Handle both sync and async params for Next.js 14/15 compatibility
    const params = await Promise.resolve(context.params);
    const { caseId } = params;

    console.log('[Deep Analysis API] Deep analysis requested for case:', caseId);

    // Fail-fast: Validate API keys before doing any expensive work
    const anthropicKey =
      process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return withCors(
        NextResponse.json(
          {
            error:
              'Anthropic API key is not configured. Please set ANTHROPIC_API_KEY before running deep analysis.',
          },
          { status: 503 }
        )
      );
    }

    // Create processing job record
    const now = new Date().toISOString();
    const initialMetadata = {
      analysisType: 'comprehensive_cold_case',
      requestedAt: now,
    };

    const { data: job, error: jobError } = await supabaseServer
      .from('processing_jobs')
      .insert({
        case_id: caseId,
        job_type: 'ai_analysis',
        status: 'pending',
        total_units: 4, // Fetch, Extract, Analyze, Save
        completed_units: 0,
        failed_units: 0,
        progress_percentage: 0,
        metadata: initialMetadata,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('[Deep Analysis API] Failed to create processing job:', jobError);
      return withCors(
        NextResponse.json(
          { error: 'Unable to schedule deep analysis job.' },
          { status: 500 }
        )
      );
    }

    // Trigger Inngest background job
    await sendInngestEvent('analysis/deep-analysis', {
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
            'Deep analysis has been scheduled. Check processing job status for progress.',
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('[Deep Analysis API] Error:', error);
    return withCors(
      NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: 500 }
      )
    );
  }
}
