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

  if (result.error || isPlaceholderText) {
    const error: ExtractionErrorLog = {
      code: deriveErrorCode(result.method),
      message: result.error || 'Document parser did not return extractable text.',
      method: result.method,
      detail: !result.error && isPlaceholderText ? 'Parser returned placeholder text.' : undefined,
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
        },
      },
      contentForEmbedding: null,
      error,
    };
  }

  return {
    status: 'completed',
    updates: {
      content: rawText,
      extraction_confidence: result.confidence ?? null,
      extraction_method: result.method,
      error_log: null,
      processed_at: now,
      metadata: sharedMetadata,
    },
    contentForEmbedding: rawText,
    error: null,
  };
}
