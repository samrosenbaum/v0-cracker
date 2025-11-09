/**
 * Quick test script to verify document extraction works
 *
 * Run with: npx tsx test-document-extraction.ts
 */

import { extractDocumentContent } from './lib/document-parser';

async function testExtraction() {
  console.log('🧪 Testing document extraction...\n');

  // This would test with a real document from your storage
  // Replace with an actual storage_path from your case_documents table
  const testPath = 'your-case-id/some-document.pdf';

  try {
    const result = await extractDocumentContent(testPath, false);

    console.log('📄 Extraction Result:');
    console.log('  Method:', result.method);
    console.log('  Confidence:', result.confidence);
    console.log('  Text Length:', result.text?.length || 0);
    console.log('  First 200 chars:', result.text?.substring(0, 200));
    console.log('  Error:', result.error || 'None');

    if (result.text && result.text.length > 100) {
      console.log('\n✅ SUCCESS: Document extraction is working!');
    } else {
      console.log('\n❌ FAILED: No text extracted');
    }
  } catch (error) {
    console.error('❌ ERROR:', error);
  }
}

testExtraction();
