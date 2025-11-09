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
  try {
    // Handle both sync and async params for Next.js 14/15 compatibility
    const params = await Promise.resolve(context.params);
    const { caseId } = params;

    // Fail-fast: Validate API keys before doing any expensive work
    const anthropicKey =
      process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return withCors(
        NextResponse.json(
          {
            error:
              'Anthropic API key is not configured. Please set ANTHROPIC_API_KEY before running timeline analysis.',
          },
          { status: 503 }
        )
      );
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

      // Provide more detailed error message
      const errorDetails = jobError
        ? `Database error: ${jobError.message || JSON.stringify(jobError)}`
        : 'Job creation returned no data';

      return withCors(
        NextResponse.json(
          {
            error: 'Unable to schedule timeline analysis job.',
            details: errorDetails,
            hint: 'Check that the processing_jobs table exists in your Supabase database'
          },
          { status: 500 }
        )
      );
    }

    // Trigger Inngest background job (optional - gracefully handles missing Inngest config)
    try {
      await sendInngestEvent('analysis/timeline', {
        jobId: job.id,
        caseId,
      });
    } catch (inngestError) {
      console.error('[Timeline Analysis API] Inngest event failed:', inngestError);
      // Don't fail the entire request if Inngest fails
      // The job is created and can be processed manually or later
    }

    // Check if Inngest is configured
    const hasInngest = process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY;

    // Return immediately with job ID
    return withCors(
      NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: 'pending',
          message: hasInngest
            ? 'Timeline analysis has been scheduled. Check processing job status for progress.'
            : 'Timeline analysis job created. Note: Inngest not configured - job will not auto-process. Set INNGEST_EVENT_KEY to enable background processing.',
          inngestConfigured: !!hasInngest,
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('[Timeline Analysis API] Error:', error);
    return withCors(
      NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: 500 }
      )
    );
  }
}
