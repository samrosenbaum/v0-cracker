/**
 * API Route: Retry Failed Chunks
 *
 * POST /api/processing-jobs/[jobId]/retry
 * Resets failed chunks to pending status and triggers reprocessing
 */

import { NextRequest, NextResponse } from 'next/server';
import { retryFailedChunks } from '@/lib/progress-tracker';
import { sendInngestEvent } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { jobId: string } }
) {
  try {
    const { jobId } = params;

    if (!jobId) {
      return NextResponse.json(
        { error: 'Job ID is required' },
        { status: 400 }
      );
    }

    // Retry failed chunks (resets them to pending)
    const retriedCount = await retryFailedChunks(jobId);

    if (retriedCount === 0) {
      return NextResponse.json({
        success: true,
        message: 'No failed chunks to retry',
        retriedCount: 0,
      });
    }

    // Get the pending chunks to trigger reprocessing
    const { data: pendingChunks } = await supabaseServer
      .from('document_chunks')
      .select('id, case_file_id, metadata')
      .eq('processing_job_id', jobId)
      .eq('processing_status', 'pending');

    if (pendingChunks && pendingChunks.length > 0) {
      // Get storage path from the first chunk's metadata
      const { data: caseFile } = await supabaseServer
        .from('case_files')
        .select('storage_path')
        .eq('id', pendingChunks[0].case_file_id)
        .single();

      if (caseFile) {
        // Trigger chunk processing for each pending chunk
        const events = pendingChunks.map(chunk => ({
          name: 'chunk/process' as const,
          data: {
            chunkId: chunk.id,
            caseFileId: chunk.case_file_id,
            storagePath: caseFile.storage_path,
            generateEmbedding: true,
          },
        }));

        // Send events to Inngest
        await sendInngestEvent('chunk/process', events[0].data);
        for (let i = 1; i < events.length; i++) {
          await sendInngestEvent('chunk/process', events[i].data);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully queued ${retriedCount} chunks for retry`,
      retriedCount,
    });
  } catch (error: any) {
    console.error('[API: Retry Failed Chunks] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to retry chunks' },
      { status: 500 }
    );
  }
}
