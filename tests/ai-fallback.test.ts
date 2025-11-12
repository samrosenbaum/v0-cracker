import assert from 'node:assert/strict';

import { fallbackCaseAnalysis } from '../lib/ai-fallback';

const BASE_DATE = '2024-10-21T18:00:00.000Z';

function testPlaceholderDocumentsDoNotEmitEvents() {
  const analysis = fallbackCaseAnalysis(
    [
      {
        content: '[No extracted text available for placeholder]',
        filename: 'placeholder.txt',
        type: 'report',
        metadata: { extracted_text: '[No extracted text available for placeholder]' },
      },
    ],
    BASE_DATE,
  );

  assert.equal(analysis.timeline.length, 1, 'only the default fallback event should be generated');
  assert.equal(analysis.timeline[0].id, 'fallback-default');
  assert.ok(
    analysis.timeline[0].description.includes('Document analysis fallback'),
    'default fallback description should be used when no meaningful text exists',
  );
}

function testMetadataCuesPopulateTimeline() {
  const analysis = fallbackCaseAnalysis(
    [
      {
        content: [
          'Summary unavailable for section.',
          'Follow-up interview captured additional context at approximately 10:15 PM about the confrontation that evening.',
          'Summary unavailable for attachments.',
        ].join('\n'),
        filename: 'officer-report.txt',
        type: 'police_report',
        metadata: {
          timestamp: '2024-10-21T22:15:00Z',
          location: 'Riverside Park Pavilion',
          participants: ['Officer Kelly', 'Jamie Lee'],
        },
      },
    ],
    BASE_DATE,
  );

  assert.equal(analysis.timeline.length, 1, 'a single enriched event should be produced');
  const event = analysis.timeline[0];

  assert.equal(event.date, '2024-10-21');
  assert.equal(event.time, '22:15');
  assert.equal(event.location, 'Riverside Park Pavilion');
  assert.deepEqual(
    new Set(event.involvedPersons),
    new Set(['Officer Kelly', 'Jamie Lee']),
    'metadata participants should populate involved persons when text lacks names',
  );
  assert.deepEqual(event.metadata?.metadataCues, { timestamp: true, location: true, participants: true });
}

function run() {
  testPlaceholderDocumentsDoNotEmitEvents();
  testMetadataCuesPopulateTimeline();
}

run();
