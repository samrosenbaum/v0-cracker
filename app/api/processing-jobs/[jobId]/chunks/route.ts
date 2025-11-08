/**
 * API Route: Get Chunks for a Processing Job
 *
 * GET /api/processing-jobs/[jobId]/chunks
 * Returns all chunks for a job with optional filtering
 *
 * Query params:
 * - status: Filter by status (pending, processing, completed, failed, skipped)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ jobId: string }> | { jobId: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const { jobId } = params;
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Build query
    let query = supabaseServer
      .from('document_chunks')
      .select('*')
      .eq('processing_job_id', jobId)
      .order('chunk_index');

    // Apply status filter if provided
    if (statusFilter) {
      query = query.eq('processing_status', statusFilter);
    }

    const { data: chunks, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      success: true,
      chunks: chunks || [],
      count: chunks?.length || 0,
    });
  } catch (error: any) {
    console.error('[API: Get Job Chunks] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chunks' },
      { status: 500 }
    );
  }
}
