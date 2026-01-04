/**
 * Simple test runner script
 * Run with: npx tsx tests/internal/run-tests.ts
 */

import { runAnalysisTests } from './analysis-test-runner';

async function main() {
  console.log('Starting FreshEyes Internal Analysis Tests...\n');

  try {
    const results = await runAnalysisTests();

    // Print final summary
    console.log('\n' + '='.repeat(60));
    console.log('ANALYSIS OUTPUT SUMMARY');
    console.log('='.repeat(60));

    console.log(`\nCase: ${results.caseData.caseName}`);
    console.log(`Victim: ${results.caseData.victim.name}`);
    console.log(`Suspects: ${results.caseData.suspects.map(s => s.name).join(', ')}`);

    console.log('\n--- Suspect Rankings ---');
    results.suspectScores.forEach((score, i) => {
      console.log(`${i + 1}. ${score.name}: ${(score.overallScore * 100).toFixed(0)}%`);
      console.log(`   Top concerns: ${score.topConcerns.slice(0, 2).join('; ') || 'None'}`);
    });

    console.log('\n--- Behavioral Red Flags ---');
    results.behavioralPatterns.forEach(pattern => {
      console.log(`${pattern.personName}:`);
      pattern.patterns.forEach(p => {
        console.log(`  - ${p.type} (${(p.suspicionLevel * 100).toFixed(0)}%): ${p.description}`);
      });
    });

    console.log('\n--- Inconsistencies Found ---');
    results.inconsistencies.forEach(inc => {
      console.log(`[${inc.severity.toUpperCase()}] ${inc.type}: ${inc.description}`);
    });

    console.log('\n--- Evidence Gaps ---');
    results.evidenceGaps.slice(0, 5).forEach(gap => {
      console.log(`[${gap.priority.toUpperCase()}] ${gap.category}: ${gap.gapDescription}`);
    });

    console.log('\n--- Test Suite Results ---');
    let totalPassed = 0;
    let totalFailed = 0;

    results.testResults.forEach(suite => {
      totalPassed += suite.passed;
      totalFailed += suite.failed;
      const status = suite.failed === 0 ? 'PASS' : 'FAIL';
      console.log(`${status} ${suite.suiteName}: ${suite.passed}/${suite.totalTests}`);
    });

    console.log(`\nTotal: ${totalPassed}/${totalPassed + totalFailed} tests passed`);

    if (totalFailed > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('Test run failed:', error);
    process.exit(1);
  }
}

main();
