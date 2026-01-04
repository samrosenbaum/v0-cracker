/**
 * Inconsistency Detection Engine
 *
 * Compares claims across statements to find:
 * - Time contradictions (3pm vs 4pm)
 * - Location contradictions (was at A, also at B at same time)
 * - Self-contradictions (changed story between interviews)
 * - Cross-witness contradictions
 * - Detail drift over time
 * - Omissions (things not mentioned in later statements)
 * - Additions (new details added later)
 */

import { supabaseServer } from './supabase-server';
import { StatementClaim, getStatementClaims } from './statement-parser';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export type InconsistencyType =
  | 'time_contradiction'
  | 'location_contradiction'
  | 'action_contradiction'
  | 'witness_contradiction'
  | 'self_contradiction'
  | 'alibi_contradiction'
  | 'detail_change'
  | 'omission'
  | 'addition'
  | 'time_drift'
  | 'story_evolution'
  | 'other';

export type Severity = 'minor' | 'moderate' | 'significant' | 'critical';
export type ReviewStatus = 'pending' | 'reviewed' | 'resolved' | 'flagged' | 'dismissed';

export interface DetectedInconsistency {
  id?: string;
  caseId: string;
  claim1Id: string;
  claim2Id: string;
  claim1: StatementClaim;
  claim2: StatementClaim;
  inconsistencyType: InconsistencyType;
  severity: Severity;
  description: string;
  analysis: string;
  investigativeSignificance: string;
  suggestedAction: string;
  timeBetweenStatements?: number; // days
  involvedEntityIds: string[];
  primarySpeakerId?: string;
  timePeriodStart?: Date;
  timePeriodEnd?: Date;
  detectionMethod: 'automated' | 'ai_assisted' | 'manual';
  detectionConfidence: number;
  reviewStatus: ReviewStatus;
}

export interface InconsistencyDetectionConfig {
  timeToleranceMinutes: number;     // Allow variance (default: 30)
  locationFuzzyMatch: boolean;      // Match similar locations
  detectOmissions: boolean;         // Flag things not mentioned later
  detectAdditions: boolean;         // Flag new details added later
  minConfidenceThreshold: number;   // Only compare high-confidence claims
  useAIAnalysis: boolean;           // Use AI for deep analysis
}

export interface StatementComparisonResult {
  statement1Id: string;
  statement2Id: string;
  speakerEntityId?: string;
  speakerName: string;
  totalClaimsCompared: number;
  matchingClaims: number;
  contradictingClaims: number;
  newClaims: number;
  omittedClaims: number;
  modifiedClaims: number;
  consistencyScore: number;
  credibilityImpact: 'positive' | 'negative' | 'neutral';
  summary: string;
  keyDifferences: string[];
  inconsistencies: DetectedInconsistency[];
}

export interface ClaimEvolution {
  claimTopic: string;
  entityId: string;
  entityName: string;
  versions: ClaimVersion[];
  hasContradictions: boolean;
  driftScore: number; // How much the claim has changed over time
}

export interface ClaimVersion {
  statementId: string;
  statementDate: Date;
  claimId: string;
  claimText: string;
  originalText: string;
  timeValue?: Date;
  locationValue?: string;
}

const DEFAULT_CONFIG: InconsistencyDetectionConfig = {
  timeToleranceMinutes: 30,
  locationFuzzyMatch: true,
  detectOmissions: true,
  detectAdditions: true,
  minConfidenceThreshold: 0.5,
  useAIAnalysis: true,
};

/**
 * Detect all inconsistencies in a case
 */
export async function detectInconsistencies(
  caseId: string,
  config: Partial<InconsistencyDetectionConfig> = {}
): Promise<DetectedInconsistency[]> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  console.log(`[Inconsistency Detector] Starting detection for case ${caseId}`);

  const inconsistencies: DetectedInconsistency[] = [];

  // Get all claims for the case
  const { data: allClaims, error: claimsError } = await supabaseServer
    .from('statement_claims')
    .select(`
      *,
      statements!inner(speaker_entity_id, speaker_name, statement_date, version_number)
    `)
    .eq('case_id', caseId)
    .gte('extraction_confidence', fullConfig.minConfidenceThreshold)
    .order('claimed_datetime', { ascending: true });

  if (claimsError || !allClaims) {
    console.error('[Inconsistency Detector] Failed to fetch claims:', claimsError);
    return [];
  }

  console.log(`[Inconsistency Detector] Analyzing ${allClaims.length} claims`);

  // Group claims by speaker
  const claimsBySpeaker = new Map<string, typeof allClaims>();
  for (const claim of allClaims) {
    const speakerId = claim.statements?.speaker_entity_id || claim.statements?.speaker_name;
    if (!claimsBySpeaker.has(speakerId)) {
      claimsBySpeaker.set(speakerId, []);
    }
    claimsBySpeaker.get(speakerId)!.push(claim);
  }

  // 1. Detect self-contradictions (same person, different statements)
  for (const [speakerId, speakerClaims] of claimsBySpeaker) {
    const selfContradictions = await detectSelfContradictions(
      caseId,
      speakerId,
      speakerClaims,
      fullConfig
    );
    inconsistencies.push(...selfContradictions);
  }

  // 2. Detect cross-witness contradictions
  const crossContradictions = await detectCrossWitnessContradictions(
    caseId,
    allClaims,
    fullConfig
  );
  inconsistencies.push(...crossContradictions);

  // 3. Detect alibi contradictions
  const alibiContradictions = await detectAlibiContradictions(
    caseId,
    allClaims,
    fullConfig
  );
  inconsistencies.push(...alibiContradictions);

  // Save detected inconsistencies to database
  for (const inconsistency of inconsistencies) {
    await saveInconsistency(inconsistency);
  }

  console.log(`[Inconsistency Detector] Found ${inconsistencies.length} inconsistencies`);

  return inconsistencies;
}

/**
 * Detect self-contradictions (same person contradicts themselves)
 */
async function detectSelfContradictions(
  caseId: string,
  speakerId: string,
  claims: any[],
  config: InconsistencyDetectionConfig
): Promise<DetectedInconsistency[]> {
  const inconsistencies: DetectedInconsistency[] = [];

  // Group claims by statement
  const claimsByStatement = new Map<string, any[]>();
  for (const claim of claims) {
    const statementId = claim.statement_id;
    if (!claimsByStatement.has(statementId)) {
      claimsByStatement.set(statementId, []);
    }
    claimsByStatement.get(statementId)!.push(claim);
  }

  const statementIds = Array.from(claimsByStatement.keys());

  // Compare each pair of statements from the same person
  for (let i = 0; i < statementIds.length; i++) {
    for (let j = i + 1; j < statementIds.length; j++) {
      const statement1Claims = claimsByStatement.get(statementIds[i])!;
      const statement2Claims = claimsByStatement.get(statementIds[j])!;

      // Compare location claims at same times
      for (const claim1 of statement1Claims) {
        for (const claim2 of statement2Claims) {
          // Check for time contradictions
          if (
            claim1.claim_type === 'location_at_time' &&
            claim2.claim_type === 'location_at_time' &&
            claim1.claimed_datetime &&
            claim2.claimed_datetime
          ) {
            const timeDiff = Math.abs(
              new Date(claim1.claimed_datetime).getTime() -
              new Date(claim2.claimed_datetime).getTime()
            ) / 60000; // minutes

            if (timeDiff <= config.timeToleranceMinutes) {
              // Same time, check for different locations
              if (
                claim1.claimed_location &&
                claim2.claimed_location &&
                !locationsMatch(claim1.claimed_location, claim2.claimed_location, config.locationFuzzyMatch)
              ) {
                const inconsistency = await analyzeInconsistency(
                  caseId,
                  claim1,
                  claim2,
                  'self_contradiction',
                  config
                );
                if (inconsistency) {
                  inconsistencies.push(inconsistency);
                }
              }

              // Check for different times for same activity
              if (
                claim1.predicate === claim2.predicate &&
                claim1.claimed_location === claim2.claimed_location
              ) {
                const hourDiff = Math.abs(
                  new Date(claim1.claimed_datetime).getTime() -
                  new Date(claim2.claimed_datetime).getTime()
                ) / 3600000; // hours

                if (hourDiff > 1) {
                  const inconsistency = await analyzeInconsistency(
                    caseId,
                    claim1,
                    claim2,
                    'time_contradiction',
                    config
                  );
                  if (inconsistency) {
                    inconsistencies.push(inconsistency);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return inconsistencies;
}

/**
 * Detect cross-witness contradictions
 */
async function detectCrossWitnessContradictions(
  caseId: string,
  allClaims: any[],
  config: InconsistencyDetectionConfig
): Promise<DetectedInconsistency[]> {
  const inconsistencies: DetectedInconsistency[] = [];

  // Find observation claims about the same subject at the same time
  const observationClaims = allClaims.filter(c =>
    c.claim_type === 'observation' && c.subject_entity_id
  );

  // Group by subject
  const bySubject = new Map<string, any[]>();
  for (const claim of observationClaims) {
    const subjectId = claim.subject_entity_id;
    if (!bySubject.has(subjectId)) {
      bySubject.set(subjectId, []);
    }
    bySubject.get(subjectId)!.push(claim);
  }

  // Compare observations of the same subject
  for (const [subjectId, subjectClaims] of bySubject) {
    for (let i = 0; i < subjectClaims.length; i++) {
      for (let j = i + 1; j < subjectClaims.length; j++) {
        const claim1 = subjectClaims[i];
        const claim2 = subjectClaims[j];

        // Different speakers
        if (claim1.statements?.speaker_entity_id === claim2.statements?.speaker_entity_id) {
          continue;
        }

        // Same time period
        if (claim1.claimed_datetime && claim2.claimed_datetime) {
          const timeDiff = Math.abs(
            new Date(claim1.claimed_datetime).getTime() -
            new Date(claim2.claimed_datetime).getTime()
          ) / 60000;

          if (timeDiff <= config.timeToleranceMinutes * 2) {
            // Check for contradictory observations
            if (
              claim1.claimed_location &&
              claim2.claimed_location &&
              !locationsMatch(claim1.claimed_location, claim2.claimed_location, config.locationFuzzyMatch)
            ) {
              const inconsistency = await analyzeInconsistency(
                caseId,
                claim1,
                claim2,
                'witness_contradiction',
                config
              );
              if (inconsistency) {
                inconsistencies.push(inconsistency);
              }
            }
          }
        }
      }
    }
  }

  return inconsistencies;
}

/**
 * Detect alibi contradictions
 */
async function detectAlibiContradictions(
  caseId: string,
  allClaims: any[],
  config: InconsistencyDetectionConfig
): Promise<DetectedInconsistency[]> {
  const inconsistencies: DetectedInconsistency[] = [];

  // Get alibi claims
  const alibiClaims = allClaims.filter(c => c.is_alibi_claim);

  // Get observation claims that might contradict alibis
  const observationClaims = allClaims.filter(c => c.claim_type === 'observation');

  for (const alibi of alibiClaims) {
    for (const observation of observationClaims) {
      // Check if observation contradicts the alibi
      if (
        alibi.subject_entity_id === observation.subject_entity_id &&
        alibi.claimed_datetime &&
        observation.claimed_datetime
      ) {
        const timeDiff = Math.abs(
          new Date(alibi.claimed_datetime).getTime() -
          new Date(observation.claimed_datetime).getTime()
        ) / 60000;

        if (timeDiff <= config.timeToleranceMinutes) {
          // Same time - check for location mismatch
          if (
            alibi.claimed_location &&
            observation.claimed_location &&
            !locationsMatch(alibi.claimed_location, observation.claimed_location, config.locationFuzzyMatch)
          ) {
            const inconsistency = await analyzeInconsistency(
              caseId,
              alibi,
              observation,
              'alibi_contradiction',
              config
            );
            if (inconsistency) {
              inconsistency.severity = 'critical'; // Alibi contradictions are critical
              inconsistencies.push(inconsistency);
            }
          }
        }
      }
    }
  }

  return inconsistencies;
}

/**
 * Analyze an inconsistency using AI
 */
async function analyzeInconsistency(
  caseId: string,
  claim1: any,
  claim2: any,
  type: InconsistencyType,
  config: InconsistencyDetectionConfig
): Promise<DetectedInconsistency | null> {
  // Calculate basic metrics
  const statement1Date = claim1.statements?.statement_date ? new Date(claim1.statements.statement_date) : null;
  const statement2Date = claim2.statements?.statement_date ? new Date(claim2.statements.statement_date) : null;
  const daysBetween = statement1Date && statement2Date
    ? Math.abs(statement2Date.getTime() - statement1Date.getTime()) / (1000 * 60 * 60 * 24)
    : undefined;

  // Determine severity
  let severity: Severity = 'moderate';
  if (type === 'alibi_contradiction') {
    severity = 'critical';
  } else if (type === 'self_contradiction' && daysBetween && daysBetween > 30) {
    severity = 'significant';
  } else if (type === 'time_contradiction') {
    severity = 'significant';
  }

  let description = '';
  let analysis = '';
  let investigativeSignificance = '';
  let suggestedAction = '';

  if (config.useAIAnalysis && process.env.ANTHROPIC_API_KEY) {
    try {
      const aiAnalysis = await getAIAnalysis(claim1, claim2, type, daysBetween);
      description = aiAnalysis.description;
      analysis = aiAnalysis.analysis;
      investigativeSignificance = aiAnalysis.significance;
      suggestedAction = aiAnalysis.suggestedAction;
      if (aiAnalysis.severity) {
        severity = aiAnalysis.severity;
      }
    } catch (error) {
      console.error('[Inconsistency Detector] AI analysis failed:', error);
    }
  }

  // Fallback to template-based description
  if (!description) {
    description = generateDescription(claim1, claim2, type, daysBetween);
    analysis = `Claims from ${claim1.statements?.speaker_name || 'unknown'} appear to conflict.`;
    investigativeSignificance = type === 'alibi_contradiction'
      ? 'This directly challenges the alibi provided and requires immediate investigation.'
      : 'This inconsistency should be explored in a follow-up interview.';
    suggestedAction = 'Schedule follow-up interview to clarify the discrepancy.';
  }

  return {
    caseId,
    claim1Id: claim1.id,
    claim2Id: claim2.id,
    claim1: mapClaimData(claim1),
    claim2: mapClaimData(claim2),
    inconsistencyType: type,
    severity,
    description,
    analysis,
    investigativeSignificance,
    suggestedAction,
    timeBetweenStatements: daysBetween,
    involvedEntityIds: [
      claim1.subject_entity_id,
      claim2.subject_entity_id,
      claim1.statements?.speaker_entity_id,
      claim2.statements?.speaker_entity_id,
    ].filter(Boolean),
    primarySpeakerId: claim1.statements?.speaker_entity_id,
    timePeriodStart: claim1.claimed_datetime ? new Date(claim1.claimed_datetime) : undefined,
    timePeriodEnd: claim2.claimed_datetime ? new Date(claim2.claimed_datetime) : undefined,
    detectionMethod: config.useAIAnalysis ? 'ai_assisted' : 'automated',
    detectionConfidence: 0.85,
    reviewStatus: 'pending',
  };
}

/**
 * Get AI analysis of an inconsistency
 */
async function getAIAnalysis(
  claim1: any,
  claim2: any,
  type: InconsistencyType,
  daysBetween?: number
): Promise<{
  description: string;
  analysis: string;
  significance: string;
  suggestedAction: string;
  severity?: Severity;
}> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Analyze this inconsistency detected in a criminal investigation:

INCONSISTENCY TYPE: ${type}

CLAIM 1 (from ${claim1.statements?.speaker_name}, dated ${claim1.statements?.statement_date}):
"${claim1.original_text}"
- Location: ${claim1.claimed_location || 'not specified'}
- Time: ${claim1.claimed_datetime || claim1.time_original_text || 'not specified'}

CLAIM 2 (from ${claim2.statements?.speaker_name}, dated ${claim2.statements?.statement_date}):
"${claim2.original_text}"
- Location: ${claim2.claimed_location || 'not specified'}
- Time: ${claim2.claimed_datetime || claim2.time_original_text || 'not specified'}

TIME BETWEEN STATEMENTS: ${daysBetween ? `${Math.round(daysBetween)} days` : 'unknown'}

Provide:
1. A clear description of the inconsistency (1-2 sentences)
2. Analysis of what this inconsistency might indicate
3. Investigative significance
4. Suggested action for investigators
5. Severity assessment: minor, moderate, significant, or critical

Respond in JSON format:
{
  "description": "...",
  "analysis": "...",
  "significance": "...",
  "suggestedAction": "...",
  "severity": "..."
}`,
    }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    return JSON.parse(text);
  } catch {
    return {
      description: 'Inconsistency detected between statements.',
      analysis: 'Further review required.',
      significance: 'Potentially significant for investigation.',
      suggestedAction: 'Review and follow up.',
    };
  }
}

/**
 * Generate a description for the inconsistency
 */
function generateDescription(
  claim1: any,
  claim2: any,
  type: InconsistencyType,
  daysBetween?: number
): string {
  const speaker = claim1.statements?.speaker_name || 'The witness';

  switch (type) {
    case 'self_contradiction':
      return `${speaker} made conflicting statements: "${claim1.original_text?.slice(0, 100)}..." vs "${claim2.original_text?.slice(0, 100)}..."${daysBetween ? ` (${Math.round(daysBetween)} days apart)` : ''}.`;

    case 'time_contradiction':
      return `${speaker} provided different times for the same event: ${claim1.time_original_text || claim1.claimed_datetime} vs ${claim2.time_original_text || claim2.claimed_datetime}.`;

    case 'location_contradiction':
      return `${speaker} claimed to be at ${claim1.claimed_location} and ${claim2.claimed_location} at approximately the same time.`;

    case 'alibi_contradiction':
      return `${speaker}'s alibi (${claim1.claimed_location}) is contradicted by an observation placing them at ${claim2.claimed_location}.`;

    case 'witness_contradiction':
      return `${claim1.statements?.speaker_name} and ${claim2.statements?.speaker_name} provided conflicting observations about the same event.`;

    default:
      return `Inconsistency detected between statements from ${speaker}.`;
  }
}

/**
 * Check if two locations match
 */
function locationsMatch(loc1: string, loc2: string, fuzzy: boolean): boolean {
  const clean1 = loc1.toLowerCase().trim();
  const clean2 = loc2.toLowerCase().trim();

  if (clean1 === clean2) return true;

  if (fuzzy) {
    // Check for containment
    if (clean1.includes(clean2) || clean2.includes(clean1)) return true;

    // Check common variations
    const normalize = (s: string) => s
      .replace(/\b(st|street)\b/g, 'street')
      .replace(/\b(ave|avenue)\b/g, 'avenue')
      .replace(/\b(rd|road)\b/g, 'road')
      .replace(/\b(dr|drive)\b/g, 'drive')
      .replace(/\bthe\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return normalize(clean1) === normalize(clean2);
  }

  return false;
}

/**
 * Save an inconsistency to the database
 */
async function saveInconsistency(inconsistency: DetectedInconsistency): Promise<void> {
  const { error } = await supabaseServer
    .from('claim_inconsistencies')
    .insert({
      case_id: inconsistency.caseId,
      claim_1_id: inconsistency.claim1Id,
      claim_2_id: inconsistency.claim2Id,
      inconsistency_type: inconsistency.inconsistencyType,
      severity: inconsistency.severity,
      description: inconsistency.description,
      analysis: inconsistency.analysis,
      investigative_significance: inconsistency.investigativeSignificance,
      suggested_action: inconsistency.suggestedAction,
      time_between_statements: inconsistency.timeBetweenStatements
        ? `${Math.round(inconsistency.timeBetweenStatements)} days`
        : null,
      involved_entity_ids: inconsistency.involvedEntityIds,
      primary_speaker_id: inconsistency.primarySpeakerId,
      time_period_start: inconsistency.timePeriodStart?.toISOString(),
      time_period_end: inconsistency.timePeriodEnd?.toISOString(),
      detection_method: inconsistency.detectionMethod,
      detection_confidence: inconsistency.detectionConfidence,
      review_status: inconsistency.reviewStatus,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[Inconsistency Detector] Failed to save inconsistency:', error);
  }
}

/**
 * Get all inconsistencies for a case
 */
export async function getCaseInconsistencies(
  caseId: string,
  filters?: {
    type?: InconsistencyType;
    severity?: Severity;
    reviewStatus?: ReviewStatus;
    speakerId?: string;
  }
): Promise<DetectedInconsistency[]> {
  let query = supabaseServer
    .from('claim_inconsistencies')
    .select(`
      *,
      claim1:statement_claims!claim_1_id(*),
      claim2:statement_claims!claim_2_id(*)
    `)
    .eq('case_id', caseId);

  if (filters?.type) {
    query = query.eq('inconsistency_type', filters.type);
  }
  if (filters?.severity) {
    query = query.eq('severity', filters.severity);
  }
  if (filters?.reviewStatus) {
    query = query.eq('review_status', filters.reviewStatus);
  }
  if (filters?.speakerId) {
    query = query.eq('primary_speaker_id', filters.speakerId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch inconsistencies: ${error.message}`);
  }

  return (data || []).map(mapToInconsistency);
}

/**
 * Compare two statements from the same person
 */
export async function compareStatements(
  statement1Id: string,
  statement2Id: string
): Promise<StatementComparisonResult> {
  // Get both statements with claims
  const [claims1, claims2] = await Promise.all([
    getStatementClaims(statement1Id),
    getStatementClaims(statement2Id),
  ]);

  const { data: statement1 } = await supabaseServer
    .from('statements')
    .select('speaker_entity_id, speaker_name')
    .eq('id', statement1Id)
    .single();

  const speakerName = statement1?.speaker_name || 'Unknown';
  const speakerId = statement1?.speaker_entity_id;

  // Compare claims
  let matching = 0;
  let contradicting = 0;
  const inconsistencies: DetectedInconsistency[] = [];

  // Find matching and contradicting claims
  for (const claim1 of claims1) {
    let foundMatch = false;

    for (const claim2 of claims2) {
      if (claimsMatch(claim1, claim2)) {
        matching++;
        foundMatch = true;
        break;
      }

      if (claimsContradict(claim1, claim2)) {
        contradicting++;
        // Create inconsistency record
        const inconsistency = await analyzeInconsistency(
          claim1.caseId,
          claim1,
          claim2,
          'self_contradiction',
          DEFAULT_CONFIG
        );
        if (inconsistency) {
          inconsistencies.push(inconsistency);
        }
      }
    }
  }

  // Count new and omitted claims
  const newClaims = claims2.filter(c2 =>
    !claims1.some(c1 => claimsMatch(c1, c2))
  ).length;

  const omittedClaims = claims1.filter(c1 =>
    !claims2.some(c2 => claimsMatch(c1, c2))
  ).length;

  // Calculate consistency score
  const total = claims1.length + claims2.length;
  const consistencyScore = total > 0
    ? (matching * 2) / total
    : 1;

  // Determine credibility impact
  let credibilityImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (contradicting > 0 || consistencyScore < 0.5) {
    credibilityImpact = 'negative';
  } else if (consistencyScore > 0.8 && matching > 5) {
    credibilityImpact = 'positive';
  }

  // Generate summary
  const keyDifferences: string[] = [];
  if (contradicting > 0) {
    keyDifferences.push(`${contradicting} contradicting claim(s)`);
  }
  if (newClaims > 0) {
    keyDifferences.push(`${newClaims} new detail(s) added`);
  }
  if (omittedClaims > 0) {
    keyDifferences.push(`${omittedClaims} detail(s) omitted`);
  }

  const summary = keyDifferences.length > 0
    ? `Comparison reveals: ${keyDifferences.join(', ')}`
    : 'Statements appear largely consistent.';

  // Save comparison result
  await supabaseServer
    .from('statement_comparisons')
    .insert({
      case_id: claims1[0]?.caseId,
      statement_1_id: statement1Id,
      statement_2_id: statement2Id,
      speaker_entity_id: speakerId,
      total_claims_compared: total,
      matching_claims: matching,
      contradicting_claims: contradicting,
      new_claims: newClaims,
      omitted_claims: omittedClaims,
      consistency_score: consistencyScore,
      credibility_impact: credibilityImpact,
      summary,
      key_differences: keyDifferences,
    });

  return {
    statement1Id,
    statement2Id,
    speakerEntityId: speakerId,
    speakerName,
    totalClaimsCompared: total,
    matchingClaims: matching,
    contradictingClaims: contradicting,
    newClaims,
    omittedClaims,
    modifiedClaims: 0, // Would require more sophisticated matching
    consistencyScore,
    credibilityImpact,
    summary,
    keyDifferences,
    inconsistencies,
  };
}

/**
 * Track how a claim has evolved across statements
 */
export async function trackClaimEvolution(
  caseId: string,
  entityId: string,
  claimTopic: string
): Promise<ClaimEvolution> {
  // Get all claims from this entity about this topic
  const { data: claims } = await supabaseServer
    .from('statement_claims')
    .select(`
      *,
      statements!inner(speaker_entity_id, speaker_name, statement_date)
    `)
    .eq('case_id', caseId)
    .eq('subject_entity_id', entityId)
    .ilike('claim_text', `%${claimTopic}%`)
    .order('statements(statement_date)', { ascending: true });

  const versions: ClaimVersion[] = (claims || []).map(c => ({
    statementId: c.statement_id,
    statementDate: new Date(c.statements.statement_date),
    claimId: c.id,
    claimText: c.claim_text,
    originalText: c.original_text,
    timeValue: c.claimed_datetime ? new Date(c.claimed_datetime) : undefined,
    locationValue: c.claimed_location,
  }));

  // Calculate drift
  let hasContradictions = false;
  let driftScore = 0;

  for (let i = 1; i < versions.length; i++) {
    const prev = versions[i - 1];
    const curr = versions[i];

    if (prev.timeValue && curr.timeValue) {
      const timeDiff = Math.abs(prev.timeValue.getTime() - curr.timeValue.getTime());
      if (timeDiff > 30 * 60 * 1000) { // More than 30 minutes
        hasContradictions = true;
        driftScore += timeDiff / (60 * 60 * 1000); // Hours of drift
      }
    }

    if (prev.locationValue && curr.locationValue && prev.locationValue !== curr.locationValue) {
      hasContradictions = true;
      driftScore += 1;
    }
  }

  const { data: entity } = await supabaseServer
    .from('canonical_entities')
    .select('canonical_name')
    .eq('id', entityId)
    .single();

  return {
    claimTopic,
    entityId,
    entityName: entity?.canonical_name || 'Unknown',
    versions,
    hasContradictions,
    driftScore,
  };
}

// Helper functions
function claimsMatch(c1: StatementClaim, c2: StatementClaim): boolean {
  if (c1.claimType !== c2.claimType) return false;
  if (c1.predicate !== c2.predicate) return false;

  // Check time similarity
  if (c1.claimedDatetime && c2.claimedDatetime) {
    const timeDiff = Math.abs(c1.claimedDatetime.getTime() - c2.claimedDatetime.getTime());
    if (timeDiff > 30 * 60 * 1000) return false; // More than 30 minutes
  }

  // Check location match
  if (c1.claimedLocation && c2.claimedLocation) {
    if (!locationsMatch(c1.claimedLocation, c2.claimedLocation, true)) return false;
  }

  return true;
}

function claimsContradict(c1: StatementClaim, c2: StatementClaim): boolean {
  // Same type of claim, same subject, but different details
  if (c1.claimType !== c2.claimType) return false;
  if (c1.subjectEntityId !== c2.subjectEntityId) return false;

  // Check for time contradiction
  if (c1.claimedDatetime && c2.claimedDatetime) {
    const timeDiff = Math.abs(c1.claimedDatetime.getTime() - c2.claimedDatetime.getTime());
    if (timeDiff <= 30 * 60 * 1000) { // Same time
      if (c1.claimedLocation && c2.claimedLocation) {
        if (!locationsMatch(c1.claimedLocation, c2.claimedLocation, true)) {
          return true; // At same time but different location = contradiction
        }
      }
    }
  }

  return false;
}

function mapClaimData(data: any): StatementClaim {
  return {
    id: data.id,
    statementId: data.statement_id,
    caseId: data.case_id,
    claimType: data.claim_type,
    claimText: data.claim_text,
    originalText: data.original_text,
    subjectEntityId: data.subject_entity_id,
    subjectText: data.subject_text,
    predicate: data.predicate,
    objectEntityId: data.object_entity_id,
    objectText: data.object_text,
    claimedDate: data.claimed_date ? new Date(data.claimed_date) : undefined,
    claimedTime: data.claimed_time,
    claimedDatetime: data.claimed_datetime ? new Date(data.claimed_datetime) : undefined,
    timePrecision: data.time_precision,
    timeRangeStart: data.time_range_start ? new Date(data.time_range_start) : undefined,
    timeRangeEnd: data.time_range_end ? new Date(data.time_range_end) : undefined,
    timeOriginalText: data.time_original_text,
    claimedLocation: data.claimed_location,
    locationEntityId: data.location_entity_id,
    locationPrecision: data.location_precision,
    extractionConfidence: data.extraction_confidence || 0.8,
    verificationStatus: data.verification_status || 'unverified',
    verifiedByEvidence: data.verified_by_evidence,
    characterOffset: data.character_offset,
    pageNumber: data.page_number,
    isAlibiClaim: data.is_alibi_claim || false,
    isAccusatory: data.is_accusatory || false,
    involvesVictim: data.involves_victim || false,
  };
}

function mapToInconsistency(data: any): DetectedInconsistency {
  return {
    id: data.id,
    caseId: data.case_id,
    claim1Id: data.claim_1_id,
    claim2Id: data.claim_2_id,
    claim1: data.claim1 ? mapClaimData(data.claim1) : {} as StatementClaim,
    claim2: data.claim2 ? mapClaimData(data.claim2) : {} as StatementClaim,
    inconsistencyType: data.inconsistency_type,
    severity: data.severity,
    description: data.description,
    analysis: data.analysis,
    investigativeSignificance: data.investigative_significance,
    suggestedAction: data.suggested_action,
    timeBetweenStatements: data.time_between_statements,
    involvedEntityIds: data.involved_entity_ids || [],
    primarySpeakerId: data.primary_speaker_id,
    timePeriodStart: data.time_period_start ? new Date(data.time_period_start) : undefined,
    timePeriodEnd: data.time_period_end ? new Date(data.time_period_end) : undefined,
    detectionMethod: data.detection_method || 'automated',
    detectionConfidence: data.detection_confidence || 0.8,
    reviewStatus: data.review_status || 'pending',
  };
}
