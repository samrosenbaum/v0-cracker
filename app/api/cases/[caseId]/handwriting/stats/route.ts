/**
 * Handwriting Statistics API
 *
 * GET /api/cases/[caseId]/handwriting/stats
 *
 * Returns statistics about handwritten document processing for a case.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;

    // Get total documents count
    const { count: totalDocuments } = await supabase
      .from('case_documents')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId);

    // Get handwritten documents count
    const { count: handwrittenDocuments } = await supabase
      .from('case_documents')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('is_handwritten', true);

    // Get extracted documents count
    const { count: extractedDocuments } = await supabase
      .from('case_documents')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('is_handwritten', true)
      .eq('extraction_status', 'completed');

    // Get pending review count
    const { count: pendingReview } = await supabase
      .from('document_review_queue')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId)
      .eq('review_type', 'handwriting')
      .in('status', ['pending', 'in_review']);

    // Get average confidence
    const { data: confidenceData } = await supabase
      .from('case_documents')
      .select('extraction_confidence')
      .eq('case_id', caseId)
      .eq('is_handwritten', true)
      .not('extraction_confidence', 'is', null);

    const averageConfidence = confidenceData && confidenceData.length > 0
      ? confidenceData.reduce((sum, d) => sum + (d.extraction_confidence || 0), 0) / confidenceData.length
      : 0;

    // Get writer profiles count
    const { count: writerProfiles } = await supabase
      .from('writer_profiles')
      .select('*', { count: 'exact', head: true })
      .eq('case_id', caseId);

    return NextResponse.json({
      success: true,
      data: {
        totalDocuments: totalDocuments || 0,
        handwrittenDocuments: handwrittenDocuments || 0,
        extractedDocuments: extractedDocuments || 0,
        pendingReview: pendingReview || 0,
        averageConfidence,
        writerProfiles: writerProfiles || 0,
      },
    });

  } catch (error: any) {
    console.error('[API/Handwriting/Stats] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
