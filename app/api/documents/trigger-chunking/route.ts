/**
 * API Endpoint: Trigger Document Chunking
 *
 * POST /api/documents/trigger-chunking
 *
 * Triggers the Inngest chunking job for uploaded documents.
 * This endpoint should be called after a document is successfully uploaded.
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendInngestEvent } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId, storagePath, fileName, fileType, fileSize } = body;

    // Validate required fields
    if (!caseId || !storagePath) {
      return NextResponse.json(
        { error: 'Missing required fields: caseId, storagePath' },
        { status: 400 }
      );
    }

    console.log(`[Trigger Chunking] Starting for file: ${fileName}`);

    // Get case_file_id (we need to find the record that was just created)
    // We'll search by storage_path since that's unique
    const { data: caseFile, error: queryError } = await supabaseServer
      .from('case_documents')
      .select('id, case_id')
      .eq('storage_path', storagePath)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (queryError || !caseFile) {
      console.error(`[Trigger Chunking] Failed to find case file:`, queryError);
      return NextResponse.json(
        { error: 'Case file not found in database' },
        { status: 404 }
      );
    }

    // Determine chunking strategy based on file type
    let chunkingStrategy: {
      type: 'page' | 'section' | 'sliding-window';
      pageSize?: number;
      chunkSize?: number;
      overlap?: number;
    } = { type: 'page' };

    // For PDFs, use page-level chunking
    if (storagePath.toLowerCase().endsWith('.pdf')) {
      chunkingStrategy = { type: 'page' };
    }
    // For text files, use sliding window if file is large
    else if (storagePath.match(/\.(txt|md|log|csv)$/i) && fileSize && fileSize > 100000) {
      chunkingStrategy = {
        type: 'sliding-window',
        chunkSize: 4000,
        overlap: 500,
      };
    }

    // Trigger Inngest chunking job
    await sendInngestEvent('document/chunk', {
      caseId,
      caseFileId: caseFile.id,
      storagePath,
      fileName: fileName || storagePath.split('/').pop() || 'unknown',
      fileType: fileType || 'unknown',
      fileSize: fileSize || 0,
      processingJobId: '', // Will be created by the job
      chunkingStrategy,
    });

    console.log(`[Trigger Chunking] Successfully triggered chunking job for: ${fileName}`);

    return NextResponse.json({
      success: true,
      message: 'Document chunking job triggered',
      caseFileId: caseFile.id,
      strategy: chunkingStrategy,
    });
  } catch (error: any) {
    console.error(`[Trigger Chunking] Error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to trigger chunking' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check if chunking is enabled
 */
export async function GET() {
  return NextResponse.json({
    enabled: true,
    message: 'Document chunking is enabled',
    features: [
      'Page-level PDF chunking',
      'Sliding window text chunking',
      'Parallel processing (50 concurrent)',
      'Vector embeddings for semantic search',
      'Progress tracking',
    ],
  });
}
