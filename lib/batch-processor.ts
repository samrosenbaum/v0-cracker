/**
 * Batch Document Processor
 *
 * Handles large-scale document processing (1000s of documents) with:
 * - Memory management (process in configurable batches)
 * - Resume capability (checkpoint after each batch)
 * - Rate limiting (avoid overwhelming AI services)
 * - Parallel processing with concurrency control
 * - Real-time progress tracking
 */

import { supabaseServer } from './supabase-server';
import { extractDocumentContent, ExtractionResult } from './document-parser';
import { inngest } from './inngest-client';

export interface BatchProcessingConfig {
  caseId: string;
  batchSize: number;           // Documents per batch (default: 10)
  concurrencyLimit: number;    // Parallel extractions (default: 5)
  maxRetries: number;          // Retry failed documents (default: 3)
  rateLimitPerMinute: number;  // AI API calls per minute (default: 60)
  checkpointInterval: number;  // Save progress every N documents (default: 5)
  prioritizeByType: boolean;   // Process police reports first (default: true)
  extractEntities: boolean;    // Run entity extraction (default: true)
  extractClaims: boolean;      // Run claim extraction on statements (default: true)
}

export interface BatchProcessingSession {
  id: string;
  caseId: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: BatchProgress;
  checkpoint: BatchCheckpoint;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface BatchProgress {
  total: number;
  processed: number;
  failed: number;
  skipped: number;
  remaining: number;
  percentComplete: number;
  estimatedTimeRemaining: number; // seconds
  currentBatch: number;
  totalBatches: number;
  avgProcessingTimeMs: number;
  documentsPerMinute: number;
}

export interface BatchCheckpoint {
  lastProcessedIndex: number;
  lastProcessedDocumentId: string;
  lastCheckpointAt: Date;
  completedBatches: number[];
  failedDocuments: FailedDocument[];
  processingStats: ProcessingStats;
}

export interface FailedDocument {
  documentId: string;
  documentPath: string;
  error: string;
  retryCount: number;
  lastAttemptAt: Date;
}

export interface ProcessingStats {
  totalProcessingTimeMs: number;
  documentsProcessed: number;
  entitiesExtracted: number;
  claimsExtracted: number;
  avgConfidence: number;
}

export interface DocumentProcessingResult {
  documentId: string;
  storagePath: string;
  status: 'completed' | 'failed' | 'skipped';
  extraction?: ExtractionResult;
  entitiesExtracted?: number;
  claimsExtracted?: number;
  processingTimeMs: number;
  error?: string;
}

const DEFAULT_CONFIG: Partial<BatchProcessingConfig> = {
  batchSize: 10,
  concurrencyLimit: 5,
  maxRetries: 3,
  rateLimitPerMinute: 60,
  checkpointInterval: 5,
  prioritizeByType: true,
  extractEntities: true,
  extractClaims: true,
};

/**
 * Create a new batch processing session
 */
export async function createBatchSession(
  config: Partial<BatchProcessingConfig> & { caseId: string }
): Promise<BatchProcessingSession> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config } as BatchProcessingConfig;

  // Get all documents for the case
  const { data: documents, error: docError } = await supabaseServer
    .from('case_files')
    .select('id, storage_path, file_type, file_size, ai_analyzed')
    .eq('case_id', config.caseId)
    .order('created_at', { ascending: true });

  if (docError) {
    throw new Error(`Failed to fetch case documents: ${docError.message}`);
  }

  // Filter to unprocessed documents
  const unprocessedDocs = documents?.filter(d => !d.ai_analyzed) || [];
  const totalBatches = Math.ceil(unprocessedDocs.length / fullConfig.batchSize);

  // Create the session
  const { data: session, error: sessionError } = await supabaseServer
    .from('batch_processing_sessions')
    .insert({
      case_id: config.caseId,
      session_name: `Batch ${new Date().toISOString()}`,
      status: 'queued',
      total_documents: unprocessedDocs.length,
      batch_size: fullConfig.batchSize,
      concurrency_limit: fullConfig.concurrencyLimit,
      total_batches: totalBatches,
      checkpoint_data: {
        config: fullConfig,
        documentIds: unprocessedDocs.map(d => d.id),
      },
    })
    .select()
    .single();

  if (sessionError) {
    throw new Error(`Failed to create batch session: ${sessionError.message}`);
  }

  // Create individual document status records
  const docStatuses = unprocessedDocs.map((doc, index) => ({
    batch_session_id: session.id,
    case_file_id: doc.id,
    document_path: doc.storage_path,
    status: 'pending',
    file_size_bytes: doc.file_size,
    max_retries: fullConfig.maxRetries,
  }));

  if (docStatuses.length > 0) {
    const { error: statusError } = await supabaseServer
      .from('batch_document_status')
      .insert(docStatuses);

    if (statusError) {
      console.error('Failed to create document status records:', statusError);
    }
  }

  return {
    id: session.id,
    caseId: config.caseId,
    status: 'queued',
    progress: {
      total: unprocessedDocs.length,
      processed: 0,
      failed: 0,
      skipped: 0,
      remaining: unprocessedDocs.length,
      percentComplete: 0,
      estimatedTimeRemaining: 0,
      currentBatch: 0,
      totalBatches,
      avgProcessingTimeMs: 0,
      documentsPerMinute: 0,
    },
    checkpoint: {
      lastProcessedIndex: -1,
      lastProcessedDocumentId: '',
      lastCheckpointAt: new Date(),
      completedBatches: [],
      failedDocuments: [],
      processingStats: {
        totalProcessingTimeMs: 0,
        documentsProcessed: 0,
        entitiesExtracted: 0,
        claimsExtracted: 0,
        avgConfidence: 0,
      },
    },
    createdAt: new Date(session.created_at),
  };
}

/**
 * Start batch processing via Inngest
 */
export async function startBatchProcessing(sessionId: string): Promise<void> {
  // Update session status
  await supabaseServer
    .from('batch_processing_sessions')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  // Trigger Inngest job
  await inngest.send({
    name: 'batch/start',
    data: {
      sessionId,
    },
  });
}

/**
 * Pause batch processing
 */
export async function pauseBatchProcessing(sessionId: string): Promise<BatchCheckpoint> {
  const { data: session } = await supabaseServer
    .from('batch_processing_sessions')
    .select('checkpoint_data')
    .eq('id', sessionId)
    .single();

  await supabaseServer
    .from('batch_processing_sessions')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  return session?.checkpoint_data as BatchCheckpoint;
}

/**
 * Resume batch processing
 */
export async function resumeBatchProcessing(sessionId: string): Promise<void> {
  await supabaseServer
    .from('batch_processing_sessions')
    .update({
      status: 'running',
      paused_at: null,
    })
    .eq('id', sessionId);

  await inngest.send({
    name: 'batch/resume',
    data: {
      sessionId,
    },
  });
}

/**
 * Get batch processing progress
 */
export async function getBatchProgress(sessionId: string): Promise<BatchProcessingSession | null> {
  const { data: session, error } = await supabaseServer
    .from('batch_processing_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

  if (error || !session) {
    return null;
  }

  // Get document status counts
  const { data: statusCounts } = await supabaseServer
    .from('batch_document_status')
    .select('status')
    .eq('batch_session_id', sessionId);

  const counts = {
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    skipped: 0,
  };

  statusCounts?.forEach(s => {
    const status = s.status as keyof typeof counts;
    if (status in counts) counts[status]++;
  });

  const processed = counts.completed + counts.failed + counts.skipped;
  const total = session.total_documents;
  const percentComplete = total > 0 ? (processed / total) * 100 : 0;

  // Calculate estimated time remaining
  const avgTimeMs = session.avg_processing_time_ms || 5000;
  const remaining = total - processed;
  const estimatedTimeRemaining = (remaining * avgTimeMs) / 1000;

  return {
    id: session.id,
    caseId: session.case_id,
    status: session.status,
    progress: {
      total,
      processed,
      failed: counts.failed,
      skipped: counts.skipped,
      remaining,
      percentComplete,
      estimatedTimeRemaining,
      currentBatch: session.current_batch_number,
      totalBatches: session.total_batches,
      avgProcessingTimeMs: avgTimeMs,
      documentsPerMinute: avgTimeMs > 0 ? 60000 / avgTimeMs : 0,
    },
    checkpoint: session.checkpoint_data as BatchCheckpoint,
    createdAt: new Date(session.created_at),
    startedAt: session.started_at ? new Date(session.started_at) : undefined,
    completedAt: session.completed_at ? new Date(session.completed_at) : undefined,
  };
}

/**
 * Retry failed documents
 */
export async function retryFailedDocuments(sessionId: string): Promise<number> {
  // Reset failed documents to pending
  const { data: failedDocs, error } = await supabaseServer
    .from('batch_document_status')
    .update({
      status: 'pending',
      error_message: null,
      error_stack: null,
    })
    .eq('batch_session_id', sessionId)
    .eq('status', 'failed')
    .lt('retry_count', 3) // Only retry if under max retries
    .select();

  if (error) {
    throw new Error(`Failed to reset failed documents: ${error.message}`);
  }

  const count = failedDocs?.length || 0;

  if (count > 0) {
    // Trigger processing
    await inngest.send({
      name: 'batch/retry-failed',
      data: {
        sessionId,
        documentIds: failedDocs?.map(d => d.case_file_id),
      },
    });
  }

  return count;
}

/**
 * Process a single document within a batch
 */
export async function processDocument(
  documentId: string,
  storagePath: string,
  config: BatchProcessingConfig
): Promise<DocumentProcessingResult> {
  const startTime = Date.now();

  try {
    // Update status to processing
    await supabaseServer
      .from('batch_document_status')
      .update({ status: 'processing' })
      .eq('case_file_id', documentId);

    // Extract document content
    const extraction = await extractDocumentContent(storagePath, true);

    if (extraction.error && !extraction.text) {
      throw new Error(extraction.error);
    }

    let entitiesExtracted = 0;
    let claimsExtracted = 0;

    // Extract entities if enabled and we have structured data
    if (config.extractEntities && extraction.structuredData?.entities) {
      entitiesExtracted = extraction.structuredData.entities.length;
      // Entity storage will be handled by entity resolution system
    }

    const processingTimeMs = Date.now() - startTime;

    // Update status to completed
    await supabaseServer
      .from('batch_document_status')
      .update({
        status: 'completed',
        processing_time_ms: processingTimeMs,
        extraction_method: extraction.method,
        extraction_confidence: extraction.confidence,
        entities_extracted: entitiesExtracted,
        claims_extracted: claimsExtracted,
        processed_at: new Date().toISOString(),
      })
      .eq('case_file_id', documentId);

    return {
      documentId,
      storagePath,
      status: 'completed',
      extraction,
      entitiesExtracted,
      claimsExtracted,
      processingTimeMs,
    };

  } catch (error: any) {
    const processingTimeMs = Date.now() - startTime;

    // Update status to failed
    await supabaseServer
      .from('batch_document_status')
      .update({
        status: 'failed',
        processing_time_ms: processingTimeMs,
        error_message: error.message,
        error_stack: error.stack,
        retry_count: supabaseServer.rpc('increment_retry_count', { doc_id: documentId }),
      })
      .eq('case_file_id', documentId);

    return {
      documentId,
      storagePath,
      status: 'failed',
      processingTimeMs,
      error: error.message,
    };
  }
}

/**
 * Process a batch of documents
 */
export async function processBatch(
  sessionId: string,
  batchNumber: number,
  documents: { id: string; storagePath: string }[],
  config: BatchProcessingConfig
): Promise<DocumentProcessingResult[]> {
  const results: DocumentProcessingResult[] = [];

  // Process documents with concurrency limit
  const chunks: { id: string; storagePath: string }[][] = [];
  for (let i = 0; i < documents.length; i += config.concurrencyLimit) {
    chunks.push(documents.slice(i, i + config.concurrencyLimit));
  }

  for (const chunk of chunks) {
    const chunkResults = await Promise.all(
      chunk.map(doc => processDocument(doc.id, doc.storagePath, config))
    );
    results.push(...chunkResults);

    // Rate limiting - wait if needed
    if (config.rateLimitPerMinute > 0) {
      const msPerRequest = 60000 / config.rateLimitPerMinute;
      await new Promise(resolve => setTimeout(resolve, msPerRequest * chunk.length));
    }
  }

  // Update session checkpoint
  const processed = results.filter(r => r.status === 'completed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  const avgTime = results.reduce((sum, r) => sum + r.processingTimeMs, 0) / results.length;

  await supabaseServer
    .from('batch_processing_sessions')
    .update({
      current_batch_number: batchNumber,
      processed_documents: supabaseServer.rpc('increment_processed', { session_id: sessionId, count: processed }),
      failed_documents: supabaseServer.rpc('increment_failed', { session_id: sessionId, count: failed }),
      avg_processing_time_ms: avgTime,
      last_checkpoint_at: new Date().toISOString(),
      checkpoint_data: {
        lastBatchNumber: batchNumber,
        lastBatchResults: results.map(r => ({ id: r.documentId, status: r.status })),
      },
    })
    .eq('id', sessionId);

  return results;
}

/**
 * Cancel batch processing
 */
export async function cancelBatchProcessing(sessionId: string): Promise<void> {
  await supabaseServer
    .from('batch_processing_sessions')
    .update({
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);
}

/**
 * Get all batch sessions for a case
 */
export async function getBatchSessions(caseId: string): Promise<BatchProcessingSession[]> {
  const { data: sessions, error } = await supabaseServer
    .from('batch_processing_sessions')
    .select('*')
    .eq('case_id', caseId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch batch sessions: ${error.message}`);
  }

  return Promise.all(
    (sessions || []).map(s => getBatchProgress(s.id).then(p => p!))
  );
}
