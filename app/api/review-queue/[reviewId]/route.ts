/**
 * API Routes: Manage individual review queue items
 * GET /api/review-queue/[reviewId] - Get review details
 * PATCH /api/review-queue/[reviewId] - Update review (assign, change status, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { createServerSupabaseClient } from '@/lib/supabase-route-handler';

export async function GET(
  request: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  try {
    const { reviewId } = params;

    console.log(`[Review Queue API] Fetching review item ${reviewId}`);

    const { data: reviewItem, error } = await supabaseServer
      .from('document_review_queue')
      .select(`
        *,
        document:case_documents!document_id (
          id,
          file_name,
          document_type,
          storage_path,
          metadata,
          file_size,
          mime_type
        ),
        case:cases!case_id (
          id,
          case_number,
          title
        )
      `)
      .eq('id', reviewId)
      .single();

    if (error) {
      console.error('[Review Queue API] Error fetching review item:', error);
      return NextResponse.json(
        { error: 'Failed to fetch review item', details: error.message },
        { status: 500 }
      );
    }

    if (!reviewItem) {
      return NextResponse.json(
        { error: 'Review item not found' },
        { status: 404 }
      );
    }

    // Get the document file URL from storage
    let documentUrl = null;
    if (reviewItem.document?.storage_path) {
      const { data: urlData } = supabaseServer.storage
        .from('case-files')
        .getPublicUrl(reviewItem.document.storage_path);

      documentUrl = urlData?.publicUrl || null;
    }

    return NextResponse.json({
      ...reviewItem,
      documentUrl,
    });

  } catch (error: any) {
    console.error('[Review Queue API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  try {
    const { reviewId } = params;
    const body = await request.json();

    console.log(`[Review Queue API] Updating review item ${reviewId}`);

    // Allowed fields to update
    const allowedUpdates = ['status', 'assigned_to', 'review_notes'];
    const updates: any = {};

    for (const field of allowedUpdates) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    // If status is changing to 'in_review', set current user as assigned
    if (updates.status === 'in_review' && !updates.assigned_to) {
      const supabaseClient = await createServerSupabaseClient();
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (user) {
        updates.assigned_to = user.id;
      }
    }

    const { data, error } = await supabaseServer
      .from('document_review_queue')
      .update(updates)
      .eq('id', reviewId)
      .select()
      .single();

    if (error) {
      console.error('[Review Queue API] Error updating review item:', error);
      return NextResponse.json(
        { error: 'Failed to update review item', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('[Review Queue API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
