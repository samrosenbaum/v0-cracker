import assert from 'node:assert/strict';
import { Blob } from 'buffer';

type SupabaseDoc = {
  file_name: string;
  document_type: string | null;
  storage_path: string | null;
  metadata?: Record<string, unknown> | null;
};

const supabaseDocs: SupabaseDoc[] = [
  {
    file_name: 'metadata-report.txt',
    document_type: 'report',
    storage_path: 'case-123/metadata-report.txt',
    metadata: {
      processed_text: 'Primary metadata text block describing the incident timeline.',
      textract: {
        pages: [
          { lines: ['Additional witness detail captured on page one.', 'Follow-up note from officer.'] },
        ],
      },
    },
  },
  {
    file_name: 'ocr-scan.json',
    document_type: 'scan',
    storage_path: 'case-123/ocr-scan.json',
    metadata: {
      extracted_text: '[No extracted text available for ocr-scan.json]',
    },
  },
  {
    file_name: 'empty-placeholder.txt',
    document_type: 'other',
    storage_path: 'case-123/empty-placeholder.txt',
    metadata: {
      extracted_text: '[No extracted text available for empty-placeholder.txt]',
    },
  },
];

const storageContentMap: Record<string, string> = {
  'case-123/ocr-scan.json': JSON.stringify({
    processed_text: 'Storage fallback text – with dash characters.',
    pages: ['First storage page with key observations.', 'Second storage page referencing lab report.'],
  }),
};

function createSupabaseStub() {
  return {
    storage: {
      from(bucket: string) {
        assert.equal(bucket, 'case-files');
        return {
          async download(path: string) {
            const content = storageContentMap[path];
            if (!content) {
              return { data: null, error: new Error('not found') };
            }
            return { data: new Blob([content], { type: 'application/json' }), error: null };
          },
        };
      },
    },
    from(table: string) {
      if (table === 'case_documents') {
        return {
          select() {
            return {
              eq(column: string, value: string) {
                if (column === 'case_id' && value === 'case-123') {
                  return Promise.resolve({ data: supabaseDocs, error: null });
                }
                return Promise.resolve({ data: [], error: null });
              },
            };
          },
        };
      }

      if (table === 'processing_jobs') {
        return {
          insert() {
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: { id: 'job-123' }, error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'case_analysis') {
        return {
          insert() {
            return {
              select() {
                return {
                  single() {
                    return Promise.resolve({ data: { id: 'analysis-123' }, error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === 'persons_of_interest') {
        return {
          select() {
            return {
              eq() {
                return {
                  eq() {
                    return Promise.resolve({ data: [], error: null });
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table access: ${table}`);
    },
  };
}

async function run() {
  const supabaseModulePath = require.resolve('../lib/supabase-server.ts');
  const aiAnalysisModulePath = require.resolve('../lib/ai-analysis.ts');
  const originalSupabaseModule = require.cache[supabaseModulePath];
  const originalAiModule = require.cache[aiAnalysisModulePath];

  const supabaseStub = createSupabaseStub();
  let analyzedDocuments: any[] | null = null;

  require.cache[supabaseModulePath] = {
    id: supabaseModulePath,
    filename: supabaseModulePath,
    loaded: true,
    exports: { supabaseServer: supabaseStub },
  } as NodeModule;

  require.cache[aiAnalysisModulePath] = {
    id: aiAnalysisModulePath,
    filename: aiAnalysisModulePath,
    loaded: true,
    exports: {
      analyzeCaseDocuments: async (docs: any[]) => {
        analyzedDocuments = docs;
        const providedAnalysis = {
          timeline: [
            {
              id: 'event-early',
              date: '2024-01-01',
              startTime: '2024-01-01T08:00:00Z',
              endTime: '2024-01-01T09:00:00Z',
              description: 'Victim meets coworker for breakfast.',
              source: 'metadata-report.txt',
              sourceType: 'report',
              location: 'Harbor Cafe',
              involvedPersons: ['Victim', 'Coworker'],
              confidence: 0.92,
            },
            {
              id: 'event-no-location',
              date: '2024-01-01',
              time: '10:15',
              description: 'Witness mentions an encounter but cannot recall the location.',
              source: 'metadata-report.txt',
              sourceType: 'report',
              location: 'Unknown',
              involvedPersons: ['Witness A'],
              confidence: 0.55,
            },
            {
              id: 'event-mid',
              date: '2024-01-01',
              description: 'Anonymous tip references a meetup without a solid time anchor.',
              source: 'ocr-scan.json',
              sourceType: 'scan',
              location: 'Riverwalk Overlook',
              involvedPersons: ['Victim'],
              confidence: 0.48,
            },
            {
              id: 'event-late',
              date: '2024-01-01',
              startTime: '2024-01-01T13:30:00Z',
              endTime: '2024-01-01T14:00:00Z',
              description: 'Victim seen entering downtown loft on security footage.',
              source: 'ocr-scan.json',
              sourceType: 'scan',
              location: 'Downtown Loft',
              involvedPersons: ['Victim'],
              confidence: 0.88,
            },
          ],
          conflicts: [],
          personMentions: [],
          gaps: [
            {
              startTime: 'Unknown',
              endTime: 'Unknown',
              lastKnownLocation: 'Unknown',
              nextKnownLocation: 'Unknown',
            },
            {
              startTime: 'Unknown',
              endTime: 'Unknown',
              lastKnownLocation: 'Unknown',
              nextKnownLocation: 'Unknown',
            },
            {
              startTime: '2024-01-01T09:00:00.000Z',
              endTime: '2024-01-01T13:30:00.000Z',
              lastKnownLocation: 'Harbor Cafe',
              nextKnownLocation: 'Downtown Loft',
            },
          ],
          topPriorities: [],
        };
        return providedAnalysis;
      },
      detectTimeConflicts: () => [],
      identifyOverlookedSuspects: () => [],
      generateConflictSummary: () => 'summary',
    },
  } as NodeModule;

  try {
    const routeModule = require('../app/api/cases/[caseId]/analyze/route.ts');
    const { runFallbackAnalysis } = routeModule.__testables;

    const response = await runFallbackAnalysis('case-123', { reason: 'unit-test', useSupabase: true });
    const payload = await response.json();
    const analysis = payload.analysis;

    assert.ok(analyzedDocuments, 'analyzeCaseDocuments should be invoked');
    assert.equal(analyzedDocuments!.length, 2, 'only documents with meaningful text should be analyzed');

    const [metadataDoc, storageDoc] = analyzedDocuments!;
    assert.ok(
      metadataDoc.content.includes('Primary metadata text block'),
      'metadata text should be included in the analyzed payload'
    );
    assert.ok(
      metadataDoc.content.includes('Additional witness detail'),
      'nested metadata arrays should be flattened into text content'
    );
    assert.ok(
      storageDoc.content.includes('Storage fallback text – with dash characters.'),
      'storage fallback text should be decoded from blobs and analyzed'
    );
    assert.ok(
      storageDoc.content.includes('Second storage page referencing lab report.'),
      'JSON blobs should have nested text extracted'
    );
    assert.ok(
      analyzedDocuments!.every((doc) => !/\[No extracted text/i.test(doc.content)),
      'placeholder strings must not be forwarded to analysis'
    );

    assert.ok(Array.isArray(analysis.gaps), 'analysis should include sanitized gaps');
    const anchoredGap = analysis.gaps.find(
      (gap: any) => gap.startEventId === 'event-early' && gap.endEventId === 'event-late'
    );
    assert.ok(anchoredGap, 'gaps should connect anchored events with concrete time and location');
    assert.equal(
      analysis.gaps.filter((gap: any) => gap.startEventId === 'event-no-location').length,
      0,
      'events without concrete locations should not anchor gaps'
    );
    const placeholderDeduped = analysis.gaps.filter((gap: any) => {
      return /unknown/i.test(gap.lastKnownLocation || '') && /unknown/i.test(gap.nextKnownLocation || '');
    });
    assert.ok(placeholderDeduped.length <= 1, 'duplicate placeholder gaps should be removed');
  } finally {
    if (originalSupabaseModule) {
      require.cache[supabaseModulePath] = originalSupabaseModule;
    } else {
      delete require.cache[supabaseModulePath];
    }

    if (originalAiModule) {
      require.cache[aiAnalysisModulePath] = originalAiModule;
    } else {
      delete require.cache[aiAnalysisModulePath];
    }
  }
}

run()
  .then(() => {
    if (process.env.DEBUG_TESTS) {
      console.log('timeline analysis route resolves real document text ✅');
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
