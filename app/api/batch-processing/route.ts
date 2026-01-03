/**
 * Batch Processing API
 *
 * POST - Create a new batch processing session
 * GET - List all batch sessions for a case
 */

import { NextRequest, NextResponse } from 'next/server';
import { createBatchSession, getBatchSessions, startBatchProcessing } from '@/lib/batch-processor';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, batchSize, concurrencyLimit, autoStart } = body;

    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId is required' },
        { status: 400 }
      );
    }

    // Create the batch session
    const session = await createBatchSession({
      caseId,
      batchSize: batchSize || 10,
      concurrencyLimit: concurrencyLimit || 5,
    });

    // Auto-start if requested
    if (autoStart) {
      await startBatchProcessing(session.id);
      session.status = 'running';
    }

    return NextResponse.json({
      success: true,
      session,
      message: autoStart
        ? `Batch processing started for ${session.progress.total} documents`
        : `Batch session created for ${session.progress.total} documents. Call /batch-processing/${session.id}/start to begin.`,
    });

  } catch (error: any) {
    console.error('[Batch Processing API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create batch session' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');

    if (!caseId) {
      return NextResponse.json(
        { error: 'caseId query parameter is required' },
        { status: 400 }
      );
    }

    const sessions = await getBatchSessions(caseId);

    return NextResponse.json({
      success: true,
      sessions,
      count: sessions.length,
    });

  } catch (error: any) {
    console.error('[Batch Processing API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch batch sessions' },
      { status: 500 }
    );
  }
}
