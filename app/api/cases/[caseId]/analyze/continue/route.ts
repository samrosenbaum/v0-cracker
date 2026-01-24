import { NextRequest, NextResponse } from 'next/server';
import { continueChunkedAnalysis } from '@/lib/chunked-analysis';

// Allow up to 300s per continuation step
export const maxDuration = 300;

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { jobId } = body;

    if (!jobId) {
      return withCors(
        NextResponse.json(
          { error: 'jobId is required' },
          { status: 400 }
        )
      );
    }

    const result = await continueChunkedAnalysis(jobId);

    return withCors(
      NextResponse.json({
        success: true,
        ...result,
      })
    );
  } catch (error: any) {
    console.error('[Analyze Continue] Error:', error);
    return withCors(
      NextResponse.json(
        {
          error: error.message || 'Continue step failed',
          done: true,
          phase: 'failed',
        },
        { status: 500 }
      )
    );
  }
}
