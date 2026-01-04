/**
 * Handwriting Extraction API Endpoint
 *
 * POST /api/handwriting/extract
 *
 * Extracts text from handwritten document images using AI-powered recognition.
 * Supports both single document and multi-page extraction.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  extractHandwrittenContent,
  HandwritingExtractionOptions,
} from '@/lib/handwriting-recognition';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      storagePath,
      documentId,
      caseId,
      documentType = 'unknown',
      eraHint,
      contextHint,
      writerProfileId,
      useClaudeVision = true,
      applyPreprocessing = true,
      extractLineByLine = true,
    } = body;

    // Validate required fields
    if (!storagePath) {
      return NextResponse.json(
        { error: 'Missing required field: storagePath' },
        { status: 400 }
      );
    }

    console.log(`[API/Handwriting] Extracting from: ${storagePath}`);

    // Download the file from Supabase storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('case-files')
      .download(storagePath);

    if (downloadError) {
      console.error('[API/Handwriting] Download error:', downloadError);
      return NextResponse.json(
        { error: `Failed to download file: ${downloadError.message}` },
        { status: 500 }
      );
    }

    // Convert to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Build extraction options
    const options: HandwritingExtractionOptions = {
      useClaudeVision,
      useTesseractFallback: true,
      applyPreprocessing,
      documentType,
      eraHint,
      contextHint,
      writerProfileId,
      extractLineByLine,
    };

    // Perform extraction
    const result = await extractHandwrittenContent(buffer, options);

    // Store result in database if documentId provided
    if (documentId) {
      await storeExtractionResult(documentId, caseId, result);
    }

    // Queue for review if needed
    if (result.needsReview && documentId && caseId) {
      await queueForReview(documentId, caseId, result);
    }

    return NextResponse.json({
      success: true,
      data: {
        text: result.text,
        confidence: result.confidence,
        method: result.method,
        handwritingAnalysis: result.handwritingAnalysis,
        lineByLineExtraction: result.lineByLineExtraction,
        alternativeReadings: result.alternativeReadings,
        uncertainSegments: result.uncertainSegments,
        structuredData: result.structuredData,
        preprocessingApplied: result.preprocessingApplied,
        needsReview: result.needsReview,
      },
    });

  } catch (error: any) {
    console.error('[API/Handwriting] Extraction error:', error);
    return NextResponse.json(
      { error: `Extraction failed: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * Store extraction result in database
 */
async function storeExtractionResult(
  documentId: string,
  caseId: string | undefined,
  result: any
) {
  try {
    // Update case_documents table
    const { error: updateError } = await supabase
      .from('case_documents')
      .update({
        extracted_text: result.text,
        extraction_method: result.method,
        extraction_confidence: result.confidence,
        extraction_status: result.error ? 'failed' : (result.needsReview ? 'needs_review' : 'completed'),
        structured_data: result.structuredData || {},
        handwriting_analysis: result.handwritingAnalysis || {},
        word_count: result.text ? result.text.split(/\s+/).length : 0,
        extracted_at: new Date().toISOString(),
        metadata: {
          lineByLineExtraction: result.lineByLineExtraction,
          alternativeReadings: result.alternativeReadings,
          preprocessingApplied: result.preprocessingApplied,
        },
      })
      .eq('id', documentId);

    if (updateError) {
      console.warn('[API/Handwriting] Failed to update case_documents:', updateError);
    }

    // Also store in handwriting_extractions table for history
    const { error: insertError } = await supabase
      .from('handwriting_extractions')
      .insert({
        document_id: documentId,
        case_id: caseId,
        extracted_text: result.text,
        confidence: result.confidence,
        method: result.method,
        handwriting_analysis: result.handwritingAnalysis,
        line_by_line_extraction: result.lineByLineExtraction,
        alternative_readings: result.alternativeReadings,
        uncertain_segments: result.uncertainSegments,
        structured_data: result.structuredData,
        preprocessing_applied: result.preprocessingApplied,
        needs_review: result.needsReview,
      });

    if (insertError) {
      console.warn('[API/Handwriting] Failed to insert handwriting_extractions:', insertError);
    }

  } catch (error) {
    console.error('[API/Handwriting] Error storing result:', error);
  }
}

/**
 * Queue document for human review
 */
async function queueForReview(
  documentId: string,
  caseId: string,
  result: any
) {
  try {
    // Calculate priority based on confidence and uncertainty
    let priority = 5; // Default medium
    if (result.confidence < 0.5) priority = 10;
    else if (result.confidence < 0.6) priority = 8;
    else if (result.confidence < 0.7) priority = 6;

    if (result.uncertainSegments?.length > 10) priority = Math.max(priority, 9);
    else if (result.uncertainSegments?.length > 5) priority = Math.max(priority, 7);

    const { error } = await supabase
      .from('document_review_queue')
      .upsert({
        document_id: documentId,
        case_id: caseId,
        extracted_text: result.text,
        overall_confidence: result.confidence,
        extraction_method: result.method,
        uncertain_segments: result.uncertainSegments || [],
        alternative_readings: result.alternativeReadings || [],
        line_by_line_extraction: result.lineByLineExtraction || [],
        handwriting_analysis: result.handwritingAnalysis,
        status: 'pending',
        priority,
        review_type: 'handwriting',
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'document_id',
      });

    if (error) {
      console.warn('[API/Handwriting] Failed to queue for review:', error);
    } else {
      console.log(`[API/Handwriting] Queued document ${documentId} for review (priority: ${priority})`);
    }

  } catch (error) {
    console.error('[API/Handwriting] Error queueing for review:', error);
  }
}
