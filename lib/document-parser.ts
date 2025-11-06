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
import pdf from 'pdf-parse';
import Tesseract from 'tesseract.js';
import OpenAI from 'openai';

// Initialize OpenAI client for Whisper transcription
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  confidence?: number; // 0-1 score for OCR
  method: 'pdf-parse' | 'ocr-tesseract' | 'ocr-google' | 'whisper-transcription' | 'cached';
  metadata?: any;
  error?: string;
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

  try {
    // First, try standard PDF text extraction
    const pdfData = await pdf(buffer);

    console.log(`[Document Parser] PDF has ${pdfData.numpages} pages`);

    // Check if PDF has actual text (not just scanned image)
    const hasText = pdfData.text && pdfData.text.trim().length > 100;

    if (hasText) {
      // Digital PDF with text layer
      console.log(`[Document Parser] Extracted ${pdfData.text.length} characters from digital PDF`);
      return {
        text: pdfData.text,
        pageCount: pdfData.numpages,
        method: 'pdf-parse',
        confidence: 1.0,
        metadata: pdfData.info,
      };
    } else {
      // Scanned PDF - need OCR
      console.log('[Document Parser] PDF appears to be scanned, attempting OCR...');

      // For scanned PDFs, we'd need to:
      // 1. Convert PDF pages to images
      // 2. Run OCR on each page
      // This requires pdf-to-img library (pdf-poppler or similar)

      // For now, return what we got with low confidence
      return {
        text: pdfData.text || '[Scanned PDF - OCR not fully implemented yet]',
        pageCount: pdfData.numpages,
        method: 'pdf-parse',
        confidence: 0.3,
        metadata: pdfData.info,
        error: 'Scanned PDF detected - full OCR requires pdf-to-image conversion',
      };
    }

  } catch (error: any) {
    console.error('[Document Parser] PDF extraction failed:', error);
    return {
      text: '',
      method: 'pdf-parse',
      confidence: 0,
      error: `PDF extraction failed: ${error.message}`,
    };
  }
}

/**
 * Extract text from image using OCR (Tesseract)
 * Good for: crime scene photos with text, handwritten notes, evidence photos
 */
async function extractFromImage(buffer: Buffer): Promise<ExtractionResult> {

  console.log('[Document Parser] Running OCR on image...');

  try {
    // Run Tesseract OCR
    const { data } = await Tesseract.recognize(buffer, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          console.log(`[OCR] Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    console.log(`[Document Parser] OCR extracted ${data.text.length} characters`);
    console.log(`[Document Parser] OCR confidence: ${data.confidence}%`);

    return {
      text: data.text,
      confidence: data.confidence / 100, // Convert 0-100 to 0-1
      method: 'ocr-tesseract',
      metadata: {
        language: 'eng',
        words: data.words?.length || 0,
        lines: data.lines?.length || 0,
      },
    };

  } catch (error: any) {
    console.error('[Document Parser] OCR failed:', error);
    return {
      text: '',
      method: 'ocr-tesseract',
      confidence: 0,
      error: `OCR failed: ${error.message}`,
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
    const { data, error } = await supabaseServer
      .from('case_files')
      .select('ai_extracted_text, ai_transcription, metadata')
      .eq('storage_path', storagePath)
      .single();

    if (error || !data) {
      return null;
    }

    // Check if extraction exists
    const extractedText = data.ai_extracted_text || data.ai_transcription;

    if (extractedText && extractedText.length > 10) {
      return {
        text: extractedText,
        method: 'cached',
        confidence: 1.0,
        metadata: data.metadata,
      };
    }

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
    const updateData: any = {
      ai_analyzed: true,
      ai_analysis_confidence: result.confidence,
      metadata: {
        extraction_method: result.method,
        extracted_at: new Date().toISOString(),
        ...result.metadata,
      },
    };

    // Store in appropriate column
    if (result.method === 'whisper-transcription') {
      updateData.ai_transcription = result.text;
    } else {
      updateData.ai_extracted_text = result.text;
    }

    const { error } = await supabaseServer
      .from('case_files')
      .update(updateData)
      .eq('storage_path', storagePath);

    if (error) {
      console.error('[Document Parser] Error caching extraction:', error);
    } else {
      console.log('[Document Parser] Cached extraction in database');
    }

  } catch (error) {
    console.error('[Document Parser] Error caching extraction:', error);
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
