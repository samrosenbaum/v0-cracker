/**
 * Suspect Scoring Algorithm
 *
 * Calculates comprehensive suspicion scores for each person of interest based on:
 * - Opportunity (25 points): Proximity to victim, access to crime scene, alibi gaps
 * - Means (25 points): Physical capability, weapon access, knowledge to execute
 * - Motive (25 points): Financial benefit, relationship conflict, witness elimination
 * - Behavior (25 points): Statement contradictions, story evolution, guilty knowledge
 * - Evidence (+/-): DNA match, physical evidence, witness identification
 *
 * Total base score: 0-100 (higher = more suspicious)
 * Evidence can add bonus points or provide exclusion
 */

import { supabaseServer } from './supabase-server';
import { getAnthropicClient, DEFAULT_ANTHROPIC_MODEL, isAnthropicConfigured } from './anthropic-client';
import type { PersonProfile, PersonClaim, PersonAlibi, GuiltyKnowledgeIndicator, SuspicionFactor } from './person-profiles';
import { getPersonProfile, getAllPersonProfiles, getPersonClaims, getPersonAlibis, getGuiltyKnowledgeIndicators } from './person-profiles';
import { getFactsForPerson, getContradictedFacts, getSuspiciousFacts } from './atomic-facts';
import type { AtomicFact } from './atomic-facts';

// ============================================================================
// Type Definitions
// ============================================================================

export interface SuspectScore {
  personId: string;
  personName: string;
  role: string;

  // Overall score
  totalScore: number;
  normalizedScore: number; // 0-100
  ranking: number;

  // Component scores (0-25 each)
  opportunityScore: number;
  meansScore: number;
  motiveScore: number;
  behaviorScore: number;

  // Evidence modifier
  evidenceScore: number;
  dnaStatus: 'matched' | 'excluded' | 'pending' | 'not_submitted';

  // Detailed breakdown
  factors: SuspicionFactor[];

  // Key findings
  keyFindings: string[];
  criticalFlags: string[];

  // Recommendation
  investigativeRecommendation: string;
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';

  // Confidence
  confidence: number; // 0-1
  dataQuality: 'insufficient' | 'partial' | 'adequate' | 'comprehensive';

  // Last updated
  calculatedAt: string;
}

export interface ScoringContext {
  caseId: string;
  victimName: string;
  crimeDate: string;
  crimeLocation: string;
  crimeType: string;
  knownFacts: string[];
}

export interface CaseRankings {
  caseId: string;
  rankedSuspects: SuspectScore[];
  totalPersonsAnalyzed: number;
  topSuspect: SuspectScore | null;
  averageScore: number;
  generatedAt: string;
}

// ============================================================================
// Main Scoring Functions
// ============================================================================

export async function scoreSuspect(
  caseId: string,
  personId: string,
  context?: ScoringContext
): Promise<SuspectScore> {
  // Get person profile
  const { data: profileData } = await supabaseServer
    .from('person_profiles')
    .select('*')
    .eq('id', personId)
    .single();

  if (!profileData) {
    throw new Error(`Person profile not found: ${personId}`);
  }

  const profile = profileData as Record<string, unknown>;

  // Get all related data
  const [claims, alibis, guiltyKnowledge, facts, contradictions] = await Promise.all([
    getPersonClaims(personId),
    getPersonAlibis(personId),
    getGuiltyKnowledgeIndicators(personId),
    getFactsForPerson(caseId, profile.canonical_name as string),
    getContradictedFactsForPerson(caseId, profile.canonical_name as string)
  ]);

  // Calculate component scores
  const opportunityResult = calculateOpportunityScore(profile, alibis, facts, context);
  const meansResult = calculateMeansScore(profile, facts, context);
  const motiveResult = calculateMotiveScore(profile, facts, context);
  const behaviorResult = calculateBehaviorScore(profile, claims, contradictions, guiltyKnowledge);
  const evidenceResult = calculateEvidenceScore(profile, facts);

  // Combine all factors
  const allFactors: SuspicionFactor[] = [
    ...opportunityResult.factors,
    ...meansResult.factors,
    ...motiveResult.factors,
    ...behaviorResult.factors,
    ...evidenceResult.factors
  ];

  // Calculate total score
  const baseScore = opportunityResult.score + meansResult.score + motiveResult.score + behaviorResult.score;
  const totalScore = Math.max(0, Math.min(100, baseScore + evidenceResult.score));

  // Generate key findings
  const keyFindings = generateKeyFindings(allFactors, claims, contradictions, guiltyKnowledge);

  // Identify critical flags
  const criticalFlags = allFactors
    .filter(f => f.weight >= 8)
    .map(f => f.factor);

  // Generate recommendation
  const recommendation = generateRecommendation(totalScore, allFactors, evidenceResult);

  // Determine priority level
  const priorityLevel = determinePriorityLevel(totalScore, criticalFlags.length, evidenceResult);

  // Calculate data quality
  const dataQuality = assessDataQuality(claims, alibis, facts, guiltyKnowledge);

  // Calculate confidence
  const confidence = calculateConfidence(dataQuality, allFactors.length, facts.length);

  const score: SuspectScore = {
    personId,
    personName: profile.canonical_name as string,
    role: profile.role as string,
    totalScore,
    normalizedScore: totalScore,
    ranking: 0, // Will be set when ranking all suspects
    opportunityScore: opportunityResult.score,
    meansScore: meansResult.score,
    motiveScore: motiveResult.score,
    behaviorScore: behaviorResult.score,
    evidenceScore: evidenceResult.score,
    dnaStatus: getDnaStatus(profile),
    factors: allFactors,
    keyFindings,
    criticalFlags,
    investigativeRecommendation: recommendation,
    priorityLevel,
    confidence,
    dataQuality,
    calculatedAt: new Date().toISOString()
  };

  // Save score to database
  await saveScoreToProfile(personId, score);

  return score;
}

export async function rankAllSuspects(caseId: string, context?: ScoringContext): Promise<CaseRankings> {
  const profiles = await getAllPersonProfiles(caseId);

  const scores: SuspectScore[] = [];

  for (const profile of profiles) {
    try {
      const score = await scoreSuspect(caseId, profile.id, context);
      scores.push(score);
    } catch (error) {
      console.error(`Failed to score ${profile.canonicalName}:`, error);
    }
  }

  // Sort by total score descending
  scores.sort((a, b) => b.totalScore - a.totalScore);

  // Assign rankings
  scores.forEach((score, index) => {
    score.ranking = index + 1;
  });

  // Calculate statistics
  const avgScore = scores.length > 0
    ? scores.reduce((sum, s) => sum + s.totalScore, 0) / scores.length
    : 0;

  return {
    caseId,
    rankedSuspects: scores,
    totalPersonsAnalyzed: scores.length,
    topSuspect: scores[0] || null,
    averageScore: avgScore,
    generatedAt: new Date().toISOString()
  };
}

// ============================================================================
// Component Scoring Functions
// ============================================================================

interface ComponentScore {
  score: number;
  factors: SuspicionFactor[];
}

function calculateOpportunityScore(
  profile: Record<string, unknown>,
  alibis: PersonAlibi[],
  facts: AtomicFact[],
  context?: ScoringContext
): ComponentScore {
  let score = 0;
  const factors: SuspicionFactor[] = [];

  // Proximity to victim (0-10)
  const relationship = profile.relationship_to_victim as string;
  const relationshipStrength = profile.relationship_strength as string;

  if (relationshipStrength === 'close' || relationship?.includes('family') || relationship?.includes('spouse')) {
    score += 8;
    factors.push({
      factor: 'Close relationship to victim',
      weight: 8,
      evidence: [relationship || 'Close relationship indicated'],
      category: 'opportunity'
    });
  } else if (relationshipStrength === 'acquaintance' || relationship?.includes('friend') || relationship?.includes('colleague')) {
    score += 5;
    factors.push({
      factor: 'Known to victim',
      weight: 5,
      evidence: [relationship || 'Acquaintance relationship'],
      category: 'opportunity'
    });
  } else if (relationship) {
    score += 2;
    factors.push({
      factor: 'Some connection to victim',
      weight: 2,
      evidence: [relationship],
      category: 'opportunity'
    });
  }

  // Access to crime location (0-10)
  const locationFacts = facts.filter(f =>
    f.factType === 'location_claim' &&
    context?.crimeLocation &&
    f.location?.toLowerCase().includes(context.crimeLocation.toLowerCase())
  );

  if (locationFacts.length > 0) {
    score += 7;
    factors.push({
      factor: 'Confirmed presence at crime location',
      weight: 7,
      evidence: locationFacts.map(f => f.source.originalQuote || f.predicate),
      category: 'opportunity'
    });
  }

  // Alibi gaps (0-5)
  const unverifiedAlibis = alibis.filter(a => a.verificationStatus === 'unverified');
  const disputedAlibis = alibis.filter(a => a.verificationStatus === 'disputed');
  const impossibleAlibis = alibis.filter(a => a.verificationStatus === 'impossible');

  if (impossibleAlibis.length > 0) {
    score += 5;
    factors.push({
      factor: 'Alibi proven impossible',
      weight: 5,
      evidence: impossibleAlibis.map(a => `Claimed ${a.location} but disproven`),
      category: 'opportunity'
    });
  } else if (disputedAlibis.length > 0) {
    score += 3;
    factors.push({
      factor: 'Alibi disputed',
      weight: 3,
      evidence: disputedAlibis.map(a => a.conflictDescription || 'Alibi inconsistencies'),
      category: 'opportunity'
    });
  } else if (unverifiedAlibis.length > 0 && alibis.length === unverifiedAlibis.length) {
    score += 2;
    factors.push({
      factor: 'No verified alibi',
      weight: 2,
      evidence: ['All alibis remain unverified'],
      category: 'opportunity'
    });
  }

  // Alibi conflicts
  const conflictingAlibis = alibis.filter(a => a.conflictingAlibiIds.length > 0);
  if (conflictingAlibis.length > 0) {
    score += 3;
    factors.push({
      factor: 'Self-conflicting alibis',
      weight: 3,
      evidence: conflictingAlibis.map(a => a.conflictDescription || 'Timeline conflict detected'),
      category: 'opportunity'
    });
  }

  return { score: Math.min(25, score), factors };
}

function calculateMeansScore(
  profile: Record<string, unknown>,
  facts: AtomicFact[],
  context?: ScoringContext
): ComponentScore {
  let score = 0;
  const factors: SuspicionFactor[] = [];

  // Physical capability (0-10)
  const gender = profile.gender as string;
  const age = profile.age_at_time as number;

  // This is a rough heuristic - should be based on crime specifics
  if (context?.crimeType?.includes('physical') || context?.crimeType?.includes('assault')) {
    // Check for mentions of physical capability
    const physicalFacts = facts.filter(f =>
      f.predicate.toLowerCase().includes('strong') ||
      f.predicate.toLowerCase().includes('physical') ||
      f.predicate.toLowerCase().includes('capable')
    );

    if (physicalFacts.length > 0) {
      score += 5;
      factors.push({
        factor: 'Physical capability noted',
        weight: 5,
        evidence: physicalFacts.map(f => f.source.originalQuote || f.predicate),
        category: 'means'
      });
    }
  }

  // Weapon/tool access (0-10)
  const possessionFacts = facts.filter(f => f.factType === 'possession');
  const weaponFacts = possessionFacts.filter(f =>
    f.predicate.toLowerCase().includes('gun') ||
    f.predicate.toLowerCase().includes('knife') ||
    f.predicate.toLowerCase().includes('weapon') ||
    f.mentionedEvidence.some(e => e.toLowerCase().includes('weapon'))
  );

  if (weaponFacts.length > 0) {
    score += 8;
    factors.push({
      factor: 'Access to potential weapon',
      weight: 8,
      evidence: weaponFacts.map(f => f.source.originalQuote || f.predicate),
      category: 'means'
    });
  }

  // Technical knowledge (0-5)
  const occupation = profile.occupation as string;
  if (occupation) {
    // Check if occupation relates to crime method
    const knowledgeFacts = facts.filter(f =>
      f.factType === 'knowledge_claim' &&
      f.isSuspicious
    );

    if (knowledgeFacts.length > 0) {
      score += 4;
      factors.push({
        factor: 'Relevant technical knowledge',
        weight: 4,
        evidence: knowledgeFacts.map(f => f.source.originalQuote || f.predicate),
        category: 'means'
      });
    }
  }

  return { score: Math.min(25, score), factors };
}

function calculateMotiveScore(
  profile: Record<string, unknown>,
  facts: AtomicFact[],
  context?: ScoringContext
): ComponentScore {
  let score = 0;
  const factors: SuspicionFactor[] = [];

  // Financial benefit (0-10)
  const financialFacts = facts.filter(f =>
    f.predicate.toLowerCase().includes('insurance') ||
    f.predicate.toLowerCase().includes('inherit') ||
    f.predicate.toLowerCase().includes('money') ||
    f.predicate.toLowerCase().includes('will') ||
    f.predicate.toLowerCase().includes('beneficiary')
  );

  if (financialFacts.length > 0) {
    const suspiciousFinancial = financialFacts.filter(f => f.isSuspicious);
    if (suspiciousFinancial.length > 0) {
      score += 10;
      factors.push({
        factor: 'Suspicious financial motive',
        weight: 10,
        evidence: suspiciousFinancial.map(f => f.source.originalQuote || f.predicate),
        category: 'motive'
      });
    } else {
      score += 5;
      factors.push({
        factor: 'Potential financial benefit',
        weight: 5,
        evidence: financialFacts.map(f => f.source.originalQuote || f.predicate),
        category: 'motive'
      });
    }
  }

  // Relationship conflict (0-10)
  const conflictFacts = facts.filter(f =>
    f.factType === 'prior_incident' ||
    f.factType === 'state_of_mind' ||
    f.predicate.toLowerCase().includes('fight') ||
    f.predicate.toLowerCase().includes('argument') ||
    f.predicate.toLowerCase().includes('angry') ||
    f.predicate.toLowerCase().includes('threatened') ||
    f.predicate.toLowerCase().includes('jealous') ||
    f.predicate.toLowerCase().includes('divorce') ||
    f.predicate.toLowerCase().includes('affair')
  );

  if (conflictFacts.length > 0) {
    const severity = conflictFacts.some(f =>
      f.predicate.toLowerCase().includes('threatened') ||
      f.predicate.toLowerCase().includes('violent')
    ) ? 10 : 6;

    score += severity;
    factors.push({
      factor: 'History of conflict with victim',
      weight: severity,
      evidence: conflictFacts.map(f => f.source.originalQuote || f.predicate),
      category: 'motive'
    });
  }

  // Witness elimination (0-5)
  const knowledgeFacts = facts.filter(f =>
    f.predicate.toLowerCase().includes('knew about') ||
    f.predicate.toLowerCase().includes('witnessed') ||
    f.predicate.toLowerCase().includes('saw') ||
    f.predicate.toLowerCase().includes('secret')
  );

  if (knowledgeFacts.some(f => f.isSuspicious)) {
    score += 5;
    factors.push({
      factor: 'Potential witness elimination motive',
      weight: 5,
      evidence: knowledgeFacts.filter(f => f.isSuspicious).map(f => f.source.originalQuote || f.predicate),
      category: 'motive'
    });
  }

  return { score: Math.min(25, score), factors };
}

function calculateBehaviorScore(
  profile: Record<string, unknown>,
  claims: PersonClaim[],
  contradictions: AtomicFact[],
  guiltyKnowledge: GuiltyKnowledgeIndicator[]
): ComponentScore {
  let score = 0;
  const factors: SuspicionFactor[] = [];

  // Statement contradictions (0-10)
  const suspiciousClaims = claims.filter(c => c.isSuspicious);
  const contradictedClaims = claims.filter(c => c.contradictedBy.length > 0);
  const evolvedClaims = claims.filter(c => c.hasEvolved);

  if (contradictions.length > 5) {
    score += 10;
    factors.push({
      factor: 'Multiple statement contradictions',
      weight: 10,
      evidence: contradictions.slice(0, 5).map(c => c.source.originalQuote || c.predicate),
      category: 'behavior'
    });
  } else if (contradictions.length > 2) {
    score += 7;
    factors.push({
      factor: 'Several statement contradictions',
      weight: 7,
      evidence: contradictions.map(c => c.source.originalQuote || c.predicate),
      category: 'behavior'
    });
  } else if (contradictions.length > 0) {
    score += 4;
    factors.push({
      factor: 'Statement contradictions detected',
      weight: 4,
      evidence: contradictions.map(c => c.source.originalQuote || c.predicate),
      category: 'behavior'
    });
  }

  // Story evolution (0-5)
  if (evolvedClaims.length > 3) {
    score += 5;
    factors.push({
      factor: 'Story changed significantly over time',
      weight: 5,
      evidence: evolvedClaims.map(c => c.evolutionNotes || 'Statement evolved'),
      category: 'behavior'
    });
  } else if (evolvedClaims.length > 0) {
    score += 2;
    factors.push({
      factor: 'Some story changes noted',
      weight: 2,
      evidence: evolvedClaims.map(c => c.evolutionNotes || 'Statement evolved'),
      category: 'behavior'
    });
  }

  // Guilty knowledge (0-10)
  const criticalKnowledge = guiltyKnowledge.filter(gk => gk.severity === 'critical');
  const highKnowledge = guiltyKnowledge.filter(gk => gk.severity === 'high');

  if (criticalKnowledge.length > 0) {
    score += 10;
    factors.push({
      factor: 'CRITICAL: Demonstrated guilty knowledge',
      weight: 10,
      evidence: criticalKnowledge.map(gk => gk.knowledgeDescription),
      category: 'behavior'
    });
  } else if (highKnowledge.length > 0) {
    score += 7;
    factors.push({
      factor: 'Suspicious knowledge of unpublicized details',
      weight: 7,
      evidence: highKnowledge.map(gk => gk.knowledgeDescription),
      category: 'behavior'
    });
  } else if (guiltyKnowledge.length > 0) {
    score += 3;
    factors.push({
      factor: 'Possible guilty knowledge indicators',
      weight: 3,
      evidence: guiltyKnowledge.map(gk => gk.knowledgeDescription),
      category: 'behavior'
    });
  }

  return { score: Math.min(25, score), factors };
}

function calculateEvidenceScore(
  profile: Record<string, unknown>,
  facts: AtomicFact[]
): ComponentScore {
  let score = 0;
  const factors: SuspicionFactor[] = [];

  // DNA status
  const dnaSubmitted = profile.dna_submitted as boolean;
  const dnaMatched = profile.dna_matched as boolean;
  const dnaExcluded = profile.dna_excluded as boolean;

  if (dnaMatched) {
    score += 50;
    factors.push({
      factor: 'DNA MATCH at crime scene',
      weight: 50,
      evidence: ['DNA profile matched crime scene evidence'],
      category: 'evidence'
    });
  } else if (dnaExcluded) {
    score -= 30;
    factors.push({
      factor: 'DNA excluded (does not match)',
      weight: -30,
      evidence: ['DNA profile does not match crime scene evidence'],
      category: 'evidence'
    });
  } else if (!dnaSubmitted) {
    factors.push({
      factor: 'DNA not submitted',
      weight: 0,
      evidence: ['No DNA sample collected from this person'],
      category: 'evidence'
    });
  }

  // Physical evidence connections
  const evidenceFacts = facts.filter(f => f.factType === 'physical_evidence');
  const forensicFacts = facts.filter(f => f.factType === 'forensic_finding');

  const connectingEvidence = [...evidenceFacts, ...forensicFacts].filter(f =>
    f.isSuspicious ||
    f.predicate.toLowerCase().includes('fingerprint') ||
    f.predicate.toLowerCase().includes('hair') ||
    f.predicate.toLowerCase().includes('fiber') ||
    f.predicate.toLowerCase().includes('blood')
  );

  if (connectingEvidence.length > 0) {
    const points = Math.min(20, connectingEvidence.length * 5);
    score += points;
    factors.push({
      factor: 'Physical evidence connections',
      weight: points,
      evidence: connectingEvidence.map(f => f.source.originalQuote || f.predicate),
      category: 'evidence'
    });
  }

  // Witness identification
  const witnessFacts = facts.filter(f =>
    f.factType === 'observation' &&
    (f.predicate.toLowerCase().includes('identified') ||
     f.predicate.toLowerCase().includes('recognized') ||
     f.predicate.toLowerCase().includes('saw him') ||
     f.predicate.toLowerCase().includes('saw her'))
  );

  if (witnessFacts.length > 0) {
    const points = Math.min(15, witnessFacts.length * 5);
    score += points;
    factors.push({
      factor: 'Witness identification',
      weight: points,
      evidence: witnessFacts.map(f => f.source.originalQuote || f.predicate),
      category: 'evidence'
    });
  }

  return { score, factors };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getContradictedFactsForPerson(caseId: string, personName: string): Promise<AtomicFact[]> {
  const { data, error } = await supabaseServer
    .from('atomic_facts')
    .select('*')
    .eq('case_id', caseId)
    .eq('verification_status', 'contradicted')
    .or(`subject.ilike.%${personName}%,mentioned_persons.cs.{${personName}}`);

  if (error) return [];

  return data.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    caseId: row.case_id as string,
    factType: row.fact_type as AtomicFact['factType'],
    subject: row.subject as string,
    predicate: row.predicate as string,
    source: row.source as AtomicFact['source'],
    mentionedPersons: row.mentioned_persons as string[] || [],
    mentionedLocations: row.mentioned_locations as string[] || [],
    mentionedEvidence: row.mentioned_evidence as string[] || [],
    mentionedVehicles: row.mentioned_vehicles as string[] || [],
    corroboratingFactIds: row.corroborating_fact_ids as string[] || [],
    contradictingFactIds: row.contradicting_fact_ids as string[] || [],
    relatedFactIds: row.related_fact_ids as string[] || [],
    verificationStatus: row.verification_status as AtomicFact['verificationStatus'],
    confidenceScore: row.confidence_score as number,
    isSuspicious: row.is_suspicious as boolean,
    suspicionReason: row.suspicion_reason as string,
    extractedAt: row.extracted_at as string,
    lastUpdated: row.last_updated as string
  }));
}

function getDnaStatus(profile: Record<string, unknown>): SuspectScore['dnaStatus'] {
  if (profile.dna_matched) return 'matched';
  if (profile.dna_excluded) return 'excluded';
  if (profile.dna_submitted) return 'pending';
  return 'not_submitted';
}

function generateKeyFindings(
  factors: SuspicionFactor[],
  claims: PersonClaim[],
  contradictions: AtomicFact[],
  guiltyKnowledge: GuiltyKnowledgeIndicator[]
): string[] {
  const findings: string[] = [];

  // Top factors by weight
  const topFactors = [...factors].sort((a, b) => b.weight - a.weight).slice(0, 5);
  topFactors.forEach(f => {
    if (f.weight >= 5) {
      findings.push(`${f.factor}: ${f.evidence[0] || 'Multiple indicators'}`);
    }
  });

  // Guilty knowledge
  guiltyKnowledge.filter(gk => gk.severity === 'critical' || gk.severity === 'high')
    .forEach(gk => {
      findings.push(`Knew: ${gk.knowledgeDescription}`);
    });

  // Major contradictions
  if (contradictions.length > 0) {
    findings.push(`${contradictions.length} statement contradictions detected`);
  }

  return findings.slice(0, 10);
}

function generateRecommendation(
  score: number,
  factors: SuspicionFactor[],
  evidenceResult: ComponentScore
): string {
  if (evidenceResult.factors.some(f => f.weight === 50)) {
    return 'PRIORITY: DNA match at crime scene. Conduct formal interview and prepare for arrest.';
  }

  if (evidenceResult.factors.some(f => f.weight === -30)) {
    return 'DNA excluded. Deprioritize unless other compelling evidence emerges.';
  }

  if (score >= 70) {
    return 'HIGH PRIORITY: Multiple strong indicators. Conduct comprehensive re-interview, verify all alibis, collect DNA sample.';
  }

  if (score >= 50) {
    return 'MEDIUM-HIGH: Significant suspicion factors. Deeper investigation warranted. Verify alibis, examine financial records, re-interview.';
  }

  if (score >= 30) {
    return 'MEDIUM: Some indicators present. Standard follow-up recommended. Verify key claims and alibi.';
  }

  if (score >= 15) {
    return 'LOW-MEDIUM: Minor indicators. Maintain as person of interest. No immediate action required.';
  }

  return 'LOW: No significant indicators at this time. Keep on file for potential re-evaluation.';
}

function determinePriorityLevel(
  score: number,
  criticalFlagCount: number,
  evidenceResult: ComponentScore
): SuspectScore['priorityLevel'] {
  if (evidenceResult.factors.some(f => f.weight === 50)) return 'critical';
  if (score >= 70 || criticalFlagCount >= 3) return 'critical';
  if (score >= 50 || criticalFlagCount >= 2) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function assessDataQuality(
  claims: PersonClaim[],
  alibis: PersonAlibi[],
  facts: AtomicFact[],
  guiltyKnowledge: GuiltyKnowledgeIndicator[]
): SuspectScore['dataQuality'] {
  const totalDataPoints = claims.length + alibis.length + facts.length + guiltyKnowledge.length;

  if (totalDataPoints >= 50) return 'comprehensive';
  if (totalDataPoints >= 20) return 'adequate';
  if (totalDataPoints >= 5) return 'partial';
  return 'insufficient';
}

function calculateConfidence(
  dataQuality: SuspectScore['dataQuality'],
  factorCount: number,
  factCount: number
): number {
  let base = 0;

  switch (dataQuality) {
    case 'comprehensive': base = 0.9; break;
    case 'adequate': base = 0.7; break;
    case 'partial': base = 0.5; break;
    case 'insufficient': base = 0.3; break;
  }

  // Adjust for number of data points
  const adjustment = Math.min(0.1, (factorCount + factCount) / 100);

  return Math.min(0.99, base + adjustment);
}

async function saveScoreToProfile(personId: string, score: SuspectScore): Promise<void> {
  await supabaseServer
    .from('person_profiles')
    .update({
      suspicion_score: score.totalScore,
      suspicion_factors: score.factors,
      opportunity_score: score.opportunityScore,
      means_score: score.meansScore,
      motive_score: score.motiveScore,
      behavior_score: score.behaviorScore,
      evidence_score: score.evidenceScore,
      updated_at: new Date().toISOString()
    })
    .eq('id', personId);
}

// ============================================================================
// AI-Enhanced Scoring (for complex cases)
// ============================================================================

export async function aiEnhancedScoring(
  caseId: string,
  personId: string,
  existingScore: SuspectScore
): Promise<SuspectScore> {
  if (!isAnthropicConfigured()) {
    return existingScore;
  }

  const client = getAnthropicClient();

  // Get additional context
  const claims = await getPersonClaims(personId);
  const guiltyKnowledge = await getGuiltyKnowledgeIndicators(personId);

  const prompt = `You are an expert cold case analyst reviewing a suspect profile.

SUSPECT: ${existingScore.personName}
ROLE: ${existingScore.role}

CURRENT SCORES:
- Opportunity: ${existingScore.opportunityScore}/25
- Means: ${existingScore.meansScore}/25
- Motive: ${existingScore.motiveScore}/25
- Behavior: ${existingScore.behaviorScore}/25
- Evidence: ${existingScore.evidenceScore}
- TOTAL: ${existingScore.totalScore}

KEY FACTORS IDENTIFIED:
${existingScore.factors.map(f => `- ${f.factor} (weight: ${f.weight}): ${f.evidence[0] || 'N/A'}`).join('\n')}

CLAIMS MADE BY THIS PERSON (${claims.length} total):
${claims.slice(0, 10).map(c => `- ${c.topic}: "${c.claimText}" ${c.isSuspicious ? '[SUSPICIOUS]' : ''}`).join('\n')}

GUILTY KNOWLEDGE INDICATORS (${guiltyKnowledge.length} total):
${guiltyKnowledge.map(gk => `- [${gk.severity.toUpperCase()}] ${gk.knowledgeDescription}`).join('\n')}

Based on this information:
1. Are there patterns I might have missed?
2. Should any scores be adjusted?
3. What are the most critical investigative next steps?
4. What is your overall assessment of this person's likelihood of involvement?

Respond in JSON format:
{
  "adjustedScores": {
    "opportunity": number (0-25),
    "means": number (0-25),
    "motive": number (0-25),
    "behavior": number (0-25)
  },
  "additionalFactors": [
    { "factor": string, "weight": number, "category": string, "evidence": [string] }
  ],
  "missedPatterns": [string],
  "criticalNextSteps": [string],
  "overallAssessment": string,
  "confidenceInScoring": number (0-1)
}`;

  try {
    const response = await client.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const aiAnalysis = JSON.parse(jsonMatch[0]);

      // Merge AI insights
      const enhancedScore: SuspectScore = {
        ...existingScore,
        opportunityScore: aiAnalysis.adjustedScores?.opportunity ?? existingScore.opportunityScore,
        meansScore: aiAnalysis.adjustedScores?.means ?? existingScore.meansScore,
        motiveScore: aiAnalysis.adjustedScores?.motive ?? existingScore.motiveScore,
        behaviorScore: aiAnalysis.adjustedScores?.behavior ?? existingScore.behaviorScore,
        factors: [
          ...existingScore.factors,
          ...(aiAnalysis.additionalFactors || [])
        ],
        keyFindings: [
          ...existingScore.keyFindings,
          ...(aiAnalysis.missedPatterns || [])
        ],
        investigativeRecommendation: aiAnalysis.criticalNextSteps?.[0] || existingScore.investigativeRecommendation,
        confidence: (existingScore.confidence + (aiAnalysis.confidenceInScoring || 0.5)) / 2
      };

      // Recalculate total
      enhancedScore.totalScore = Math.min(100,
        enhancedScore.opportunityScore +
        enhancedScore.meansScore +
        enhancedScore.motiveScore +
        enhancedScore.behaviorScore +
        enhancedScore.evidenceScore
      );

      return enhancedScore;
    }
  } catch (error) {
    console.error('AI-enhanced scoring failed:', error);
  }

  return existingScore;
}
