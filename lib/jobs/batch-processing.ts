/**
 * Inngest Job: Batch Document Processing
 *
 * Processes large numbers of documents with checkpointing and resume capability.
 * Handles 1000s of documents without failing by processing in batches.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { extractDocumentContent } from '@/lib/document-parser';
import { extractEntitiesFromText } from '@/lib/entity-resolution';

// Types for document status tracking
interface BatchDocumentStatus {
  documentId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
}

// Helper functions for batch processing
async function getDocumentStatus(sessionId: string, documentId: string): Promise<BatchDocumentStatus | null> {
  const { data } = await supabaseServer
    .from('batch_document_status')
    .select('*')
    .eq('session_id', sessionId)
    .eq('document_id', documentId)
    .single();
  return data;
}

async function updateDocumentStatus(
  sessionId: string,
  documentId: string,
  status: string,
  result?: any
): Promise<void> {
  await supabaseServer
    .from('batch_document_status')
    .upsert({
      session_id: sessionId,
      document_id: documentId,
      status,
      result,
      updated_at: new Date().toISOString(),
    });
}

async function recordProcessingError(
  sessionId: string,
  documentId: string,
  errorMessage: string,
  errorStack?: string
): Promise<void> {
  await supabaseServer
    .from('batch_processing_errors')
    .insert({
      session_id: sessionId,
      document_id: documentId,
      error_message: errorMessage,
      error_stack: errorStack,
      created_at: new Date().toISOString(),
    });
}

const BATCH_SIZE = 10; // Process 10 documents at a time

interface BatchProcessingEventData {
  sessionId: string;
  caseId: string;
  documentIds: string[];
  options?: {
    extractEntities?: boolean;
    parseStatements?: boolean;
    generateTimelines?: boolean;
    detectInconsistencies?: boolean;
  };
}

export const processBatchDocumentsJob = inngest.createFunction(
  {
    id: 'batch-process-documents',
    name: 'Batch Document Processing with Checkpointing',
    retries: 3,
    concurrency: {
      limit: 1, // One batch session at a time to avoid conflicts
    },
  },
  { event: 'batch/process-documents' },
  async ({ event, step }) => {
    const { sessionId, caseId, documentIds, options } = event.data as BatchProcessingEventData;
    const totalDocs = documentIds.length;

    console.log(`[Batch Processing] Starting session ${sessionId} with ${totalDocs} documents`);

    try {
      // Step 1: Update session status to running
      await step.run('initialize-session', async () => {
        await supabaseServer
          .from('batch_processing_sessions')
          .update({
            status: 'running',
            started_at: new Date().toISOString(),
          })
          .eq('id', sessionId);
      });

      // Process documents in batches
      const batches = [];
      for (let i = 0; i < documentIds.length; i += BATCH_SIZE) {
        batches.push(documentIds.slice(i, i + BATCH_SIZE));
      }

      let processedCount = 0;
      let successCount = 0;
      let failedCount = 0;

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        const batchName = `process-batch-${batchIndex + 1}`;

        const batchResults = await step.run(batchName, async () => {
          const results = {
            processed: 0,
            succeeded: 0,
            failed: 0,
          };

          for (const docId of batch) {
            try {
              // Check if already processed (for resume capability)
              const existingStatus = await getDocumentStatus(sessionId, docId);
              if (existingStatus?.status === 'completed') {
                results.processed++;
                results.succeeded++;
                continue;
              }

              // Mark as processing
              await updateDocumentStatus(sessionId, docId, 'processing');

              // Get document info
              const { data: doc, error: docError } = await supabaseServer
                .from('case_files')
                .select('*')
                .eq('id', docId)
                .single();

              if (docError || !doc) {
                throw new Error(`Document not found: ${docId}`);
              }

              // Extract text content
              const extraction = await extractDocumentContent(doc.storage_path);

              if (!extraction.text) {
                throw new Error(extraction.error || 'Extraction failed');
              }

              // Update document with extracted content
              await supabaseServer
                .from('case_files')
                .update({
                  extracted_text: extraction.text,
                  extraction_method: extraction.method,
                  processing_status: 'completed',
                })
                .eq('id', docId);

              // Extract entities if requested
              if (options?.extractEntities && extraction.text) {
                try {
                  await extractEntitiesFromText(caseId, docId, extraction.text);
                } catch (entityError: any) {
                  console.warn(`[Batch Processing] Entity extraction warning for ${docId}:`, entityError.message);
                }
              }

              // Mark as completed
              await updateDocumentStatus(sessionId, docId, 'completed', {
                extractedChars: extraction.text?.length || 0,
                pageCount: extraction.pageCount || 1,
              });

              results.processed++;
              results.succeeded++;

            } catch (error: any) {
              console.error(`[Batch Processing] Document ${docId} failed:`, error.message);

              await updateDocumentStatus(sessionId, docId, 'failed');
              await recordProcessingError(sessionId, docId, error.message, error.stack);

              results.processed++;
              results.failed++;
            }
          }

          // Update session progress
          const completedTotal = processedCount + results.processed;
          await supabaseServer
            .from('batch_processing_sessions')
            .update({
              documents_processed: completedTotal,
              documents_succeeded: successCount + results.succeeded,
              documents_failed: failedCount + results.failed,
              progress_percentage: Math.round((completedTotal / totalDocs) * 100),
              last_checkpoint: new Date().toISOString(),
            })
            .eq('id', sessionId);

          return results;
        });

        processedCount += batchResults.processed;
        successCount += batchResults.succeeded;
        failedCount += batchResults.failed;
      }

      // Step 3: Finalize session
      await step.run('finalize-session', async () => {
        await supabaseServer
          .from('batch_processing_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            documents_processed: processedCount,
            documents_succeeded: successCount,
            documents_failed: failedCount,
            progress_percentage: 100,
          })
          .eq('id', sessionId);
      });

      console.log(`[Batch Processing] Session ${sessionId} completed: ${successCount}/${totalDocs} successful`);

      return {
        success: true,
        sessionId,
        processed: processedCount,
        succeeded: successCount,
        failed: failedCount,
      };

    } catch (error: any) {
      console.error(`[Batch Processing] Session ${sessionId} failed:`, error);

      await supabaseServer
        .from('batch_processing_sessions')
        .update({
          status: 'failed',
          error_message: error.message,
          completed_at: new Date().toISOString(),
        })
        .eq('id', sessionId);

      throw error;
    }
  }
);
