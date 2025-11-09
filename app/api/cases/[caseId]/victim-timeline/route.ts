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
        message: 'Victim Timeline endpoint is ready. Use POST method to run analysis.',
        endpoint: '/api/cases/[caseId]/victim-timeline',
        method: 'POST',
        description: 'Reconstructs victim\'s last 24-48 hours with gap detection'
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
    const body = await request.json();

    console.log('[Victim Timeline API] Starting analysis for case:', caseId);

    // Get victim information from request
    const {
      victimName,
      incidentTime,
      incidentLocation,
      typicalRoutine,
      knownHabits,
      regularContacts,
    } = body;

    if (!victimName || !incidentTime) {
      return withCors(NextResponse.json(
        { error: 'victimName and incidentTime are required' },
        { status: 400 }
      ));
    }

    const anthropicKey =
      process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      console.error('[Victim Timeline API] Missing Anthropic API key');
      return withCors(NextResponse.json(
        {
          error:
            'Anthropic API key is not configured. Please set ANTHROPIC_API_KEY before running victim timeline analysis.',
        },
        { status: 503 }
      ));
    }

    // Verify the case exists first
    console.log('[Victim Timeline API] Checking if case exists:', caseId);
    const { data: existingCase, error: caseCheckError } = await supabaseServer
      .from('cases')
      .select('id, title')
      .eq('id', caseId)
      .maybeSingle();

    if (caseCheckError) {
      console.error('[Victim Timeline API] Error checking case:', caseCheckError);
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
      console.error('[Victim Timeline API] Case not found:', caseId);
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

    console.log('[Victim Timeline API] Case found:', existingCase.title);

    const now = new Date().toISOString();
    const initialMetadata = {
      analysisType: 'victim_timeline',
      victimName,
      incidentTime,
      incidentLocation,
    };

    console.log('[Victim Timeline API] Creating processing job...');
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
      console.error('[Victim Timeline API] Failed to create processing job:', {
        error: jobError,
        code: jobError?.code,
        message: jobError?.message,
        details: jobError?.details,
        hint: jobError?.hint,
      });

      const errorDetails = jobError
        ? `${jobError.message || 'Unknown error'} (Code: ${jobError.code || 'N/A'})`
        : 'Job creation returned no data';

      return withCors(
        NextResponse.json(
          {
            error: 'Unable to schedule victim timeline analysis job.',
            details: errorDetails,
            hint: jobError?.hint || 'Check that the processing_jobs table exists in your Supabase database',
            dbError: jobError,
          },
          { status: 500 }
        )
      );
    }

    console.log('[Victim Timeline API] Processing job created:', job.id);

    // Trigger Inngest background job (optional - gracefully handles missing Inngest config)
    try {
      await sendInngestEvent('analysis/victim-timeline', {
        jobId: job.id,
        caseId,
        victimName,
        incidentTime,
        incidentLocation,
        typicalRoutine,
        knownHabits: knownHabits || [],
        regularContacts: regularContacts || [],
        digitalRecords: body.digitalRecords || null,
      });
    } catch (inngestError) {
      console.error('[Victim Timeline API] Inngest event failed:', inngestError);
      // Don't fail the entire request if Inngest fails
    }

    // Check if Inngest is configured
    const hasInngest = process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY;

    return withCors(
      NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: 'pending',
          message: hasInngest
            ? 'Victim timeline reconstruction has been scheduled. Check processing job status for progress.'
            : 'Victim timeline job created. Note: Inngest not configured - job will not auto-process. Set INNGEST_EVENT_KEY to enable background processing.',
          inngestConfigured: !!hasInngest,
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('[Victim Timeline API] Error:', error);
    return withCors(NextResponse.json(
      { error: error.message || 'Timeline analysis failed' },
      { status: 500 }
    ));
  }
}
