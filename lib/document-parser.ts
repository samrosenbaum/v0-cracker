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
import { parsePdf } from './pdf-parse-compat';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';

type PdfjsModule = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsModulePromise: Promise<PdfjsModule | null> | null = null;
let hasLoggedPdfjsLoad = false;

const NON_RECOVERABLE_PDF_ERROR_NAMES = new Set([
  'InvalidPDFException',
  'MissingPDFException',
  'PasswordException',
  'UnexpectedResponseException',
]);

// Polyfill DOMMatrix for Node.js environment
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-ignore - Polyfill for Node.js
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      // Minimal DOMMatrix implementation for pdfjs-dist compatibility
    }
  };
}

async function loadPdfJsModule(): Promise<PdfjsModule | null> {
  if (typeof window !== 'undefined') {
    // The ingestion pipeline only runs on the server – fall back to pdf-parse for browser builds.
    return null;
  }

  if (!pdfjsModulePromise) {
    pdfjsModulePromise = (async () => {
      try {
        const mod = await import('pdfjs-dist/legacy/build/pdf.mjs');

        try {
          const workerOptions = (mod as any).GlobalWorkerOptions;
          if (workerOptions && typeof window !== 'undefined') {
            workerOptions.workerSrc = workerOptions.workerSrc || '';
          }
        } catch (workerError) {
          console.warn('[Document Parser] Unable to configure pdfjs worker, falling back to pdf-parse.', workerError);
          return null;
        }

        if (!hasLoggedPdfjsLoad) {
          const version = (mod as any).version || 'unknown';
          console.log(`[Document Parser] pdfjs-dist backend ready (v${version})`);
          hasLoggedPdfjsLoad = true;
        }

        return mod;
      } catch (error) {
        console.error('[Document Parser] Failed to load pdfjs-dist module:', error);
        return null;
      }
    })();
  }

  return pdfjsModulePromise;
}

function isNonRecoverablePdfError(error: any): boolean {
  const name = typeof error?.name === 'string' ? error.name : '';
  const message = typeof error?.message === 'string' ? error.message : '';

  if (name && NON_RECOVERABLE_PDF_ERROR_NAMES.has(name)) {
    return true;
  }

  if (!message) {
    return false;
  }

  return /invalid pdf|missing pdf|password required|unexpected response/i.test(message);
}

// Lazy-initialized OpenAI client for Whisper transcription
let openaiInstance: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiInstance) {
    openaiInstance = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiInstance;
}

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
  method: 'pdf-parse' | 'pdfjs-dist' | 'ocr-tesseract' | 'ocr-google' | 'whisper-transcription' | 'cached' | 'mammoth-docx' | 'xlsx-parse' | 'csv-parse';
  metadata?: any;
  error?: string;
  uncertainSegments?: UncertainSegment[]; // Segments that need human review
  needsReview?: boolean; // Quick flag if human review is recommended
  structuredData?: ExtractedStructuredData; // For spreadsheets, databases, structured content
}

export interface ExtractedStructuredData {
  tables?: ExtractedTable[];
  entities?: ExtractedEntity[];
  dates?: ExtractedDate[];
  locations?: ExtractedLocation[];
  phoneNumbers?: string[];
  emails?: string[];
  addresses?: string[];
}

export interface ExtractedTable {
  name?: string;
  headers: string[];
  rows: string[][];
  sheetIndex?: number;
}

export interface ExtractedEntity {
  name: string;
  type: 'person' | 'organization' | 'vehicle' | 'weapon' | 'evidence' | 'unknown';
  mentions: number;
  context: string[];
}

export interface ExtractedDate {
  original: string;
  normalized?: string;
  context: string;
  lineNumber?: number;
}

export interface ExtractedLocation {
  name: string;
  type?: 'address' | 'landmark' | 'city' | 'state' | 'country' | 'coordinates';
  context: string;
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

  // Word documents (.docx)
  if (lowerPath.endsWith('.docx')) {
    return await extractFromDocx(buffer);
  }

  // Legacy Word documents (.doc) - limited support
  if (lowerPath.endsWith('.doc')) {
    return {
      text: '[Legacy .doc format detected - please convert to .docx for better extraction]',
      method: 'mammoth-docx',
      confidence: 0,
      error: 'Legacy .doc format not fully supported. Please convert to .docx format.',
      needsReview: true,
    };
  }

  // Excel spreadsheets
  if (lowerPath.match(/\.(xlsx|xls)$/)) {
    return await extractFromExcel(buffer, storagePath);
  }

  // CSV files (structured parsing)
  if (lowerPath.endsWith('.csv')) {
    return await extractFromCSV(buffer);
  }

  // Unsupported file type
  return {
    text: `[Unsupported file type: ${storagePath}]`,
    method: 'pdf-parse',
    confidence: 0,
    error: 'Unsupported file type',
  };
}

export async function extractDocumentContentFromBuffer(
  storagePath: string,
  buffer: Buffer
): Promise<ExtractionResult> {
  return extractByFileType(storagePath, buffer);
}

/**
 * Extract a specific page from a PDF document
 * This is used by the chunking system for parallel page-level processing
 */
export async function extractPdfPage(
  storagePath: string,
  pageNumber: number
): Promise<ExtractionResult> {
  console.log(`[Document Parser] Extracting page ${pageNumber} from: ${storagePath}`);

  try {
    // Download file from Supabase Storage
    const { data: fileData, error: downloadError } = await supabaseServer.storage
      .from('case-files')
      .download(storagePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    return await extractPdfPageFromBuffer(buffer, pageNumber);

  } catch (error: any) {
    console.error(`[Document Parser] Error extracting page ${pageNumber}:`, error);
    return {
      text: '',
      method: 'pdfjs-dist',
      error: error.message,
      confidence: 0,
      pageCount: 1,
    };
  }
}

/**
 * Extract a specific page from a PDF buffer
 */
export async function extractPdfPageFromBuffer(
  buffer: Buffer,
  pageNumber: number
): Promise<ExtractionResult> {
  const pdfjs = await loadPdfJsModule();

  if (!pdfjs) {
    console.warn('[Document Parser] pdfjs module unavailable, falling back to pdf-parse for page extraction.');
    // Fallback: extract entire document with pdf-parse
    const result = await extractWithPdfParse(buffer);
    return {
      ...result,
      metadata: { ...result.metadata, requestedPage: pageNumber, note: 'Full document extracted - page-level not available' },
    };
  }

  let loadingTask: ReturnType<PdfjsModule['getDocument']>;

  try {
    loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  } catch (initError) {
    console.warn('[Document Parser] pdfjs failed to initialize for page extraction.', initError);
    const result = await extractWithPdfParse(buffer);
    return { ...result, metadata: { ...result.metadata, requestedPage: pageNumber } };
  }

  try {
    const pdfDocument = await loadingTask.promise;
    const totalPages = pdfDocument.numPages;

    if (pageNumber < 1 || pageNumber > totalPages) {
      return {
        text: '',
        method: 'pdfjs-dist',
        confidence: 0,
        pageCount: 1,
        error: `Invalid page number ${pageNumber}. Document has ${totalPages} pages.`,
      };
    }

    const page = await pdfDocument.getPage(pageNumber);
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

    try {
      page.cleanup();
    } catch (cleanupError) {
      console.warn('[Document Parser] Failed to cleanup PDF page', cleanupError);
    }

    const hasMeaningfulText = pageText.trim().length > 0;
    const confidence = hasMeaningfulText
      ? Math.min(0.95, Math.max(0.4, pageText.length / 1500))
      : 0.1;

    // Extract structured data from the page
    const structuredData = extractStructuredDataFromText(pageText);

    return {
      text: hasMeaningfulText ? pageText : '[No extractable text found on this page]',
      pageCount: 1,
      method: 'pdfjs-dist',
      confidence,
      metadata: {
        pageNumber,
        totalPages,
        characterCount: pageText.length,
      },
      structuredData,
      needsReview: !hasMeaningfulText,
    };
  } catch (error: any) {
    console.error(`[Document Parser] PDF page ${pageNumber} extraction failed:`, error);

    if (isNonRecoverablePdfError(error)) {
      return {
        text: '',
        pageCount: 1,
        method: 'pdfjs-dist',
        confidence: 0,
        error: error?.message || 'PDF extraction failed.',
        needsReview: true,
      };
    }

    // Fallback to full document extraction
    const result = await extractWithPdfParse(buffer);
    return { ...result, metadata: { ...result.metadata, requestedPage: pageNumber, fallback: true } };
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
 * Get PDF page count without full extraction
 * Useful for determining how to chunk a PDF
 */
export async function getPdfPageCount(storagePath: string): Promise<number> {
  try {
    const { data: fileData, error: downloadError } = await supabaseServer.storage
      .from('case-files')
      .download(storagePath);

    if (downloadError) {
      console.error('[Document Parser] Failed to download for page count:', downloadError);
      return 1;
    }

    const buffer = Buffer.from(await fileData.arrayBuffer());
    return await getPdfPageCountFromBuffer(buffer);
  } catch (error) {
    console.error('[Document Parser] Failed to get page count:', error);
    return 1;
  }
}

/**
 * Get PDF page count from buffer
 */
export async function getPdfPageCountFromBuffer(buffer: Buffer): Promise<number> {
  const pdfjs = await loadPdfJsModule();

  if (!pdfjs) {
    // Fallback to pdf-parse
    try {
      const result = await parsePdf(buffer);
      return result.numpages || 1;
    } catch {
      return 1;
    }
  }

  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdfDocument = await loadingTask.promise;
    const pageCount = pdfDocument.numPages;

    try {
      await loadingTask.destroy();
    } catch { /* ignore */ }

    return pageCount;
  } catch {
    // Fallback to pdf-parse
    try {
      const result = await parsePdf(buffer);
      return result.numpages || 1;
    } catch {
      return 1;
    }
  }
}

/**
 * Extract text from PDF (handles both digital and scanned)
 */
async function extractFromPDF(buffer: Buffer): Promise<ExtractionResult> {

  console.log('[Document Parser] Processing PDF...');

  const pdfjs = await loadPdfJsModule();

  if (!pdfjs) {
    console.warn('[Document Parser] pdfjs module unavailable, falling back to pdf-parse.');
    return extractWithPdfParse(buffer);
  }

  let loadingTask: ReturnType<PdfjsModule['getDocument']>;

  try {
    loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  } catch (initializationError) {
    console.warn('[Document Parser] pdfjs failed to initialize, falling back to pdf-parse.', initializationError);
    return extractWithPdfParse(buffer);
  }

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
    console.error('[Document Parser] PDF extraction failed during parsing:', error);

    if (isNonRecoverablePdfError(error)) {
      return {
        text: '',
        pageCount: undefined,
        method: 'pdfjs-dist',
        confidence: 0,
        error: error?.message || 'PDF extraction failed.',
        metadata: {
          failure: {
            name: error?.name,
            message: error?.message,
          },
        },
        needsReview: true,
      };
    }

    console.warn('[Document Parser] Falling back to pdf-parse after recoverable error.');
    return extractWithPdfParse(buffer);
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

async function extractWithPdfParse(buffer: Buffer): Promise<ExtractionResult> {
  try {
    const result = await parsePdf(buffer);
    const text = result.text?.trim() || '';
    const hasMeaningfulText = text.length > 0;
    const pageCount = result.numpages || result.numrender || undefined;

    return {
      text: hasMeaningfulText ? text : '[No extractable text found in this PDF]',
      pageCount,
      method: 'pdf-parse',
      confidence: hasMeaningfulText ? 0.75 : 0.1,
      metadata: {
        pageCount,
        info: result.info,
      },
      needsReview: !hasMeaningfulText,
    };
  } catch (error: any) {
    console.error('[Document Parser] pdf-parse fallback failed:', error);
    return {
      text: '',
      method: 'pdf-parse',
      confidence: 0,
      error: `PDF extraction failed: ${error.message}`,
      needsReview: true,
    };
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

    // Use type assertion for Tesseract result which includes words array
    const ocrData = data as Tesseract.RecognizeResult['data'] & { words?: any[]; lines?: any[] };

    if (ocrData.words && ocrData.words.length > 0) {
      ocrData.words.forEach((word: any, idx: number) => {
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
        words: ocrData.words?.length || 0,
        lines: ocrData.lines?.length || 0,
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

  const openai = getOpenAIClient();
  if (!openai) {
    return {
      text: '[Audio transcription requires OPENAI_API_KEY in environment variables]',
      method: 'whisper-transcription',
      confidence: 0,
      error: 'OPENAI_API_KEY is not configured. Add it to your environment variables to enable audio transcription.',
      needsReview: true,
    };
  }

  try {
    // Create a File object from buffer - convert Buffer to Uint8Array for browser compatibility
    const file = new File([new Uint8Array(buffer)], filename, {
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
 * Extract text from Word documents (.docx) using mammoth
 * Good for: Typed reports, transcripts, formal documents
 */
async function extractFromDocx(buffer: Buffer): Promise<ExtractionResult> {
  console.log('[Document Parser] Extracting from Word document...');

  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    // Check for any messages/warnings from mammoth
    const warnings = result.messages.filter(m => m.type === 'warning');

    if (!text || text.length === 0) {
      return {
        text: '[No text content found in Word document]',
        method: 'mammoth-docx',
        confidence: 0.1,
        needsReview: true,
        error: 'Document appears to be empty or contains only images',
      };
    }

    // Extract structured data from the document
    const structuredData = extractStructuredDataFromText(text);

    console.log(`[Document Parser] Extracted ${text.length} characters from Word document`);
    if (warnings.length > 0) {
      console.log(`[Document Parser] Word extraction warnings: ${warnings.length}`);
    }

    return {
      text,
      method: 'mammoth-docx',
      confidence: warnings.length > 0 ? 0.85 : 0.95,
      metadata: {
        warnings: warnings.map(w => w.message),
        characterCount: text.length,
        wordCount: text.split(/\s+/).length,
      },
      structuredData,
      needsReview: warnings.length > 5,
    };

  } catch (error: any) {
    console.error('[Document Parser] Word document extraction failed:', error);
    return {
      text: '',
      method: 'mammoth-docx',
      confidence: 0,
      error: `Word document extraction failed: ${error.message}`,
      needsReview: true,
    };
  }
}

/**
 * Extract data from Excel files (.xlsx, .xls)
 * Parses all sheets and converts to structured format
 * Good for: Phone records, financial records, evidence logs
 */
async function extractFromExcel(buffer: Buffer, fileName: string): Promise<ExtractionResult> {
  console.log('[Document Parser] Extracting from Excel spreadsheet...');

  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const tables: ExtractedTable[] = [];
    const textParts: string[] = [];

    workbook.SheetNames.forEach((sheetName, index) => {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

      if (jsonData.length === 0) return;

      const headers = (jsonData[0] || []).map(h => String(h || '').trim());
      const rows = jsonData.slice(1).map(row =>
        (row || []).map(cell => String(cell || '').trim())
      );

      tables.push({
        name: sheetName,
        headers,
        rows,
        sheetIndex: index,
      });

      // Convert to text format for analysis
      textParts.push(`\n=== Sheet: ${sheetName} ===\n`);
      textParts.push(`Columns: ${headers.join(' | ')}\n`);
      textParts.push('-'.repeat(80) + '\n');

      rows.forEach((row, rowIndex) => {
        const rowText = headers.map((h, i) => `${h}: ${row[i] || 'N/A'}`).join(' | ');
        textParts.push(`Row ${rowIndex + 1}: ${rowText}\n`);
      });
    });

    const fullText = textParts.join('');

    // Extract entities from the spreadsheet data
    const structuredData: ExtractedStructuredData = {
      tables,
      ...extractStructuredDataFromText(fullText),
    };

    console.log(`[Document Parser] Extracted ${tables.length} sheets, ${fullText.length} characters`);

    return {
      text: fullText,
      method: 'xlsx-parse',
      confidence: 0.98,
      metadata: {
        sheetCount: workbook.SheetNames.length,
        sheetNames: workbook.SheetNames,
        totalRows: tables.reduce((sum, t) => sum + t.rows.length, 0),
        totalColumns: tables.reduce((max, t) => Math.max(max, t.headers.length), 0),
      },
      structuredData,
    };

  } catch (error: any) {
    console.error('[Document Parser] Excel extraction failed:', error);
    return {
      text: '',
      method: 'xlsx-parse',
      confidence: 0,
      error: `Excel extraction failed: ${error.message}`,
      needsReview: true,
    };
  }
}

/**
 * Extract data from CSV files with structure detection
 * Good for: Call logs, transaction records, witness lists
 */
async function extractFromCSV(buffer: Buffer): Promise<ExtractionResult> {
  console.log('[Document Parser] Extracting from CSV file...');

  try {
    const content = buffer.toString('utf-8');
    const workbook = XLSX.read(content, { type: 'string' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });

    if (jsonData.length === 0) {
      return {
        text: '[Empty CSV file]',
        method: 'csv-parse',
        confidence: 0.5,
        needsReview: true,
      };
    }

    const headers = (jsonData[0] || []).map(h => String(h || '').trim());
    const rows = jsonData.slice(1).map(row =>
      (row || []).map(cell => String(cell || '').trim())
    );

    const table: ExtractedTable = { headers, rows };

    // Convert to readable text
    const textParts: string[] = [`Columns: ${headers.join(' | ')}\n`, '-'.repeat(80) + '\n'];
    rows.forEach((row, index) => {
      const rowText = headers.map((h, i) => `${h}: ${row[i] || 'N/A'}`).join(' | ');
      textParts.push(`Row ${index + 1}: ${rowText}\n`);
    });

    const fullText = textParts.join('');
    const structuredData: ExtractedStructuredData = {
      tables: [table],
      ...extractStructuredDataFromText(fullText),
    };

    console.log(`[Document Parser] Extracted ${rows.length} rows from CSV`);

    return {
      text: fullText,
      method: 'csv-parse',
      confidence: 0.95,
      metadata: {
        rowCount: rows.length,
        columnCount: headers.length,
        headers,
      },
      structuredData,
    };

  } catch (error: any) {
    console.error('[Document Parser] CSV extraction failed:', error);
    return {
      text: '',
      method: 'csv-parse',
      confidence: 0,
      error: `CSV extraction failed: ${error.message}`,
      needsReview: true,
    };
  }
}

/**
 * Extract structured data (entities, dates, locations, phone numbers) from text
 * This runs on any extracted text to find investigatively relevant information
 */
function extractStructuredDataFromText(text: string): ExtractedStructuredData {
  const result: ExtractedStructuredData = {
    entities: [],
    dates: [],
    locations: [],
    phoneNumbers: [],
    emails: [],
    addresses: [],
  };

  if (!text || text.length === 0) return result;

  // Extract phone numbers (various formats)
  const phonePatterns = [
    /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,  // 555-123-4567
    /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g,       // (555) 123-4567
    /\b\d{10}\b/g,                           // 5551234567
    /\+1[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, // +1-555-123-4567
  ];
  phonePatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      result.phoneNumbers!.push(...matches.filter(m => !result.phoneNumbers!.includes(m)));
    }
  });

  // Extract email addresses
  const emailPattern = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emails = text.match(emailPattern);
  if (emails) {
    result.emails = [...new Set(emails)];
  }

  // Extract dates (various formats)
  const datePatterns = [
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,           // MM/DD/YYYY or M/D/YY
    /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,             // MM-DD-YYYY
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
    /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
  ];
  datePatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const lineStart = Math.max(0, match.index - 50);
      const lineEnd = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.slice(lineStart, lineEnd).replace(/\s+/g, ' ').trim();

      result.dates!.push({
        original: match[0],
        context,
      });
    }
  });

  // Extract proper names (potential persons of interest)
  const namePattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}\b/g;
  const nameMap = new Map<string, { count: number; contexts: string[] }>();
  let nameMatch;
  while ((nameMatch = namePattern.exec(text)) !== null) {
    const name = nameMatch[0];
    // Filter out common non-name patterns
    if (!/^(?:The |A |An |In |On |At |By |For |With |From )/.test(name)) {
      const existing = nameMap.get(name) || { count: 0, contexts: [] };
      existing.count++;
      if (existing.contexts.length < 3) {
        const contextStart = Math.max(0, nameMatch.index - 30);
        const contextEnd = Math.min(text.length, nameMatch.index + name.length + 30);
        existing.contexts.push(text.slice(contextStart, contextEnd).replace(/\s+/g, ' ').trim());
      }
      nameMap.set(name, existing);
    }
  }
  nameMap.forEach((data, name) => {
    if (data.count >= 1) { // Only include names mentioned at least once
      result.entities!.push({
        name,
        type: 'person',
        mentions: data.count,
        context: data.contexts,
      });
    }
  });

  // Extract addresses (basic patterns)
  const addressPattern = /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Way|Court|Ct|Place|Pl)\.?(?:\s*,?\s*(?:Apt|Suite|Unit|#)\.?\s*\d+)?/gi;
  const addresses = text.match(addressPattern);
  if (addresses) {
    result.addresses = [...new Set(addresses)];
    addresses.forEach(addr => {
      result.locations!.push({
        name: addr,
        type: 'address',
        context: addr,
      });
    });
  }

  // Extract vehicle information (license plates, makes/models)
  const vehiclePattern = /\b(?:\d{4}\s+)?(?:Ford|Chevrolet|Chevy|Toyota|Honda|Nissan|BMW|Mercedes|Dodge|Jeep|GMC|Volkswagen|VW|Hyundai|Kia|Subaru|Mazda|Lexus|Acura|Infiniti|Cadillac|Buick|Lincoln|Chrysler)\s+[A-Za-z0-9]+\b/gi;
  const vehicles = text.match(vehiclePattern);
  if (vehicles) {
    vehicles.forEach(v => {
      result.entities!.push({
        name: v,
        type: 'vehicle',
        mentions: 1,
        context: [v],
      });
    });
  }

  // Remove duplicates from entities
  const uniqueEntities = new Map<string, ExtractedEntity>();
  result.entities!.forEach(entity => {
    const existing = uniqueEntities.get(entity.name.toLowerCase());
    if (existing) {
      existing.mentions += entity.mentions;
      existing.context.push(...entity.context.slice(0, 2));
    } else {
      uniqueEntities.set(entity.name.toLowerCase(), entity);
    }
  });
  result.entities = Array.from(uniqueEntities.values());

  // Sort entities by mention count
  result.entities.sort((a, b) => b.mentions - a.mentions);

  // Limit results to most relevant
  result.entities = result.entities.slice(0, 50);
  result.dates = result.dates!.slice(0, 50);
  result.phoneNumbers = result.phoneNumbers!.slice(0, 30);

  return result;
}

/**
 * Check if document has already been extracted (cached)
 */
async function getCachedExtraction(storagePath: string): Promise<ExtractionResult | null> {
  try {
    // First try case_documents table
    const { data: docRecord, error: docError } = await supabaseServer
      .from('case_documents')
      .select('extracted_text, extraction_method, extraction_confidence, structured_data, extraction_status, page_count')
      .eq('storage_path', storagePath)
      .eq('extraction_status', 'completed')
      .single();

    if (!docError && docRecord?.extracted_text) {
      console.log('[Document Parser] Using cached extraction from case_documents');
      return {
        text: docRecord.extracted_text,
        method: (docRecord.extraction_method as any) || 'cached',
        confidence: docRecord.extraction_confidence || 0.9,
        pageCount: docRecord.page_count,
        structuredData: docRecord.structured_data as ExtractedStructuredData,
        metadata: { cached: true, cacheSource: 'case_documents' },
      };
    }

    // Fallback to case_files table
    const { data: fileRecord, error: fileError } = await supabaseServer
      .from('case_files')
      .select('ai_extracted_text, ai_transcription, ai_analyzed, ai_analysis_confidence')
      .eq('storage_path', storagePath)
      .eq('ai_analyzed', true)
      .single();

    if (!fileError && fileRecord && (fileRecord.ai_extracted_text || fileRecord.ai_transcription)) {
      console.log('[Document Parser] Using cached extraction from case_files');
      return {
        text: fileRecord.ai_extracted_text || fileRecord.ai_transcription || '',
        method: 'cached',
        confidence: fileRecord.ai_analysis_confidence || 0.9,
        metadata: { cached: true, cacheSource: 'case_files' },
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
    // Calculate word count
    const wordCount = result.text ? result.text.split(/\s+/).filter(w => w.length > 0).length : 0;

    // Try to update case_documents first
    const { error: docError } = await supabaseServer
      .from('case_documents')
      .update({
        extracted_text: result.text,
        extraction_method: result.method,
        extraction_confidence: result.confidence,
        extraction_status: result.error ? 'failed' : (result.needsReview ? 'needs_review' : 'completed'),
        structured_data: result.structuredData || {},
        page_count: result.pageCount || 1,
        word_count: wordCount,
        extracted_at: new Date().toISOString(),
      })
      .eq('storage_path', storagePath);

    if (docError) {
      console.warn('[Document Parser] Could not cache to case_documents:', docError.message);

      // Fallback to case_files table
      const { error: fileError } = await supabaseServer
        .from('case_files')
        .update({
          ai_extracted_text: result.text,
          ai_analyzed: true,
          ai_analysis_confidence: result.confidence,
          metadata: {
            extraction_method: result.method,
            page_count: result.pageCount,
            word_count: wordCount,
            structured_data: result.structuredData,
            extracted_at: new Date().toISOString(),
          },
        })
        .eq('storage_path', storagePath);

      if (fileError) {
        console.warn('[Document Parser] Could not cache to case_files:', fileError.message);
      } else {
        console.log('[Document Parser] Cached extraction to case_files');
      }
    } else {
      console.log('[Document Parser] Cached extraction to case_documents');
    }

    console.log(`[Document Parser] Extracted ${result.text.length} characters, ${wordCount} words using ${result.method}`);
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
