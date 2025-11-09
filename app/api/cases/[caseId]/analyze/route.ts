import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { sendInngestEvent } from '@/lib/inngest-client';
import { runTimelineAnalysis } from '@/lib/jobs/timeline-analysis';

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

    console.log('[Timeline Analysis API] Starting analysis for case:', caseId);

    // Fail-fast: Validate API keys before doing any expensive work
    const anthropicKey =
      process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      console.error('[Timeline Analysis API] Missing Anthropic API key');
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

    // Verify the case exists first
    console.log('[Timeline Analysis API] Checking if case exists:', caseId);
    const { data: existingCase, error: caseCheckError } = await supabaseServer
      .from('cases')
      .select('id, title')
      .eq('id', caseId)
      .maybeSingle();

    if (caseCheckError) {
      console.error('[Timeline Analysis API] Error checking case:', caseCheckError);
      return withCors(
        NextResponse.json(
          {
            error: 'Failed to verify case exists',
            details: caseCheckError.message,
            caseId,
          },
          { status: 500 }
        )
      );
    }

    if (!existingCase) {
      console.error('[Timeline Analysis API] Case not found:', caseId);
      return withCors(
        NextResponse.json(
          {
            error: 'Case not found',
            details: `No case exists with ID: ${caseId}`,
            caseId,
          },
          { status: 404 }
        )
      );
    }

    console.log('[Timeline Analysis API] Case found:', existingCase.title);

    // Create processing job record
    const now = new Date().toISOString();
    const initialMetadata = {
      analysisType: 'timeline_and_conflicts',
      requestedAt: now,
    };

    console.log('[Timeline Analysis API] Creating processing job...');
    const { data: job, error: jobError } = await supabaseServer
      .from('processing_jobs')
      .insert({
        case_id: caseId,
        job_type: 'ai_analysis',
        status: 'pending',
        total_units: 5, // Fetch, Extract, Analyze, Save Events, Save Conflicts
        completed_units: 0,
        failed_units: 0,
        metadata: initialMetadata,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('[Timeline Analysis API] Failed to create processing job:', {
        error: jobError,
        code: jobError?.code,
        message: jobError?.message,
        details: jobError?.details,
        hint: jobError?.hint,
      });

      // Provide more detailed error message
      const errorDetails = jobError
        ? `${jobError.message || 'Unknown error'} (Code: ${jobError.code || 'N/A'})`
        : 'Job creation returned no data';

      return withCors(
        NextResponse.json(
          {
            error: 'Unable to schedule timeline analysis job.',
            details: errorDetails,
            hint: jobError?.hint || 'Check that the processing_jobs table exists in your Supabase database',
            dbError: jobError,
          },
          { status: 500 }
        )
      );
    }

    console.log('[Timeline Analysis API] Processing job created:', job.id);

    // Check if Inngest is configured
    const hasInngest = process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY;

    let inlineProcessing = false;

    // Trigger Inngest background job (optional - gracefully handles missing Inngest config)
    let eventQueued = false;
    try {
      eventQueued = await sendInngestEvent('analysis/timeline', {
        jobId: job.id,
        caseId,
      });
    } catch (inngestError) {
      console.error('[Timeline Analysis API] Inngest event failed:', inngestError);
    }

    if (!eventQueued) {
      inlineProcessing = true;
      console.log('[Timeline Analysis API] Running timeline analysis inline (Inngest unavailable).');
      try {
        await runTimelineAnalysis(job.id, caseId);
      } catch (inlineError: any) {
        console.error('[Timeline Analysis API] Inline timeline analysis failed:', inlineError);
        return withCors(
          NextResponse.json(
            {
              error: inlineError?.message || 'Timeline analysis failed to run inline.',
              jobId: job.id,
            },
            { status: 500 }
          )
        );
      }
    }

    // Return immediately with job ID
    return withCors(
      NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: inlineProcessing ? 'completed' : 'pending',
          message: inlineProcessing
            ? 'Timeline analysis completed inline because background workers were unavailable.'
            : hasInngest
            ? 'Timeline analysis has been scheduled. Check processing job status for progress.'
            : 'Timeline analysis job created. Note: Inngest not configured - job will be processed inline when triggered.',
          inngestConfigured: !!hasInngest,
          processedInline: inlineProcessing,
        },
        { status: inlineProcessing ? 200 : 202 }
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
