/**
 * API endpoint to clean up stuck processing jobs
 *
 * POST /api/processing-jobs/cleanup
 *
 * Query parameters:
 * - action: 'mark-failed' (default) or 'delete' - determines cleanup behavior
 * - threshold: number of hours to consider a job stuck (default: 2)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cleanupStuckJobs, deleteStuckJobs, findStuckJobs } from '@/lib/progress-tracker';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'mark-failed';
    const thresholdHours = parseInt(searchParams.get('threshold') || '2', 10);

    if (thresholdHours < 1 || thresholdHours > 24) {
      return NextResponse.json(
        { error: 'Threshold must be between 1 and 24 hours' },
        { status: 400 }
      );
    }

    if (action === 'delete') {
      // Permanently delete stuck jobs
      const result = await deleteStuckJobs(thresholdHours);
      return NextResponse.json({
        message: `Deleted ${result.deletedJobCount} stuck jobs`,
        deletedJobCount: result.deletedJobCount,
        deletedJobIds: result.deletedJobIds,
      });
    } else if (action === 'mark-failed') {
      // Mark stuck jobs as failed
      const result = await cleanupStuckJobs(thresholdHours);
      return NextResponse.json({
        message: `Marked ${result.cleanedJobCount} stuck jobs as failed`,
        cleanedJobCount: result.cleanedJobCount,
        cleanedJobIds: result.cleanedJobIds,
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "mark-failed" or "delete"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error cleaning up stuck jobs:', error);
    return NextResponse.json(
      { error: 'Failed to clean up stuck jobs' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to find stuck jobs without modifying them
 *
 * GET /api/processing-jobs/cleanup
 *
 * Query parameters:
 * - threshold: number of hours to consider a job stuck (default: 2)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const thresholdHours = parseInt(searchParams.get('threshold') || '2', 10);

    if (thresholdHours < 1 || thresholdHours > 24) {
      return NextResponse.json(
        { error: 'Threshold must be between 1 and 24 hours' },
        { status: 400 }
      );
    }

    const stuckJobs = await findStuckJobs(thresholdHours);

    return NextResponse.json({
      stuckJobCount: stuckJobs.length,
      stuckJobs,
    });
  } catch (error) {
    console.error('Error finding stuck jobs:', error);
    return NextResponse.json(
      { error: 'Failed to find stuck jobs' },
      { status: 500 }
    );
  }
}
