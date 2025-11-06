/**
 * Document Chunking Module
 *
 * Breaks documents into processable chunks for parallel extraction.
 * Handles:
 * - Page-level chunking for PDFs
 * - Sliding window chunking for long text
 * - Section-based chunking
 * - Chunk metadata management
 */

import { supabaseServer } from './supabase-server';
import * as pdfParse from 'pdf-parse';
import type { Database } from '@/app/types/database';

export interface ChunkingStrategy {
  type: 'page' | 'section' | 'sliding-window';
  pageSize?: number; // For PDFs
  chunkSize?: number; // For sliding window (characters)
  overlap?: number; // Overlapping context (characters)
}

// Use the database type but with a typed metadata field for our use
export type DocumentChunkRow = Database['public']['Tables']['document_chunks']['Row'];
export type DocumentChunkInsert = Database['public']['Tables']['document_chunks']['Insert'];

export interface DocumentChunk extends Omit<DocumentChunkInsert, 'metadata'> {
  id?: string;
  metadata: {
    pageNumber?: number;
    totalPages?: number;
    startChar?: number;
    endChar?: number;
    imageFormat?: string;
    fileName?: string;
    [key: string]: any;
  };
}

export interface ChunkingResult {
  chunks: DocumentChunk[];
  totalChunks: number;
  estimatedProcessingTime: number; // seconds
  strategy: ChunkingStrategy;
}

/**
 * Main chunking function
 * Creates chunk records in database for parallel processing
 */
export async function chunkDocument(
  caseFileId: string,
  storagePath: string,
  strategy: ChunkingStrategy = { type: 'page' },
  processingJobId?: string
): Promise<ChunkingResult> {
  console.log(`[Document Chunker] Chunking document: ${storagePath}`);
  console.log(`[Document Chunker] Strategy:`, strategy);

  try {
    // Get document metadata to determine chunking approach
    const metadata = await getDocumentMetadata(storagePath);
    console.log(`[Document Chunker] Metadata:`, metadata);

    // Generate chunks based on file type and strategy
    let chunks: DocumentChunk[] = [];

    if (metadata.type === 'pdf' && strategy.type === 'page') {
      // PDF: One chunk per page
      chunks = await chunkPDF(caseFileId, storagePath, metadata, processingJobId);
    } else if (metadata.type === 'image') {
      // Image: Single chunk
      chunks = await chunkImage(caseFileId, metadata, processingJobId);
    } else if (metadata.type === 'audio') {
      // Audio: Single chunk
      chunks = await chunkAudio(caseFileId, metadata, processingJobId);
    } else if (strategy.type === 'sliding-window') {
      // Text with sliding windows
      chunks = await chunkTextWithSlidingWindow(
        caseFileId,
        storagePath,
        strategy,
        processingJobId
      );
    } else {
      // Default: Single chunk
      chunks = [{
        case_file_id: caseFileId,
        processing_job_id: processingJobId,
        chunk_index: 1,
        chunk_type: 'page',
        processing_status: 'pending',
        metadata: {
          fileName: metadata.fileName,
        },
      }];
    }

    // Bulk insert chunks into database
    const { error: insertError } = await supabaseServer
      .from('document_chunks')
      .insert(chunks);

    if (insertError) {
      console.error(`[Document Chunker] Failed to insert chunks:`, insertError);
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    // Calculate estimated processing time
    const estimatedTime = estimateProcessingTime(chunks, metadata.type);

    console.log(`[Document Chunker] Created ${chunks.length} chunks`);
    console.log(`[Document Chunker] Estimated processing time: ${estimatedTime}s`);

    return {
      chunks,
      totalChunks: chunks.length,
      estimatedProcessingTime: estimatedTime,
      strategy,
    };
  } catch (error: any) {
    console.error(`[Document Chunker] Error:`, error);
    throw error;
  }
}

/**
 * Get document metadata without full extraction
 */
async function getDocumentMetadata(storagePath: string): Promise<{
  type: 'pdf' | 'image' | 'audio' | 'text' | 'unknown';
  pageCount?: number;
  fileSize?: number;
  format?: string;
  fileName: string;
}> {
  const lowerPath = storagePath.toLowerCase();
  const fileName = storagePath.split('/').pop() || storagePath;

  // Determine file type
  let type: 'pdf' | 'image' | 'audio' | 'text' | 'unknown' = 'unknown';
  let pageCount: number | undefined;

  if (lowerPath.endsWith('.pdf')) {
    type = 'pdf';

    // Download and get page count
    try {
      const { data: fileData } = await supabaseServer.storage
        .from('case-files')
        .download(storagePath);

      if (fileData) {
        const buffer = Buffer.from(await fileData.arrayBuffer());
        const pdfData = await (pdfParse as any)(buffer);
        pageCount = pdfData.numpages;
      }
    } catch (error) {
      console.warn(`[Document Chunker] Could not get PDF page count:`, error);
      pageCount = 1; // Fallback
    }
  } else if (lowerPath.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/)) {
    type = 'image';
    pageCount = 1;
  } else if (lowerPath.match(/\.(mp3|wav|m4a|ogg|flac)$/)) {
    type = 'audio';
    pageCount = 1;
  } else if (lowerPath.match(/\.(txt|md|log|csv)$/)) {
    type = 'text';
    pageCount = 1;
  }

  return {
    type,
    pageCount,
    fileName,
  };
}

/**
 * Chunk a PDF by pages
 */
async function chunkPDF(
  caseFileId: string,
  storagePath: string,
  metadata: any,
  processingJobId?: string
): Promise<DocumentChunk[]> {
  const pageCount = metadata.pageCount || 1;
  const chunks: DocumentChunk[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    chunks.push({
      case_file_id: caseFileId,
      processing_job_id: processingJobId,
      chunk_index: pageNum,
      chunk_type: 'page',
      processing_status: 'pending',
      metadata: {
        pageNumber: pageNum,
        totalPages: pageCount,
        fileName: metadata.fileName,
      },
    });
  }

  return chunks;
}

/**
 * Chunk an image (single chunk)
 */
async function chunkImage(
  caseFileId: string,
  metadata: any,
  processingJobId?: string
): Promise<DocumentChunk[]> {
  return [{
    case_file_id: caseFileId,
    processing_job_id: processingJobId,
    chunk_index: 1,
    chunk_type: 'page',
    processing_status: 'pending',
    metadata: {
      imageFormat: metadata.format,
      fileName: metadata.fileName,
    },
  }];
}

/**
 * Chunk audio (single chunk)
 */
async function chunkAudio(
  caseFileId: string,
  metadata: any,
  processingJobId?: string
): Promise<DocumentChunk[]> {
  return [{
    case_file_id: caseFileId,
    processing_job_id: processingJobId,
    chunk_index: 1,
    chunk_type: 'page',
    processing_status: 'pending',
    metadata: {
      fileName: metadata.fileName,
    },
  }];
}

/**
 * Chunk text with sliding window
 * Useful for very long text documents
 */
async function chunkTextWithSlidingWindow(
  caseFileId: string,
  storagePath: string,
  strategy: ChunkingStrategy,
  processingJobId?: string
): Promise<DocumentChunk[]> {
  // Download file
  const { data: fileData } = await supabaseServer.storage
    .from('case-files')
    .download(storagePath);

  if (!fileData) {
    throw new Error('Failed to download file for chunking');
  }

  const buffer = Buffer.from(await fileData.arrayBuffer());
  const fullText = buffer.toString('utf-8');

  const chunkSize = strategy.chunkSize || 4000;
  const overlap = strategy.overlap || 500;

  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;

  for (let i = 0; i < fullText.length; i += (chunkSize - overlap)) {
    const endChar = Math.min(i + chunkSize, fullText.length);

    chunks.push({
      case_file_id: caseFileId,
      processing_job_id: processingJobId,
      chunk_index: chunkIndex,
      chunk_type: 'sliding-window',
      processing_status: 'pending',
      metadata: {
        startChar: i,
        endChar: endChar,
        fileName: storagePath.split('/').pop() || storagePath,
      },
    });

    chunkIndex++;

    // Break if we've reached the end
    if (endChar >= fullText.length) break;
  }

  return chunks;
}

/**
 * Estimate processing time based on chunk count and type
 */
function estimateProcessingTime(
  chunks: DocumentChunk[],
  fileType: string
): number {
  const chunkCount = chunks.length;

  // Time estimates per chunk (seconds)
  const timePerChunk: Record<string, number> = {
    pdf: 2, // PDF parsing
    image: 10, // OCR
    audio: 30, // Transcription (assuming 30s audio)
    text: 1, // Direct read
  };

  const baseTime = timePerChunk[fileType] || 2;

  // With 50 concurrent workers, divide by concurrency
  const concurrency = 50;
  const totalSequentialTime = chunkCount * baseTime;
  const parallelTime = Math.ceil(totalSequentialTime / concurrency);

  return parallelTime;
}

/**
 * Get chunks for a processing job
 */
export async function getChunksForJob(
  processingJobId: string
): Promise<DocumentChunk[]> {
  const { data, error } = await supabaseServer
    .from('document_chunks')
    .select('*')
    .eq('processing_job_id', processingJobId)
    .order('chunk_index');

  if (error) {
    throw new Error(`Failed to get chunks: ${error.message}`);
  }

  return data || [];
}

/**
 * Get pending chunks (for worker to pick up)
 */
export async function getPendingChunks(
  processingJobId: string,
  limit: number = 10
): Promise<DocumentChunk[]> {
  const { data, error } = await supabaseServer
    .from('document_chunks')
    .select('*')
    .eq('processing_job_id', processingJobId)
    .eq('processing_status', 'pending')
    .order('chunk_index')
    .limit(limit);

  if (error) {
    throw new Error(`Failed to get pending chunks: ${error.message}`);
  }

  return data || [];
}

/**
 * Update chunk status
 */
export async function updateChunkStatus(
  chunkId: string,
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped',
  updates: Partial<{
    content: string | null;
    extraction_confidence: number | null;
    extraction_method: 'pdf-parse' | 'ocr-tesseract' | 'ocr-google' | 'whisper-transcription' | 'direct-read' | 'cached' | null;
    error_log: string | null;
    processed_at: string | null;
    metadata: any;
    processing_attempts: number;
  }> = {}
): Promise<void> {
  const { error } = await supabaseServer
    .from('document_chunks')
    .update({
      processing_status: status,
      ...updates,
    } as any)
    .eq('id', chunkId);

  if (error) {
    throw new Error(`Failed to update chunk status: ${error.message}`);
  }
}

/**
 * Get chunk by ID
 */
export async function getChunkById(chunkId: string): Promise<DocumentChunk | null> {
  const { data, error } = await supabaseServer
    .from('document_chunks')
    .select('*')
    .eq('id', chunkId)
    .single();

  if (error) {
    console.error(`Failed to get chunk: ${error.message}`);
    return null;
  }

  return data;
}
