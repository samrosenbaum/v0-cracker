import type { ExtractionResult } from './document-parser';
import type { DocumentChunkRow } from './document-chunker';

export interface ExtractionErrorLog {
  code: string;
  message: string;
  method: ExtractionResult['method'];
  detail?: string;
  timestamp: string;
}

export interface ChunkPersistencePlan {
  status: 'completed' | 'failed';
  updates: {
    content?: string | null;
    extraction_confidence?: number | null;
    extraction_method?: ExtractionResult['method'] | null;
    error_log?: string | null;
    processed_at?: string | null;
    metadata?: any;
  };
  contentForEmbedding: string | null;
  error: ExtractionErrorLog | null;
}

const NO_TEXT_PLACEHOLDER = '[No extractable text';

/**
 * Detect if text looks like raw PDF internal data rather than extracted content.
 * PDF artifacts include object syntax, cross-reference tables, and binary markers.
 */
function looksLikePdfArtifact(text: string): boolean {
  if (!text || text.length === 0) return false;

  // Check first 2000 chars for efficiency
  const sample = text.slice(0, 2000);

  // PDF object syntax markers
  const pdfMarkers = [
    /<<\s*\/Type\s*\//, // <<\/Type\/Page, <<\/Type\/Font
    /\/Filter\s*\/FlateDecode/,
    /\/BaseFont\s*\/[A-Za-z]/,
    /\/Encoding\s*\/Identity/,
    /\/Parent\s*\d+\s*\d+\s*R/,
    /\/Resources\s*<</,
    /\d+\s+\d+\s+obj\b/,
    /\bendobj\b/,
    /\bstream\b[\s\S]*\bendstream\b/,
    /\/Length\s*\d+/,
  ];

  let markerCount = 0;
  for (const pattern of pdfMarkers) {
    if (pattern.test(sample)) {
      markerCount++;
    }
    // If we find 3+ PDF markers, it's definitely PDF syntax
    if (markerCount >= 3) return true;
  }

  // Check ratio of PDF tokens (like /Name) to total content
  const pdfTokens = sample.match(/\/[A-Z][a-z]+/g) || [];
  const alphanumericChars = sample.replace(/[^a-zA-Z0-9]/g, '').length;
  if (pdfTokens.length >= 5 && alphanumericChars > 0) {
    const tokenRatio = (pdfTokens.length * 5) / alphanumericChars;
    if (tokenRatio > 0.3) return true;
  }

  // Check for high ratio of non-printable or unusual characters
  const unusualChars = sample.match(/[^\x20-\x7E\n\r\t]/g) || [];
  if (unusualChars.length / sample.length > 0.15) return true;

  return false;
}

/**
 * Clean extracted text by removing PDF artifact lines while preserving real content
 */
function cleanPdfArtifacts(text: string): string {
  const lines = text.split(/\r?\n/);
  const cleanedLines = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true; // Keep empty lines for formatting

    // Skip lines that look like PDF syntax
    if (/^<<|^>>|^\d+\s+\d+\s+obj|^endobj|^stream|^endstream|^xref/.test(trimmed)) {
      return false;
    }

    // Skip lines with heavy PDF token concentration
    const pdfTokens = trimmed.match(/\/[A-Z][a-z]+/g) || [];
    if (pdfTokens.length >= 3 && /<</.test(trimmed)) {
      return false;
    }

    return true;
  });

  return cleanedLines.join('\n').trim();
}

function deriveErrorCode(method: ExtractionResult['method']): string {
  if (method === 'pdfjs-dist' || method === 'pdf-parse') {
    return 'PDF_EXTRACTION_FAILED';
  }
  if (method && method.startsWith('ocr-')) {
    return 'OCR_EXTRACTION_FAILED';
  }
  if (method === 'whisper-transcription') {
    return 'AUDIO_TRANSCRIPTION_FAILED';
  }
  return 'DOCUMENT_EXTRACTION_FAILED';
}

function cloneMetadata(metadata: DocumentChunkRow['metadata']): Record<string, any> {
  if (metadata && typeof metadata === 'object') {
    return JSON.parse(JSON.stringify(metadata));
  }
  return {};
}

export function deriveChunkPersistencePlan(
  chunk: Pick<DocumentChunkRow, 'metadata'>,
  result: ExtractionResult
): ChunkPersistencePlan {
  const now = new Date().toISOString();
  const rawText = (result.text || '').trim();
  const isPlaceholderText = rawText.length === 0 || rawText.startsWith(NO_TEXT_PLACEHOLDER);
  const baseMetadata = cloneMetadata(chunk.metadata);

  const sharedMetadata = {
    ...baseMetadata,
    extractionMethod: result.method,
    pageCount: result.pageCount,
    processingTimestamp: now,
  };

  // Check if the extracted text is actually raw PDF data (extraction failed silently)
  const isPdfArtifact = looksLikePdfArtifact(rawText);

  if (result.error || isPlaceholderText || isPdfArtifact) {
    const error: ExtractionErrorLog = {
      code: isPdfArtifact ? 'PDF_ARTIFACT_DETECTED' : deriveErrorCode(result.method),
      message: isPdfArtifact
        ? 'Extraction returned raw PDF data instead of readable text. The PDF may be scanned or corrupted.'
        : result.error || 'Document parser did not return extractable text.',
      method: result.method,
      detail: isPdfArtifact
        ? 'Content contains PDF object syntax markers. OCR may be required.'
        : (!result.error && isPlaceholderText ? 'Parser returned placeholder text.' : undefined),
      timestamp: now,
    };

    return {
      status: 'failed',
      updates: {
        content: null,
        extraction_confidence: result.confidence ?? 0,
        extraction_method: result.method,
        error_log: JSON.stringify(error),
        processed_at: now,
        metadata: {
          ...sharedMetadata,
          extractionError: error,
          pdfArtifactDetected: isPdfArtifact,
        },
      },
      contentForEmbedding: null,
      error,
    };
  }

  // Clean any remaining PDF artifacts from the text
  const cleanedText = cleanPdfArtifacts(rawText);

  // If cleaning removed everything, mark as failed
  if (!cleanedText || cleanedText.length < 20) {
    const error: ExtractionErrorLog = {
      code: 'CONTENT_CLEANING_FAILED',
      message: 'After removing PDF artifacts, no meaningful content remained.',
      method: result.method,
      detail: `Original length: ${rawText.length}, cleaned length: ${cleanedText.length}`,
      timestamp: now,
    };

    return {
      status: 'failed',
      updates: {
        content: null,
        extraction_confidence: 0,
        extraction_method: result.method,
        error_log: JSON.stringify(error),
        processed_at: now,
        metadata: {
          ...sharedMetadata,
          extractionError: error,
        },
      },
      contentForEmbedding: null,
      error,
    };
  }

  return {
    status: 'completed',
    updates: {
      content: cleanedText,
      extraction_confidence: result.confidence ?? null,
      extraction_method: result.method,
      error_log: null,
      processed_at: now,
      metadata: sharedMetadata,
    },
    contentForEmbedding: cleanedText,
    error: null,
  };
}
