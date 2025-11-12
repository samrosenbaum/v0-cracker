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
    PDFParse.setWorker('');
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
