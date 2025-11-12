/**
 * Inngest Job Functions for Document Processing
 *
 * These background jobs handle:
 * 1. Document chunking (breaking documents into pages/sections)
 * 2. Parallel chunk extraction (50 concurrent workers)
 * 3. Embedding generation for semantic search
 * 4. Document aggregation and finalization
 */

import { inngest } from '@/lib/inngest-client';
import {
  chunkDocument,
  getChunkById,
  updateChunkStatus,
  getChunksForJob,
} from '@/lib/document-chunker';
import { extractDocumentContent } from '@/lib/document-parser';
import { deriveChunkPersistencePlan } from '@/lib/extraction-outcome';
import { supabaseServer } from '@/lib/supabase-server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

/**
 * Job 1: Chunk Document
 * Creates chunk records in database when a document is uploaded
 */
export const chunkDocumentJob = inngest.createFunction(
  {
    id: 'chunk-document',
    name: 'Chunk Document into Pages/Sections',
    retries: 3,
  },
  { event: 'document/chunk' },
  async ({ event, step }) => {
    const { caseId, caseFileId, storagePath, processingJobId, chunkingStrategy } = event.data;

    console.log(`[Job: Chunk Document] Starting for file: ${caseFileId}`);

    // Step 1: Create processing job record
    const jobId = await step.run('create-processing-job', async () => {
      if (processingJobId) {
        return processingJobId;
      }

      const { data: job, error } = await supabaseServer
        .from('processing_jobs')
        .insert({
          case_id: caseId,
          job_type: 'document_extraction',
          status: 'pending',
          metadata: {
            case_file_id: caseFileId,
            storage_path: storagePath,
            chunking_strategy: chunkingStrategy,
          },
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create processing job: ${error.message}`);
      }

      console.log(`[Job: Chunk Document] Created processing job: ${job.id}`);
      return job.id;
    });

    // Step 2: Chunk the document
    const chunkingResult = await step.run('chunk-document', async () => {
      const result = await chunkDocument(
        caseFileId,
        storagePath,
        chunkingStrategy,
        jobId
      );

      console.log(`[Job: Chunk Document] Created ${result.totalChunks} chunks`);
      return result;
    });

    // Step 3: Update job with total chunks
    await step.run('update-job-totals', async () => {
      const { error } = await supabaseServer
        .from('processing_jobs')
        .update({
          total_units: chunkingResult.totalChunks,
          status: 'running',
          started_at: new Date().toISOString(),
          estimated_completion: new Date(
            Date.now() + chunkingResult.estimatedProcessingTime * 1000
          ).toISOString(),
        })
        .eq('id', jobId);

      if (error) {
        console.error(`Failed to update job totals:`, error);
      }
    });

    // Step 4: Trigger parallel chunk processing
    const chunkEvents = chunkingResult.chunks.map((chunk, index) => ({
      name: 'chunk/process' as const,
      data: {
        chunkId: chunk.id || `chunk-${index}`, // Will be populated after insert
        caseFileId,
        storagePath,
        pageNumber: chunk.metadata.pageNumber,
        generateEmbedding: true,
      },
    }));

    // Get actual chunk IDs from database
    const { data: insertedChunks } = await supabaseServer
      .from('document_chunks')
      .select('id, chunk_index')
      .eq('case_file_id', caseFileId)
      .eq('processing_job_id', jobId)
      .order('chunk_index');

    if (insertedChunks && insertedChunks.length > 0) {
      const actualEvents = insertedChunks.map(chunk => ({
        name: 'chunk/process' as const,
        data: {
          chunkId: chunk.id,
          caseFileId,
          storagePath,
          generateEmbedding: true,
        },
      }));

      await step.sendEvent('trigger-chunk-processing', actualEvents);
      console.log(`[Job: Chunk Document] Triggered ${actualEvents.length} chunk processing jobs`);
    }

    return {
      jobId,
      totalChunks: chunkingResult.totalChunks,
      estimatedTime: chunkingResult.estimatedProcessingTime,
    };
  }
);

/**
 * Job 2: Process Individual Chunk
 * Extracts content from a single chunk (runs in parallel, 50 concurrent)
 */
export const processChunkJob = inngest.createFunction(
  {
    id: 'process-chunk',
    name: 'Process Document Chunk',
    concurrency: {
      limit: 50, // 50 concurrent chunk processors!
    },
    retries: 3,
  },
  { event: 'chunk/process' },
  async ({ event, step }) => {
    const { chunkId, caseFileId, storagePath, generateEmbedding = true } = event.data;

    console.log(`[Job: Process Chunk] Starting chunk: ${chunkId}`);

    // Step 1: Get chunk details
    const chunk = await step.run('get-chunk', async () => {
      const chunkData = await getChunkById(chunkId);
      if (!chunkData) {
        throw new Error(`Chunk not found: ${chunkId}`);
      }
      return chunkData;
    });

    // Step 2: Mark chunk as processing
    await step.run('mark-processing', async () => {
      await updateChunkStatus(chunkId, 'processing', {
        processing_attempts: (chunk.processing_attempts || 0) + 1,
      });
    });

    // Step 3: Extract content
    const extractionResult = await step.run('extract-content', async () => {
      try {
        // For now, extract entire document (page-specific extraction to be added)
        const result = await extractDocumentContent(storagePath, false);

        console.log(`[Job: Process Chunk] Extraction method: ${result.method}`);
        return result;
      } catch (error: any) {
        console.error(`[Job: Process Chunk] Extraction failed:`, error);
        throw error;
      }
    });

    const plan = deriveChunkPersistencePlan(chunk, extractionResult);

    if (plan.status === 'failed' && plan.error) {
      console.warn(
        `[Job: Process Chunk] Extraction produced no usable text. Marking chunk as failed (code=${plan.error.code}).`
      );
    } else {
      console.log(
        `[Job: Process Chunk] Extracted ${plan.contentForEmbedding?.length || 0} characters with confidence ${
          extractionResult.confidence ?? 'n/a'
        }`
      );
    }

    // Step 4: Generate embedding (if requested)
    let embedding: number[] | null = null;
    if (
      plan.status === 'completed' &&
      generateEmbedding &&
      plan.contentForEmbedding &&
      plan.contentForEmbedding.length > 0
    ) {
      embedding = await step.run('generate-embedding', async () => {
        try {
          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: plan.contentForEmbedding.substring(0, 8000), // OpenAI limit
          });

          console.log(`[Job: Process Chunk] Generated embedding`);
          return response.data[0].embedding;
        } catch (error: any) {
          console.error(`[Job: Process Chunk] Embedding failed:`, error);
          return null;
        }
      });
    }

    // Step 5: Update chunk with results
    await step.run('save-chunk-results', async () => {
      await updateChunkStatus(chunkId, plan.status, plan.updates);

      if (plan.status === 'completed' && embedding) {
        await supabaseServer
          .from('document_chunks')
          .update({
            content_embedding: embedding,
          })
          .eq('id', chunkId);
      }
    });

    // Step 6: Update processing job progress (for both success and failure)
    await step.run('update-job-progress', async () => {
      if (!chunk.processing_job_id) return;

      // Get current job stats
      const { data: chunks } = await supabaseServer
        .from('document_chunks')
        .select('processing_status')
        .eq('processing_job_id', chunk.processing_job_id);

      if (!chunks) return;

      const completed = chunks.filter(c => c.processing_status === 'completed').length;
      const failed = chunks.filter(c => c.processing_status === 'failed').length;
      const total = chunks.length;

      const { error } = await supabaseServer
        .from('processing_jobs')
        .update({
          completed_units: completed,
          failed_units: failed,
          status: completed + failed === total ? 'completed' : 'running',
          completed_at: completed + failed === total ? new Date().toISOString() : null,
        })
        .eq('id', chunk.processing_job_id);

      if (error) {
        console.error(`Failed to update job progress:`, error);
      }

      // If all chunks complete, trigger aggregation
      if (completed + failed === total) {
        console.log(`[Job: Process Chunk] All chunks completed, triggering aggregation`);
        await step.sendEvent('trigger-aggregation', {
          name: 'document/aggregate',
          data: {
            caseFileId,
            processingJobId: chunk.processing_job_id,
          },
        });
      }
    });

    // Return appropriate result based on status
    if (plan.status === 'failed') {
      return {
        chunkId,
        failed: true,
        error: plan.error,
      };
    }

    return {
      chunkId,
      charactersExtracted: plan.contentForEmbedding?.length || 0,
      confidence: extractionResult.confidence,
      hasEmbedding: !!embedding,
    };
  }
);

/**
 * Job 3: Aggregate Document
 * Combines all chunks into full document after processing completes
 */
export const aggregateDocumentJob = inngest.createFunction(
  {
    id: 'aggregate-document',
    name: 'Aggregate Document Chunks',
    retries: 2,
  },
  { event: 'document/aggregate' },
  async ({ event, step }) => {
    const { caseFileId, processingJobId } = event.data;

    console.log(`[Job: Aggregate Document] Starting for file: ${caseFileId}`);

    // Step 1: Retrieve all chunks
    const chunks = await step.run('fetch-all-chunks', async () => {
      const allChunks = await getChunksForJob(processingJobId);
      console.log(`[Job: Aggregate Document] Found ${allChunks.length} chunks`);
      return allChunks;
    });

    // Step 2: Combine chunk content
    const aggregatedData = await step.run('combine-chunks', async () => {
      const completedChunks = chunks
        .filter(c => c.processing_status === 'completed')
        .sort((a, b) => a.chunk_index - b.chunk_index);

      const fullText = completedChunks
        .map(c => c.content)
        .filter(Boolean)
        .join('\n\n--- Page Break ---\n\n');

      const avgConfidence =
        completedChunks.reduce((sum, c) => sum + (c.extraction_confidence || 0), 0) /
        completedChunks.length;

      return {
        fullText,
        avgConfidence,
        totalChunks: chunks.length,
        successfulChunks: completedChunks.length,
        failedChunks: chunks.filter(c => c.processing_status === 'failed').length,
      };
    });

    // Step 3: Update case_files with aggregated data
    await step.run('update-case-file', async () => {
      const { error } = await supabaseServer
        .from('case_files')
        .update({
          ai_extracted_text: aggregatedData.fullText,
          ai_analyzed: true,
          ai_analysis_confidence: aggregatedData.avgConfidence,
          metadata: {
            chunked_extraction: true,
            total_chunks: aggregatedData.totalChunks,
            successful_chunks: aggregatedData.successfulChunks,
            failed_chunks: aggregatedData.failedChunks,
            total_characters: aggregatedData.fullText.length,
            processing_completed: new Date().toISOString(),
            processing_job_id: processingJobId,
          },
        })
        .eq('id', caseFileId);

      if (error) {
        console.error(`Failed to update case file:`, error);
        throw error;
      }

      console.log(`[Job: Aggregate Document] Updated case file with ${aggregatedData.fullText.length} characters`);
    });

    // Step 4: Send completion event
    await step.sendEvent('document-complete', {
      name: 'document/chunks-completed',
      data: {
        caseFileId,
        processingJobId,
        totalChunks: aggregatedData.totalChunks,
        successfulChunks: aggregatedData.successfulChunks,
        failedChunks: aggregatedData.failedChunks,
      },
    });

    // Step 5: Get case ID and trigger Investigation Board population
    const caseId = await step.run('get-case-id', async () => {
      const { data: caseFile } = await supabaseServer
        .from('case_files')
        .select('case_id')
        .eq('id', caseFileId)
        .single();

      return caseFile?.case_id;
    });

    if (caseId) {
      await step.sendEvent('trigger-board-population', {
        name: 'board/populate',
        data: {
          caseId,
          caseFileId, // Populate from this specific file
        },
      });
      console.log(`[Job: Aggregate Document] Triggered Investigation Board population for case: ${caseId}`);
    }

    return {
      caseFileId,
      totalChunks: aggregatedData.totalChunks,
      successfulChunks: aggregatedData.successfulChunks,
      totalCharacters: aggregatedData.fullText.length,
      avgConfidence: aggregatedData.avgConfidence,
    };
  }
);

/**
 * Job 4: Generate Embeddings (Batch)
 * Generates embeddings for chunks that don't have them
 */
export const generateEmbeddingsJob = inngest.createFunction(
  {
    id: 'generate-embeddings-batch',
    name: 'Generate Embeddings for Chunks',
    concurrency: {
      limit: 10, // Limit to avoid OpenAI rate limits
    },
    retries: 3,
  },
  { event: 'embeddings/generate' },
  async ({ event, step }) => {
    const { chunkIds, processingJobId } = event.data;

    console.log(`[Job: Generate Embeddings] Processing ${chunkIds.length} chunks`);

    // Process each chunk
    const results = await step.run('generate-all-embeddings', async () => {
      const embeddings: Array<{ chunkId: string; success: boolean }> = [];

      for (const chunkId of chunkIds) {
        try {
          const chunk = await getChunkById(chunkId);
          if (!chunk || !chunk.content) {
            embeddings.push({ chunkId, success: false });
            continue;
          }

          const response = await openai.embeddings.create({
            model: 'text-embedding-3-small',
            input: chunk.content.substring(0, 8000),
          });

          await supabaseServer
            .from('document_chunks')
            .update({
              content_embedding: response.data[0].embedding,
            })
            .eq('id', chunkId);

          embeddings.push({ chunkId, success: true });
          console.log(`[Job: Generate Embeddings] Generated for chunk: ${chunkId}`);
        } catch (error) {
          console.error(`[Job: Generate Embeddings] Failed for chunk ${chunkId}:`, error);
          embeddings.push({ chunkId, success: false });
        }
      }

      return embeddings;
    });

    const successCount = results.filter(r => r.success).length;
    console.log(`[Job: Generate Embeddings] Completed ${successCount}/${chunkIds.length} embeddings`);

    return {
      total: chunkIds.length,
      successful: successCount,
      failed: chunkIds.length - successCount,
    };
  }
);
