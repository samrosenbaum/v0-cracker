/**
 * API Endpoint: Reprocess Case Documents
 *
 * POST /api/documents/reprocess-case
 *
 * Clears bad extracted data and re-triggers document chunking for all documents in a case.
 * Use this when document extraction has failed or produced bad results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { sendInngestEvent } from '@/lib/inngest-client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { caseId } = body;

    if (!caseId) {
      return NextResponse.json(
        { error: 'Missing required field: caseId' },
        { status: 400 }
      );
    }

    console.log(`[Reprocess Case] Starting for case: ${caseId}`);

    // Step 1: Get all case files
    const { data: caseFiles, error: filesError } = await supabaseServer
      .from('case_files')
      .select('id, storage_path, file_name, file_type, file_size')
      .eq('case_id', caseId)
      .not('storage_path', 'is', null);

    if (filesError) {
      throw new Error(`Failed to fetch case files: ${filesError.message}`);
    }

    if (!caseFiles || caseFiles.length === 0) {
      return NextResponse.json(
        { error: 'No files found for this case' },
        { status: 404 }
      );
    }

    console.log(`[Reprocess Case] Found ${caseFiles.length} files to reprocess`);

    // Step 2: Clear document chunks for this case
    const caseFileIds = caseFiles.map(f => f.id);
    const { error: deleteChunksError } = await supabaseServer
      .from('document_chunks')
      .delete()
      .in('case_file_id', caseFileIds);

    if (deleteChunksError) {
      console.error('[Reprocess Case] Failed to delete chunks:', deleteChunksError);
    } else {
      console.log('[Reprocess Case] Cleared existing chunks');
    }

    // Step 3: Clear extracted text from case_files
    const { error: clearTextError } = await supabaseServer
      .from('case_files')
      .update({
        ai_extracted_text: null,
        ai_analyzed: false,
        ai_analysis_confidence: null,
      })
      .in('id', caseFileIds);

    if (clearTextError) {
      console.error('[Reprocess Case] Failed to clear extracted text:', clearTextError);
    } else {
      console.log('[Reprocess Case] Cleared extracted text');
    }

    // Step 4: Clear investigation board data
    const { error: clearEntitiesError } = await supabaseServer
      .from('case_entities')
      .delete()
      .eq('case_id', caseId);

    const { error: clearEventsError } = await supabaseServer
      .from('timeline_events')
      .delete()
      .eq('case_id', caseId);

    const { error: clearConnectionsError } = await supabaseServer
      .from('case_connections')
      .delete()
      .eq('case_id', caseId);

    const { error: clearAlibisError } = await supabaseServer
      .from('alibi_entries')
      .delete()
      .eq('case_id', caseId);

    console.log('[Reprocess Case] Cleared investigation board data');

    // Step 5: Re-trigger chunking for each file
    const chunkingJobs = [];
    for (const file of caseFiles) {
      try {
        // Determine chunking strategy
        let chunkingStrategy: {
          type: 'page' | 'section' | 'sliding-window';
          pageSize?: number;
          chunkSize?: number;
          overlap?: number;
        } = { type: 'page' };

        if (file.storage_path.toLowerCase().endsWith('.pdf')) {
          chunkingStrategy = { type: 'page' };
        } else if (
          file.storage_path.match(/\.(txt|md|log|csv)$/i) &&
          file.file_size &&
          file.file_size > 100000
        ) {
          chunkingStrategy = {
            type: 'sliding-window',
            chunkSize: 4000,
            overlap: 500,
          };
        }

        // Trigger chunking job
        await sendInngestEvent('document/chunk', {
          caseId,
          caseFileId: file.id,
          storagePath: file.storage_path,
          fileName: file.file_name || file.storage_path.split('/').pop() || 'unknown',
          fileType: file.file_type || 'unknown',
          fileSize: file.file_size || 0,
          processingJobId: '',
          chunkingStrategy,
        });

        chunkingJobs.push(file.file_name);
        console.log(`[Reprocess Case] Triggered chunking for: ${file.file_name}`);
      } catch (error: any) {
        console.error(`[Reprocess Case] Failed to trigger chunking for ${file.file_name}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Reprocessing ${caseFiles.length} documents`,
      filesReprocessing: chunkingJobs,
      caseId,
      nextSteps: [
        'Documents are being re-extracted in the background',
        'Once complete, use "Populate from Documents" to rebuild the timeline board',
        'Check processing status in a few minutes',
      ],
    });
  } catch (error: any) {
    console.error(`[Reprocess Case] Error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to reprocess documents' },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check reprocessing status
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const caseId = searchParams.get('caseId');

  if (!caseId) {
    return NextResponse.json(
      { error: 'Missing required parameter: caseId' },
      { status: 400 }
    );
  }

  try {
    // Get case files and their chunk status
    const { data: caseFiles } = await supabaseServer
      .from('case_files')
      .select('id, file_name, ai_analyzed')
      .eq('case_id', caseId);

    if (!caseFiles) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    const fileIds = caseFiles.map(f => f.id);

    // Count chunks by status
    const { data: chunks } = await supabaseServer
      .from('document_chunks')
      .select('processing_status, case_file_id')
      .in('case_file_id', fileIds);

    const chunkStats = {
      total: chunks?.length || 0,
      completed: chunks?.filter(c => c.processing_status === 'completed').length || 0,
      processing: chunks?.filter(c => c.processing_status === 'processing').length || 0,
      pending: chunks?.filter(c => c.processing_status === 'pending').length || 0,
      failed: chunks?.filter(c => c.processing_status === 'failed').length || 0,
    };

    const progress = chunkStats.total > 0
      ? Math.round((chunkStats.completed / chunkStats.total) * 100)
      : 0;

    return NextResponse.json({
      caseId,
      totalFiles: caseFiles.length,
      filesAnalyzed: caseFiles.filter(f => f.ai_analyzed).length,
      chunks: chunkStats,
      progress: `${progress}%`,
      isComplete: chunkStats.total > 0 && chunkStats.completed === chunkStats.total,
      readyForBoardPopulation: chunkStats.completed > 0,
    });
  } catch (error: any) {
    console.error('[Reprocess Case] Status check error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check status' },
      { status: 500 }
    );
  }
}
