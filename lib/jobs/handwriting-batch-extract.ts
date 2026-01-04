/**
 * Inngest Job: Batch Handwriting Extraction
 *
 * Processes multiple handwritten documents in parallel with progress tracking.
 * Handles retries, error recovery, and updates processing job status.
 */

import { inngest } from '../inngest-client';
import { supabaseServer } from '../supabase-server';
import {
  extractHandwrittenContent,
  HandwritingExtractionOptions,
} from '../handwriting-recognition';

/**
 * Batch handwriting extraction job
 * Triggered by POST /api/handwriting/batch
 */
export const batchHandwritingExtract = inngest.createFunction(
  {
    id: 'handwriting-batch-extract',
    name: 'Batch Handwriting Extraction',
    concurrency: {
      limit: 3, // Limit concurrent batch jobs
    },
    retries: 2,
  },
  { event: 'handwriting/batch.extract' },
  async ({ event, step }) => {
    const { jobId, caseId, documentIds, options } = event.data;

    console.log(`[Job/HandwritingBatch] Starting batch extraction for job ${jobId}`);
    console.log(`[Job/HandwritingBatch] Processing ${documentIds.length} documents`);

    // Update job status to running
    await step.run('update-job-running', async () => {
      await supabaseServer
        .from('processing_jobs')
        .update({
          status: 'running',
          started_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    });

    // Get document storage paths
    const documents = await step.run('fetch-documents', async () => {
      const { data, error } = await supabaseServer
        .from('case_documents')
        .select('id, storage_path, document_type, file_name')
        .in('id', documentIds);

      if (error) throw error;
      return data || [];
    });

    // Process documents in batches
    const batchSize = options.maxConcurrent || 5;
    let completedCount = 0;
    let failedCount = 0;
    const errors: Array<{ documentId: string; error: string }> = [];

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(documents.length / batchSize);

      console.log(`[Job/HandwritingBatch] Processing batch ${batchNumber}/${totalBatches}`);

      // Process batch in parallel
      const batchResults = await step.run(
        `process-batch-${batchNumber}`,
        async () => {
          const results = await Promise.allSettled(
            batch.map(async (doc) => {
              try {
                // Download file
                const { data: fileData, error: downloadError } = await supabaseServer.storage
                  .from('case-files')
                  .download(doc.storage_path);

                if (downloadError) {
                  throw new Error(`Download failed: ${downloadError.message}`);
                }

                const buffer = Buffer.from(await fileData.arrayBuffer());

                // Build extraction options
                const extractionOptions: HandwritingExtractionOptions = {
                  useClaudeVision: true,
                  useTesseractFallback: true,
                  applyPreprocessing: true,
                  documentType: (doc.document_type as any) || options.documentType,
                  eraHint: options.eraHint,
                  contextHint: options.contextHint,
                  writerProfileId: options.writerProfileId,
                  extractLineByLine: true,
                };

                // Extract handwritten content
                const result = await extractHandwrittenContent(buffer, extractionOptions);

                // Store result
                await storeExtractionResult(doc.id, caseId, result);

                // Queue for review if needed
                if (result.needsReview) {
                  await queueForReview(doc.id, caseId, result);
                }

                return { documentId: doc.id, success: true, confidence: result.confidence };
              } catch (error: any) {
                console.error(`[Job/HandwritingBatch] Error processing ${doc.id}:`, error);
                return { documentId: doc.id, success: false, error: error.message };
              }
            })
          );

          return results;
        }
      );

      // Count successes and failures
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          if (result.value.success) {
            completedCount++;
          } else {
            failedCount++;
            errors.push({
              documentId: result.value.documentId,
              error: result.value.error || 'Unknown error',
            });
          }
        } else {
          failedCount++;
          errors.push({
            documentId: 'unknown',
            error: result.reason?.message || 'Unknown error',
          });
        }
      }

      // Update job progress
      await step.run(`update-progress-${batchNumber}`, async () => {
        const progress = ((completedCount + failedCount) / documents.length) * 100;
        const estimatedCompletion = calculateEstimatedCompletion(
          i + batch.length,
          documents.length,
          event.data.startTime || Date.now()
        );

        await supabaseServer
          .from('processing_jobs')
          .update({
            completed_units: completedCount,
            failed_units: failedCount,
            estimated_completion: estimatedCompletion,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      });
    }

    // Final job update
    await step.run('complete-job', async () => {
      const finalStatus = failedCount === 0 ? 'completed' : (completedCount === 0 ? 'failed' : 'completed');

      await supabaseServer
        .from('processing_jobs')
        .update({
          status: finalStatus,
          completed_units: completedCount,
          failed_units: failedCount,
          error_summary: errors.length > 0 ? { errors: errors.slice(0, 20) } : null,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    });

    console.log(`[Job/HandwritingBatch] Completed job ${jobId}: ${completedCount} succeeded, ${failedCount} failed`);

    return {
      jobId,
      completedCount,
      failedCount,
      totalDocuments: documents.length,
    };
  }
);

/**
 * Store extraction result in database
 */
async function storeExtractionResult(
  documentId: string,
  caseId: string,
  result: any
) {
  // Update case_documents
  await supabaseServer
    .from('case_documents')
    .update({
      extracted_text: result.text,
      extraction_method: result.method,
      extraction_confidence: result.confidence,
      extraction_status: result.error ? 'failed' : (result.needsReview ? 'needs_review' : 'completed'),
      structured_data: result.structuredData || {},
      handwriting_analysis: result.handwritingAnalysis || {},
      is_handwritten: true,
      word_count: result.text ? result.text.split(/\s+/).length : 0,
      extracted_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  // Store in handwriting_extractions for history
  await supabaseServer
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
}

/**
 * Queue document for human review
 */
async function queueForReview(
  documentId: string,
  caseId: string,
  result: any
) {
  let priority = 5;
  if (result.confidence < 0.5) priority = 10;
  else if (result.confidence < 0.6) priority = 8;
  else if (result.confidence < 0.7) priority = 6;

  if (result.uncertainSegments?.length > 10) priority = Math.max(priority, 9);
  else if (result.uncertainSegments?.length > 5) priority = Math.max(priority, 7);

  await supabaseServer
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
}

/**
 * Calculate estimated completion time based on progress
 */
function calculateEstimatedCompletion(
  processedCount: number,
  totalCount: number,
  startTime: number
): string {
  if (processedCount === 0) return new Date(Date.now() + 3600000).toISOString(); // 1 hour default

  const elapsedMs = Date.now() - startTime;
  const msPerDocument = elapsedMs / processedCount;
  const remainingDocuments = totalCount - processedCount;
  const estimatedRemainingMs = msPerDocument * remainingDocuments;

  return new Date(Date.now() + estimatedRemainingMs).toISOString();
}

/**
 * Single document extraction job (for individual processing)
 */
export const singleHandwritingExtract = inngest.createFunction(
  {
    id: 'handwriting-single-extract',
    name: 'Single Handwriting Extraction',
    concurrency: {
      limit: 10,
    },
    retries: 3,
  },
  { event: 'handwriting/single.extract' },
  async ({ event, step }) => {
    const { documentId, caseId, storagePath, options } = event.data;

    console.log(`[Job/HandwritingSingle] Extracting document ${documentId}`);

    const result = await step.run('extract-handwriting', async () => {
      // Download file
      const { data: fileData, error } = await supabaseServer.storage
        .from('case-files')
        .download(storagePath);

      if (error) throw error;

      const buffer = Buffer.from(await fileData.arrayBuffer());

      // Extract
      return await extractHandwrittenContent(buffer, {
        useClaudeVision: true,
        useTesseractFallback: true,
        applyPreprocessing: true,
        ...options,
      });
    });

    // Store result
    await step.run('store-result', async () => {
      await storeExtractionResult(documentId, caseId, result);
    });

    // Queue for review if needed
    if (result.needsReview) {
      await step.run('queue-review', async () => {
        await queueForReview(documentId, caseId, result);
      });
    }

    return {
      documentId,
      confidence: result.confidence,
      needsReview: result.needsReview,
      textLength: result.text?.length || 0,
    };
  }
);
