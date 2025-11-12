import assert from 'node:assert/strict';

import { gatherDocumentsForAnalysis } from '../app/api/cases/[caseId]/analyze/route';
import { supabaseServer } from '../lib/supabase-server';

async function run() {
  const originalFrom = (supabaseServer as any).from;
  const originalStorage = (supabaseServer as any).storage;

  const fakeDocuments = [
    {
      file_name: 'Investigation Summary.pdf',
      document_type: 'report',
      storage_path: null,
      metadata: {
        extracted_text: '[No extracted text available for Investigation Summary.pdf]',
        processed_text: 'Case summary generated from processing pipeline.',
        pages: [
          { text: 'Page 1 fragment' },
          { text: 'Page 2 fragment' },
        ],
      },
    },
    {
      file_name: 'Audio Interview.mp3',
      document_type: 'audio_transcript',
      storage_path: 'case-123/audio-interview.txt',
      metadata: {
        extracted_text: '[No extracted text available for Audio Interview.mp3]',
      },
    },
    {
      file_name: 'Placeholder Note.txt',
      document_type: 'note',
      storage_path: null,
      metadata: {
        extracted_text: '[No extracted text available for Placeholder Note.txt]',
      },
    },
  ];

  const storageText = 'Transcribed conversation from Supabase storage.';

  try {
    (supabaseServer as any).from = (table: string) => {
      if (table !== 'case_documents') {
        return originalFrom.call(supabaseServer, table);
      }

      return {
        select() {
          return {
            eq() {
              return Promise.resolve({ data: fakeDocuments, error: null });
            },
          };
        },
      };
    };

    (supabaseServer as any).storage = {
      from(bucket: string) {
        if (bucket !== 'case-files') {
          return originalStorage.from(bucket);
        }

        return {
          async download(path: string) {
            if (path === 'case-123/audio-interview.txt') {
              const buffer = Buffer.from(storageText, 'utf-8');
              return {
                data: {
                  async arrayBuffer() {
                    return buffer;
                  },
                },
                error: null,
              };
            }

            return {
              data: null,
              error: { message: 'not found' },
            };
          },
        };
      },
    };

    const documents = await gatherDocumentsForAnalysis('case-123', true);

    assert.equal(documents.length, 2, 'documents with real content should be retained');

    const summaryDoc = documents.find((doc) => doc.filename === 'Investigation Summary.pdf');
    assert.ok(summaryDoc, 'summary document should be present');
    assert.ok(
      summaryDoc?.content.includes('Case summary generated from processing pipeline.'),
      'metadata processed_text should be included'
    );
    assert.ok(
      summaryDoc?.content.includes('Page 1 fragment'),
      'page fragments should also be extracted'
    );
    assert.ok(
      !summaryDoc?.content.includes('[No extracted text'),
      'placeholder text should be filtered out'
    );

    const audioDoc = documents.find((doc) => doc.filename === 'Audio Interview.mp3');
    assert.ok(audioDoc, 'audio document should be present');
    assert.equal(
      audioDoc?.content,
      storageText,
      'storage blob should be decoded into UTF-8 text when metadata is empty'
    );

    assert.ok(!documents.some((doc) => doc.filename === 'Placeholder Note.txt'));
  } finally {
    (supabaseServer as any).from = originalFrom;
    (supabaseServer as any).storage = originalStorage;
  }
}

run()
  .then(() => {
    if (process.env.DEBUG_TESTS) {
      console.log('analyze route gathers document content ✅');
    }
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
