/**
 * API Route: Get Processing Jobs for a Case
 *
 * GET /api/cases/[caseId]/processing-jobs
 * Returns all processing jobs for a case with optional filters
 *
 * Query params:
 * - status: Filter by status (pending, running, completed, failed, cancelled)
 * - active: If true, only return active jobs (pending or running)
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getCaseProcessingJobs,
  getActiveJobs,
  getCaseDocumentStats,
} from '@/lib/progress-tracker';

export async function GET(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { caseId } = params;
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const statusFilter = searchParams.get('status');

    if (!caseId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      );
    }

    // Get jobs based on filters
    let jobs;
    if (activeOnly) {
      jobs = await getActiveJobs(caseId);
    } else {
      jobs = await getCaseProcessingJobs(caseId);
    }

    // Filter by status if specified
    if (statusFilter) {
      jobs = jobs.filter(job => job.status === statusFilter);
    }

    // Get case-wide statistics
    const stats = await getCaseDocumentStats(caseId);

    return NextResponse.json({
      success: true,
      jobs,
      stats,
      count: jobs.length,
    });
  } catch (error: any) {
    console.error('[API: Get Case Processing Jobs] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch processing jobs' },
      { status: 500 }
    );
  }
}
