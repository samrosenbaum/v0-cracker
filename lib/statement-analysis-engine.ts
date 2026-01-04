/**
 * Statement Analysis Engine
 *
 * Advanced analysis of interview statements to detect:
 * 1. Statement version diffs (side-by-side comparison with highlights)
 * 2. Story evolution over time (what changed between interviews)
 * 3. Oddly specific details (potential guilty knowledge)
 * 4. Behavioral red flags (evasion, defensiveness, over-explaining)
 * 5. Omissions and additions between versions
 * 6. Claim-to-evidence verification status
 *
 * Based on patterns from solved cold cases where fresh eyes caught:
 * - Details only the killer would know (Lyon Sisters case)
 * - Timeline inconsistencies missed in original investigation
 * - Alibis that were "cleared" but never DNA verified
 */

import Anthropic from '@anthropic-ai/sdk';

// =============================================================================
// Types
// =============================================================================

export interface StatementVersion {
  id: string;
  speakerId: string;
  speakerName: string;
  speakerRole: 'suspect' | 'witness' | 'victim_family' | 'associate' | 'other';
  statementDate: Date;
  interviewer?: string;
  versionNumber: number;
  fullText: string;
  claims: ExtractedClaim[];
  behavioralFlags: BehavioralFlag[];
  suspiciousDetails: SuspiciousDetail[];
}

export interface ExtractedClaim {
  id: string;
  type: ClaimType;
  text: string;
  originalQuote: string;
  time?: ClaimTime;
  location?: string;
  subject: string;
  action?: string;
  object?: string;
  confidence: number;
  isAlibi: boolean;
  isAccusation: boolean;
  involvesVictim: boolean;
  characterOffset: number;
}

export type ClaimType =
  | 'location_at_time'
  | 'action'
  | 'observation'
  | 'relationship'
  | 'communication'
  | 'possession'
  | 'alibi'
  | 'accusation'
  | 'denial'
  | 'emotional_state'
  | 'physical_description'
  | 'specific_detail'
  | 'knowledge_claim'
  | 'other';

export interface ClaimTime {
  originalText: string;
  normalizedTime?: string; // HH:MM format
  date?: string; // YYYY-MM-DD
  precision: 'exact' | 'approximate' | 'vague' | 'range';
  rangeStart?: string;
  rangeEnd?: string;
}

export interface BehavioralFlag {
  type: BehavioralFlagType;
  severity: 'low' | 'medium' | 'high';
  quote: string;
  explanation: string;
  psychologicalNote?: string;
}

export type BehavioralFlagType =
  | 'evasion'
  | 'memory_gaps'
  | 'over_explaining'
  | 'timeline_vagueness'
  | 'defensive'
  | 'projection'
  | 'story_change'
  | 'emotional_incongruence'
  | 'distancing_language'
  | 'rehearsed_response'
  | 'unnecessary_denial'
  | 'knowledge_slip';

export interface SuspiciousDetail {
  type: SuspiciousDetailType;
  severity: 'notable' | 'concerning' | 'critical';
  quote: string;
  reason: string;
  investigativeAction: string;
}

export type SuspiciousDetailType =
  | 'oddly_specific'           // Details only someone present would know
  | 'unprompted_knowledge'     // Knowledge volunteered without being asked
  | 'future_tense_slip'        // Speaking of victim in past tense before death known
  | 'crime_scene_detail'       // Knowledge of scene details not released
  | 'body_disposition'         // Knowledge about what happened to body
  | 'timeline_knowledge'       // Knowing exact times without explanation
  | 'motive_awareness'         // Unprompted mention of motive elements
  | 'forensic_awareness'       // Unusual knowledge of forensics/evidence;

// =============================================================================
// Statement Version Comparison
// =============================================================================

export interface StatementDiff {
  speaker: string;
  version1: StatementVersion;
  version2: StatementVersion;
  daysBetween: number;

  // Claim-level changes
  matchingClaims: ClaimMatch[];
  changedClaims: ClaimChange[];
  addedClaims: ExtractedClaim[];      // In v2 but not v1
  omittedClaims: ExtractedClaim[];    // In v1 but not v2

  // Time-specific changes
  timeChanges: TimeChange[];

  // Story evolution analysis
  storyEvolution: StoryEvolution;

  // Overall assessment
  consistencyScore: number;           // 0-1, higher = more consistent
  credibilityImpact: 'positive' | 'negative' | 'neutral';
  redFlags: string[];
  investigativeNotes: string[];
}

export interface ClaimMatch {
  claim1: ExtractedClaim;
  claim2: ExtractedClaim;
  matchType: 'exact' | 'semantically_equivalent' | 'similar';
}

export interface ClaimChange {
  claim1: ExtractedClaim;
  claim2: ExtractedClaim;
  changeType: 'time_changed' | 'location_changed' | 'detail_modified' | 'emphasis_shifted';
  originalValue: string;
  newValue: string;
  significance: 'minor' | 'moderate' | 'significant' | 'critical';
  analysis: string;
}

export interface TimeChange {
  topic: string;
  originalTime: string;
  newTime: string;
  driftMinutes: number;
  direction: 'earlier' | 'later';
  significance: string;
}

export interface StoryEvolution {
  overallNarrative: string;
  keyChanges: string[];
  addedDetails: string[];
  removedDetails: string[];
  changedEmphasis: string[];
  possibleExplanations: string[];
  concernLevel: 'low' | 'medium' | 'high' | 'critical';
}

// =============================================================================
// Clearance Tracking (Priority 3 preview)
// =============================================================================

export type ClearanceMethod =
  | 'dna_exclusion'
  | 'fingerprint_exclusion'
  | 'verified_alibi'
  | 'polygraph_passed'        // WEAK - Lyon Sisters case lesson
  | 'witness_vouched'         // WEAK - can be unreliable
  | 'no_motive_found'         // WEAK - motive can be hidden
  | 'cooperative_demeanor'    // VERY WEAK - killers can be cooperative
  | 'not_investigated';       // Never actually cleared

export interface SuspectClearance {
  suspectId: string;
  suspectName: string;
  clearanceMethod: ClearanceMethod;
  clearanceDate?: Date;
  clearedBy?: string;
  evidenceReference?: string;
  verificationLevel: 'forensic' | 'documented' | 'verbal' | 'assumed';
  needsReview: boolean;
  reviewReason?: string;
}

// =============================================================================
// Main Analysis Functions
// =============================================================================

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

/**
 * Parse a raw interview transcript into structured statement version
 */
export async function parseStatement(
  text: string,
  metadata: {
    speakerId: string;
    speakerName: string;
    speakerRole: StatementVersion['speakerRole'];
    statementDate: Date;
    interviewer?: string;
    versionNumber?: number;
    referenceDate?: Date;  // Date of incident for context
  }
): Promise<StatementVersion> {
  // Extract claims
  const claims = await extractClaims(text, metadata.speakerName, metadata.referenceDate || metadata.statementDate);

  // Detect behavioral flags
  const behavioralFlags = detectBehavioralFlags(text, metadata.speakerName);

  // Find suspicious details
  const suspiciousDetails = await detectSuspiciousDetails(text, metadata.speakerName, metadata.speakerRole);

  return {
    id: `stmt-${metadata.speakerId}-${metadata.versionNumber || 1}`,
    speakerId: metadata.speakerId,
    speakerName: metadata.speakerName,
    speakerRole: metadata.speakerRole,
    statementDate: metadata.statementDate,
    interviewer: metadata.interviewer,
    versionNumber: metadata.versionNumber || 1,
    fullText: text,
    claims,
    behavioralFlags,
    suspiciousDetails,
  };
}

/**
 * Extract all claims from statement text
 */
export async function extractClaims(
  text: string,
  speakerName: string,
  referenceDate: Date
): Promise<ExtractedClaim[]> {
  // Try AI extraction first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await extractClaimsWithAI(text, speakerName, referenceDate);
    } catch (error) {
      console.error('[Statement Analysis] AI extraction failed, using patterns:', error);
    }
  }

  // Fallback to pattern extraction
  return extractClaimsWithPatterns(text, speakerName, referenceDate);
}

/**
 * AI-powered claim extraction
 */
async function extractClaimsWithAI(
  text: string,
  speakerName: string,
  referenceDate: Date
): Promise<ExtractedClaim[]> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `You are analyzing an interview statement from a criminal investigation. Extract ALL factual claims made by the speaker.

SPEAKER: ${speakerName}
REFERENCE DATE: ${referenceDate.toISOString().split('T')[0]}

STATEMENT:
${text}

Extract each claim with:
1. type: One of: location_at_time, action, observation, relationship, communication, possession, alibi, accusation, denial, emotional_state, physical_description, specific_detail, knowledge_claim, other
2. text: Normalized claim
3. originalQuote: Exact quote from statement
4. time: { originalText, normalizedTime (HH:MM), date (YYYY-MM-DD), precision, rangeStart, rangeEnd } if mentioned
5. location: Place name if mentioned
6. subject: Who/what the claim is about
7. action: What happened
8. object: Target of action if any
9. confidence: 0-1 extraction confidence
10. isAlibi: true if this establishes whereabouts
11. isAccusation: true if accusing someone
12. involvesVictim: true if mentions the victim
13. characterOffset: Approximate position in text

Pay special attention to:
- ODDLY SPECIFIC DETAILS that seem unnecessary (potential guilty knowledge)
- TIMELINE CLAIMS with exact times
- KNOWLEDGE that wasn't asked about but was volunteered

Return JSON array. Example:
[{
  "type": "location_at_time",
  "text": "Speaker was at O'Malley's bar from 4:30 PM to 6 PM",
  "originalQuote": "I was at O'Malley's that afternoon. Got there around 4:30, left maybe 6, 6:15",
  "time": { "originalText": "around 4:30, left maybe 6, 6:15", "normalizedTime": "16:30", "precision": "approximate", "rangeStart": "16:30", "rangeEnd": "18:15" },
  "location": "O'Malley's bar",
  "subject": "${speakerName}",
  "action": "was located at",
  "confidence": 0.9,
  "isAlibi": true,
  "isAccusation": false,
  "involvesVictim": false,
  "characterOffset": 0
}]

Return ONLY the JSON array.`
    }],
  });

  const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

  try {
    const claims = JSON.parse(responseText);
    return Array.isArray(claims) ? claims.map((c: any, i: number) => ({
      id: `claim-${i}`,
      ...c
    })) : [];
  } catch {
    console.error('[Statement Analysis] Failed to parse AI response');
    return [];
  }
}

/**
 * Pattern-based claim extraction (fallback)
 */
function extractClaimsWithPatterns(
  text: string,
  speakerName: string,
  referenceDate: Date
): ExtractedClaim[] {
  const claims: ExtractedClaim[] = [];
  let claimId = 0;

  // Split into sentences for analysis
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

  // Location patterns
  const locationPatterns = [
    { regex: /I was (?:at|in) (?:the |my )?([^,.\n]+?)(?:\s+(?:at|around|from|until))?/gi, type: 'location_at_time' as ClaimType },
    { regex: /I went to (?:the |my )?([^,.\n]+)/gi, type: 'action' as ClaimType },
    { regex: /I left (?:the |my )?([^,.\n]+)/gi, type: 'action' as ClaimType },
    { regex: /I arrived at (?:the |my )?([^,.\n]+)/gi, type: 'action' as ClaimType },
  ];

  for (const { regex, type } of locationPatterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      const timeMatch = text.slice(match.index, match.index + 150).match(
        /(?:at |around |about |approximately )?(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?)/
      );

      claims.push({
        id: `claim-${claimId++}`,
        type,
        text: `${speakerName} ${match[0].replace(/^I /i, '')}`,
        originalQuote: match[0],
        location: match[1].trim(),
        time: timeMatch ? {
          originalText: timeMatch[0],
          normalizedTime: parseTimeToHHMM(timeMatch[1]),
          precision: timeMatch[0].toLowerCase().includes('around') ? 'approximate' : 'exact'
        } : undefined,
        subject: speakerName,
        action: type === 'location_at_time' ? 'was at' : match[0].match(/went|left|arrived/i)?.[0] || 'was at',
        confidence: 0.7,
        isAlibi: type === 'location_at_time',
        isAccusation: false,
        involvesVictim: false,
        characterOffset: match.index,
      });
    }
  }

  // Observation patterns
  const observationPatterns = [
    /I saw ([^,.]+)/gi,
    /I noticed ([^,.]+)/gi,
    /I heard ([^,.]+)/gi,
    /I observed ([^,.]+)/gi,
  ];

  for (const regex of observationPatterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      claims.push({
        id: `claim-${claimId++}`,
        type: 'observation',
        text: `${speakerName} observed: ${match[1].trim()}`,
        originalQuote: match[0],
        subject: speakerName,
        action: 'observed',
        object: match[1].trim(),
        confidence: 0.7,
        isAlibi: false,
        isAccusation: false,
        involvesVictim: match[1].toLowerCase().includes('sarah') || match[1].toLowerCase().includes('victim'),
        characterOffset: match.index,
      });
    }
  }

  // Time reference patterns
  const timePatterns = [
    /(?:at |around |about |approximately )(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM|a\.m\.|p\.m\.)?)/gi,
  ];

  for (const regex of timePatterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Get surrounding context
      const start = Math.max(0, match.index - 50);
      const end = Math.min(text.length, match.index + match[0].length + 50);
      const context = text.slice(start, end);

      claims.push({
        id: `claim-${claimId++}`,
        type: 'specific_detail',
        text: `Time reference: ${match[0]}`,
        originalQuote: context.trim(),
        time: {
          originalText: match[0],
          normalizedTime: parseTimeToHHMM(match[1]),
          precision: match[0].toLowerCase().includes('around') ? 'approximate' : 'exact'
        },
        subject: speakerName,
        confidence: 0.6,
        isAlibi: false,
        isAccusation: false,
        involvesVictim: false,
        characterOffset: match.index,
      });
    }
  }

  // Communication patterns
  const commPatterns = [
    /I (?:called|texted|messaged|spoke (?:to|with)|talked to) ([^,.]+)/gi,
  ];

  for (const regex of commPatterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      claims.push({
        id: `claim-${claimId++}`,
        type: 'communication',
        text: `${speakerName} communicated with ${match[1].trim()}`,
        originalQuote: match[0],
        subject: speakerName,
        action: 'communicated with',
        object: match[1].trim(),
        confidence: 0.7,
        isAlibi: false,
        isAccusation: false,
        involvesVictim: match[1].toLowerCase().includes('sarah') || match[1].toLowerCase().includes('victim'),
        characterOffset: match.index,
      });
    }
  }

  // Accusation patterns
  const accusationPatterns = [
    /you (?:need to|should) (?:look at|investigate|talk to) ([^,.]+)/gi,
    /([A-Z][a-z]+ [A-Z][a-z]+) (?:did it|killed|murdered|was responsible)/gi,
    /I think ([^,.]+) (?:did|was|is)/gi,
  ];

  for (const regex of accusationPatterns) {
    let match;
    while ((match = regex.exec(text)) !== null) {
      claims.push({
        id: `claim-${claimId++}`,
        type: 'accusation',
        text: `${speakerName} suggested investigating ${match[1].trim()}`,
        originalQuote: match[0],
        subject: speakerName,
        action: 'accused/suggested',
        object: match[1].trim(),
        confidence: 0.8,
        isAlibi: false,
        isAccusation: true,
        involvesVictim: false,
        characterOffset: match.index,
      });
    }
  }

  return claims;
}

/**
 * Detect behavioral red flags in statement
 */
export function detectBehavioralFlags(text: string, speakerName: string): BehavioralFlag[] {
  const flags: BehavioralFlag[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 5);

  const flagPatterns: Array<{
    type: BehavioralFlagType;
    patterns: RegExp[];
    severity: 'low' | 'medium' | 'high';
    explanation: string;
    psychNote?: string;
  }> = [
    {
      type: 'evasion',
      patterns: [/don't recall/i, /can't remember/i, /not sure/i, /I guess/i, /memory is fuzzy/i, /things are blurry/i],
      severity: 'medium',
      explanation: 'Memory gaps or evasive responses about key events',
      psychNote: 'Selective memory issues around critical events may indicate deception'
    },
    {
      type: 'over_explaining',
      patterns: [/let me explain/i, /to be honest/i, /honestly/i, /I swear/i, /truthfully/i, /believe me/i],
      severity: 'medium',
      explanation: 'Excessive emphasis on truthfulness',
      psychNote: 'Over-emphasis on honesty can indicate awareness of deception'
    },
    {
      type: 'timeline_vagueness',
      patterns: [/around/i, /maybe/i, /approximately/i, /sometime/i, /I think it was/i, /probably/i],
      severity: 'low',
      explanation: 'Imprecise timing when specifics would be expected',
    },
    {
      type: 'defensive',
      patterns: [/why would I/i, /you think/i, /stop asking/i, /already told you/i, /what are you implying/i],
      severity: 'high',
      explanation: 'Defensive reactions to routine questions',
      psychNote: 'Defensiveness to neutral questions may indicate guilt awareness'
    },
    {
      type: 'projection',
      patterns: [/you need to look at/i, /you should talk to/i, /they must have/i, /someone else/i, /what about/i],
      severity: 'medium',
      explanation: 'Redirecting focus to other suspects without evidence',
      psychNote: 'Unprompted deflection may indicate knowledge of guilt'
    },
    {
      type: 'story_change',
      patterns: [/I need to correct/i, /actually/i, /I was mistaken/i, /I meant to say/i, /let me clarify/i],
      severity: 'high',
      explanation: 'Changing previous statements',
      psychNote: 'Story modifications may indicate original lie being refined'
    },
    {
      type: 'distancing_language',
      patterns: [/that person/i, /the body/i, /the deceased/i, /that woman/i, /the victim/i],
      severity: 'medium',
      explanation: 'Using impersonal terms for someone they knew',
      psychNote: 'Emotional distancing from victim may indicate guilt'
    },
    {
      type: 'unnecessary_denial',
      patterns: [/I didn't do anything/i, /I'm not a killer/i, /I would never/i, /I'm innocent/i],
      severity: 'medium',
      explanation: 'Denying things not yet accused of',
      psychNote: 'Preemptive denial of unasked questions is a classic deception indicator'
    },
    {
      type: 'rehearsed_response',
      patterns: [/like I said before/i, /as I mentioned/i, /I've already explained/i],
      severity: 'low',
      explanation: 'Responses that sound memorized or practiced',
    },
    {
      type: 'knowledge_slip',
      patterns: [/before she died/i, /when she was killed/i, /after the murder/i, /where the body/i],
      severity: 'high',
      explanation: 'Knowledge of details not yet disclosed by investigators',
      psychNote: 'CRITICAL: Knowledge only perpetrator would have - Lyon Sisters breakthrough pattern'
    },
  ];

  for (const sentence of sentences) {
    for (const flagDef of flagPatterns) {
      for (const pattern of flagDef.patterns) {
        if (pattern.test(sentence)) {
          // Check if we already flagged this sentence for this type
          if (!flags.some(f => f.type === flagDef.type && f.quote === sentence.trim())) {
            flags.push({
              type: flagDef.type,
              severity: flagDef.severity,
              quote: sentence.trim(),
              explanation: flagDef.explanation,
              psychologicalNote: flagDef.psychNote,
            });
          }
          break; // Only flag once per pattern type per sentence
        }
      }
    }
  }

  return flags;
}

/**
 * Detect suspiciously specific details (guilty knowledge patterns)
 * This is the "Lyon Sisters" pattern - details only someone present would know
 */
export async function detectSuspiciousDetails(
  text: string,
  speakerName: string,
  speakerRole: StatementVersion['speakerRole']
): Promise<SuspiciousDetail[]> {
  const details: SuspiciousDetail[] = [];

  // Pattern-based detection
  const suspiciousPatterns: Array<{
    type: SuspiciousDetailType;
    patterns: RegExp[];
    severity: 'notable' | 'concerning' | 'critical';
    reason: string;
    action: string;
  }> = [
    {
      type: 'oddly_specific',
      patterns: [
        /burned/i,
        /strangled/i,
        /stabbed \d+ times/i,
        /buried/i,
        /disposed/i,
        /wrapped in/i,
        /tied with/i,
      ],
      severity: 'critical',
      reason: 'Speaker knows specific details about what happened to victim/body',
      action: 'IMMEDIATE: Verify how speaker knows this. Was it disclosed publicly?'
    },
    {
      type: 'timeline_knowledge',
      patterns: [
        /exactly \d{1,2}:\d{2}/i,
        /at precisely/i,
        /I know it was \d/i,
      ],
      severity: 'concerning',
      reason: 'Unusually precise time knowledge without explanation',
      action: 'Ask how they know the exact time. Check against phone/surveillance records.'
    },
    {
      type: 'crime_scene_detail',
      patterns: [
        /the door was/i,
        /the window was/i,
        /found near/i,
        /the keys were/i,
        /her purse was/i,
        /the phone was/i,
      ],
      severity: 'concerning',
      reason: 'Knowledge of crime scene details',
      action: 'Verify if these details were publicly released. If not, critical red flag.'
    },
    {
      type: 'unprompted_knowledge',
      patterns: [
        /I assume/i,
        /must have been/i,
        /probably happened/i,
        /they would have/i,
      ],
      severity: 'notable',
      reason: 'Volunteering theories without being asked',
      action: 'Explore why they are speculating. May reveal knowledge.'
    },
    {
      type: 'future_tense_slip',
      patterns: [
        /she was a good/i,  // Past tense before death known
        /she used to/i,
        /she always/i,
      ],
      severity: 'notable',
      reason: 'Speaking of victim in past tense (verify timing)',
      action: 'Check if statement was made before or after death was publicly known.'
    },
  ];

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);

  for (const sentence of sentences) {
    for (const patternDef of suspiciousPatterns) {
      for (const pattern of patternDef.patterns) {
        if (pattern.test(sentence)) {
          // Don't flag if it's clearly the person quoting what police told them
          if (/police said|detective told|investigator mentioned/i.test(sentence)) {
            continue;
          }

          details.push({
            type: patternDef.type,
            severity: patternDef.severity,
            quote: sentence.trim(),
            reason: patternDef.reason,
            investigativeAction: patternDef.action,
          });
          break;
        }
      }
    }
  }

  // For suspects, also look for specific assumption patterns
  if (speakerRole === 'suspect') {
    // Look for assumptions about what happened
    const assumptionMatch = text.match(/(?:I assumed|I figured|I thought maybe)[^.]+/gi);
    if (assumptionMatch) {
      for (const match of assumptionMatch) {
        details.push({
          type: 'unprompted_knowledge',
          severity: 'concerning',
          quote: match,
          reason: 'Suspect making assumptions that may reveal knowledge',
          investigativeAction: 'Press on how/why they made this assumption. What led them to this conclusion?'
        });
      }
    }
  }

  return details;
}

/**
 * Compare two statement versions and produce detailed diff
 */
export async function compareStatements(
  version1: StatementVersion,
  version2: StatementVersion
): Promise<StatementDiff> {
  const daysBetween = Math.abs(
    version2.statementDate.getTime() - version1.statementDate.getTime()
  ) / (1000 * 60 * 60 * 24);

  // Match claims between versions
  const { matching, changed, added, omitted } = matchClaims(version1.claims, version2.claims);

  // Analyze time changes specifically
  const timeChanges = analyzeTimeChanges(version1.claims, version2.claims);

  // Analyze story evolution
  const storyEvolution = analyzeStoryEvolution(version1, version2, matching, changed, added, omitted);

  // Calculate consistency score
  const totalClaims = version1.claims.length + version2.claims.length;
  const matchingWeight = matching.length * 2;
  const timeDriftCount = timeChanges.filter(t => t.driftMinutes > 30).length;
  const rawConsistencyScore = totalClaims > 0
    ? matchingWeight / totalClaims - (changed.length * 0.1) - (timeDriftCount * 0.15)
    : 1;
  const consistencyScore = Math.max(0, Math.min(1, rawConsistencyScore));

  // Determine credibility impact
  let credibilityImpact: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (changed.filter(c => c.significance === 'critical').length > 0) {
    credibilityImpact = 'negative';
  } else if (timeChanges.filter(t => t.driftMinutes > 60).length > 0) {
    credibilityImpact = 'negative';
  } else if (consistencyScore > 0.85) {
    credibilityImpact = 'positive';
  }

  // Compile red flags
  const redFlags: string[] = [];

  for (const change of changed) {
    if (change.significance === 'critical' || change.significance === 'significant') {
      redFlags.push(`${change.changeType}: ${change.originalValue} → ${change.newValue}`);
    }
  }

  for (const timeChange of timeChanges) {
    if (timeChange.driftMinutes > 30) {
      redFlags.push(`Timeline shift: ${timeChange.topic} moved ${timeChange.driftMinutes} minutes ${timeChange.direction}`);
    }
  }

  if (omitted.length > 0) {
    redFlags.push(`${omitted.length} claim(s) from first interview not repeated`);
  }

  // Investigative notes
  const investigativeNotes: string[] = [];

  if (timeChanges.length > 0) {
    investigativeNotes.push(`Re-interview focusing on timeline. ${timeChanges.length} time discrepancies detected.`);
  }

  if (added.length > 3) {
    investigativeNotes.push(`New details added in second interview. Ask why these weren't mentioned before.`);
  }

  // Guard against undefined suspiciousDetails arrays
  const susp1 = Array.isArray(version1.suspiciousDetails) ? version1.suspiciousDetails : [];
  const susp2 = Array.isArray(version2.suspiciousDetails) ? version2.suspiciousDetails : [];
  if (susp1.length > 0 || susp2.length > 0) {
    const allSuspicious = [...susp1, ...susp2];
    const critical = allSuspicious.filter(d => d.severity === 'critical');
    if (critical.length > 0) {
      investigativeNotes.push(`CRITICAL: ${critical.length} suspicious detail(s) detected that may indicate guilty knowledge.`);
    }
  }

  return {
    speaker: version1.speakerName,
    version1,
    version2,
    daysBetween,
    matchingClaims: matching,
    changedClaims: changed,
    addedClaims: added,
    omittedClaims: omitted,
    timeChanges,
    storyEvolution,
    consistencyScore,
    credibilityImpact,
    redFlags,
    investigativeNotes,
  };
}

/**
 * Match claims between two statement versions
 */
function matchClaims(
  claims1: ExtractedClaim[],
  claims2: ExtractedClaim[]
): {
  matching: ClaimMatch[];
  changed: ClaimChange[];
  added: ExtractedClaim[];
  omitted: ExtractedClaim[];
} {
  const matching: ClaimMatch[] = [];
  const changed: ClaimChange[] = [];
  const matched1 = new Set<string>();
  const matched2 = new Set<string>();

  // First pass: find exact and semantic matches
  for (const c1 of claims1) {
    for (const c2 of claims2) {
      if (matched2.has(c2.id)) continue;

      const similarity = claimSimilarity(c1, c2);

      if (similarity === 'exact' || similarity === 'semantically_equivalent') {
        matching.push({ claim1: c1, claim2: c2, matchType: similarity });
        matched1.add(c1.id);
        matched2.add(c2.id);
        break;
      } else if (similarity === 'similar' && c1.type === c2.type) {
        // These are related claims with changes
        const change = analyzeClaimChange(c1, c2);
        if (change) {
          changed.push(change);
          matched1.add(c1.id);
          matched2.add(c2.id);
        }
        break;
      }
    }
  }

  // Find added and omitted claims
  const added = claims2.filter(c => !matched2.has(c.id));
  const omitted = claims1.filter(c => !matched1.has(c.id));

  return { matching, changed, added, omitted };
}

/**
 * Calculate similarity between two claims
 */
function claimSimilarity(c1: ExtractedClaim, c2: ExtractedClaim): 'exact' | 'semantically_equivalent' | 'similar' | 'different' {
  // Same type check
  if (c1.type !== c2.type) {
    // Some types are related
    const relatedTypes = [
      ['location_at_time', 'alibi'],
      ['action', 'observation'],
    ];
    const areRelated = relatedTypes.some(group => group.includes(c1.type) && group.includes(c2.type));
    if (!areRelated) return 'different';
  }

  // Exact match check
  if (c1.text.toLowerCase() === c2.text.toLowerCase()) {
    return 'exact';
  }

  // Check for same subject + action + location combination
  if (c1.subject === c2.subject && c1.action === c2.action && c1.location === c2.location) {
    // Check time
    if (c1.time && c2.time) {
      const t1 = c1.time.normalizedTime || c1.time.originalText;
      const t2 = c2.time.normalizedTime || c2.time.originalText;
      if (t1 === t2) {
        return 'semantically_equivalent';
      } else {
        return 'similar'; // Same place, different time
      }
    }
    return 'semantically_equivalent';
  }

  // Check for same location with different details
  if (c1.location && c2.location) {
    const loc1 = c1.location.toLowerCase();
    const loc2 = c2.location.toLowerCase();
    if (loc1.includes(loc2) || loc2.includes(loc1)) {
      return 'similar';
    }
  }

  // Word overlap check
  const words1 = new Set(c1.text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const words2 = new Set(c2.text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  const intersection = [...words1].filter(w => words2.has(w));
  const overlap = intersection.length / Math.max(words1.size, words2.size);

  if (overlap > 0.5) return 'similar';

  return 'different';
}

/**
 * Analyze what changed between two similar claims
 */
function analyzeClaimChange(c1: ExtractedClaim, c2: ExtractedClaim): ClaimChange | null {
  let changeType: ClaimChange['changeType'] = 'detail_modified';
  let originalValue = '';
  let newValue = '';
  let significance: ClaimChange['significance'] = 'minor';

  // Time change
  if (c1.time && c2.time) {
    const t1 = c1.time.normalizedTime || c1.time.originalText;
    const t2 = c2.time.normalizedTime || c2.time.originalText;
    if (t1 !== t2) {
      changeType = 'time_changed';
      originalValue = c1.time.originalText;
      newValue = c2.time.originalText;

      // Calculate time drift
      if (c1.time.normalizedTime && c2.time.normalizedTime) {
        const drift = Math.abs(timeToMinutes(c1.time.normalizedTime) - timeToMinutes(c2.time.normalizedTime));
        if (drift > 60) significance = 'critical';
        else if (drift > 30) significance = 'significant';
        else if (drift > 15) significance = 'moderate';
      } else {
        significance = 'moderate'; // Can't calculate drift, be cautious
      }
    }
  }

  // Location change
  if (c1.location && c2.location && c1.location.toLowerCase() !== c2.location.toLowerCase()) {
    changeType = 'location_changed';
    originalValue = c1.location;
    newValue = c2.location;
    significance = 'significant';
  }

  if (!originalValue) {
    // Generic detail change
    originalValue = c1.originalQuote.slice(0, 100);
    newValue = c2.originalQuote.slice(0, 100);
  }

  return {
    claim1: c1,
    claim2: c2,
    changeType,
    originalValue,
    newValue,
    significance,
    analysis: `${changeType}: Changed from "${originalValue}" to "${newValue}"`,
  };
}

/**
 * Analyze time changes between statement versions
 */
function analyzeTimeChanges(claims1: ExtractedClaim[], claims2: ExtractedClaim[]): TimeChange[] {
  const changes: TimeChange[] = [];

  // Group time-related claims by topic/action
  const timeClaims1 = claims1.filter(c => c.time?.normalizedTime);
  const timeClaims2 = claims2.filter(c => c.time?.normalizedTime);

  for (const c1 of timeClaims1) {
    // Find corresponding claim in version 2
    const corresponding = timeClaims2.find(c2 =>
      c2.action === c1.action ||
      c2.location === c1.location ||
      (c2.subject === c1.subject && c2.type === c1.type)
    );

    if (corresponding && c1.time?.normalizedTime && corresponding.time?.normalizedTime) {
      const mins1 = timeToMinutes(c1.time.normalizedTime);
      const mins2 = timeToMinutes(corresponding.time.normalizedTime);
      const drift = mins2 - mins1;

      if (Math.abs(drift) >= 5) { // At least 5 minute difference
        changes.push({
          topic: c1.action || c1.location || c1.text.slice(0, 50),
          originalTime: c1.time.originalText,
          newTime: corresponding.time.originalText,
          driftMinutes: Math.abs(drift),
          direction: drift > 0 ? 'later' : 'earlier',
          significance: Math.abs(drift) > 60
            ? 'CRITICAL: Over 1 hour difference'
            : Math.abs(drift) > 30
              ? 'Significant: 30+ minute shift'
              : 'Minor timing adjustment',
        });
      }
    }
  }

  return changes;
}

/**
 * Analyze how the overall story evolved between versions
 */
function analyzeStoryEvolution(
  version1: StatementVersion,
  version2: StatementVersion,
  matching: ClaimMatch[],
  changed: ClaimChange[],
  added: ExtractedClaim[],
  omitted: ExtractedClaim[]
): StoryEvolution {
  const keyChanges: string[] = [];
  const addedDetails: string[] = [];
  const removedDetails: string[] = [];
  const changedEmphasis: string[] = [];
  const possibleExplanations: string[] = [];

  // Analyze significant changes
  for (const change of changed) {
    if (change.significance === 'critical' || change.significance === 'significant') {
      keyChanges.push(change.analysis);
    }
  }

  // Analyze additions
  for (const claim of added) {
    if (claim.isAlibi) {
      addedDetails.push(`NEW ALIBI: ${claim.text}`);
    } else if (claim.isAccusation) {
      addedDetails.push(`NEW ACCUSATION: ${claim.text}`);
    } else {
      addedDetails.push(claim.text);
    }
  }

  // Analyze omissions
  for (const claim of omitted) {
    if (claim.isAlibi) {
      removedDetails.push(`OMITTED ALIBI: ${claim.text}`);
    } else {
      removedDetails.push(claim.text);
    }
  }

  // Determine concern level
  let concernLevel: StoryEvolution['concernLevel'] = 'low';

  const criticalChanges = changed.filter(c => c.significance === 'critical').length;
  const significantChanges = changed.filter(c => c.significance === 'significant').length;
  const alibiChanges = changed.filter(c => c.claim1.isAlibi).length;

  if (criticalChanges > 0 || alibiChanges > 0) {
    concernLevel = 'critical';
    possibleExplanations.push('Story changes in alibi or critical details warrant serious investigation');
  } else if (significantChanges > 2) {
    concernLevel = 'high';
    possibleExplanations.push('Multiple significant changes between interviews');
  } else if (omitted.length > 3 && added.length > 3) {
    concernLevel = 'medium';
    possibleExplanations.push('Story restructured - may indicate rehearsal or memory reconstruction');
  }

  // Natural explanations to consider
  if (concernLevel !== 'critical') {
    possibleExplanations.push('Memory naturally degrades over time');
    possibleExplanations.push('Stress during first interview may have affected recall');
  }

  return {
    overallNarrative: concernLevel === 'critical'
      ? `CRITICAL: ${version1.speakerName}'s story has significant inconsistencies between interviews.`
      : concernLevel === 'high'
        ? `${version1.speakerName}'s account shows notable changes that require follow-up.`
        : `${version1.speakerName}'s account is largely consistent with minor variations.`,
    keyChanges,
    addedDetails,
    removedDetails,
    changedEmphasis,
    possibleExplanations,
    concernLevel,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

function parseTimeToHHMM(timeStr: string): string | undefined {
  const cleaned = timeStr.toLowerCase().replace(/\./g, '').trim();

  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return undefined;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function timeToMinutes(hhmmTime: string): number {
  if (!hhmmTime || !hhmmTime.includes(':')) {
    return NaN;
  }
  const parts = hhmmTime.split(':').map(Number);
  const hours = parts[0];
  const minutes = parts[1] ?? 0;
  if (isNaN(hours) || isNaN(minutes)) {
    return NaN;
  }
  return hours * 60 + minutes;
}

/**
 * Evaluate if a suspect clearance is weak and needs review
 */
export function evaluateClearance(clearance: SuspectClearance): {
  isWeak: boolean;
  reason: string;
  recommendation: string;
} {
  const weakMethods: ClearanceMethod[] = [
    'polygraph_passed',
    'witness_vouched',
    'no_motive_found',
    'cooperative_demeanor',
    'not_investigated'
  ];

  if (weakMethods.includes(clearance.clearanceMethod)) {
    let reason = '';
    let recommendation = '';

    switch (clearance.clearanceMethod) {
      case 'polygraph_passed':
        reason = 'Polygraph is not reliable. 1979 Riverside case: suspect passed polygraph but was later identified by DNA.';
        recommendation = 'Run DNA comparison if evidence available. Polygraph does not exclude.';
        break;
      case 'witness_vouched':
        reason = 'Witness alibi can be false. Witnesses lie to protect loved ones.';
        recommendation = 'Verify alibi with independent evidence (cameras, transactions, cell data).';
        break;
      case 'no_motive_found':
        reason = 'Motive may be hidden or unknown to investigators.';
        recommendation = 'Dig deeper into relationship with victim. Financial records, communications.';
        break;
      case 'cooperative_demeanor':
        reason = 'Cooperation does not indicate innocence. Many killers are cooperative.';
        recommendation = 'This should never be a clearance factor. Review evidence only.';
        break;
      case 'not_investigated':
        reason = 'Suspect was never actually investigated or cleared.';
        recommendation = 'CRITICAL: Investigate this person. They were never excluded.';
        break;
    }

    return { isWeak: true, reason, recommendation };
  }

  if (clearance.verificationLevel === 'verbal' || clearance.verificationLevel === 'assumed') {
    return {
      isWeak: true,
      reason: `Clearance based on ${clearance.verificationLevel} verification only.`,
      recommendation: 'Obtain documented verification of clearance evidence.'
    };
  }

  return {
    isWeak: false,
    reason: 'Clearance appears sound.',
    recommendation: 'No immediate action needed.'
  };
}

