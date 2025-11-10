/**
 * Document Parser Module
 *
 * Comprehensive document parsing for investigative case files:
 * - PDF text extraction (digital and scanned)
 * - OCR for images and handwritten documents
 * - Audio transcription
 * - Caching to avoid re-processing
 */

import { supabaseServer } from './supabase-server';
import Tesseract from 'tesseract.js';
import OpenAI from 'openai';

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsModulePromise: Promise<PdfjsModule | null> | null = null;

async function loadPdfJsModule(): Promise<PdfjsModule | null> {
  if (!pdfjsModulePromise) {
    pdfjsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs')
      .then(mod => {
        try {
          if (mod.GlobalWorkerOptions) {
            mod.GlobalWorkerOptions.workerSrc = '';
          }
        } catch (workerError) {
          console.warn('[Document Parser] Unable to configure pdfjs worker', workerError);
        }
        return mod;
      })
      .catch(error => {
        console.error('[Document Parser] Failed to load pdfjs module:', error);
        pdfjsModulePromise = null;
        return null;
      });
  }

  return pdfjsModulePromise;
}

// Initialize OpenAI client for Whisper transcription
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export interface UncertainSegment {
  text: string;           // What OCR thinks it says
  confidence: number;     // 0-1 score for this segment
  position: {
    page?: number;
    boundingBox: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  imageSnippet?: string;  // Base64 encoded crop of the unclear text region
  alternatives?: string[]; // Other possible readings from OCR
  wordIndex?: number;      // Position in the word sequence
}

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  confidence?: number; // 0-1 score for OCR
  method: 'pdf-parse' | 'pdfjs-dist' | 'ocr-tesseract' | 'ocr-google' | 'whisper-transcription' | 'cached';
  metadata?: any;
  error?: string;
  uncertainSegments?: UncertainSegment[]; // Segments that need human review
  needsReview?: boolean; // Quick flag if human review is recommended
}

/**
 * Main function: Extract text from any document type
 * Automatically detects file type and uses appropriate extraction method
 */
export async function extractDocumentContent(
  storagePath: string,
  cacheInDatabase: boolean = true
): Promise<ExtractionResult> {

  console.log(`[Document Parser] Extracting content from: ${storagePath}`);

  try {
    // Check if already extracted (cached in database)
    if (cacheInDatabase) {
      const cached = await getCachedExtraction(storagePath);
      if (cached) {
        console.log(`[Document Parser] Using cached extraction`);
        return cached;
      }
    }

    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseServer.storage
      .from('case-files')
      .download(storagePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    // Convert to buffer
    const buffer = Buffer.from(await fileData.arrayBuffer());

    // Determine file type and extract accordingly
    const result = await extractByFileType(storagePath, buffer);

    // Cache result in database
    if (cacheInDatabase && result.text) {
      await cacheExtraction(storagePath, result);
    }

    return result;

  } catch (error: any) {
    console.error(`[Document Parser] Error extracting ${storagePath}:`, error);
    return {
      text: '',
      method: 'pdf-parse',
      error: error.message,
      confidence: 0,
    };
  }
}

/**
 * Extract text based on file type
 */
async function extractByFileType(
  storagePath: string,
  buffer: Buffer
): Promise<ExtractionResult> {

  const lowerPath = storagePath.toLowerCase();

  // PDF files
  if (lowerPath.endsWith('.pdf')) {
    return await extractFromPDF(buffer);
  }

  // Image files (photos, scans)
  if (lowerPath.match(/\.(jpg|jpeg|png|gif|bmp|tiff|webp)$/)) {
    return await extractFromImage(buffer);
  }

  // Audio files (interviews, 911 calls)
  if (lowerPath.match(/\.(mp3|wav|m4a|ogg|flac)$/)) {
    return await transcribeAudio(buffer, storagePath);
  }

  // Plain text files
  if (lowerPath.match(/\.(txt|md|log|csv)$/)) {
    return {
      text: buffer.toString('utf-8'),
      method: 'pdf-parse', // reusing enum
      confidence: 1.0,
    };
  }

  // Word documents (would need additional library)
  if (lowerPath.match(/\.(doc|docx)$/)) {
    // TODO: Add mammoth.js for Word doc parsing
    return {
      text: '[Word document - extraction not yet implemented]',
      method: 'pdf-parse',
      confidence: 0,
      error: 'Word document parsing requires mammoth.js library',
    };
  }

  // Unsupported file type
  return {
    text: `[Unsupported file type: ${storagePath}]`,
    method: 'pdf-parse',
    confidence: 0,
    error: 'Unsupported file type',
  };
}

/**
 * Extract text from PDF (handles both digital and scanned)
 */
async function extractFromPDF(buffer: Buffer): Promise<ExtractionResult> {

  console.log('[Document Parser] Processing PDF...');

  const pdfjs = await loadPdfJsModule();

  if (!pdfjs) {
    return {
      text: '[Unable to load PDF parser module]',
      method: 'pdfjs-dist',
      confidence: 0,
      error: 'pdfjs module failed to load',
      needsReview: true,
    };
  }

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });

  try {
    const pdfDocument = await loadingTask.promise;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map(item => {
          const anyItem = item as any;
          if (typeof anyItem.str === 'string') return anyItem.str;
          if (typeof anyItem.text === 'string') return anyItem.text;
          if (typeof anyItem.unicode === 'string') return anyItem.unicode;
          return '';
        })
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (pageText) {
        pageTexts.push(pageText);
      }

      try {
        page.cleanup();
      } catch (cleanupError) {
        console.warn('[Document Parser] Failed to cleanup PDF page', cleanupError);
      }
    }

    const combinedText = pageTexts.join('\n\n');
    const hasMeaningfulText = combinedText.trim().length > 0;
    const pageCount = pdfDocument.numPages;

    const confidence = hasMeaningfulText
      ? Math.min(0.95, Math.max(0.4, combinedText.length / (pageCount * 1500)))
      : 0.1;

    return {
      text: hasMeaningfulText ? combinedText : '[No extractable text found in this PDF]',
      pageCount,
      method: 'pdfjs-dist',
      confidence,
      metadata: { pageCount },
      needsReview: !hasMeaningfulText,
      uncertainSegments: hasMeaningfulText ? [] : undefined,
    };
  } catch (error: any) {
    console.error('[Document Parser] PDF extraction failed:', error);
    return {
      text: '',
      method: 'pdfjs-dist',
      confidence: 0,
      error: `PDF extraction failed: ${error.message}`,
      needsReview: true,
    };
  } finally {
    try {
      if (typeof loadingTask.destroy === 'function') {
        await loadingTask.destroy();
      }
    } catch (destroyError) {
      console.warn('[Document Parser] Failed to destroy PDF loading task', destroyError);
    }
  }
}

/**
 * Extract text from image using OCR (Tesseract)
 * Good for: crime scene photos with text, handwritten notes, evidence photos
 * Now includes word-level confidence tracking for human review
 */
async function extractFromImage(buffer: Buffer): Promise<ExtractionResult> {

  console.log('[Document Parser] Running OCR on image...');

  try {
    // Run Tesseract OCR with detailed word data
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    console.log(`[Document Parser] OCR extracted ${data.text.length} characters`);
    console.log(`[Document Parser] OCR confidence: ${data.confidence}%`);

    // Track uncertain segments (low confidence words)
    const uncertainSegments: UncertainSegment[] = [];
    const CONFIDENCE_THRESHOLD = 60; // Words below 60% confidence need review

    if (data.words && data.words.length > 0) {
      data.words.forEach((word: any, idx: number) => {
        // Flag low-confidence words that are potentially important
        const isLowConfidence = word.confidence < CONFIDENCE_THRESHOLD;
        const isImportant =
          word.text.length >= 2 && // Not just single letters
          !/^(the|and|or|a|an|is|was|were|be|to|of|in|on|at)$/i.test(word.text); // Not common words

        if (isLowConfidence && isImportant) {
          uncertainSegments.push({
            text: word.text,
            confidence: word.confidence / 100,
            position: {
              boundingBox: {
                x: word.bbox.x0,
                y: word.bbox.y0,
                width: word.bbox.x1 - word.bbox.x0,
                height: word.bbox.y1 - word.bbox.y0,
              },
            },
            wordIndex: idx,
            // imageSnippet would be added here if we implement cropping
          });
        }
      });
    }

    const overallConfidence = data.confidence / 100;
    const needsReview =
      overallConfidence < 0.75 || // Overall low confidence
      uncertainSegments.length > 0; // Has specific uncertain segments

    console.log(`[Document Parser] Found ${uncertainSegments.length} uncertain segments`);
    if (needsReview) {
      console.log(`[Document Parser] ⚠️  Document needs human review`);
    }

    return {
      text: data.text,
      confidence: overallConfidence,
      method: 'ocr-tesseract',
      metadata: {
        language: 'eng',
        words: data.words?.length || 0,
        lines: data.lines?.length || 0,
        uncertainCount: uncertainSegments.length,
      },
      uncertainSegments,
      needsReview,
    };

  } catch (error: any) {
    console.error('[Document Parser] OCR failed:', error);
    return {
      text: '',
      method: 'ocr-tesseract',
      confidence: 0,
      error: `OCR failed: ${error.message}`,
      needsReview: true,
    };
  }
}

/**
 * Transcribe audio file (interviews, 911 calls, surveillance audio)
 * Uses OpenAI Whisper API
 */
async function transcribeAudio(
  buffer: Buffer,
  filename: string
): Promise<ExtractionResult> {

  console.log('[Document Parser] Transcribing audio with Whisper...');

  // Check if OpenAI API key is configured
  if (!process.env.OPENAI_API_KEY) {
    return {
      text: '[Audio transcription requires OPENAI_API_KEY in environment]',
      method: 'whisper-transcription',
      confidence: 0,
      error: 'OpenAI API key not configured',
    };
  }

  try {
    // Create a File object from buffer
    const file = new File([buffer], filename, {
      type: 'audio/mpeg', // Whisper supports many formats
    });

    // Call Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en',
      response_format: 'verbose_json', // Includes timestamps
    });

    console.log(`[Document Parser] Transcribed ${transcription.text?.length || 0} characters from audio`);

    return {
      text: transcription.text || '',
      method: 'whisper-transcription',
      confidence: 0.9, // Whisper is highly accurate
      metadata: {
        duration: (transcription as any).duration,
        language: transcription.language,
      },
    };

  } catch (error: any) {
    console.error('[Document Parser] Audio transcription failed:', error);
    return {
      text: '',
      method: 'whisper-transcription',
      confidence: 0,
      error: `Transcription failed: ${error.message}`,
    };
  }
}

/**
 * Check if document has already been extracted (cached)
 */
async function getCachedExtraction(storagePath: string): Promise<ExtractionResult | null> {

  try {
    // NOTE: Caching is currently disabled because the required columns
    // (ai_extracted_text, ai_transcription) don't exist in case_files table
    // Always return null to trigger fresh extraction
    return null;

  } catch (error) {
    console.error('[Document Parser] Error checking cache:', error);
    return null;
  }
}

/**
 * Save extracted text to database for future use
 */
async function cacheExtraction(
  storagePath: string,
  result: ExtractionResult
): Promise<void> {

  try {
    // NOTE: Caching extraction results requires the following columns to be added to case_files:
    // - ai_analyzed (boolean)
    // - ai_analysis_confidence (numeric)
    // - ai_extracted_text (text)
    // - ai_transcription (text)
    //
    // Since these columns don't exist in the current schema, we'll skip caching
    // and just log the extraction completion. This doesn't affect functionality,
    // as extraction will work, it just won't be cached in the database.

    console.log('[Document Parser] Extraction completed (caching skipped - schema columns not available)');
    console.log(`[Document Parser] Extracted ${result.text.length} characters using ${result.method}`);

  } catch (error) {
    console.error('[Document Parser] Error in cacheExtraction:', error);
  }
}

/**
 * Batch extract multiple documents in parallel
 */
export async function extractMultipleDocuments(
  storagePaths: string[],
  maxConcurrent: number = 3
): Promise<Map<string, ExtractionResult>> {

  console.log(`[Document Parser] Batch extracting ${storagePaths.length} documents`);

  const results = new Map<string, ExtractionResult>();

  // Process in batches to avoid overwhelming the system
  for (let i = 0; i < storagePaths.length; i += maxConcurrent) {
    const batch = storagePaths.slice(i, i + maxConcurrent);

    const batchResults = await Promise.all(
      batch.map(async (path) => {
        const result = await extractDocumentContent(path);
        return { path, result };
      })
    );

    batchResults.forEach(({ path, result }) => {
      results.set(path, result);
    });

    console.log(`[Document Parser] Completed batch ${i / maxConcurrent + 1} of ${Math.ceil(storagePaths.length / maxConcurrent)}`);
  }

  return results;
}

/**
 * Queue a document for human review if it has uncertain segments
 */
export async function queueDocumentForReview(
  documentId: string,
  caseId: string,
  extractionResult: ExtractionResult
): Promise<boolean> {

  // Only queue if needs review
  if (!extractionResult.needsReview) {
    console.log('[Document Parser] Document does not need review, skipping queue');
    return false;
  }

  try {
    const { error } = await supabaseServer
      .from('document_review_queue')
      .insert({
        case_id: caseId,
        document_id: documentId,
        extracted_text: extractionResult.text,
        overall_confidence: extractionResult.confidence || 0,
        extraction_method: extractionResult.method,
        uncertain_segments: extractionResult.uncertainSegments || [],
        status: 'pending',
        priority: calculateReviewPriority(extractionResult),
      });

    if (error) {
      console.error('[Document Parser] Error queueing document for review:', error);
      return false;
    }

    console.log(`[Document Parser] ✓ Queued document for review (${extractionResult.uncertainSegments?.length || 0} uncertain segments)`);
    return true;

  } catch (error: any) {
    console.error('[Document Parser] Error queueing document for review:', error);
    return false;
  }
}

/**
 * Calculate review priority based on extraction quality
 * Returns 1-10 (10 = highest priority)
 */
function calculateReviewPriority(result: ExtractionResult): number {
  const confidence = result.confidence || 0;
  const uncertainCount = result.uncertainSegments?.length || 0;

  // Very low confidence = high priority
  if (confidence < 0.5) return 10;
  if (confidence < 0.6) return 8;

  // Many uncertain segments = high priority
  if (uncertainCount > 10) return 9;
  if (uncertainCount > 5) return 7;
  if (uncertainCount > 2) return 6;

  // Default medium-low priority
  return 5;
}

/**
 * Get extraction statistics for a case
 */
export async function getExtractionStats(caseId: string) {

  const { data: files } = await supabaseServer
    .from('case_files')
    .select('ai_analyzed, ai_extracted_text, ai_transcription, file_type')
    .eq('case_id', caseId);

  if (!files) return null;

  const stats = {
    total: files.length,
    extracted: files.filter(f => f.ai_analyzed).length,
    pending: files.filter(f => !f.ai_analyzed).length,
    byType: {
      documents: files.filter(f => f.file_type === 'document').length,
      images: files.filter(f => f.file_type === 'image').length,
      audio: files.filter(f => f.file_type === 'audio').length,
      video: files.filter(f => f.file_type === 'video').length,
    },
    totalCharacters: files.reduce((sum, f) => {
      const text = f.ai_extracted_text || f.ai_transcription || '';
      return sum + text.length;
    }, 0),
  };

  return stats;
}
