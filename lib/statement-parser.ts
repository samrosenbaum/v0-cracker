/**
 * Statement Parser
 *
 * Parses interview transcripts and statements to extract structured claims.
 * Uses AI for complex parsing with fallback patterns for common claim types.
 *
 * Key features:
 * - Extract claims about locations, times, actions, relationships
 * - Normalize time references to absolute timestamps
 * - Link claims to canonical entities
 * - Prepare claims for inconsistency detection
 */

import { supabaseServer } from './supabase-server';
import Anthropic from '@anthropic-ai/sdk';
import { resolveEntity, EntityMatch, UnresolvedEntity } from './entity-resolution';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export type ClaimType =
  | 'location_at_time'
  | 'action_performed'
  | 'observation'
  | 'relationship'
  | 'possession'
  | 'communication'
  | 'alibi'
  | 'accusation'
  | 'denial'
  | 'time_reference'
  | 'physical_description'
  | 'emotional_state'
  | 'other';

export type TimePrecision = 'exact' | 'approximate' | 'range' | 'relative' | 'vague';
export type LocationPrecision = 'exact_address' | 'place_name' | 'area' | 'city' | 'vague';
export type VerificationStatus = 'verified' | 'unverified' | 'contradicted' | 'partially_verified' | 'false';

export interface Statement {
  id: string;
  caseId: string;
  documentId?: string;
  speakerEntityId?: string;
  speakerName: string;
  speakerRole?: string;
  statementType: string;
  statementDate?: Date;
  statementTime?: string;
  interviewer?: string;
  location?: string;
  durationMinutes?: number;
  versionNumber: number;
  previousStatementId?: string;
  fullText: string;
  summary?: string;
  claimExtractionStatus: 'pending' | 'processing' | 'completed' | 'failed';
  claimsExtractedCount: number;
  credibilityScore?: number;
  consistencyScore?: number;
}

export interface StatementClaim {
  id?: string;
  statementId: string;
  caseId: string;
  claimType: ClaimType;
  claimText: string;
  originalText: string;
  subjectEntityId?: string;
  subjectText?: string;
  predicate?: string;
  objectEntityId?: string;
  objectText?: string;
  claimedDate?: Date;
  claimedTime?: string;
  claimedDatetime?: Date;
  timePrecision?: TimePrecision;
  timeRangeStart?: Date;
  timeRangeEnd?: Date;
  timeOriginalText?: string;
  claimedLocation?: string;
  locationEntityId?: string;
  locationPrecision?: LocationPrecision;
  extractionConfidence: number;
  verificationStatus: VerificationStatus;
  verifiedByEvidence?: string;
  characterOffset?: number;
  pageNumber?: number;
  isAlibiClaim: boolean;
  isAccusatory: boolean;
  involvesVictim: boolean;
}

export interface ParsedStatement {
  statement: Statement;
  claims: StatementClaim[];
  unresolvedEntities: UnresolvedEntity[];
  timeline: ClaimTimelineEntry[];
  summary: string;
  confidence: number;
}

export interface ClaimTimelineEntry {
  datetime: Date;
  precision: TimePrecision;
  claimId?: string;
  description: string;
  location?: string;
  isVerified: boolean;
}

export interface AIExtractedClaim {
  claim_type: ClaimType;
  claim_text: string;
  original_text: string;
  subject: string;
  predicate: string;
  object?: string;
  time?: {
    text: string;
    date?: string;
    time?: string;
    precision: TimePrecision;
    range_start?: string;
    range_end?: string;
  };
  location?: {
    text: string;
    precision: LocationPrecision;
  };
  confidence: number;
  is_alibi: boolean;
  is_accusatory: boolean;
  involves_victim: boolean;
}

/**
 * Create a new statement record
 */
export async function createStatement(
  caseId: string,
  data: {
    documentId?: string;
    speakerName: string;
    speakerRole?: string;
    statementType?: string;
    statementDate?: Date;
    interviewer?: string;
    location?: string;
    fullText: string;
  }
): Promise<Statement> {
  // Check for previous statements from this speaker
  let versionNumber = 1;
  let previousStatementId: string | undefined;

  if (data.speakerName) {
    const { data: prevStatements } = await supabaseServer
      .from('statements')
      .select('id, version_number')
      .eq('case_id', caseId)
      .ilike('speaker_name', data.speakerName)
      .order('version_number', { ascending: false })
      .limit(1);

    if (prevStatements && prevStatements.length > 0) {
      versionNumber = prevStatements[0].version_number + 1;
      previousStatementId = prevStatements[0].id;
    }
  }

  const { data: statement, error } = await supabaseServer
    .from('statements')
    .insert({
      case_id: caseId,
      document_id: data.documentId,
      speaker_name: data.speakerName,
      speaker_role: data.speakerRole || 'unknown',
      statement_type: data.statementType || 'interview',
      statement_date: data.statementDate?.toISOString().split('T')[0],
      interviewer: data.interviewer,
      location: data.location,
      full_text: data.fullText,
      version_number: versionNumber,
      previous_statement_id: previousStatementId,
      claim_extraction_status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create statement: ${error.message}`);
  }

  return mapToStatement(statement);
}

/**
 * Parse a statement and extract all claims
 */
export async function parseStatement(
  statementId: string,
  options: {
    resolveEntities?: boolean;
    interviewDate?: Date;
    referenceDate?: Date; // For relative time resolution
  } = {}
): Promise<ParsedStatement> {
  // Get the statement
  const { data: statementData, error } = await supabaseServer
    .from('statements')
    .select('*')
    .eq('id', statementId)
    .single();

  if (error || !statementData) {
    throw new Error(`Statement not found: ${statementId}`);
  }

  const statement = mapToStatement(statementData);

  // Update status to processing
  await supabaseServer
    .from('statements')
    .update({ claim_extraction_status: 'processing' })
    .eq('id', statementId);

  try {
    // Extract claims using AI
    const extractedClaims = await extractClaimsWithAI(
      statement.fullText,
      statement.speakerName,
      options.referenceDate || statement.statementDate || new Date()
    );

    const claims: StatementClaim[] = [];
    const unresolvedEntities: UnresolvedEntity[] = [];

    // Process each extracted claim
    for (const aiClaim of extractedClaims) {
      const claim: StatementClaim = {
        statementId,
        caseId: statement.caseId,
        claimType: aiClaim.claim_type,
        claimText: aiClaim.claim_text,
        originalText: aiClaim.original_text,
        subjectText: aiClaim.subject,
        predicate: aiClaim.predicate,
        objectText: aiClaim.object,
        extractionConfidence: aiClaim.confidence,
        verificationStatus: 'unverified',
        isAlibiClaim: aiClaim.is_alibi,
        isAccusatory: aiClaim.is_accusatory,
        involvesVictim: aiClaim.involves_victim,
      };

      // Process time component
      if (aiClaim.time) {
        claim.timeOriginalText = aiClaim.time.text;
        claim.timePrecision = aiClaim.time.precision;

        if (aiClaim.time.date) {
          claim.claimedDate = new Date(aiClaim.time.date);
        }
        if (aiClaim.time.time) {
          claim.claimedTime = aiClaim.time.time;
        }
        if (aiClaim.time.date && aiClaim.time.time) {
          claim.claimedDatetime = new Date(`${aiClaim.time.date}T${aiClaim.time.time}`);
        } else if (aiClaim.time.date) {
          claim.claimedDatetime = new Date(aiClaim.time.date);
        }
        if (aiClaim.time.range_start) {
          claim.timeRangeStart = new Date(aiClaim.time.range_start);
        }
        if (aiClaim.time.range_end) {
          claim.timeRangeEnd = new Date(aiClaim.time.range_end);
        }
      }

      // Process location component
      if (aiClaim.location) {
        claim.claimedLocation = aiClaim.location.text;
        claim.locationPrecision = aiClaim.location.precision;
      }

      // Resolve entities if enabled
      if (options.resolveEntities && aiClaim.subject) {
        const subjectResult = await resolveEntity(
          statement.caseId,
          aiClaim.subject,
          aiClaim.original_text,
          statement.documentId || ''
        );

        if ('canonicalEntityId' in subjectResult) {
          claim.subjectEntityId = subjectResult.canonicalEntityId;
        } else {
          unresolvedEntities.push(subjectResult);
        }
      }

      if (options.resolveEntities && aiClaim.object) {
        const objectResult = await resolveEntity(
          statement.caseId,
          aiClaim.object,
          aiClaim.original_text,
          statement.documentId || ''
        );

        if ('canonicalEntityId' in objectResult) {
          claim.objectEntityId = objectResult.canonicalEntityId;
        } else {
          unresolvedEntities.push(objectResult);
        }
      }

      claims.push(claim);
    }

    // Save claims to database
    if (claims.length > 0) {
      const claimsToInsert = claims.map(c => ({
        statement_id: c.statementId,
        case_id: c.caseId,
        claim_type: c.claimType,
        claim_text: c.claimText,
        original_text: c.originalText,
        subject_entity_id: c.subjectEntityId,
        subject_text: c.subjectText,
        predicate: c.predicate,
        object_entity_id: c.objectEntityId,
        object_text: c.objectText,
        claimed_date: c.claimedDate?.toISOString().split('T')[0],
        claimed_time: c.claimedTime,
        claimed_datetime: c.claimedDatetime?.toISOString(),
        time_precision: c.timePrecision,
        time_range_start: c.timeRangeStart?.toISOString(),
        time_range_end: c.timeRangeEnd?.toISOString(),
        time_original_text: c.timeOriginalText,
        claimed_location: c.claimedLocation,
        location_entity_id: c.locationEntityId,
        location_precision: c.locationPrecision,
        extraction_confidence: c.extractionConfidence,
        verification_status: c.verificationStatus,
        is_alibi_claim: c.isAlibiClaim,
        is_accusatory: c.isAccusatory,
        involves_victim: c.involvesVictim,
      }));

      const { data: savedClaims, error: claimError } = await supabaseServer
        .from('statement_claims')
        .insert(claimsToInsert)
        .select('id');

      if (claimError) {
        console.error('Failed to save claims:', claimError);
      } else {
        // Update claim IDs
        savedClaims?.forEach((saved, index) => {
          claims[index].id = saved.id;
        });
      }
    }

    // Build timeline from claims
    const timeline = buildClaimTimeline(claims);

    // Generate summary
    const summary = await generateStatementSummary(statement.speakerName, claims);

    // Calculate overall confidence
    const avgConfidence = claims.length > 0
      ? claims.reduce((sum, c) => sum + c.extractionConfidence, 0) / claims.length
      : 0;

    // Update statement status
    await supabaseServer
      .from('statements')
      .update({
        claim_extraction_status: 'completed',
        claims_extracted_count: claims.length,
        claims_extracted_at: new Date().toISOString(),
        summary,
      })
      .eq('id', statementId);

    return {
      statement: { ...statement, claimsExtractedCount: claims.length, summary },
      claims,
      unresolvedEntities,
      timeline,
      summary,
      confidence: avgConfidence,
    };

  } catch (error: any) {
    // Update status to failed
    await supabaseServer
      .from('statements')
      .update({ claim_extraction_status: 'failed' })
      .eq('id', statementId);

    throw error;
  }
}

/**
 * Extract claims from text using AI
 */
async function extractClaimsWithAI(
  text: string,
  speakerName: string,
  referenceDate: Date
): Promise<AIExtractedClaim[]> {
  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback to pattern-based extraction
    return extractClaimsWithPatterns(text, speakerName, referenceDate);
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: `You are analyzing an interview statement from a criminal investigation. Extract all factual claims made by the speaker.

SPEAKER: ${speakerName}
REFERENCE DATE: ${referenceDate.toISOString().split('T')[0]}

STATEMENT TEXT:
${text}

For each claim, extract:
1. claim_type: One of: location_at_time, action_performed, observation, relationship, possession, communication, alibi, accusation, denial, time_reference, physical_description, emotional_state, other
2. claim_text: Normalized claim statement
3. original_text: Exact quote from the statement
4. subject: Who/what the claim is about
5. predicate: The action/relationship/state
6. object: (optional) Target of action
7. time: (if mentioned) { text, date (YYYY-MM-DD), time (HH:MM), precision, range_start, range_end }
8. location: (if mentioned) { text, precision }
9. confidence: 0-1 extraction confidence
10. is_alibi: true if this is an alibi claim
11. is_accusatory: true if accusing someone
12. involves_victim: true if mentions the victim

Respond with a JSON array of claims. Be thorough - extract ALL claims, even small details.

Example:
[
  {
    "claim_type": "location_at_time",
    "claim_text": "John was at his home at approximately 3pm on January 15",
    "original_text": "I was home around 3 o'clock that afternoon",
    "subject": "John Smith",
    "predicate": "was located at",
    "object": "home",
    "time": { "text": "around 3 o'clock that afternoon", "date": "2024-01-15", "time": "15:00", "precision": "approximate" },
    "location": { "text": "home", "precision": "place_name" },
    "confidence": 0.9,
    "is_alibi": true,
    "is_accusatory": false,
    "involves_victim": false
  }
]

Return ONLY the JSON array, no other text.`,
      }],
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON response
    try {
      const claims = JSON.parse(responseText);
      return Array.isArray(claims) ? claims : [];
    } catch {
      console.error('[Statement Parser] Failed to parse AI response as JSON');
      return extractClaimsWithPatterns(text, speakerName, referenceDate);
    }

  } catch (error: any) {
    console.error('[Statement Parser] AI extraction failed:', error);
    return extractClaimsWithPatterns(text, speakerName, referenceDate);
  }
}

/**
 * Fallback: Extract claims using regex patterns
 */
function extractClaimsWithPatterns(
  text: string,
  speakerName: string,
  referenceDate: Date
): AIExtractedClaim[] {
  const claims: AIExtractedClaim[] = [];

  // Location claims: "I was at X"
  const locationPatterns = [
    /I was (?:at|in) (?:the |my |)([^,.]+)/gi,
    /I went to (?:the |my |)([^,.]+)/gi,
    /I arrived at (?:the |my |)([^,.]+)/gi,
    /I left (?:the |my |)([^,.]+)/gi,
  ];

  for (const pattern of locationPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push({
        claim_type: 'location_at_time',
        claim_text: `${speakerName} ${match[0].replace(/^I /i, 'was ')}`,
        original_text: match[0],
        subject: speakerName,
        predicate: 'was at',
        object: match[1].trim(),
        location: { text: match[1].trim(), precision: 'place_name' },
        confidence: 0.7,
        is_alibi: true,
        is_accusatory: false,
        involves_victim: false,
      });
    }
  }

  // Time claims
  const timePatterns = [
    /(?:at |around |about |approximately )(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)?)/gi,
    /(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)) (?:that|on|in)/gi,
  ];

  for (const pattern of timePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const timeText = match[1].trim();
      const parsedTime = parseTimeString(timeText);

      claims.push({
        claim_type: 'time_reference',
        claim_text: `Time reference: ${timeText}`,
        original_text: match[0],
        subject: speakerName,
        predicate: 'referenced time',
        time: {
          text: timeText,
          time: parsedTime,
          precision: timeText.toLowerCase().includes('around') ? 'approximate' : 'exact',
        },
        confidence: 0.6,
        is_alibi: false,
        is_accusatory: false,
        involves_victim: false,
      });
    }
  }

  // Observation claims: "I saw X"
  const observationPatterns = [
    /I saw ([^,.]+)/gi,
    /I noticed ([^,.]+)/gi,
    /I heard ([^,.]+)/gi,
    /I observed ([^,.]+)/gi,
  ];

  for (const pattern of observationPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push({
        claim_type: 'observation',
        claim_text: `${speakerName} observed: ${match[1].trim()}`,
        original_text: match[0],
        subject: speakerName,
        predicate: 'observed',
        object: match[1].trim(),
        confidence: 0.7,
        is_alibi: false,
        is_accusatory: false,
        involves_victim: match[1].toLowerCase().includes('victim'),
      });
    }
  }

  // Communication claims
  const commPatterns = [
    /I (?:called|texted|messaged|emailed|spoke (?:to|with)) ([^,.]+)/gi,
  ];

  for (const pattern of commPatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      claims.push({
        claim_type: 'communication',
        claim_text: `${speakerName} communicated with ${match[1].trim()}`,
        original_text: match[0],
        subject: speakerName,
        predicate: 'communicated with',
        object: match[1].trim(),
        confidence: 0.7,
        is_alibi: false,
        is_accusatory: false,
        involves_victim: false,
      });
    }
  }

  return claims;
}

/**
 * Build a timeline from claims
 */
function buildClaimTimeline(claims: StatementClaim[]): ClaimTimelineEntry[] {
  const timeline: ClaimTimelineEntry[] = [];

  for (const claim of claims) {
    if (claim.claimedDatetime || claim.claimedDate) {
      timeline.push({
        datetime: claim.claimedDatetime || new Date(claim.claimedDate!),
        precision: claim.timePrecision || 'vague',
        claimId: claim.id,
        description: claim.claimText,
        location: claim.claimedLocation,
        isVerified: claim.verificationStatus === 'verified',
      });
    }
  }

  return timeline.sort((a, b) => a.datetime.getTime() - b.datetime.getTime());
}

/**
 * Generate a summary of the statement
 */
async function generateStatementSummary(speakerName: string, claims: StatementClaim[]): Promise<string> {
  if (claims.length === 0) {
    return 'No claims extracted from this statement.';
  }

  const alibiClaims = claims.filter(c => c.isAlibiClaim);
  const observationClaims = claims.filter(c => c.claimType === 'observation');
  const locationClaims = claims.filter(c => c.claimedLocation);

  const parts: string[] = [];

  if (alibiClaims.length > 0) {
    parts.push(`${speakerName} provided ${alibiClaims.length} alibi claim(s)`);
  }

  if (observationClaims.length > 0) {
    parts.push(`made ${observationClaims.length} observation(s)`);
  }

  if (locationClaims.length > 0) {
    const locations = [...new Set(locationClaims.map(c => c.claimedLocation))];
    parts.push(`mentioned ${locations.length} location(s): ${locations.slice(0, 3).join(', ')}`);
  }

  return parts.join('; ') + '.';
}

/**
 * Parse a time string to HH:MM format
 */
function parseTimeString(timeStr: string): string | undefined {
  const cleaned = timeStr.toLowerCase().replace(/\./g, '');

  const match = cleaned.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/);
  if (!match) return undefined;

  let hours = parseInt(match[1], 10);
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const period = match[3];

  if (period === 'pm' && hours < 12) hours += 12;
  if (period === 'am' && hours === 12) hours = 0;

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Get claims for a statement
 */
export async function getStatementClaims(statementId: string): Promise<StatementClaim[]> {
  const { data: claims, error } = await supabaseServer
    .from('statement_claims')
    .select('*')
    .eq('statement_id', statementId)
    .order('claimed_datetime', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch claims: ${error.message}`);
  }

  return (claims || []).map(mapToClaim);
}

/**
 * Get all statements for a person
 */
export async function getPersonStatements(caseId: string, entityId: string): Promise<Statement[]> {
  const { data: statements, error } = await supabaseServer
    .from('statements')
    .select('*')
    .eq('case_id', caseId)
    .eq('speaker_entity_id', entityId)
    .order('statement_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch statements: ${error.message}`);
  }

  return (statements || []).map(mapToStatement);
}

function mapToStatement(data: any): Statement {
  return {
    id: data.id,
    caseId: data.case_id,
    documentId: data.document_id,
    speakerEntityId: data.speaker_entity_id,
    speakerName: data.speaker_name,
    speakerRole: data.speaker_role,
    statementType: data.statement_type,
    statementDate: data.statement_date ? new Date(data.statement_date) : undefined,
    statementTime: data.statement_time,
    interviewer: data.interviewer,
    location: data.location,
    durationMinutes: data.duration_minutes,
    versionNumber: data.version_number || 1,
    previousStatementId: data.previous_statement_id,
    fullText: data.full_text,
    summary: data.summary,
    claimExtractionStatus: data.claim_extraction_status || 'pending',
    claimsExtractedCount: data.claims_extracted_count || 0,
    credibilityScore: data.credibility_score,
    consistencyScore: data.consistency_score,
  };
}

function mapToClaim(data: any): StatementClaim {
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
