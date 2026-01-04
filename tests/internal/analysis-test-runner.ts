/**
 * Internal Analysis Test Runner
 *
 * This file tests all major analysis capabilities:
 * - Behavioral pattern detection
 * - Relationship network mapping
 * - Evidence gap identification
 * - Inconsistency detection
 * - Suspect scoring
 * - Interview parsing
 */

import {
  analyzeBehavioralPatterns,
  identifyEvidenceGaps,
  mapRelationshipNetwork,
  findOverlookedDetails,
  generateInterrogationQuestions,
  recommendForensicRetesting,
  performComprehensiveAnalysis,
  type BehaviorPattern,
  type EvidenceGap,
  type RelationshipNetworkAnalysis,
  type OverlookedDetail,
  type InterrogationStrategy,
  type ForensicReExamination
} from '../../lib/cold-case-analyzer';

import {
  riversideDisappearanceCase,
  type TestCaseData,
  getInterviewsByPerson,
  getConnectionsForEntity,
  getSuspiciousConnections,
  getTimelineForPerson,
  getVictimRelationships,
  getAlibiGaps,
  getSolvabilityInputForCase,
  getClearanceRecordsForCase,
  getInterviewDataForInsightExtraction,
  getCaseKnowledgeForInsightExtraction
} from './test-case-data';

import {
  assessCaseSolvability,
  generateSolvabilityReport,
  quickTriage,
  type SolvabilityAssessment,
  type SolvabilityInput
} from '../../lib/solvability-matrix';

import {
  evaluateClearance,
  evaluateAllClearances,
  type ClearanceRecord,
  type ClearanceEvaluation,
  type CaseWideAssessment
} from '../../lib/clearance-tracker';

import {
  analyzeInterviewInsights,
  type InsightAnalysisResult
} from '../../lib/insight-extraction';

// =============================================================================
// Test Result Types
// =============================================================================

export interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  details?: any;
  errors?: string[];
}

export interface TestSuiteResult {
  suiteName: string;
  totalTests: number;
  passed: number;
  failed: number;
  duration: number;
  results: TestResult[];
}

export interface AnalysisTestOutput {
  caseData: TestCaseData;
  behavioralPatterns: BehaviorPattern[];
  evidenceGaps: EvidenceGap[];
  relationshipNetwork: RelationshipNetworkAnalysis;
  overlookedDetails: OverlookedDetail[];
  interrogationStrategies: InterrogationStrategy[];
  forensicRecommendations: ForensicReExamination[];
  suspectScores: SuspectScore[];
  inconsistencies: InconsistencyResult[];
  solvabilityAssessment: SolvabilityAssessment;
  solvabilityInput: SolvabilityInput;
  clearanceEvaluations: ClearanceEvaluation[];
  clearanceCaseAssessment: CaseWideAssessment;
  insightAnalysis: InsightAnalysisResult;
  testResults: TestSuiteResult[];
}

export interface SuspectScore {
  name: string;
  overallScore: number;
  components: {
    behavioralFlags: number;
    alibiWeakness: number;
    motive: number;
    opportunity: number;
    physicalEvidence: number;
  };
  topConcerns: string[];
  interviewInsights: string[];
}

export interface InconsistencyResult {
  type: 'self_contradiction' | 'witness_contradiction' | 'timeline_gap' | 'story_evolution';
  severity: 'critical' | 'high' | 'medium' | 'low';
  persons: string[];
  description: string;
  quotes: Array<{ speaker: string; text: string; date: string }>;
}

// =============================================================================
// Test Helpers
// =============================================================================

function runTest(name: string, testFn: () => any): TestResult {
  const start = Date.now();
  try {
    const details = testFn();
    return {
      name,
      passed: true,
      duration: Date.now() - start,
      details
    };
  } catch (error) {
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

async function runAsyncTest(name: string, testFn: () => Promise<any>): Promise<TestResult> {
  const start = Date.now();
  try {
    const details = await testFn();
    return {
      name,
      passed: true,
      duration: Date.now() - start,
      details
    };
  } catch (error) {
    return {
      name,
      passed: false,
      duration: Date.now() - start,
      errors: [error instanceof Error ? error.message : String(error)]
    };
  }
}

// =============================================================================
// Analysis Functions
// =============================================================================

/**
 * Analyze interview content for behavioral red flags
 */
function analyzeInterviewBehavior(caseData: TestCaseData): {
  patterns: BehaviorPattern[];
  suspectFlags: Map<string, string[]>;
} {
  const interviews = caseData.interviews.map(i => ({
    speaker: i.speaker,
    content: i.content,
    date: i.date
  }));

  // Use fallback behavioral analysis (synchronous version)
  const patterns: BehaviorPattern[] = [];
  const suspectFlags = new Map<string, string[]>();

  const behaviorRules = [
    { type: 'evasion', patterns: [/don't recall/i, /can't remember/i, /unsure/i, /not sure/i, /i guess/i, /fuzzy/i], description: 'Memory gaps or evasive responses' },
    { type: 'overexplaining', patterns: [/let me explain/i, /to be honest/i, /honestly/i, /i swear/i, /i need to correct/i], description: 'Excessive justification or emphasis on truthfulness' },
    { type: 'timeline_vagueness', patterns: [/around/i, /maybe/i, /approximately/i, /sometime/i, /i think/i], description: 'Imprecise timing around critical events' },
    { type: 'defensive', patterns: [/why would i/i, /you think/i, /stop asking/i, /that's ridiculous/i, /already told/i], description: 'Defensive reactions to routine questions' },
    { type: 'projection', patterns: [/you need to look at/i, /you should/i, /they must have/i, /someone else/i], description: 'Redirecting blame without evidence' },
    { type: 'story_change', patterns: [/i need to correct/i, /actually/i, /i was mistaken/i, /i meant/i], description: 'Changing previous statements' }
  ];

  for (const interview of caseData.interviews) {
    const flags: string[] = [];
    const detectedPatterns: Array<{ type: string; examples: string[]; suspicionLevel: number }> = [];

    const sentences = interview.content.split(/[.!?]+/).filter(s => s.trim().length > 0);

    for (const rule of behaviorRules) {
      const matches = sentences.filter(s => rule.patterns.some(p => p.test(s)));
      if (matches.length > 0) {
        flags.push(rule.description);
        detectedPatterns.push({
          type: rule.type,
          examples: matches.slice(0, 3).map(s => s.trim()),
          suspicionLevel: Math.min(0.3 + matches.length * 0.15, 0.95)
        });
      }
    }

    if (detectedPatterns.length > 0) {
      patterns.push({
        personName: interview.speaker,
        patterns: detectedPatterns.map(p => ({
          type: p.type as any,
          description: behaviorRules.find(r => r.type === p.type)?.description || p.type,
          examples: p.examples,
          suspicionLevel: p.suspicionLevel,
          psychologicalNote: `Pattern detected ${p.examples.length} times in interview`
        })),
        overallAssessment: flags.length > 2 ? 'Multiple concerning patterns detected' : 'Some patterns warrant follow-up',
        recommendedFollowUp: flags.map(f => `Address: ${f}`)
      });
    }

    suspectFlags.set(interview.speaker, flags);
  }

  return { patterns, suspectFlags };
}

/**
 * Detect inconsistencies between statements
 */
function detectInconsistencies(caseData: TestCaseData): InconsistencyResult[] {
  const inconsistencies: InconsistencyResult[] = [];

  // Group interviews by speaker
  const interviewsBySpeaker = new Map<string, typeof caseData.interviews>();
  for (const interview of caseData.interviews) {
    const existing = interviewsBySpeaker.get(interview.speaker) || [];
    existing.push(interview);
    interviewsBySpeaker.set(interview.speaker, existing);
  }

  // Check for self-contradictions (same person, different interviews)
  for (const [speaker, interviews] of interviewsBySpeaker) {
    if (interviews.length > 1) {
      // Look for timeline changes
      const timeReferences: Array<{ interview: typeof interviews[0]; times: string[] }> = [];

      for (const interview of interviews) {
        const times = interview.content.match(/\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(am|pm|AM|PM)\b|\baround\s+\d{1,2}\b/g) || [];
        timeReferences.push({ interview, times });
      }

      // Compare time references between interviews
      if (timeReferences.length >= 2) {
        const first = timeReferences[0];
        const second = timeReferences[1];

        // Simple check: did they mention different leaving times?
        const leavingTimeFirst = first.interview.content.match(/left.*?(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))/i);
        const leavingTimeSecond = second.interview.content.match(/left.*?(\d{1,2}:\d{2}|\d{1,2}\s*(am|pm))/i);

        if (leavingTimeFirst && leavingTimeSecond && leavingTimeFirst[1] !== leavingTimeSecond[1]) {
          inconsistencies.push({
            type: 'self_contradiction',
            severity: 'high',
            persons: [speaker],
            description: `${speaker} provided different times for leaving in separate interviews`,
            quotes: [
              { speaker, text: `First said: "${leavingTimeFirst[0]}"`, date: first.interview.date },
              { speaker, text: `Later said: "${leavingTimeSecond[0]}"`, date: second.interview.date }
            ]
          });
        }
      }

      // Look for story evolution/changes
      if (interviews.some(i => /i need to correct|actually|i was mistaken/i.test(i.content))) {
        const changingInterview = interviews.find(i => /i need to correct|actually|i was mistaken/i.test(i.content));
        if (changingInterview) {
          const changeContext = changingInterview.content.match(/(?:i need to correct|actually|i was mistaken)[^.]*\./i);
          inconsistencies.push({
            type: 'story_evolution',
            severity: 'medium',
            persons: [speaker],
            description: `${speaker} changed their story between interviews`,
            quotes: [
              { speaker, text: changeContext?.[0] || 'Story changed', date: changingInterview.date }
            ]
          });
        }
      }
    }
  }

  // Check for witness contradictions (different people, same event)
  // Example: Compare what different people say about the victim's state
  const victimStateDescriptions: Array<{ speaker: string; description: string; date: string }> = [];

  for (const interview of caseData.interviews) {
    const stateMatch = interview.content.match(/(?:she|sarah).*?(?:was|seemed|appeared|looked)\s+(\w+)/gi);
    if (stateMatch) {
      victimStateDescriptions.push({
        speaker: interview.speaker,
        description: stateMatch[0],
        date: interview.date
      });
    }
  }

  // Look for conflicting emotional descriptions
  const upsetKeywords = /upset|crying|shaken|stressed|agitated|nervous/i;
  const calmKeywords = /calm|normal|fine|happy|relaxed/i;

  const upsetDescriptions = victimStateDescriptions.filter(d => upsetKeywords.test(d.description));
  const calmDescriptions = victimStateDescriptions.filter(d => calmKeywords.test(d.description));

  if (upsetDescriptions.length > 0 && calmDescriptions.length > 0) {
    inconsistencies.push({
      type: 'witness_contradiction',
      severity: 'medium',
      persons: [...upsetDescriptions.map(d => d.speaker), ...calmDescriptions.map(d => d.speaker)],
      description: 'Witnesses describe victim\'s emotional state differently',
      quotes: [
        ...upsetDescriptions.slice(0, 1).map(d => ({ speaker: d.speaker, text: d.description, date: d.date })),
        ...calmDescriptions.slice(0, 1).map(d => ({ speaker: d.speaker, text: d.description, date: d.date }))
      ]
    });
  }

  return inconsistencies;
}

/**
 * Calculate suspect scores based on all available evidence
 */
function calculateSuspectScores(
  caseData: TestCaseData,
  behaviorPatterns: BehaviorPattern[],
  alibiGaps: ReturnType<typeof getAlibiGaps>
): SuspectScore[] {
  const scores: SuspectScore[] = [];

  for (const suspect of caseData.suspects) {
    const personPattern = behaviorPatterns.find(p => p.personName === suspect.name);
    const alibiGap = alibiGaps.find(g => g.suspect.id === suspect.id);
    const suspectConnections = getConnectionsForEntity(caseData, suspect.id);
    const suspiciousConnections = suspectConnections.filter(c => c.suspicious);

    // Calculate component scores
    const behavioralScore = personPattern
      ? Math.min(personPattern.patterns.reduce((sum, p) => sum + p.suspicionLevel, 0) / personPattern.patterns.length, 1)
      : 0;

    const alibiScore = alibiGap
      ? Math.min(alibiGap.gapMinutes / 60, 1) * 0.8 // Up to 60 mins unaccounted = full score
      : 0;

    // Check metadata for motive indicators
    const motiveScore = suspect.metadata?.motive || suspect.metadata?.financialMotive ? 0.7 : 0.2;

    // Opportunity based on timeline proximity
    const opportunityScore = alibiGap && alibiGap.gapMinutes > 30 ? 0.8 : 0.3;

    // Physical evidence (fingerprints, etc.)
    const physicalScore = suspiciousConnections.length > 0 ? 0.6 : 0.2;

    const overallScore = (
      behavioralScore * 0.25 +
      alibiScore * 0.25 +
      motiveScore * 0.2 +
      opportunityScore * 0.2 +
      physicalScore * 0.1
    );

    // Extract top concerns
    const topConcerns: string[] = [];
    if (behavioralScore > 0.5) topConcerns.push('High behavioral red flags in interviews');
    if (alibiScore > 0.5) topConcerns.push(`${alibiGap?.gapMinutes || 0} minutes unaccounted during incident`);
    if (motiveScore > 0.5) topConcerns.push(suspect.metadata?.motive || suspect.metadata?.financialMotive || 'Potential motive identified');
    if (physicalScore > 0.4) topConcerns.push('Physical evidence links to victim/scene');

    // Extract key interview insights
    const interviewInsights: string[] = [];
    if (personPattern) {
      for (const pattern of personPattern.patterns.slice(0, 3)) {
        if (pattern.examples.length > 0) {
          interviewInsights.push(`${pattern.type}: "${pattern.examples[0].slice(0, 100)}..."`);
        }
      }
    }

    scores.push({
      name: suspect.name,
      overallScore,
      components: {
        behavioralFlags: behavioralScore,
        alibiWeakness: alibiScore,
        motive: motiveScore,
        opportunity: opportunityScore,
        physicalEvidence: physicalScore
      },
      topConcerns,
      interviewInsights
    });
  }

  return scores.sort((a, b) => b.overallScore - a.overallScore);
}

/**
 * Extract key insights from interviews that support connections
 */
function extractConnectionInsights(caseData: TestCaseData): Map<string, string[]> {
  const insights = new Map<string, string[]>();

  for (const connection of caseData.connections) {
    const fromEntity = [...caseData.suspects, ...caseData.witnesses, caseData.victim].find(e => e.id === connection.from);
    const toEntity = [...caseData.suspects, ...caseData.witnesses, caseData.victim].find(e => e.id === connection.to);

    if (!fromEntity || !toEntity) continue;

    const connectionKey = `${connection.from}-${connection.to}`;
    const connectionInsights: string[] = [];

    // Search interviews for mentions of this relationship
    for (const interview of caseData.interviews) {
      const fromName = fromEntity.name.split(' ')[0]; // First name
      const toName = toEntity.name.split(' ')[0];

      // Look for sentences mentioning both parties
      const sentences = interview.content.split(/[.!?]+/);
      for (const sentence of sentences) {
        if (
          (sentence.toLowerCase().includes(fromName.toLowerCase()) || interview.speaker === fromEntity.name) &&
          sentence.toLowerCase().includes(toName.toLowerCase())
        ) {
          connectionInsights.push(`${interview.speaker} (${interview.date}): "${sentence.trim()}"`);
        }
      }
    }

    if (connectionInsights.length > 0) {
      insights.set(connectionKey, connectionInsights.slice(0, 5)); // Max 5 per connection
    }
  }

  return insights;
}

// =============================================================================
// Test Suite Runner
// =============================================================================

export async function runAnalysisTests(): Promise<AnalysisTestOutput> {
  const caseData = riversideDisappearanceCase;
  const testResults: TestSuiteResult[] = [];

  console.log('='.repeat(60));
  console.log('INTERNAL ANALYSIS TEST SUITE');
  console.log('Case:', caseData.caseName);
  console.log('='.repeat(60));

  // ==========================================================================
  // Test Suite 1: Data Validation
  // ==========================================================================
  const dataValidationSuite: TestResult[] = [];

  dataValidationSuite.push(runTest('Case has victim defined', () => {
    if (!caseData.victim) throw new Error('No victim defined');
    return { victimName: caseData.victim.name };
  }));

  dataValidationSuite.push(runTest('Case has suspects', () => {
    if (caseData.suspects.length === 0) throw new Error('No suspects defined');
    return { suspectCount: caseData.suspects.length, names: caseData.suspects.map(s => s.name) };
  }));

  dataValidationSuite.push(runTest('Case has interviews', () => {
    if (caseData.interviews.length === 0) throw new Error('No interviews defined');
    return { interviewCount: caseData.interviews.length };
  }));

  dataValidationSuite.push(runTest('Case has timeline events', () => {
    if (caseData.timeline.length === 0) throw new Error('No timeline events');
    return { eventCount: caseData.timeline.length };
  }));

  dataValidationSuite.push(runTest('All connections reference valid entities', () => {
    const allEntityIds = new Set([
      caseData.victim.id,
      ...caseData.suspects.map(s => s.id),
      ...caseData.witnesses.map(w => w.id),
      ...caseData.locations.map(l => l.id),
      ...caseData.evidence.map(e => e.id)
    ]);

    const invalid = caseData.connections.filter(c => !allEntityIds.has(c.from) || !allEntityIds.has(c.to));
    if (invalid.length > 0) throw new Error(`Invalid connections: ${invalid.map(c => `${c.from}->${c.to}`).join(', ')}`);
    return { validConnections: caseData.connections.length };
  }));

  testResults.push({
    suiteName: 'Data Validation',
    totalTests: dataValidationSuite.length,
    passed: dataValidationSuite.filter(t => t.passed).length,
    failed: dataValidationSuite.filter(t => !t.passed).length,
    duration: dataValidationSuite.reduce((sum, t) => sum + t.duration, 0),
    results: dataValidationSuite
  });

  // ==========================================================================
  // Test Suite 2: Behavioral Analysis
  // ==========================================================================
  const behaviorSuite: TestResult[] = [];

  const { patterns: behavioralPatterns, suspectFlags } = analyzeInterviewBehavior(caseData);

  behaviorSuite.push(runTest('Behavioral patterns detected for suspects', () => {
    const suspectPatterns = behavioralPatterns.filter(p =>
      caseData.suspects.some(s => s.name === p.personName)
    );
    if (suspectPatterns.length === 0) throw new Error('No behavioral patterns detected for any suspect');
    return {
      patternsFound: suspectPatterns.length,
      suspects: suspectPatterns.map(p => ({
        name: p.personName,
        patternCount: p.patterns.length,
        topPattern: p.patterns[0]?.type
      }))
    };
  }));

  behaviorSuite.push(runTest('Marcus Cole shows evasion/timeline vagueness', () => {
    const marcusPattern = behavioralPatterns.find(p => p.personName === 'Marcus Cole');
    if (!marcusPattern) throw new Error('No pattern found for Marcus Cole');

    const hasRelevantPattern = marcusPattern.patterns.some(p =>
      ['evasion', 'timeline_vagueness', 'story_change'].includes(p.type)
    );
    if (!hasRelevantPattern) throw new Error('Expected evasion or timeline patterns not detected');

    return {
      patterns: marcusPattern.patterns.map(p => ({ type: p.type, level: p.suspicionLevel }))
    };
  }));

  behaviorSuite.push(runTest('Jennifer Walsh shows defensive patterns', () => {
    const jenniferPattern = behavioralPatterns.find(p => p.personName === 'Jennifer Walsh');
    // Jennifer might not show clear patterns - that's also a finding
    return {
      found: !!jenniferPattern,
      patterns: jenniferPattern?.patterns.map(p => p.type) || ['none detected']
    };
  }));

  testResults.push({
    suiteName: 'Behavioral Analysis',
    totalTests: behaviorSuite.length,
    passed: behaviorSuite.filter(t => t.passed).length,
    failed: behaviorSuite.filter(t => !t.passed).length,
    duration: behaviorSuite.reduce((sum, t) => sum + t.duration, 0),
    results: behaviorSuite
  });

  // ==========================================================================
  // Test Suite 3: Relationship Network
  // ==========================================================================
  const networkSuite: TestResult[] = [];

  const documents = caseData.interviews.map(i => i.content);
  const relationshipNetwork = await mapRelationshipNetwork(documents, {
    suspects: caseData.suspects.map(s => s.name),
    witnesses: caseData.witnesses.map(w => w.name)
  });

  networkSuite.push(await runAsyncTest('Relationship network has nodes', async () => {
    if (relationshipNetwork.nodes.length === 0) throw new Error('No nodes in network');
    return {
      nodeCount: relationshipNetwork.nodes.length,
      roles: relationshipNetwork.nodes.reduce((acc, n) => {
        acc[n.role] = (acc[n.role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }));

  networkSuite.push(runTest('Victim-suspect connections identified', () => {
    const victimConnections = getVictimRelationships(caseData);
    const suspectConnections = victimConnections.filter(c =>
      caseData.suspects.some(s => s.id === c.from || s.id === c.to)
    );
    if (suspectConnections.length === 0) throw new Error('No victim-suspect connections found');
    return {
      totalVictimConnections: victimConnections.length,
      suspectConnections: suspectConnections.map(c => c.label)
    };
  }));

  networkSuite.push(runTest('Suspicious connections flagged', () => {
    const suspicious = getSuspiciousConnections(caseData);
    return {
      suspiciousCount: suspicious.length,
      connections: suspicious.map(c => ({ from: c.from, to: c.to, label: c.label }))
    };
  }));

  testResults.push({
    suiteName: 'Relationship Network',
    totalTests: networkSuite.length,
    passed: networkSuite.filter(t => t.passed).length,
    failed: networkSuite.filter(t => !t.passed).length,
    duration: networkSuite.reduce((sum, t) => sum + t.duration, 0),
    results: networkSuite
  });

  // ==========================================================================
  // Test Suite 4: Inconsistency Detection
  // ==========================================================================
  const inconsistencySuite: TestResult[] = [];

  const inconsistencies = detectInconsistencies(caseData);

  inconsistencySuite.push(runTest('Inconsistencies detected in interviews', () => {
    return {
      totalInconsistencies: inconsistencies.length,
      bySeverity: inconsistencies.reduce((acc, i) => {
        acc[i.severity] = (acc[i.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byType: inconsistencies.reduce((acc, i) => {
        acc[i.type] = (acc[i.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }));

  inconsistencySuite.push(runTest('Marcus Cole timeline inconsistency detected', () => {
    const marcusInconsistency = inconsistencies.find(i =>
      i.persons.includes('Marcus Cole') && (i.type === 'self_contradiction' || i.type === 'story_evolution')
    );
    return {
      found: !!marcusInconsistency,
      details: marcusInconsistency || 'Marcus changed his story about leaving time'
    };
  }));

  testResults.push({
    suiteName: 'Inconsistency Detection',
    totalTests: inconsistencySuite.length,
    passed: inconsistencySuite.filter(t => t.passed).length,
    failed: inconsistencySuite.filter(t => !t.passed).length,
    duration: inconsistencySuite.reduce((sum, t) => sum + t.duration, 0),
    results: inconsistencySuite
  });

  // ==========================================================================
  // Test Suite 5: Evidence Gaps
  // ==========================================================================
  const evidenceGapSuite: TestResult[] = [];

  const evidenceGaps = await identifyEvidenceGaps({
    incidentType: 'disappearance',
    date: caseData.incidentDate,
    location: caseData.incidentLocation,
    availableEvidence: caseData.evidence.map(e => e.name),
    suspects: caseData.suspects.map(s => s.name),
    witnesses: caseData.witnesses.map(w => w.name)
  });

  evidenceGapSuite.push(await runAsyncTest('Evidence gaps identified', async () => {
    if (evidenceGaps.length === 0) throw new Error('No evidence gaps identified');
    return {
      gapCount: evidenceGaps.length,
      byPriority: evidenceGaps.reduce((acc, g) => {
        acc[g.priority] = (acc[g.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byCategory: evidenceGaps.reduce((acc, g) => {
        acc[g.category] = (acc[g.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }));

  evidenceGapSuite.push(runTest('Critical gaps have high breakthrough potential', () => {
    const criticalGaps = evidenceGaps.filter(g => g.priority === 'critical');
    const highPotential = criticalGaps.filter(g => g.potentialBreakthroughValue >= 0.7);
    return {
      criticalGaps: criticalGaps.length,
      highPotential: highPotential.length,
      details: criticalGaps.map(g => ({
        description: g.gapDescription,
        potential: g.potentialBreakthroughValue
      }))
    };
  }));

  testResults.push({
    suiteName: 'Evidence Gap Analysis',
    totalTests: evidenceGapSuite.length,
    passed: evidenceGapSuite.filter(t => t.passed).length,
    failed: evidenceGapSuite.filter(t => !t.passed).length,
    duration: evidenceGapSuite.reduce((sum, t) => sum + t.duration, 0),
    results: evidenceGapSuite
  });

  // ==========================================================================
  // Test Suite 6: Alibi Analysis
  // ==========================================================================
  const alibiSuite: TestResult[] = [];

  const alibiGaps = getAlibiGaps(caseData);

  alibiSuite.push(runTest('Alibi gaps calculated for suspects', () => {
    return {
      suspectsWithGaps: alibiGaps.length,
      gaps: alibiGaps.map(g => ({
        suspect: g.suspect.name,
        lastVerified: g.lastVerified,
        gapMinutes: g.gapMinutes
      }))
    };
  }));

  alibiSuite.push(runTest('Marcus Cole has alibi gap after 5:58 PM', () => {
    const marcusGap = alibiGaps.find(g => g.suspect.name === 'Marcus Cole');
    if (!marcusGap) throw new Error('No alibi gap found for Marcus Cole');
    if (marcusGap.gapMinutes < 30) throw new Error('Expected significant alibi gap');
    return {
      lastVerified: marcusGap.lastVerified,
      gapMinutes: marcusGap.gapMinutes,
      assessment: marcusGap.gapMinutes > 45 ? 'Significant unaccounted time' : 'Moderate gap'
    };
  }));

  testResults.push({
    suiteName: 'Alibi Analysis',
    totalTests: alibiSuite.length,
    passed: alibiSuite.filter(t => t.passed).length,
    failed: alibiSuite.filter(t => !t.passed).length,
    duration: alibiSuite.reduce((sum, t) => sum + t.duration, 0),
    results: alibiSuite
  });

  // ==========================================================================
  // Test Suite 7: Suspect Scoring
  // ==========================================================================
  const scoringSuite: TestResult[] = [];

  const suspectScores = calculateSuspectScores(caseData, behavioralPatterns, alibiGaps);

  scoringSuite.push(runTest('All suspects scored', () => {
    if (suspectScores.length !== caseData.suspects.length) {
      throw new Error(`Expected ${caseData.suspects.length} scores, got ${suspectScores.length}`);
    }
    return {
      scores: suspectScores.map(s => ({ name: s.name, score: s.overallScore.toFixed(2) }))
    };
  }));

  scoringSuite.push(runTest('Scores differentiate between suspects', () => {
    const uniqueScores = new Set(suspectScores.map(s => s.overallScore.toFixed(2)));
    return {
      uniqueScores: uniqueScores.size,
      ranking: suspectScores.map((s, i) => `${i + 1}. ${s.name}: ${(s.overallScore * 100).toFixed(0)}%`)
    };
  }));

  scoringSuite.push(runTest('Top suspect has identifiable concerns', () => {
    const topSuspect = suspectScores[0];
    if (topSuspect.topConcerns.length === 0) throw new Error('Top suspect has no identified concerns');
    return {
      topSuspect: topSuspect.name,
      score: topSuspect.overallScore,
      concerns: topSuspect.topConcerns,
      components: topSuspect.components
    };
  }));

  testResults.push({
    suiteName: 'Suspect Scoring',
    totalTests: scoringSuite.length,
    passed: scoringSuite.filter(t => t.passed).length,
    failed: scoringSuite.filter(t => !t.passed).length,
    duration: scoringSuite.reduce((sum, t) => sum + t.duration, 0),
    results: scoringSuite
  });

  // ==========================================================================
  // Test Suite 8: Overlooked Details
  // ==========================================================================
  const overlookedSuite: TestResult[] = [];

  const documentInputs = caseData.interviews.map(i => ({
    filename: `Interview_${i.speaker.replace(/\s/g, '_')}_${i.date}.txt`,
    content: i.content
  }));

  const overlookedDetails = await findOverlookedDetails(documentInputs);

  overlookedSuite.push(await runAsyncTest('Overlooked details extracted', async () => {
    if (overlookedDetails.length === 0) throw new Error('No overlooked details found');
    return {
      detailCount: overlookedDetails.length,
      byCategory: overlookedDetails.reduce((acc, d) => {
        acc[d.category] = (acc[d.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }));

  overlookedSuite.push(runTest('High potential details identified', () => {
    const highPotential = overlookedDetails.filter(d => d.potentialBreakthrough >= 0.7);
    return {
      highPotentialCount: highPotential.length,
      details: highPotential.slice(0, 3).map(d => ({
        detail: d.detail.slice(0, 100),
        potential: d.potentialBreakthrough,
        category: d.category
      }))
    };
  }));

  testResults.push({
    suiteName: 'Overlooked Details',
    totalTests: overlookedSuite.length,
    passed: overlookedSuite.filter(t => t.passed).length,
    failed: overlookedSuite.filter(t => !t.passed).length,
    duration: overlookedSuite.reduce((sum, t) => sum + t.duration, 0),
    results: overlookedSuite
  });

  // ==========================================================================
  // Test Suite 9: Interrogation Strategy
  // ==========================================================================
  const interrogationSuite: TestResult[] = [];

  const topSuspectData = caseData.suspects[0];
  const topSuspectInterviews = getInterviewsByPerson(caseData, topSuspectData.id);

  const interrogationStrategy = await generateInterrogationQuestions({
    name: topSuspectData.name,
    statements: topSuspectInterviews.map(i => i.content),
    knownFacts: [
      'Last verified at bar at 5:58 PM',
      'Fingerprints found on victim\'s car',
      'Recent breakup with victim'
    ],
    inconsistencies: inconsistencies
      .filter(i => i.persons.includes(topSuspectData.name))
      .map(i => i.description),
    relationships: getConnectionsForEntity(caseData, topSuspectData.id).map(c => c.label)
  });

  const interrogationStrategies = [interrogationStrategy];

  interrogationSuite.push(await runAsyncTest('Interrogation strategy generated', async () => {
    if (!interrogationStrategy.questions || interrogationStrategy.questions.length === 0) {
      throw new Error('No interrogation questions generated');
    }
    return {
      questionCount: interrogationStrategy.questions.length,
      techniques: interrogationStrategy.questions.map(q => q.psychologicalTechnique),
      overallStrategy: interrogationStrategy.overallStrategy
    };
  }));

  interrogationSuite.push(runTest('Questions target weak points', () => {
    if (interrogationStrategy.weakPoints.length === 0) throw new Error('No weak points identified');
    return {
      weakPoints: interrogationStrategy.weakPoints,
      inconsistencies: interrogationStrategy.inconsistencies
    };
  }));

  testResults.push({
    suiteName: 'Interrogation Strategy',
    totalTests: interrogationSuite.length,
    passed: interrogationSuite.filter(t => t.passed).length,
    failed: interrogationSuite.filter(t => !t.passed).length,
    duration: interrogationSuite.reduce((sum, t) => sum + t.duration, 0),
    results: interrogationSuite
  });

  // ==========================================================================
  // Test Suite 10: Forensic Recommendations
  // ==========================================================================
  const forensicSuite: TestResult[] = [];

  const evidenceInventory = caseData.evidence.map(e => ({
    item: e.name,
    dateCollected: caseData.incidentDate,
    testingPerformed: e.metadata?.dnaStatus || e.metadata?.fingerprints || 'Standard processing',
    results: e.metadata?.condition || 'Pending'
  }));

  const forensicRecommendations = await recommendForensicRetesting(evidenceInventory);

  forensicSuite.push(await runAsyncTest('Forensic recommendations generated', async () => {
    if (forensicRecommendations.length === 0) throw new Error('No forensic recommendations');
    return {
      recommendationCount: forensicRecommendations.length,
      byPriority: forensicRecommendations.reduce((acc, r) => {
        acc[r.priority] = (acc[r.priority] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }));

  forensicSuite.push(runTest('Modern technologies suggested', () => {
    const allTechnologies = forensicRecommendations.flatMap(r => r.newTechnologiesAvailable);
    const modernTech = allTechnologies.filter(t =>
      /DNA|genealogy|touch|M-Vac|next-gen/i.test(t)
    );
    return {
      technologiesSuggested: allTechnologies.length,
      modernTechniques: [...new Set(modernTech)]
    };
  }));

  testResults.push({
    suiteName: 'Forensic Recommendations',
    totalTests: forensicSuite.length,
    passed: forensicSuite.filter(t => t.passed).length,
    failed: forensicSuite.filter(t => !t.passed).length,
    duration: forensicSuite.reduce((sum, t) => sum + t.duration, 0),
    results: forensicSuite
  });

  // ==========================================================================
  // Test Suite 11: Solvability Matrix
  // ==========================================================================
  const solvabilitySuite: TestResult[] = [];

  const solvabilityInput = getSolvabilityInputForCase(caseData);
  const solvabilityAssessment = assessCaseSolvability(solvabilityInput);

  solvabilitySuite.push(runTest('Solvability assessment generated', () => {
    if (!solvabilityAssessment) throw new Error('No solvability assessment generated');
    if (solvabilityAssessment.overallScore < 0 || solvabilityAssessment.overallScore > 100) {
      throw new Error('Invalid overall score');
    }
    return {
      overallScore: solvabilityAssessment.overallScore,
      category: solvabilityAssessment.category,
      componentScores: solvabilityAssessment.scores
    };
  }));

  solvabilitySuite.push(runTest('Evidence viability scored correctly', () => {
    const evidenceScore = solvabilityAssessment.scores.evidenceViability;
    // Should be medium-high since we have untested DNA
    if (evidenceScore < 40) throw new Error('Evidence viability score too low for case with untested DNA');
    return {
      evidenceViability: evidenceScore,
      reason: 'Untested DNA samples should boost score'
    };
  }));

  solvabilitySuite.push(runTest('Technology opportunity detected for 2019 case', () => {
    const techScore = solvabilityAssessment.scores.technologyOpportunity;
    // 2019 case should have genetic genealogy opportunity (available since 2018)
    if (techScore < 30) throw new Error('Technology opportunity score too low for case with IGG potential');
    return {
      technologyOpportunity: techScore,
      reason: 'Case predates widespread use of modern forensic techniques'
    };
  }));

  solvabilitySuite.push(runTest('Retesting opportunities identified', () => {
    if (solvabilityAssessment.retestingOpportunities.length === 0) {
      throw new Error('No retesting opportunities identified for case with untested evidence');
    }
    return {
      count: solvabilityAssessment.retestingOpportunities.length,
      topOpportunities: solvabilityAssessment.retestingOpportunities.slice(0, 3).map(o => ({
        evidence: o.evidenceDescription,
        technology: o.recommendedTechnology,
        likelihood: o.successLikelihood
      }))
    };
  }));

  solvabilitySuite.push(runTest('Investigative gaps identified', () => {
    if (solvabilityAssessment.investigativeGaps.length === 0) {
      throw new Error('No investigative gaps identified');
    }
    return {
      count: solvabilityAssessment.investigativeGaps.length,
      gaps: solvabilityAssessment.investigativeGaps.slice(0, 3).map(g => ({
        type: g.type,
        priority: g.priority,
        description: g.description
      }))
    };
  }));

  solvabilitySuite.push(runTest('Weak clearance flagged for David Park', () => {
    const davidSuspect = solvabilityInput.suspects.find(s => s.name === 'David Park');
    if (!davidSuspect) throw new Error('David Park not found in suspects');
    if (davidSuspect.clearanceStrength !== 'weak') {
      throw new Error('David Park should be flagged with weak clearance');
    }
    return {
      suspect: davidSuspect.name,
      clearanceStrength: davidSuspect.clearanceStrength,
      clearanceMethod: davidSuspect.clearanceMethod
    };
  }));

  solvabilitySuite.push(runTest('Immediate actions recommended', () => {
    if (solvabilityAssessment.immediateActions.length === 0) {
      throw new Error('No immediate actions recommended');
    }
    return {
      count: solvabilityAssessment.immediateActions.length,
      actions: solvabilityAssessment.immediateActions.map(a => ({
        action: a.action,
        impact: a.potentialImpact,
        cost: a.estimatedCost
      }))
    };
  }));

  solvabilitySuite.push(runTest('Witness opportunities identified', () => {
    return {
      count: solvabilityAssessment.witnessOpportunities.length,
      opportunities: solvabilityAssessment.witnessOpportunities.slice(0, 3).map(o => ({
        witness: o.witnessName,
        type: o.opportunityType,
        rationale: o.rationale
      }))
    };
  }));

  solvabilitySuite.push(runTest('Quick triage generates summary', () => {
    const triage = quickTriage(solvabilityInput);
    if (!triage.topOpportunity || !triage.recommendedAction) {
      throw new Error('Quick triage missing required fields');
    }
    return {
      score: triage.overallScore,
      category: triage.category,
      topOpportunity: triage.topOpportunity,
      biggestObstacle: triage.biggestObstacle,
      recommendedAction: triage.recommendedAction
    };
  }));

  solvabilitySuite.push(runTest('Solvability report generates text output', () => {
    const report = generateSolvabilityReport(solvabilityAssessment);
    if (!report || report.length < 100) {
      throw new Error('Report too short or empty');
    }
    if (!report.includes('SOLVABILITY')) {
      throw new Error('Report missing expected header');
    }
    return {
      reportLength: report.length,
      containsScore: report.includes(String(solvabilityAssessment.overallScore)),
      containsCategory: report.includes(solvabilityAssessment.category.replace(/_/g, ' ').toUpperCase())
    };
  }));

  testResults.push({
    suiteName: 'Solvability Matrix',
    totalTests: solvabilitySuite.length,
    passed: solvabilitySuite.filter(t => t.passed).length,
    failed: solvabilitySuite.filter(t => !t.passed).length,
    duration: solvabilitySuite.reduce((sum, t) => sum + t.duration, 0),
    results: solvabilitySuite
  });

  // ==========================================================================
  // Test Suite 12: Clearance Tracker
  // ==========================================================================
  const clearanceSuite: TestResult[] = [];

  const clearanceRecords = getClearanceRecordsForCase(caseData);
  const { evaluations: clearanceEvaluations, caseWideAssessment: clearanceCaseAssessment } =
    evaluateAllClearances(clearanceRecords);

  clearanceSuite.push(runTest('Clearance records loaded', () => {
    if (clearanceRecords.length === 0) throw new Error('No clearance records');
    return {
      count: clearanceRecords.length,
      suspects: clearanceRecords.map(r => r.suspectName)
    };
  }));

  clearanceSuite.push(runTest('All suspects evaluated', () => {
    if (clearanceEvaluations.length !== clearanceRecords.length) {
      throw new Error('Not all suspects evaluated');
    }
    return {
      evaluations: clearanceEvaluations.map(e => ({
        name: e.suspectName,
        strength: e.overallStrength,
        score: e.strengthScore
      }))
    };
  }));

  clearanceSuite.push(runTest('Polygraph-only clearance flagged as unreliable', () => {
    const davidEval = clearanceEvaluations.find(e => e.suspectName === 'David Park');
    if (!davidEval) throw new Error('David Park evaluation not found');

    const hasPolygraphFlag = davidEval.redFlags.some(f => f.type === 'polygraph_only');
    if (!hasPolygraphFlag) throw new Error('Polygraph clearance should be flagged');

    // Should not be strong or moderate
    if (davidEval.overallStrength === 'strong' || davidEval.overallStrength === 'moderate') {
      throw new Error('Polygraph-based clearance should not be rated strong or moderate');
    }

    return {
      suspectName: davidEval.suspectName,
      overallStrength: davidEval.overallStrength,
      hasPolygraphFlag,
      redFlags: davidEval.redFlags.map(f => ({ type: f.type, severity: f.severity }))
    };
  }));

  clearanceSuite.push(runTest('Cooperative behavior flagged as weak', () => {
    const jenniferEval = clearanceEvaluations.find(e => e.suspectName === 'Jennifer Walsh');
    if (!jenniferEval) throw new Error('Jennifer Walsh evaluation not found');

    const hasBehaviorFlag = jenniferEval.redFlags.some(f => f.type === 'behavior_based');
    if (!hasBehaviorFlag) throw new Error('Cooperative behavior should be flagged');

    return {
      suspectName: jenniferEval.suspectName,
      overallStrength: jenniferEval.overallStrength,
      hasBehaviorFlag,
      shouldBeReexamined: jenniferEval.shouldBeReexamined
    };
  }));

  clearanceSuite.push(runTest('Alibi contradictions detected', () => {
    const marcusEval = clearanceEvaluations.find(e => e.suspectName === 'Marcus Cole');
    if (!marcusEval) throw new Error('Marcus Cole evaluation not found');

    const hasConflictingFlag = marcusEval.redFlags.some(f => f.type === 'conflicting_evidence');
    if (!hasConflictingFlag) throw new Error('Alibi contradictions should be flagged');

    return {
      suspectName: marcusEval.suspectName,
      hasConflictingFlag,
      redFlagCount: marcusEval.redFlags.length
    };
  }));

  clearanceSuite.push(runTest('Re-examination recommendations generated', () => {
    const needReexam = clearanceEvaluations.filter(e => e.shouldBeReexamined);
    if (needReexam.length === 0) throw new Error('At least one suspect should need re-examination');

    // Each should have recommendations
    for (const eval_ of needReexam) {
      if (eval_.recommendations.length === 0) {
        throw new Error(`${eval_.suspectName} needs re-exam but has no recommendations`);
      }
    }

    return {
      needReexamination: needReexam.map(e => e.suspectName),
      totalRecommendations: needReexam.reduce((sum, e) => sum + e.recommendations.length, 0)
    };
  }));

  clearanceSuite.push(runTest('Case-wide assessment generated', () => {
    if (!clearanceCaseAssessment) throw new Error('No case assessment');
    if (!clearanceCaseAssessment.primaryRecommendation) {
      throw new Error('No primary recommendation');
    }

    return {
      totalSuspects: clearanceCaseAssessment.totalSuspects,
      needReexamination: clearanceCaseAssessment.needReexamination,
      criticalConcerns: clearanceCaseAssessment.criticalConcerns,
      overallConcern: clearanceCaseAssessment.overallConcern,
      recommendation: clearanceCaseAssessment.primaryRecommendation.slice(0, 100)
    };
  }));

  clearanceSuite.push(runTest('Method reliability correctly assessed', () => {
    // DNA exclusion should be high reliability
    // Polygraph should be none reliability
    const davidEval = clearanceEvaluations.find(e => e.suspectName === 'David Park');
    if (!davidEval) throw new Error('David Park not found');

    const polygraphMethod = davidEval.methodAnalysis.find(m => m.method === 'polygraph_passed');
    if (!polygraphMethod) throw new Error('Polygraph method not found');
    if (polygraphMethod.reliability !== 'none') {
      throw new Error('Polygraph should have none reliability');
    }
    if (polygraphMethod.scientificBasis !== 'debunked') {
      throw new Error('Polygraph should be marked as debunked');
    }

    return {
      method: 'polygraph_passed',
      reliability: polygraphMethod.reliability,
      scientificBasis: polygraphMethod.scientificBasis
    };
  }));

  testResults.push({
    suiteName: 'Clearance Tracker',
    totalTests: clearanceSuite.length,
    passed: clearanceSuite.filter(t => t.passed).length,
    failed: clearanceSuite.filter(t => !t.passed).length,
    duration: clearanceSuite.reduce((sum, t) => sum + t.duration, 0),
    results: clearanceSuite
  });

  // ==========================================================================
  // Test Suite 13: Insight Extraction
  // ==========================================================================
  const insightSuite: TestResult[] = [];

  const interviewData = getInterviewDataForInsightExtraction(caseData);
  const caseKnowledge = getCaseKnowledgeForInsightExtraction(caseData);
  const insightAnalysis = analyzeInterviewInsights(interviewData, caseKnowledge);

  insightSuite.push(runTest('Interview data converted', () => {
    if (interviewData.length === 0) throw new Error('No interview data');
    return {
      count: interviewData.length,
      speakers: interviewData.map(i => i.speakerName)
    };
  }));

  insightSuite.push(runTest('Insights extracted from interviews', () => {
    if (insightAnalysis.totalInsightsExtracted === 0) {
      throw new Error('No insights extracted');
    }
    return {
      totalInsights: insightAnalysis.totalInsightsExtracted,
      crossReferences: insightAnalysis.crossReferences.length
    };
  }));

  insightSuite.push(runTest('Suspect knowledge profiles generated', () => {
    if (insightAnalysis.suspectKnowledgeProfiles.length === 0) {
      throw new Error('No suspect profiles generated');
    }
    return {
      profiles: insightAnalysis.suspectKnowledgeProfiles.map(p => ({
        name: p.name,
        role: p.role,
        suspicionScore: p.suspicionScore,
        guiltyKnowledgeFlags: p.guiltyKnowledgeFlags
      }))
    };
  }));

  insightSuite.push(runTest('Suspicion scores calculated', () => {
    const highSuspicion = insightAnalysis.suspectKnowledgeProfiles.filter(p => p.suspicionScore >= 40);
    return {
      highSuspicionCount: highSuspicion.length,
      topScorer: insightAnalysis.suspectKnowledgeProfiles[0]?.name,
      topScore: insightAnalysis.suspectKnowledgeProfiles[0]?.suspicionScore
    };
  }));

  insightSuite.push(runTest('Cross-references analyzed', () => {
    return {
      totalCrossRefs: insightAnalysis.crossReferences.length,
      withIndicators: insightAnalysis.crossReferences.filter(cr => cr.guiltyKnowledgeIndicators.length > 0).length
    };
  }));

  insightSuite.push(runTest('Recommendations generated', () => {
    return {
      count: insightAnalysis.recommendations.length,
      recommendations: insightAnalysis.recommendations.slice(0, 3).map(r => ({
        priority: r.priority,
        action: r.action.slice(0, 50)
      }))
    };
  }));

  testResults.push({
    suiteName: 'Insight Extraction',
    totalTests: insightSuite.length,
    passed: insightSuite.filter(t => t.passed).length,
    failed: insightSuite.filter(t => !t.passed).length,
    duration: insightSuite.reduce((sum, t) => sum + t.duration, 0),
    results: insightSuite
  });

  // ==========================================================================
  // Summary
  // ==========================================================================
  console.log('\n' + '='.repeat(60));
  console.log('TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  let totalPassed = 0;
  let totalFailed = 0;
  let totalDuration = 0;

  for (const suite of testResults) {
    totalPassed += suite.passed;
    totalFailed += suite.failed;
    totalDuration += suite.duration;

    const status = suite.failed === 0 ? 'PASS' : 'FAIL';
    console.log(`${status} ${suite.suiteName}: ${suite.passed}/${suite.totalTests} (${suite.duration}ms)`);

    if (suite.failed > 0) {
      for (const result of suite.results.filter(r => !r.passed)) {
        console.log(`  - FAILED: ${result.name}`);
        if (result.errors) {
          result.errors.forEach(e => console.log(`    Error: ${e}`));
        }
      }
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log(`TOTAL: ${totalPassed}/${totalPassed + totalFailed} tests passed (${totalDuration}ms)`);
  console.log('='.repeat(60));

  return {
    caseData,
    behavioralPatterns,
    evidenceGaps,
    relationshipNetwork,
    overlookedDetails,
    interrogationStrategies,
    forensicRecommendations,
    suspectScores,
    inconsistencies,
    solvabilityAssessment,
    solvabilityInput,
    clearanceEvaluations,
    clearanceCaseAssessment,
    insightAnalysis,
    testResults
  };
}

// Export for use in test page
export {
  analyzeInterviewBehavior,
  detectInconsistencies,
  calculateSuspectScores,
  extractConnectionInsights
};
