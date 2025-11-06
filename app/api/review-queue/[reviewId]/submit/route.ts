/**
 * API Route: Submit human corrections for a review item
 * POST /api/review-queue/[reviewId]/submit
 *
 * Body:
 * {
 *   corrections: { "0": "corrected text", "1": "another correction" },
 *   reviewNotes?: "Optional notes from reviewer"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { reviewId: string } }
) {
  try {
    const { reviewId } = params;
    const body = await request.json();

    console.log(`[Review Queue API] Submitting corrections for review ${reviewId}`);

    const { corrections, reviewNotes } = body;

    if (!corrections || typeof corrections !== 'object') {
      return NextResponse.json(
        { error: 'Corrections object is required' },
        { status: 400 }
      );
    }

    // Get current user
    const { data: { user } } = await supabaseServer.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the review item
    const { data: reviewItem, error: fetchError } = await supabaseServer
      .from('document_review_queue')
      .select('*, document:case_documents!document_id(id, storage_path)')
      .eq('id', reviewId)
      .single();

    if (fetchError || !reviewItem) {
      console.error('[Review Queue API] Error fetching review item:', fetchError);
      return NextResponse.json(
        { error: 'Review item not found', details: fetchError?.message },
        { status: 404 }
      );
    }

    // Build corrected text by applying corrections to uncertain segments
    const uncertainSegments = reviewItem.uncertain_segments || [];
    let correctedText = reviewItem.extracted_text || '';

    // Store individual corrections for learning
    const ocrCorrections = [];

    for (const [segmentIdx, correctedValue] of Object.entries(corrections)) {
      const idx = parseInt(segmentIdx);
      const segment = uncertainSegments[idx];

      if (segment && correctedValue) {
        // Track this correction for learning
        ocrCorrections.push({
          review_queue_id: reviewId,
          original_text: segment.text,
          original_confidence: segment.confidence,
          corrected_text: correctedValue as string,
          document_type: 'handwritten_police_document', // Could be dynamic
          correction_type: segment.text === correctedValue ? 'confirmed_correct' : 'full_replacement',
          corrected_by: user.id,
        });

        // Simple text replacement (in production, use position-aware replacement)
        correctedText = correctedText.replace(
          new RegExp(`\\b${segment.text}\\b`, 'g'),
          correctedValue as string
        );
      }
    }

    // Update review queue item
    const { error: updateError } = await supabaseServer
      .from('document_review_queue')
      .update({
        status: 'completed',
        corrections,
        review_notes: reviewNotes || null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewId);

    if (updateError) {
      console.error('[Review Queue API] Error updating review item:', updateError);
      return NextResponse.json(
        { error: 'Failed to update review item', details: updateError.message },
        { status: 500 }
      );
    }

    // Update the document with corrected text
    if (reviewItem.document?.id) {
      const { error: docUpdateError } = await supabaseServer
        .from('case_documents')
        .update({
          ai_extracted_text: correctedText,
          metadata: {
            ...(reviewItem.document as any).metadata,
            human_reviewed: true,
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
            corrections_count: Object.keys(corrections).length,
          },
        })
        .eq('id', reviewItem.document.id);

      if (docUpdateError) {
        console.error('[Review Queue API] Error updating document:', docUpdateError);
        // Don't fail the whole request, just log
      }
    }

    // Save corrections to learning table
    if (ocrCorrections.length > 0) {
      const { error: correctionsError } = await supabaseServer
        .from('ocr_corrections')
        .insert(ocrCorrections);

      if (correctionsError) {
        console.error('[Review Queue API] Error saving corrections for learning:', correctionsError);
        // Don't fail the whole request, just log
      } else {
        console.log(`[Review Queue API] Saved ${ocrCorrections.length} corrections for learning`);
      }
    }

    console.log(`[Review Queue API] ✓ Successfully submitted ${Object.keys(corrections).length} corrections`);

    return NextResponse.json({
      success: true,
      correctionsApplied: Object.keys(corrections).length,
      correctedText,
    });

  } catch (error: any) {
    console.error('[Review Queue API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
