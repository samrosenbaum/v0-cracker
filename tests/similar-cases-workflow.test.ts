import assert from 'node:assert/strict';

import type { CaseSimilarity } from '../lib/cold-case-analyzer';
import {
  calculateSimilarCaseSummary,
  normalizeSimilarCaseResults,
} from '../lib/workflows/similar-cases';

function createCase(
  overrides: Partial<CaseSimilarity> & { caseId: string; caseTitle: string; similarityScore: number },
): any {
  return {
    caseId: overrides.caseId,
    caseTitle: overrides.caseTitle,
    similarityScore: overrides.similarityScore,
    matchingPatterns: overrides.matchingPatterns,
    commonPatterns: (overrides as any).commonPatterns,
    suspectOverlap: overrides.suspectOverlap,
    recommendation: overrides.recommendation,
  };
}

function testNormalizeSupportsLegacyCommonPatterns() {
  const raw = [
    createCase({
      caseId: 'case-a',
      caseTitle: 'Case A',
      similarityScore: 0.82,
      // Only the legacy field is populated
      matchingPatterns: undefined,
      commonPatterns: [
        { category: 'modus_operandi', details: 'Entry via second floor window' },
        { category: 'timing', details: 'Incidents on Friday nights' },
      ] as any,
      suspectOverlap: ['Jordan Blake'],
      recommendation: 'Compare witness notes',
    }),
  ];

  const normalized = normalizeSimilarCaseResults(raw);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].matchingPatterns.length, 2);
  assert.deepEqual(normalized[0].suspectOverlap, ['Jordan Blake']);
  assert.equal(normalized[0].recommendation, 'Compare witness notes');
}

function testNormalizeFiltersInvalidEntries() {
  const raw = [
    createCase({
      caseId: 'case-b',
      caseTitle: 'Case B',
      similarityScore: 0.65,
      matchingPatterns: [
        { category: 'modus_operandi', details: 'Unknown tool marks' },
        { category: 'invalid', details: 42 as any },
      ],
      suspectOverlap: ['Valid Suspect', 123 as any],
      recommendation: null as any,
    }),
  ];

  const normalized = normalizeSimilarCaseResults(raw);
  assert.equal(normalized[0].matchingPatterns.length, 1);
  assert.equal(normalized[0].matchingPatterns[0].details, 'Unknown tool marks');
  assert.deepEqual(normalized[0].suspectOverlap, ['Valid Suspect']);
  assert.equal(normalized[0].recommendation, '');
}

function testSummaryCountsMatchingPatterns() {
  const normalized = normalizeSimilarCaseResults([
    createCase({
      caseId: 'case-c',
      caseTitle: 'Case C',
      similarityScore: 0.91,
      matchingPatterns: [
        { category: 'modus_operandi', details: 'Same entry point' },
        { category: 'timing', details: 'Weekend attacks' },
      ],
      suspectOverlap: [],
      recommendation: '',
    }),
    createCase({
      caseId: 'case-d',
      caseTitle: 'Case D',
      similarityScore: 0.55,
      matchingPatterns: [
        { category: 'location_pattern', details: 'Within two-mile radius' },
      ],
      suspectOverlap: [],
      recommendation: '',
    }),
  ]);

  const summary = calculateSimilarCaseSummary(normalized);
  assert.equal(summary.totalSimilarCases, 2);
  assert.equal(summary.highSimilarity, 1);
  assert.equal(summary.matchingPatternCount, 3);
}

function run() {
  testNormalizeSupportsLegacyCommonPatterns();
  testNormalizeFiltersInvalidEntries();
  testSummaryCountsMatchingPatterns();
}

run();
