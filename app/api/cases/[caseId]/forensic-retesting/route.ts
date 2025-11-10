import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { start } from 'workflow/api';
import { processForensicRetesting } from '@/lib/workflows/forensic-retesting';

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
        message:
          'Forensic Retesting Recommendations endpoint is ready. Use POST method to run analysis.',
        endpoint: '/api/cases/[caseId]/forensic-retesting',
        method: 'POST',
        description:
          'Recommends evidence for modern forensic techniques and retesting',
      },
      { status: 200 },
    ),
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } },
) {
  try {
    const params = await Promise.resolve(context.params);
    const { caseId } = params;

    console.log(
      '[Forensic Retesting API] Analysis requested for case:',
      caseId,
    );

    const anthropicKey =
      process.env.ANTHROPIC_API_KEY ||
      process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      return withCors(
        NextResponse.json(
          {
            error:
              'Anthropic API key is not configured. Please set ANTHROPIC_API_KEY before running forensic retesting analysis.',
          },
          { status: 503 },
        ),
      );
    }

    const now = new Date().toISOString();
    const initialMetadata = {
      analysisType: 'forensic_retesting',
      requestedAt: now,
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
      console.error(
        '[Forensic Retesting API] Failed to create processing job:',
        jobError,
      );
      return withCors(
        NextResponse.json(
          { error: 'Unable to schedule forensic retesting analysis job.' },
          { status: 500 },
        ),
      );
    }

    // Trigger workflow in background (fire and forget)
    start(processForensicRetesting, [
      {
        jobId: job.id,
        caseId,
      },
    ]).catch((error) => {
      console.error('[Forensic Retesting API] Workflow failed:', error);
      // Workflow will update job status to 'failed' internally
    });

    return withCors(
      NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: 'pending',
          message:
            'Forensic retesting analysis workflow has been triggered. Check processing job status for progress.',
        },
        { status: 202 },
      ),
    );
  } catch (error: any) {
    console.error('[Forensic Retesting API] Error:', error);
    return withCors(
      NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: 500 },
      ),
    );
  }
}
