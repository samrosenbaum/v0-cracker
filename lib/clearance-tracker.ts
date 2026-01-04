/**
 * Clearance Tracker - "Cleared vs Actually Cleared"
 *
 * Evaluates how suspects were cleared in the original investigation and
 * flags weak clearances that should be re-examined. Based on research
 * showing that many cold cases are solved when "cleared" suspects are
 * re-investigated.
 *
 * Key insight: The 1979 Riverside case suspect passed a polygraph and
 * was cleared - but was later proven guilty by DNA. Polygraph-only
 * clearances are a major red flag.
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export type ClearanceMethod =
  | 'polygraph_passed'
  | 'alibi_friend_family'
  | 'alibi_coworker'
  | 'alibi_stranger'
  | 'alibi_documented'       // Receipt, camera footage, etc.
  | 'alibi_multiple_sources' // Multiple independent confirmations
  | 'dna_exclusion'
  | 'physical_impossibility' // In another location with proof
  | 'video_evidence'
  | 'cooperative_behavior'   // "Seemed cooperative" - very weak
  | 'passed_interview'       // Didn't break in interview
  | 'no_apparent_motive'
  | 'no_opportunity'
  | 'voluntary_dna_provided'
  | 'other';

export interface ClearanceRecord {
  id: string;
  suspectName: string;
  suspectId: string;
  clearanceDate: Date;
  clearedBy: string; // Investigator name
  methods: ClearanceMethod[];
  alibiDetails?: AlibiDetails;
  polygraphDetails?: PolygraphDetails;
  dnaDetails?: DNADetails;
  interviewDetails?: InterviewDetails;
  notes?: string;
  documentationAvailable: boolean;
  wasEverReopened: boolean;
  reopenedReason?: string;
}

export interface AlibiDetails {
  alibiClaim: string;
  alibiTimeframe: string;
  witnesses: AlibiWitness[];
  documentaryEvidence: string[];
  investigatorVerification: 'full' | 'partial' | 'none' | 'unknown';
  contradictions: string[];
}

export interface AlibiWitness {
  name: string;
  relationship: 'stranger' | 'acquaintance' | 'friend' | 'family' | 'coworker' | 'romantic_partner' | 'business_partner';
  statement: string;
  credibilityScore: number; // 0-1
  wasInterviewed: boolean;
  interviewDate?: Date;
  changedStory: boolean;
  notes?: string;
}

export interface PolygraphDetails {
  examiner: string;
  date: Date;
  result: 'passed' | 'failed' | 'inconclusive';
  questionsFocused: string[];
  notes?: string;
}

export interface DNADetails {
  sampleType: string;
  testDate: Date;
  result: 'match' | 'exclusion' | 'inconclusive' | 'no_profile';
  profileQuality: 'full' | 'partial' | 'degraded';
  wasVoluntary: boolean;
  notes?: string;
}

export interface InterviewDetails {
  interviewCount: number;
  totalDuration: string;
  techniques: string[];
  demeanor: string;
  cooperationLevel: 'full' | 'partial' | 'resistant' | 'with_attorney';
  storyConsistency: 'consistent' | 'minor_changes' | 'significant_changes' | 'contradictory';
  suspiciousIndicators: string[];
}

// ============================================================================
// Clearance Strength Evaluation
// ============================================================================

export interface ClearanceEvaluation {
  suspectId: string;
  suspectName: string;
  overallStrength: 'strong' | 'moderate' | 'weak' | 'very_weak' | 'unreliable';
  strengthScore: number; // 0-100
  shouldBeReexamined: boolean;
  urgency: 'critical' | 'high' | 'medium' | 'low';

  methodAnalysis: MethodAnalysis[];
  redFlags: RedFlag[];
  recommendations: ClearanceRecommendation[];

  summaryStatement: string;
}

export interface MethodAnalysis {
  method: ClearanceMethod;
  reliability: 'high' | 'medium' | 'low' | 'none';
  scientificBasis: 'strong' | 'weak' | 'debunked' | 'none';
  description: string;
  concern?: string;
}

export interface RedFlag {
  type: 'polygraph_only' | 'biased_witness' | 'unverified_alibi' | 'behavior_based' | 'weak_documentation' | 'conflicting_evidence' | 'tunnel_vision' | 'premature_clearance';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  actionNeeded: string;
}

export interface ClearanceRecommendation {
  priority: number;
  action: string;
  rationale: string;
  expectedOutcome: string;
}

// ============================================================================
// Method Reliability Database
// ============================================================================

const METHOD_RELIABILITY: Record<ClearanceMethod, {
  reliability: 'high' | 'medium' | 'low' | 'none';
  scientificBasis: 'strong' | 'weak' | 'debunked' | 'none';
  baseScore: number; // 0-100 contribution to clearance strength
  description: string;
  warning?: string;
}> = {
  dna_exclusion: {
    reliability: 'high',
    scientificBasis: 'strong',
    baseScore: 95,
    description: 'DNA from crime scene does not match suspect',
  },
  physical_impossibility: {
    reliability: 'high',
    scientificBasis: 'strong',
    baseScore: 90,
    description: 'Physical impossibility proven (e.g., documented in another country)',
  },
  video_evidence: {
    reliability: 'high',
    scientificBasis: 'strong',
    baseScore: 85,
    description: 'Clear video evidence showing suspect elsewhere at time of crime',
  },
  alibi_multiple_sources: {
    reliability: 'high',
    scientificBasis: 'strong',
    baseScore: 80,
    description: 'Multiple independent witnesses confirm alibi',
  },
  alibi_documented: {
    reliability: 'high',
    scientificBasis: 'strong',
    baseScore: 75,
    description: 'Documentary evidence (receipts, timestamps, etc.) confirms alibi',
  },
  alibi_stranger: {
    reliability: 'medium',
    scientificBasis: 'weak',
    baseScore: 55,
    description: 'Alibi confirmed by stranger with no connection to suspect',
  },
  voluntary_dna_provided: {
    reliability: 'medium',
    scientificBasis: 'weak',
    baseScore: 40,
    description: 'Suspect voluntarily provided DNA',
    warning: 'Willingness to provide DNA is not evidence of innocence if DNA was never found at scene',
  },
  alibi_coworker: {
    reliability: 'low',
    scientificBasis: 'weak',
    baseScore: 35,
    description: 'Alibi confirmed by coworker',
    warning: 'Coworkers may have social pressure to support colleague',
  },
  alibi_friend_family: {
    reliability: 'low',
    scientificBasis: 'weak',
    baseScore: 25,
    description: 'Alibi confirmed only by friends or family',
    warning: 'Friends and family have strong motive to protect suspect',
  },
  no_opportunity: {
    reliability: 'low',
    scientificBasis: 'weak',
    baseScore: 30,
    description: 'No apparent opportunity to commit crime',
    warning: 'Opportunity assessment may be incomplete',
  },
  no_apparent_motive: {
    reliability: 'low',
    scientificBasis: 'none',
    baseScore: 20,
    description: 'No apparent motive identified',
    warning: 'Hidden motives are common; absence of known motive is not evidence of innocence',
  },
  passed_interview: {
    reliability: 'low',
    scientificBasis: 'none',
    baseScore: 15,
    description: 'Did not confess or break during interview',
    warning: 'Interview performance is not reliable indicator of guilt or innocence',
  },
  polygraph_passed: {
    reliability: 'none',
    scientificBasis: 'debunked',
    baseScore: 5,
    description: 'Passed polygraph examination',
    warning: 'CRITICAL: Polygraph is scientifically unreliable. Many convicted criminals passed polygraphs.',
  },
  cooperative_behavior: {
    reliability: 'none',
    scientificBasis: 'none',
    baseScore: 5,
    description: 'Appeared cooperative during investigation',
    warning: 'CRITICAL: Cooperative behavior is a common manipulation tactic. Not evidence of innocence.',
  },
  other: {
    reliability: 'low',
    scientificBasis: 'none',
    baseScore: 10,
    description: 'Other clearance method',
  },
};

// Type alias for method reliability info
export type MethodInfo = (typeof METHOD_RELIABILITY)[ClearanceMethod];

// ============================================================================
// Evaluation Functions
// ============================================================================

/**
 * Evaluate the strength of a suspect's clearance
 */
export function evaluateClearance(record: ClearanceRecord): ClearanceEvaluation {
  const methodAnalysis: MethodAnalysis[] = [];
  const redFlags: RedFlag[] = [];
  const recommendations: ClearanceRecommendation[] = [];
  let totalScore = 0;
  let maxPossibleScore = 0;

  // Analyze each clearance method
  for (const method of record.methods) {
    const methodInfo = METHOD_RELIABILITY[method];

    methodAnalysis.push({
      method,
      reliability: methodInfo.reliability,
      scientificBasis: methodInfo.scientificBasis,
      description: methodInfo.description,
      concern: methodInfo.warning,
    });

    // Accumulate scores
    totalScore += methodInfo.baseScore;
    maxPossibleScore += 100;

    // Flag unreliable methods
    if (methodInfo.reliability === 'none') {
      if (method === 'polygraph_passed') {
        redFlags.push({
          type: 'polygraph_only',
          severity: 'critical',
          description: 'Suspect was cleared based on polygraph, which is scientifically unreliable. The 1979 Riverside suspect passed polygraph but was later proven guilty.',
          actionNeeded: 'Disregard polygraph results and re-evaluate all evidence without this bias',
        });
      } else if (method === 'cooperative_behavior') {
        redFlags.push({
          type: 'behavior_based',
          severity: 'high',
          description: 'Clearance relied on subjective assessment of "cooperative" behavior',
          actionNeeded: 'Do not use demeanor or behavior as evidence of innocence',
        });
      }
    }
  }

  // Check for alibi weaknesses
  if (record.alibiDetails) {
    const alibi = record.alibiDetails;

    // Check for biased witnesses
    const biasedWitnesses = alibi.witnesses.filter(w =>
      ['family', 'romantic_partner', 'friend'].includes(w.relationship)
    );

    if (biasedWitnesses.length > 0 && biasedWitnesses.length === alibi.witnesses.length) {
      redFlags.push({
        type: 'biased_witness',
        severity: 'high',
        description: `Alibi supported only by ${biasedWitnesses.map(w => w.relationship).join(', ')} - all have potential bias`,
        actionNeeded: 'Seek independent corroboration of alibi',
      });
      totalScore -= 20;
    }

    // Check for unverified alibi
    if (alibi.investigatorVerification === 'none' || alibi.investigatorVerification === 'unknown') {
      redFlags.push({
        type: 'unverified_alibi',
        severity: 'high',
        description: 'Alibi was not independently verified by investigators',
        actionNeeded: 'Conduct thorough verification of alibi claims',
      });
      totalScore -= 15;
    }

    // Check for contradictions
    if (alibi.contradictions && alibi.contradictions.length > 0) {
      redFlags.push({
        type: 'conflicting_evidence',
        severity: 'critical',
        description: `Alibi has ${alibi.contradictions.length} contradiction(s): ${alibi.contradictions.join('; ')}`,
        actionNeeded: 'Investigate contradictions and interview witnesses again',
      });
      totalScore -= 30;
    }

    // Check for documentary evidence
    if (alibi.documentaryEvidence.length === 0) {
      redFlags.push({
        type: 'weak_documentation',
        severity: 'medium',
        description: 'No documentary evidence supporting alibi (receipts, camera footage, etc.)',
        actionNeeded: 'Search for historical records that could verify or contradict alibi',
      });
      totalScore -= 10;
    }
  }

  // Check for polygraph-only clearance
  const hasPolygraph = record.methods.includes('polygraph_passed');
  const hasStrongMethod = record.methods.some(m =>
    ['dna_exclusion', 'physical_impossibility', 'video_evidence', 'alibi_documented', 'alibi_multiple_sources'].includes(m)
  );

  if (hasPolygraph && !hasStrongMethod) {
    redFlags.push({
      type: 'polygraph_only',
      severity: 'critical',
      description: 'Primary clearance method is polygraph with no reliable corroborating evidence',
      actionNeeded: 'Treat suspect as NOT cleared - investigate as if polygraph never occurred',
    });
  }

  // Check for premature clearance
  if (record.methods.length === 1 && !hasStrongMethod) {
    redFlags.push({
      type: 'premature_clearance',
      severity: 'high',
      description: 'Suspect cleared based on single weak factor',
      actionNeeded: 'Conduct comprehensive re-investigation',
    });
  }

  // Check documentation
  if (!record.documentationAvailable) {
    redFlags.push({
      type: 'weak_documentation',
      severity: 'medium',
      description: 'Original clearance documentation is not available for review',
      actionNeeded: 'Attempt to reconstruct investigation through other records',
    });
  }

  // Calculate final score
  const strengthScore = maxPossibleScore > 0
    ? Math.max(0, Math.min(100, Math.round((totalScore / maxPossibleScore) * 100)))
    : 0;

  // Determine overall strength
  let overallStrength: ClearanceEvaluation['overallStrength'];
  if (strengthScore >= 80) overallStrength = 'strong';
  else if (strengthScore >= 60) overallStrength = 'moderate';
  else if (strengthScore >= 40) overallStrength = 'weak';
  else if (strengthScore >= 20) overallStrength = 'very_weak';
  else overallStrength = 'unreliable';

  // Adjust for critical red flags
  if (redFlags.some(f => f.severity === 'critical')) {
    if (overallStrength === 'strong') overallStrength = 'moderate';
    else if (overallStrength === 'moderate') overallStrength = 'weak';
    else if (overallStrength === 'weak') overallStrength = 'very_weak';
    else overallStrength = 'unreliable';
  }

  // Determine if should be re-examined
  const shouldBeReexamined = overallStrength === 'weak' ||
    overallStrength === 'very_weak' ||
    overallStrength === 'unreliable' ||
    redFlags.some(f => f.severity === 'critical');

  // Determine urgency
  let urgency: ClearanceEvaluation['urgency'];
  if (redFlags.some(f => f.severity === 'critical')) urgency = 'critical';
  else if (overallStrength === 'unreliable' || overallStrength === 'very_weak') urgency = 'high';
  else if (overallStrength === 'weak') urgency = 'medium';
  else urgency = 'low';

  // Generate recommendations
  let priority = 1;

  if (hasPolygraph && !hasStrongMethod) {
    recommendations.push({
      priority: priority++,
      action: 'Remove polygraph from consideration and re-evaluate case',
      rationale: 'Polygraph has no scientific validity and has cleared guilty suspects in documented cases',
      expectedOutcome: 'Fresh perspective without polygraph bias',
    });
  }

  if (redFlags.some(f => f.type === 'biased_witness')) {
    recommendations.push({
      priority: priority++,
      action: 'Re-interview alibi witnesses separately, looking for inconsistencies',
      rationale: 'Biased witnesses may have false or rehearsed statements',
      expectedOutcome: 'Potential discovery of alibi holes or contradictions',
    });
  }

  if (!record.methods.includes('dna_exclusion')) {
    recommendations.push({
      priority: priority++,
      action: 'Request DNA sample from suspect for comparison',
      rationale: 'DNA is the most reliable clearance method',
      expectedOutcome: 'Definitive inclusion or exclusion',
    });
  }

  if (record.alibiDetails && record.alibiDetails.documentaryEvidence.length === 0) {
    recommendations.push({
      priority: priority++,
      action: 'Search for historical records: credit card statements, cell tower data, camera footage',
      rationale: 'Documentary evidence can verify or contradict alibi claims',
      expectedOutcome: 'Independent verification of suspect location during crime',
    });
  }

  // Generate summary statement
  let summaryStatement = '';
  if (overallStrength === 'strong') {
    summaryStatement = `${record.suspectName}'s clearance is supported by strong evidence (${record.methods.filter(m => METHOD_RELIABILITY[m].reliability === 'high').join(', ')}). Re-investigation is low priority unless new evidence emerges.`;
  } else if (overallStrength === 'moderate') {
    summaryStatement = `${record.suspectName}'s clearance has moderate support but ${redFlags.length} concern(s) warrant review. Recommend verifying alibi with additional evidence.`;
  } else if (overallStrength === 'weak') {
    summaryStatement = `${record.suspectName}'s clearance relies on weak methods. ${redFlags.length} red flag(s) identified. Should be re-examined.`;
  } else if (overallStrength === 'very_weak') {
    summaryStatement = `${record.suspectName}'s clearance is very weak with ${redFlags.length} significant concern(s). Treat as NOT CLEARED and investigate.`;
  } else {
    summaryStatement = `${record.suspectName}'s clearance is UNRELIABLE. Based primarily on ${record.methods.join(', ')} which have no scientific validity. This suspect should be actively investigated.`;
  }

  return {
    suspectId: record.suspectId,
    suspectName: record.suspectName,
    overallStrength,
    strengthScore,
    shouldBeReexamined,
    urgency,
    methodAnalysis,
    redFlags,
    recommendations,
    summaryStatement,
  };
}

/**
 * Evaluate all suspects in a case
 */
export function evaluateAllClearances(records: ClearanceRecord[]): {
  evaluations: ClearanceEvaluation[];
  caseWideAssessment: CaseWideAssessment;
} {
  const evaluations = records.map(r => evaluateClearance(r));

  const criticalCount = evaluations.filter(e => e.urgency === 'critical').length;
  const highCount = evaluations.filter(e => e.urgency === 'high').length;
  const reexamineCount = evaluations.filter(e => e.shouldBeReexamined).length;

  let overallConcern: 'high' | 'medium' | 'low';
  if (criticalCount > 0) overallConcern = 'high';
  else if (highCount > 0 || reexamineCount >= records.length * 0.5) overallConcern = 'medium';
  else overallConcern = 'low';

  return {
    evaluations: evaluations.sort((a, b) => b.strengthScore - a.strengthScore * -1), // Sort worst first
    caseWideAssessment: {
      totalSuspects: records.length,
      needReexamination: reexamineCount,
      criticalConcerns: criticalCount,
      highConcerns: highCount,
      overallConcern,
      primaryRecommendation: getPrimaryRecommendation(evaluations),
    },
  };
}

export interface CaseWideAssessment {
  totalSuspects: number;
  needReexamination: number;
  criticalConcerns: number;
  highConcerns: number;
  overallConcern: 'high' | 'medium' | 'low';
  primaryRecommendation: string;
}

function getPrimaryRecommendation(evaluations: ClearanceEvaluation[]): string {
  const critical = evaluations.filter(e => e.urgency === 'critical');
  const polygraphOnly = evaluations.filter(e =>
    e.redFlags.some(f => f.type === 'polygraph_only')
  );

  if (polygraphOnly.length > 0) {
    return `${polygraphOnly.length} suspect(s) cleared by polygraph only - disregard these clearances and investigate as active suspects.`;
  }

  if (critical.length > 0) {
    return `${critical.length} suspect(s) have critical clearance concerns requiring immediate attention.`;
  }

  const reexamine = evaluations.filter(e => e.shouldBeReexamined);
  if (reexamine.length > 0) {
    return `${reexamine.length} suspect(s) should be re-examined due to weak clearance methods.`;
  }

  return 'All clearances appear reliable, but periodic review is recommended as new technologies become available.';
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a clearance record from case data
 */
export function createClearanceRecord(
  suspectId: string,
  suspectName: string,
  data: {
    clearanceDate: Date;
    clearedBy: string;
    methods: ClearanceMethod[];
    alibiDetails?: AlibiDetails;
    polygraphDetails?: PolygraphDetails;
    dnaDetails?: DNADetails;
    interviewDetails?: InterviewDetails;
    notes?: string;
    documentationAvailable?: boolean;
  }
): ClearanceRecord {
  return {
    id: `clearance-${suspectId}`,
    suspectId,
    suspectName,
    clearanceDate: data.clearanceDate,
    clearedBy: data.clearedBy,
    methods: data.methods,
    alibiDetails: data.alibiDetails,
    polygraphDetails: data.polygraphDetails,
    dnaDetails: data.dnaDetails,
    interviewDetails: data.interviewDetails,
    notes: data.notes,
    documentationAvailable: data.documentationAvailable ?? true,
    wasEverReopened: false,
  };
}

/**
 * Get a simple strength label for display
 */
export function getStrengthLabel(strength: ClearanceEvaluation['overallStrength']): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (strength) {
    case 'strong':
      return { label: 'Strong', color: 'text-green-600', bgColor: 'bg-green-100' };
    case 'moderate':
      return { label: 'Moderate', color: 'text-blue-600', bgColor: 'bg-blue-100' };
    case 'weak':
      return { label: 'Weak', color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
    case 'very_weak':
      return { label: 'Very Weak', color: 'text-orange-600', bgColor: 'bg-orange-100' };
    case 'unreliable':
      return { label: 'UNRELIABLE', color: 'text-red-600', bgColor: 'bg-red-100' };
  }
}

/**
 * Get method reliability info for display
 */
export function getMethodInfo(method: ClearanceMethod): MethodInfo {
  return METHOD_RELIABILITY[method];
}

/**
 * Get all available clearance methods
 */
export function getAllClearanceMethods(): { method: ClearanceMethod; info: MethodInfo }[] {
  return Object.entries(METHOD_RELIABILITY).map(([method, info]) => ({
    method: method as ClearanceMethod,
    info,
  })).sort((a, b) => b.info.baseScore - a.info.baseScore);
}
