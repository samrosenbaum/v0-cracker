import '../polyfills/dom-matrix';
import { PDFParse } from 'pdf-parse';

interface LegacyPdfParseResult {
  text: string;
  numpages?: number;
  numrender?: number;
  info?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
}

let workerConfigured = false;

function ensureWorkerConfigured() {
  if (workerConfigured) return;

  try {
    // Only configure the worker when running in a browser context. On the
    // server (where our document parsing runs) pdfjs-dist falls back to a
    // synchronous parser and does not require a worker script. Setting an
    // empty worker source caused pdf.js to throw "Unable to load PDF parser
    // module", which is exactly the error we saw in the Victim Timeline
    // Reconstruction output.
    if (typeof PDFParse.setWorker === 'function') {
      if (typeof window !== 'undefined') {
        PDFParse.setWorker(
          'https://cdn.jsdelivr.net/npm/pdf-parse@latest/dist/pdf-parse/web/pdf.worker.mjs'
        );
      } else {
        // In Node environments just touch the getter so pdf.js keeps its
        // default worker configuration.
        PDFParse.setWorker();
      }
    }
  } catch (workerError) {
    console.warn('[pdf-parse compat] Failed to configure worker', workerError);
  } finally {
    workerConfigured = true;
  }
}

export async function parsePdf(buffer: Buffer): Promise<LegacyPdfParseResult> {
  ensureWorkerConfigured();

  const parser = new PDFParse({ data: buffer });

  try {
    const textResult = await parser.getText();

    let infoResult: any | null = null;
    try {
      infoResult = await parser.getInfo();
    } catch (infoError) {
      console.warn('[pdf-parse compat] Failed to load PDF metadata', infoError);
    }

    return {
      text: textResult.text ?? '',
      numpages: textResult.total,
      numrender: textResult.total,
      info: infoResult?.info ?? null,
      metadata: infoResult ?? null,
    };
  } finally {
    try {
      await parser.destroy();
    } catch (destroyError) {
      console.warn('[pdf-parse compat] Failed to destroy parser', destroyError);
    }
  }
}
