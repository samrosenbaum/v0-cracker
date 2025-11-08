/**
 * API Route: Get document review queue for a case
 * GET /api/cases/[caseId]/review-queue
 *
 * Returns all pending document reviews that need human verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await context.params;

    // Get query parameters
    const url = new URL(request.url);
    const status = url.searchParams.get('status') || 'pending'; // pending, in_review, completed, all

    console.log(`[Review Queue API] Fetching review queue for case ${caseId}, status: ${status}`);

    // Build query
    let query = supabaseServer
      .from('document_review_queue')
      .select(`
        *,
        document:case_documents!document_id (
          id,
          file_name,
          document_type,
          storage_path,
          metadata
        )
      `)
      .eq('case_id', caseId)
      .order('priority', { ascending: false }) // Highest priority first
      .order('created_at', { ascending: true }); // Then oldest first

    // Filter by status if not 'all'
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: reviewQueue, error } = await query;

    if (error) {
      console.error('[Review Queue API] Error fetching review queue:', error);
      return NextResponse.json(
        { error: 'Failed to fetch review queue', details: error.message },
        { status: 500 }
      );
    }

    // Calculate summary stats
    const stats = {
      total: reviewQueue?.length || 0,
      pending: reviewQueue?.filter(r => r.status === 'pending').length || 0,
      inReview: reviewQueue?.filter(r => r.status === 'in_review').length || 0,
      completed: reviewQueue?.filter(r => r.status === 'completed').length || 0,
      totalUncertainSegments: reviewQueue?.reduce((sum, r) =>
        sum + (Array.isArray(r.uncertain_segments) ? r.uncertain_segments.length : 0),
        0
      ) || 0,
    };

    console.log(`[Review Queue API] Found ${reviewQueue?.length || 0} review items`);

    return NextResponse.json({
      reviewQueue: reviewQueue || [],
      stats,
    });

  } catch (error: any) {
    console.error('[Review Queue API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
