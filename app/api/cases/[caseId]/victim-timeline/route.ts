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
      return withCors(NextResponse.json(
        {
          error:
            'Anthropic API key is not configured. Please set ANTHROPIC_API_KEY before running victim timeline analysis.',
        },
        { status: 503 }
      ));
    }

    const now = new Date().toISOString();
    const initialMetadata = {
      analysisType: 'victim_timeline',
      victimName,
      incidentTime,
      incidentLocation,
    };

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
      console.error('Failed to create processing job for victim timeline:', jobError);
      return withCors(
        NextResponse.json(
          { error: 'Unable to schedule victim timeline analysis job.' },
          { status: 500 }
        )
      );
    }

    await sendInngestEvent('analysis/victim-timeline', {
      jobId: job.id,
      caseId,
      victimInfo: {
        name: victimName,
        incidentTime,
        incidentLocation,
        typicalRoutine,
        knownHabits,
        regularContacts,
      },
      requestContext: {
        digitalRecords: body.digitalRecords || null,
      },
      requestedAt: now,
    });

    return withCors(
      NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: 'pending',
          message:
            'Victim timeline reconstruction has been scheduled. Check processing job status for progress.',
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('Victim timeline error:', error);
    return withCors(NextResponse.json(
      { error: error.message || 'Timeline analysis failed' },
      { status: 500 }
    ));
  }
}
