/**
 * API Route: Get Processing Job Details
 *
 * GET /api/processing-jobs/[jobId]
 * Returns detailed information about a processing job including:
 * - Job status and progress
 * - Chunk statistics
 * - Failed chunks for debugging
 */

import { NextRequest, NextResponse } from 'next/server';
import { getProcessingSummary } from '@/lib/progress-tracker';

export async function GET(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Get comprehensive processing summary
    const summary = await getProcessingSummary(jobId);

    if (!summary.job) {
      return NextResponse.json(
        { error: 'Processing job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      job: summary.job,
      chunks: summary.chunks,
      failedChunks: summary.failedChunks,
    });
  } catch (error: any) {
    console.error('[API: Get Processing Job] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch processing job' },
      { status: 500 }
    );
  }
}
