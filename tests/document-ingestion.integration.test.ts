import assert from 'node:assert/strict';

import { deriveChunkPersistencePlan } from '../lib/extraction-outcome';
import { extractDocumentContentFromBuffer } from '../lib/document-parser';

async function run() {
  const malformedPdf = Buffer.from('This is not a valid PDF document');

  const extraction = await extractDocumentContentFromBuffer('malformed.pdf', malformedPdf);

  assert.ok(extraction.error, 'extraction should surface an error message');
  assert.equal(extraction.text.trim().length, 0, 'no text should be returned for malformed input');

  const plan = deriveChunkPersistencePlan({ metadata: { pageNumber: 1 } } as any, extraction);

  assert.equal(plan.status, 'failed');
  assert.equal(plan.contentForEmbedding, null);
  assert.ok(plan.error, 'plan should include structured error payload');
  assert.equal(plan.error?.code, 'PDF_EXTRACTION_FAILED');
  assert.ok(plan.updates.error_log, 'error log should be persisted');

  const parsedLog = JSON.parse(plan.updates.error_log!);
  assert.equal(parsedLog.code, plan.error?.code);
  assert.equal(parsedLog.message, plan.error?.message);
}

run().then(() => {
  if (process.env.DEBUG_TESTS) {
    console.log('malformed PDF triggers structured ingestion failure ✅');
  }
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
