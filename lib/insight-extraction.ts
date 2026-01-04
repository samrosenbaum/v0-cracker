/**
 * Cross-Interview Insight Extraction for Guilty Knowledge Detection
 *
 * Based on the Lyon Sisters case pattern where a witness mentioned
 * the bodies were burned - information only the perpetrator would know.
 * This system extracts specific details from interviews and cross-references
 * them to detect "guilty knowledge" - information someone shouldn't have.
 *
 * Key insight categories:
 * 1. Knowledge of undisclosed crime scene details
 * 2. Specific knowledge of victim's final movements
 * 3. Details about evidence before it was found
 * 4. Knowledge of body location/condition
 * 5. Precise timings that wouldn't be known to innocent parties
 */

// ============================================================================
// Types and Interfaces
// ============================================================================

export interface ExtractedInsight {
  id: string;
  sourceInterviewId: string;
  speakerName: string;
  speakerRole: 'suspect' | 'witness' | 'family' | 'associate' | 'other';
  insightType: InsightType;
  detail: string;
  fullQuote: string;
  specificity: 'vague' | 'general' | 'specific' | 'highly_specific';
  howWouldTheyKnow: string; // Explanation of how they claim to know this
  alternativeExplanations: string[];
  flaggedAsGuiltyKnowledge: boolean;
  guiltyKnowledgeReason?: string;
  relatedEvidence?: string[];
  confidenceScore: number; // 0-1, how confident we are this is significant
  interviewDate: Date;
}

export type InsightType =
  | 'crime_scene_detail'
  | 'victim_movement'
  | 'victim_state'
  | 'evidence_knowledge'
  | 'timing_detail'
  | 'location_knowledge'
  | 'relationship_detail'
  | 'motive_indicator'
  | 'behavior_knowledge'
  | 'weapon_knowledge'
  | 'body_knowledge'
  | 'other';

export interface CrossReferenceResult {
  detail: string;
  insightType: InsightType;
  mentions: InsightMention[];
  publiclyKnown: boolean;
  publiclyKnownSource?: string;
  discoveryDate?: Date;
  mentionedBeforeDiscovery: InsightMention[];
  inconsistentMentions: InconsistentMention[];
  guiltyKnowledgeIndicators: GuiltyKnowledgeIndicator[];
}

export interface InsightMention {
  speakerName: string;
  speakerRole: string;
  interviewDate: Date;
  quote: string;
  specificity: ExtractedInsight['specificity'];
}

export interface InconsistentMention {
  speakers: string[];
  inconsistency: string;
  quotes: { speaker: string; quote: string }[];
}

export interface GuiltyKnowledgeIndicator {
  type: 'before_discovery' | 'unpublished_detail' | 'specific_knowledge' | 'unique_knowledge' | 'impossible_knowledge';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suspectName: string;
  evidence: string;
}

export interface InsightAnalysisResult {
  caseId: string;
  analysisDate: Date;
  totalInsightsExtracted: number;
  guiltyKnowledgeFlags: GuiltyKnowledgeFlag[];
  crossReferences: CrossReferenceResult[];
  suspectKnowledgeProfiles: SuspectKnowledgeProfile[];
  criticalFindings: CriticalFinding[];
  recommendations: InsightRecommendation[];
}

export interface GuiltyKnowledgeFlag {
  id: string;
  suspectName: string;
  insightType: InsightType;
  detail: string;
  quote: string;
  reason: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  verificationStatus: 'needs_verification' | 'verified' | 'explained' | 'unexplained';
  investigatorNotes?: string;
}

export interface SuspectKnowledgeProfile {
  name: string;
  role: string;
  totalInsights: number;
  specificInsights: number;
  guiltyKnowledgeFlags: number;
  knowledgeCategories: { type: InsightType; count: number; flagged: number }[];
  suspicionScore: number; // 0-100
  topConcerns: string[];
}

export interface CriticalFinding {
  type: 'guilty_knowledge' | 'impossible_knowledge' | 'unique_detail' | 'inconsistency';
  severity: 'critical' | 'high' | 'medium';
  summary: string;
  details: string;
  involvedParties: string[];
  actionRequired: string;
}

export interface InsightRecommendation {
  priority: number;
  action: string;
  rationale: string;
  targetPerson?: string;
}

// ============================================================================
// Insight Extraction Patterns
// ============================================================================

const INSIGHT_PATTERNS: { type: InsightType; patterns: RegExp[]; guiltyKnowledgeSignals: string[] }[] = [
  {
    type: 'crime_scene_detail',
    patterns: [
      /(?:the|at the) (?:crime )?scene (?:was|had|looked|appeared)/i,
      /(?:there was|there were|I saw|found) .{0,50}(?:blood|weapon|evidence|marks|signs)/i,
      /(?:the room|the area|the location) (?:was|had|looked)/i,
      /(?:damaged|broken|disturbed|moved|missing)/i,
    ],
    guiltyKnowledgeSignals: [
      'specific detail about crime scene not released to public',
      'knowledge of scene layout before discovery',
      'details about evidence positioning',
    ],
  },
  {
    type: 'victim_state',
    patterns: [
      /(?:she|he|the victim|the body) (?:was|had been|looked|appeared) (?:hurt|injured|dead|killed)/i,
      /(?:wounds?|injuries?|marks?|bruises?) (?:on|to) /i,
      /(?:burned|strangled|shot|stabbed|beaten|drowned)/i,
      /(?:alive|dead|unconscious|struggling)/i,
    ],
    guiltyKnowledgeSignals: [
      'specific knowledge of cause of death before autopsy release',
      'details about victim injuries not publicly known',
      'knowledge of victim state (burned, etc.) before discovery',
    ],
  },
  {
    type: 'body_knowledge',
    patterns: [
      /(?:the body|bodies|remains) (?:was|were|had been)/i,
      /(?:buried|hidden|dumped|disposed|placed)/i,
      /(?:found|discovered|located) (?:at|in|near)/i,
      /(?:decomposed|burned|dismembered)/i,
    ],
    guiltyKnowledgeSignals: [
      'knowledge of body location before discovery',
      'details about body condition not public',
      'knowledge of burial/disposal method',
    ],
  },
  {
    type: 'timing_detail',
    patterns: [
      /(?:at|around|about|exactly|precisely) \d{1,2}(?::\d{2})?\s*(?:am|pm|o\'clock)?/i,
      /(?:before|after|during|when) .{0,30}(?:happened|occurred|left|arrived)/i,
      /(?:for|about|around) \d+ (?:minutes?|hours?)/i,
      /(?:the last time|when I last|final time)/i,
    ],
    guiltyKnowledgeSignals: [
      'precise timing knowledge beyond what should be known',
      'knowledge of victim movements with unusual specificity',
      'timing that contradicts known facts',
    ],
  },
  {
    type: 'location_knowledge',
    patterns: [
      /(?:went to|was at|headed to|drove to|walked to) .{0,50}/i,
      /(?:near|by|at|in) the .{0,30}(?:park|road|building|house|car)/i,
      /(?:specific location|exact spot|particular place)/i,
      /(?:where .{0,30} happened|where .{0,30} was found)/i,
    ],
    guiltyKnowledgeSignals: [
      'knowledge of exact location before public disclosure',
      'specific route knowledge of victim',
      'details about location only perpetrator would know',
    ],
  },
  {
    type: 'evidence_knowledge',
    patterns: [
      /(?:the|a) (?:knife|gun|weapon|phone|car|keys|wallet|purse|clothing)/i,
      /(?:DNA|fingerprints?|blood|hair|fibers?)/i,
      /(?:evidence|proof|clues?)/i,
      /(?:found|discovered|recovered|collected)/i,
    ],
    guiltyKnowledgeSignals: [
      'knowledge of evidence before it was found',
      'specific details about evidence not released',
      'knowledge of what evidence was left/taken',
    ],
  },
  {
    type: 'weapon_knowledge',
    patterns: [
      /(?:used|with|using) (?:a|the) .{0,20}(?:knife|gun|weapon|bat|hammer)/i,
      /(?:caliber|blade|type of weapon)/i,
      /(?:shot|stabbed|hit|struck) .{0,20}(?:times?|wounds?)/i,
    ],
    guiltyKnowledgeSignals: [
      'knowledge of weapon type before disclosure',
      'specific details about weapon characteristics',
      'knowledge of number of wounds/shots',
    ],
  },
  {
    type: 'victim_movement',
    patterns: [
      /(?:she|he|the victim) (?:went|walked|drove|left|arrived|traveled)/i,
      /(?:on (?:her|his|their) way to|heading to|coming from)/i,
      /(?:route|path|direction|destination)/i,
      /(?:last seen|final|before (?:she|he) disappeared)/i,
    ],
    guiltyKnowledgeSignals: [
      'knowledge of victim route not publicly known',
      'details about victim plans not shared widely',
      'knowledge of victim destination',
    ],
  },
];

// ============================================================================
// Core Extraction Functions
// ============================================================================

export interface InterviewData {
  id: string;
  speakerName: string;
  speakerRole: 'suspect' | 'witness' | 'family' | 'associate' | 'other';
  interviewDate: Date;
  fullText: string;
  segments?: { text: string; timestamp?: string }[];
}

export interface CaseKnowledge {
  publiclyKnownFacts: { fact: string; disclosureDate: Date; source: string }[];
  criminallyKnownOnly: string[]; // Facts only perpetrator would know
  evidenceDiscoveryDates: { evidence: string; discoveryDate: Date }[];
}

/**
 * Extract insights from interview text
 */
export function extractInsightsFromInterview(
  interview: InterviewData,
  caseKnowledge?: CaseKnowledge
): ExtractedInsight[] {
  const insights: ExtractedInsight[] = [];

  // Guard against missing text
  if (!interview.fullText || typeof interview.fullText !== 'string') {
    return insights;
  }

  const sentences = splitIntoSentences(interview.fullText);

  for (const sentence of sentences) {
    for (const pattern of INSIGHT_PATTERNS) {
      const matches = pattern.patterns.some(p => p.test(sentence));
      if (matches) {
        const insight = createInsight(
          interview,
          sentence,
          pattern.type,
          caseKnowledge
        );
        if (insight) {
          insights.push(insight);
        }
      }
    }
  }

  return deduplicateInsights(insights);
}

function splitIntoSentences(text: string): string[] {
  // Guard against null/undefined
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Split on sentence boundaries while preserving quotes
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=["'])\s+(?=["']?[A-Z])/)
    .map(s => s.trim())
    .filter(s => s.length > 10);
}

function createInsight(
  interview: InterviewData,
  quote: string,
  type: InsightType,
  caseKnowledge?: CaseKnowledge
): ExtractedInsight | null {
  // Assess specificity
  const specificity = assessSpecificity(quote);
  if (specificity === 'vague') return null; // Skip very vague statements

  // Check for guilty knowledge
  const guiltyKnowledgeCheck = checkForGuiltyKnowledge(
    quote,
    type,
    interview.interviewDate,
    caseKnowledge
  );

  const detail = extractDetailFromQuote(quote);

  return {
    id: `insight-${interview.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sourceInterviewId: interview.id,
    speakerName: interview.speakerName,
    speakerRole: interview.speakerRole,
    insightType: type,
    detail,
    fullQuote: quote,
    specificity,
    howWouldTheyKnow: inferKnowledgeSource(interview.speakerRole, type),
    alternativeExplanations: generateAlternativeExplanations(type, interview.speakerRole),
    flaggedAsGuiltyKnowledge: guiltyKnowledgeCheck.flagged,
    guiltyKnowledgeReason: guiltyKnowledgeCheck.reason,
    relatedEvidence: [],
    confidenceScore: calculateConfidence(specificity, guiltyKnowledgeCheck.flagged),
    interviewDate: interview.interviewDate,
  };
}

function assessSpecificity(quote: string): ExtractedInsight['specificity'] {
  // Count specific indicators
  let specificityScore = 0;

  // Times
  if (/\d{1,2}:\d{2}/.test(quote)) specificityScore += 2;
  if (/\d{1,2}\s*(?:am|pm)/i.test(quote)) specificityScore += 1;

  // Specific numbers
  if (/\d+ (?:times?|wounds?|shots?|minutes?|hours?|feet|meters?|miles?)/i.test(quote)) {
    specificityScore += 2;
  }

  // Specific locations
  if (/(?:specific|exact|particular|precise)/i.test(quote)) specificityScore += 1;
  if (/\b(?:[A-Z][a-z]+ (?:Street|Road|Avenue|Park|Building|House))\b/.test(quote)) {
    specificityScore += 2;
  }

  // Specific objects
  if (/(?:blue|red|black|white|silver|gold)\s+\w+/i.test(quote)) specificityScore += 1;

  // Detailed descriptions
  if (quote.length > 150) specificityScore += 1;

  if (specificityScore >= 4) return 'highly_specific';
  if (specificityScore >= 2) return 'specific';
  if (specificityScore >= 1) return 'general';
  return 'vague';
}

function checkForGuiltyKnowledge(
  quote: string,
  type: InsightType,
  interviewDate: Date,
  caseKnowledge?: CaseKnowledge
): { flagged: boolean; reason?: string } {
  // Check if the detail matches something only the perpetrator would know
  if (caseKnowledge?.criminallyKnownOnly) {
    for (const fact of caseKnowledge.criminallyKnownOnly) {
      if (quote.toLowerCase().includes(fact.toLowerCase())) {
        return {
          flagged: true,
          reason: `Mentions "${fact}" which is information only the perpetrator would know`,
        };
      }
    }
  }

  // Check if mentioned before discovery
  if (caseKnowledge?.evidenceDiscoveryDates) {
    for (const evidence of caseKnowledge.evidenceDiscoveryDates) {
      if (
        quote.toLowerCase().includes(evidence.evidence.toLowerCase()) &&
        interviewDate < evidence.discoveryDate
      ) {
        return {
          flagged: true,
          reason: `Mentions "${evidence.evidence}" before it was discovered on ${evidence.discoveryDate.toLocaleDateString()}`,
        };
      }
    }
  }

  // Pattern-based guilty knowledge signals
  const pattern = INSIGHT_PATTERNS.find(p => p.type === type);
  if (pattern) {
    for (const signal of pattern.guiltyKnowledgeSignals) {
      // For now, flag highly specific details about sensitive topics
      if (
        (type === 'body_knowledge' || type === 'weapon_knowledge' || type === 'victim_state') &&
        quote.length > 80
      ) {
        return {
          flagged: true,
          reason: signal,
        };
      }
    }
  }

  return { flagged: false };
}

function extractDetailFromQuote(quote: string): string {
  // Extract the key detail/fact from the quote
  // Simplify to a short summary
  if (quote.length <= 100) return quote;
  return quote.slice(0, 100) + '...';
}

function inferKnowledgeSource(
  role: InterviewData['speakerRole'],
  type: InsightType
): string {
  switch (role) {
    case 'witness':
      return 'Claims to have observed or been told by someone';
    case 'family':
      return 'Family relationship may explain knowledge of victim';
    case 'suspect':
      return 'Source of knowledge requires verification';
    case 'associate':
      return 'Social connection may explain some knowledge';
    default:
      return 'Unknown source of knowledge';
  }
}

function generateAlternativeExplanations(
  type: InsightType,
  role: InterviewData['speakerRole']
): string[] {
  const explanations: string[] = [];

  switch (role) {
    case 'family':
      explanations.push('May have been told by victim before incident');
      explanations.push('May have learned from other family members');
      break;
    case 'witness':
      explanations.push('May have observed the detail directly');
      explanations.push('May have heard from first responders');
      break;
    case 'associate':
      explanations.push('May have been told by mutual acquaintances');
      break;
  }

  // Type-specific explanations
  if (type === 'location_knowledge') {
    explanations.push('May be familiar with the area');
  }
  if (type === 'timing_detail') {
    explanations.push('May be estimating or guessing');
  }

  return explanations;
}

function calculateConfidence(
  specificity: ExtractedInsight['specificity'],
  isGuiltyKnowledge: boolean
): number {
  let base = 0.3;
  if (specificity === 'general') base = 0.4;
  if (specificity === 'specific') base = 0.6;
  if (specificity === 'highly_specific') base = 0.8;
  if (isGuiltyKnowledge) base = Math.min(1, base + 0.3);
  return base;
}

function deduplicateInsights(insights: ExtractedInsight[]): ExtractedInsight[] {
  const seen = new Map<string, ExtractedInsight>();
  for (const insight of insights) {
    const key = `${insight.speakerName}-${insight.detail.slice(0, 50)}`;
    if (!seen.has(key) || insight.confidenceScore > (seen.get(key)?.confidenceScore || 0)) {
      seen.set(key, insight);
    }
  }
  return Array.from(seen.values());
}

// ============================================================================
// Cross-Reference Analysis
// ============================================================================

/**
 * Cross-reference insights across all interviews
 */
export function crossReferenceInsights(
  allInsights: ExtractedInsight[],
  caseKnowledge?: CaseKnowledge
): CrossReferenceResult[] {
  const results: CrossReferenceResult[] = [];

  // Group insights by detail (normalized)
  const detailGroups = new Map<string, ExtractedInsight[]>();
  for (const insight of allInsights) {
    const normalizedDetail = insight.detail.toLowerCase().trim();
    const existing = detailGroups.get(normalizedDetail) || [];
    existing.push(insight);
    detailGroups.set(normalizedDetail, existing);
  }

  // Analyze each group
  for (const [detail, insights] of detailGroups.entries()) {
    const mentions: InsightMention[] = insights.map(i => ({
      speakerName: i.speakerName,
      speakerRole: i.speakerRole,
      interviewDate: i.interviewDate,
      quote: i.fullQuote,
      specificity: i.specificity,
    }));

    // Check if publicly known (with null safety)
    const publicFact = caseKnowledge?.publiclyKnownFacts?.find(f =>
      f?.fact && detail.includes(f.fact.toLowerCase())
    );

    // Check for mentions before discovery (with null safety)
    const mentionedBeforeDiscovery = mentions.filter(m => {
      const discoveryEntry = caseKnowledge?.evidenceDiscoveryDates?.find(e =>
        e?.evidence && detail.includes(e.evidence.toLowerCase())
      );
      return discoveryEntry && m.interviewDate < discoveryEntry.discoveryDate;
    });

    // Check for inconsistencies
    const inconsistencies = findInconsistencies(insights);

    // Identify guilty knowledge indicators
    const indicators: GuiltyKnowledgeIndicator[] = [];

    if (mentionedBeforeDiscovery.length > 0) {
      for (const mention of mentionedBeforeDiscovery) {
        indicators.push({
          type: 'before_discovery',
          description: `${mention.speakerName} mentioned this detail before it was discovered`,
          severity: 'critical',
          suspectName: mention.speakerName,
          evidence: mention.quote,
        });
      }
    }

    // Check for unique knowledge
    const suspectsWithDetail = insights.filter(i => i.speakerRole === 'suspect');
    if (suspectsWithDetail.length === 1 && insights.length === 1) {
      indicators.push({
        type: 'unique_knowledge',
        description: `Only ${suspectsWithDetail[0].speakerName} knows this detail`,
        severity: 'high',
        suspectName: suspectsWithDetail[0].speakerName,
        evidence: suspectsWithDetail[0].fullQuote,
      });
    }

    if (insights.some(i => i.flaggedAsGuiltyKnowledge)) {
      for (const insight of insights.filter(i => i.flaggedAsGuiltyKnowledge)) {
        indicators.push({
          type: 'unpublished_detail',
          description: insight.guiltyKnowledgeReason || 'Unpublished detail known',
          severity: insight.speakerRole === 'suspect' ? 'critical' : 'high',
          suspectName: insight.speakerName,
          evidence: insight.fullQuote,
        });
      }
    }

    // Guard against empty insights array (should not happen but defensive)
    if (insights.length === 0) continue;

    results.push({
      detail,
      insightType: insights[0].insightType,
      mentions,
      publiclyKnown: !!publicFact,
      publiclyKnownSource: publicFact?.source,
      discoveryDate: caseKnowledge?.evidenceDiscoveryDates?.find(e =>
        e?.evidence && detail.includes(e.evidence.toLowerCase())
      )?.discoveryDate,
      mentionedBeforeDiscovery,
      inconsistentMentions: inconsistencies,
      guiltyKnowledgeIndicators: indicators,
    });
  }

  return results.filter(r => r.mentions.length > 0);
}

function findInconsistencies(insights: ExtractedInsight[]): InconsistentMention[] {
  const inconsistencies: InconsistentMention[] = [];

  // Compare specificity of same detail
  const highlySpecific = insights.filter(i => i.specificity === 'highly_specific');
  const vague = insights.filter(i => i.specificity === 'vague' || i.specificity === 'general');

  if (highlySpecific.length > 0 && vague.length > 0) {
    // One person knows details others don't
    inconsistencies.push({
      speakers: [...highlySpecific.map(i => i.speakerName), ...vague.map(i => i.speakerName)],
      inconsistency: 'Significant difference in detail level - some speakers have unusually specific knowledge',
      quotes: insights.map(i => ({ speaker: i.speakerName, quote: i.fullQuote })),
    });
  }

  return inconsistencies;
}

// ============================================================================
// Profile Generation
// ============================================================================

/**
 * Generate knowledge profile for each suspect
 */
export function generateSuspectKnowledgeProfiles(
  allInsights: ExtractedInsight[],
  crossRefs: CrossReferenceResult[]
): SuspectKnowledgeProfile[] {
  const profiles: SuspectKnowledgeProfile[] = [];

  // Group by speaker
  const speakerGroups = new Map<string, ExtractedInsight[]>();
  for (const insight of allInsights) {
    const existing = speakerGroups.get(insight.speakerName) || [];
    existing.push(insight);
    speakerGroups.set(insight.speakerName, existing);
  }

  for (const [name, insights] of speakerGroups.entries()) {
    const role = insights[0].speakerRole;
    const specificInsights = insights.filter(
      i => i.specificity === 'specific' || i.specificity === 'highly_specific'
    );
    const flaggedInsights = insights.filter(i => i.flaggedAsGuiltyKnowledge);

    // Count by category
    const categoryMap = new Map<InsightType, { count: number; flagged: number }>();
    for (const insight of insights) {
      const existing = categoryMap.get(insight.insightType) || { count: 0, flagged: 0 };
      existing.count++;
      if (insight.flaggedAsGuiltyKnowledge) existing.flagged++;
      categoryMap.set(insight.insightType, existing);
    }

    // Calculate suspicion score
    let suspicionScore = 0;
    if (role === 'suspect') suspicionScore += 20;
    suspicionScore += Math.min(30, specificInsights.length * 5);
    suspicionScore += Math.min(40, flaggedInsights.length * 15);

    // Check for guilty knowledge indicators in cross-refs
    const relevantIndicators = crossRefs.flatMap(cr =>
      cr.guiltyKnowledgeIndicators.filter(ind => ind.suspectName === name)
    );
    suspicionScore += Math.min(30, relevantIndicators.length * 10);

    // Top concerns
    const topConcerns: string[] = [];
    if (flaggedInsights.length > 0) {
      topConcerns.push(`${flaggedInsights.length} statement(s) flagged as potential guilty knowledge`);
    }
    if (specificInsights.length > 3) {
      topConcerns.push('Unusually detailed knowledge of case facts');
    }
    const criticalIndicators = relevantIndicators.filter(i => i.severity === 'critical');
    if (criticalIndicators.length > 0) {
      topConcerns.push(`${criticalIndicators.length} critical guilty knowledge indicator(s)`);
    }

    profiles.push({
      name,
      role,
      totalInsights: insights.length,
      specificInsights: specificInsights.length,
      guiltyKnowledgeFlags: flaggedInsights.length,
      knowledgeCategories: Array.from(categoryMap.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        flagged: data.flagged,
      })),
      suspicionScore: Math.min(100, suspicionScore),
      topConcerns,
    });
  }

  return profiles.sort((a, b) => b.suspicionScore - a.suspicionScore);
}

// ============================================================================
// Full Analysis
// ============================================================================

/**
 * Run full insight extraction and analysis
 */
export function analyzeInterviewInsights(
  interviews: InterviewData[],
  caseKnowledge?: CaseKnowledge
): InsightAnalysisResult {
  // Extract insights from all interviews
  const allInsights: ExtractedInsight[] = [];
  for (const interview of interviews) {
    const insights = extractInsightsFromInterview(interview, caseKnowledge);
    allInsights.push(...insights);
  }

  // Cross-reference
  const crossRefs = crossReferenceInsights(allInsights, caseKnowledge);

  // Generate profiles
  const profiles = generateSuspectKnowledgeProfiles(allInsights, crossRefs);

  // Collect guilty knowledge flags
  const guiltyKnowledgeFlags: GuiltyKnowledgeFlag[] = [];
  for (const crossRef of crossRefs) {
    for (const indicator of crossRef.guiltyKnowledgeIndicators) {
      guiltyKnowledgeFlags.push({
        id: `flag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        suspectName: indicator.suspectName,
        insightType: crossRef.insightType,
        detail: crossRef.detail,
        quote: indicator.evidence,
        reason: indicator.description,
        severity: indicator.severity,
        verificationStatus: 'needs_verification',
      });
    }
  }

  // Generate critical findings
  const criticalFindings: CriticalFinding[] = [];
  const criticalFlags = guiltyKnowledgeFlags.filter(f => f.severity === 'critical');
  for (const flag of criticalFlags) {
    criticalFindings.push({
      type: 'guilty_knowledge',
      severity: 'critical',
      summary: `${flag.suspectName} demonstrates potential guilty knowledge`,
      details: `${flag.reason}: "${flag.quote.slice(0, 100)}..."`,
      involvedParties: [flag.suspectName],
      actionRequired: 'Immediate re-interview required to explain knowledge source',
    });
  }

  // Generate recommendations
  const recommendations: InsightRecommendation[] = [];
  let priority = 1;

  if (criticalFlags.length > 0) {
    recommendations.push({
      priority: priority++,
      action: `Re-interview ${[...new Set(criticalFlags.map(f => f.suspectName))].join(', ')} about knowledge source`,
      rationale: 'Critical guilty knowledge indicators detected',
      targetPerson: criticalFlags[0].suspectName,
    });
  }

  const highSuspicionProfiles = profiles.filter(p => p.suspicionScore >= 60);
  for (const profile of highSuspicionProfiles) {
    recommendations.push({
      priority: priority++,
      action: `Conduct detailed interview focusing on ${profile.name}'s knowledge sources`,
      rationale: profile.topConcerns.join('; '),
      targetPerson: profile.name,
    });
  }

  return {
    caseId: 'analysis',
    analysisDate: new Date(),
    totalInsightsExtracted: allInsights.length,
    guiltyKnowledgeFlags,
    crossReferences: crossRefs,
    suspectKnowledgeProfiles: profiles,
    criticalFindings,
    recommendations,
  };
}
