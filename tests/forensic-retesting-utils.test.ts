import assert from 'node:assert/strict';

import type { ForensicReExamination } from '../lib/cold-case-analyzer';
import {
  mapEvidenceRowsToAnalyzerInput,
  sanitizeForensicRecommendations,
  summarizeForensicRecommendations,
} from '../lib/forensic-retesting-utils';

function testEvidenceMappingMatchesAnalyzerShape() {
  const rows = [
    {
      file_name: 'Bloody swab from hallway banister',
      created_at: '2020-02-12T10:20:30.000Z',
      notes: 'Initial DNA extraction yielded partial profile',
      testing_results: 'Partial STR profile',
    },
    {
      evidence_type: 'Fiber sample',
      date_collected: '2018-09-01',
      notes: 'Unknown',
      analysis_summary: 'Trace blue fiber consistent with denim',
    },
  ];

  const mapped = mapEvidenceRowsToAnalyzerInput(rows);

  assert.equal(mapped.length, 2);
  assert.deepEqual(Object.keys(mapped[0]), ['item', 'dateCollected', 'testingPerformed', 'results']);
  assert.equal(mapped[0].item, 'Bloody swab from hallway banister');
  assert.equal(mapped[0].testingPerformed, 'Initial DNA extraction yielded partial profile');
  assert.equal(mapped[0].results, 'Partial STR profile');
  assert.equal(mapped[1].item, 'Fiber sample');
  assert.equal(mapped[1].testingPerformed, undefined);
  assert.equal(mapped[1].results, 'Trace blue fiber consistent with denim');
}

function testSanitizeRemovesPlaceholderValues() {
  const recommendations: ForensicReExamination[] = [
    {
      evidenceItem: 'Fiber sample',
      originalTesting: 'Unknown',
      newTechnologiesAvailable: ['Touch DNA recovery', 'Unknown'],
      whyRetest: 'Unknown',
      potentialFindings: ['Identify new contributors', 'Unknown'],
      costEstimate: 'Unknown',
      priority: 'high',
      exampleSuccessStories: 'Unknown',
    },
  ];

  const sanitized = sanitizeForensicRecommendations(recommendations);

  assert.equal(sanitized[0].originalTesting, '');
  assert.deepEqual(sanitized[0].newTechnologiesAvailable, ['Touch DNA recovery']);
  assert.equal(sanitized[0].whyRetest, '');
  assert.deepEqual(sanitized[0].potentialFindings, ['Identify new contributors']);
  assert.equal(sanitized[0].costEstimate, '');
  assert.equal(sanitized[0].exampleSuccessStories, '');
}

function testSummaryReflectsAnalyzerFields() {
  const recommendations: ForensicReExamination[] = [
    {
      evidenceItem: 'Bloody swab from hallway banister',
      originalTesting: 'Initial STR run in 2010',
      newTechnologiesAvailable: ['Touch DNA recovery', 'Next-generation sequencing'],
      whyRetest: 'Apply higher-sensitivity DNA sequencing to low-yield sample.',
      potentialFindings: ['Full STR profile'],
      costEstimate: '$1,200',
      priority: 'critical',
      exampleSuccessStories: 'Golden State Killer genealogy breakthrough',
    },
    {
      evidenceItem: 'Fiber sample',
      originalTesting: '',
      newTechnologiesAvailable: ['Micro trace analysis'],
      whyRetest: 'Corroborate suspect presence through trace transfer patterns.',
      potentialFindings: ['Link fibers to suspect vehicle'],
      costEstimate: '$800',
      priority: 'high',
      exampleSuccessStories: '',
    },
  ];

  const summary = summarizeForensicRecommendations(recommendations);

  assert.equal(summary.totalRecommendations, 2);
  assert.equal(summary.highPriority, 2);
  assert.equal(summary.uniqueNewTechnologies, 3);
  assert.deepEqual(summary.whyRetestHighlights, [
    'Apply higher-sensitivity DNA sequencing to low-yield sample.',
    'Corroborate suspect presence through trace transfer patterns.',
  ]);
}

function run() {
  testEvidenceMappingMatchesAnalyzerShape();
  testSanitizeRemovesPlaceholderValues();
  testSummaryReflectsAnalyzerFields();
}

run();
