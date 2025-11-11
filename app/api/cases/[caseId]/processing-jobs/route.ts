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
import { hasPartialSupabaseConfig } from '@/lib/environment';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const { caseId } = params;
    const { searchParams } = new URL(request.url);
    const activeOnly = searchParams.get('active') === 'true';
    const statusFilter = searchParams.get('status');

    if (!caseId || caseId === 'undefined') {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      );
    }

    if (hasPartialSupabaseConfig()) {
      return NextResponse.json(
        {
          error:
            'Supabase service role key missing. Processing job data cannot be retrieved until SUPABASE_SERVICE_ROLE_KEY is set.',
        },
        { status: 500 }
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
