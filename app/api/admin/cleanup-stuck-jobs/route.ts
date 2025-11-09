/**
 * Admin Endpoint: Cleanup Stuck Processing Jobs
 *
 * This endpoint deletes processing jobs that are stuck at 0% (never processed by Inngest)
 * and their associated document chunks.
 *
 * POST /api/admin/cleanup-stuck-jobs
 *
 * Body:
 * {
 *   "dryRun": true  // Optional: set to false to actually delete
 * }
 */

import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const dryRun = body.dryRun !== false; // Default to dry run

    // Use service role client to bypass RLS
    const supabaseServer = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Find stuck jobs:
    // - Status is 'pending' or 'running'
    // - progress_percentage = 0
    // - Created more than 5 minutes ago (to avoid deleting actively processing jobs)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    const { data: stuckJobs, error: fetchError } = await supabaseServer
      .from('processing_jobs')
      .select('id, job_type, status, total_units, completed_units, created_at, metadata')
      .in('status', ['pending', 'running'])
      .eq('completed_units', 0)
      .lte('created_at', fiveMinutesAgo);

    if (fetchError) {
      console.error('Error fetching stuck jobs:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch stuck jobs', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!stuckJobs || stuckJobs.length === 0) {
      return NextResponse.json({
        message: 'No stuck jobs found',
        deleted: 0,
      });
    }

    const jobIds = stuckJobs.map(job => job.id);

    // Count associated chunks
    const { count: chunkCount, error: chunkCountError } = await supabaseServer
      .from('document_chunks')
      .select('*', { count: 'exact', head: true })
      .in('processing_job_id', jobIds);

    if (chunkCountError) {
      console.error('Error counting chunks:', chunkCountError);
    }

    if (dryRun) {
      return NextResponse.json({
        message: 'DRY RUN - No changes made',
        stuckJobs: stuckJobs.map(job => ({
          id: job.id,
          type: job.job_type,
          status: job.status,
          totalUnits: job.total_units,
          completedUnits: job.completed_units,
          createdAt: job.created_at,
          fileName: job.metadata?.fileName || 'Unknown',
        })),
        totalJobs: stuckJobs.length,
        totalChunks: chunkCount || 0,
        action: 'Set dryRun: false to delete these jobs',
      });
    }

    // Actually delete - chunks first (to avoid orphans)
    const { error: deleteChunksError } = await supabaseServer
      .from('document_chunks')
      .delete()
      .in('processing_job_id', jobIds);

    if (deleteChunksError) {
      console.error('Error deleting chunks:', deleteChunksError);
      return NextResponse.json(
        { error: 'Failed to delete chunks', details: deleteChunksError.message },
        { status: 500 }
      );
    }

    // Delete jobs
    const { error: deleteJobsError } = await supabaseServer
      .from('processing_jobs')
      .delete()
      .in('id', jobIds);

    if (deleteJobsError) {
      console.error('Error deleting jobs:', deleteJobsError);
      return NextResponse.json(
        { error: 'Failed to delete jobs', details: deleteJobsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: 'Successfully cleaned up stuck jobs',
      deletedJobs: stuckJobs.length,
      deletedChunks: chunkCount || 0,
      jobs: stuckJobs.map(job => ({
        id: job.id,
        fileName: job.metadata?.fileName || 'Unknown',
      })),
    });

  } catch (error) {
    console.error('Error in cleanup-stuck-jobs:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}
