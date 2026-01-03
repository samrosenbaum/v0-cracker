/**
 * Batch Processing Session API
 *
 * GET - Get session details and progress
 * PATCH - Pause/resume session
 * DELETE - Cancel session
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getBatchProgress,
  pauseBatchProcessing,
  resumeBatchProcessing,
  cancelBatchProcessing,
  startBatchProcessing,
  retryFailedDocuments
} from '@/lib/batch-processor';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const session = await getBatchProgress(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      session,
    });

  } catch (error: any) {
    console.error('[Batch Processing API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'start':
        await startBatchProcessing(sessionId);
        return NextResponse.json({
          success: true,
          message: 'Batch processing started',
        });

      case 'pause':
        const checkpoint = await pauseBatchProcessing(sessionId);
        return NextResponse.json({
          success: true,
          message: 'Batch processing paused',
          checkpoint,
        });

      case 'resume':
        await resumeBatchProcessing(sessionId);
        return NextResponse.json({
          success: true,
          message: 'Batch processing resumed',
        });

      case 'retry-failed':
        const count = await retryFailedDocuments(sessionId);
        return NextResponse.json({
          success: true,
          message: `Retrying ${count} failed documents`,
          retriedCount: count,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, pause, resume, or retry-failed' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('[Batch Processing API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    await cancelBatchProcessing(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Batch processing cancelled',
    });

  } catch (error: any) {
    console.error('[Batch Processing API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel session' },
      { status: 500 }
    );
  }
}
