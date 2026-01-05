/**
 * Atomic Fact Extraction Engine
 *
 * Transforms documents into queryable atomic facts - the foundation
 * for analyzing massive cold cases without losing context.
 *
 * Each fact is a single, atomic piece of information that can be:
 * - Queried independently
 * - Cross-referenced with other facts
 * - Used to detect contradictions
 * - Attributed to a source
 */

import { getAnthropicClient, DEFAULT_ANTHROPIC_MODEL, isAnthropicConfigured } from './anthropic-client';
import { supabaseServer } from './supabase-server';

// ============================================================================
// Type Definitions
// ============================================================================

export type FactType =
  | 'location_claim'        // "I was at the store at 3pm"
  | 'timeline_claim'        // "The event happened around midnight"
  | 'action_claim'          // "I saw him walk to the car"
  | 'observation'           // "The window was broken"
  | 'relationship'          // "John is Mary's brother"
  | 'physical_evidence'     // "Blood was found on the doorknob"
  | 'alibi'                 // "I was with Bob all night"
  | 'accusation'            // "I think John did it"
  | 'denial'                // "I never touched the weapon"
  | 'admission'             // "Yes, I was there that night"
  | 'behavioral_observation'// "He seemed nervous during questioning"
  | 'forensic_finding'      // "DNA matched the suspect"
  | 'communication'         // "She called him at 10pm"
  | 'possession'            // "He owned a blue sedan"
  | 'knowledge_claim'       // "I didn't know about the money"
  | 'state_of_mind'         // "She was angry at him"
  | 'prior_incident'        // "They had fought before"
  | 'physical_description'  // "The suspect was 6 feet tall"
  | 'vehicle_sighting'      // "A white van was seen"
  | 'other';

export type TimeCertainty = 'exact' | 'approximate' | 'estimated' | 'range' | 'unknown';

export type VerificationStatus =
  | 'unverified'           // Not yet checked
  | 'corroborated'         // Supported by other evidence
  | 'partially_verified'   // Some aspects confirmed
  | 'contradicted'         // Conflicts with other evidence
  | 'impossible'           // Physically/logically impossible
  | 'confirmed';           // Definitively proven true

export interface TimeReference {
  earliest?: string;        // ISO date string
  latest?: string;          // ISO date string
  certainty: TimeCertainty;
  originalText: string;     // "around 10pm" or "late that night"
  relativeAnchor?: string;  // "after the party" or "before she left"
}

export interface FactSource {
  speakerId?: string;       // Person who made the claim (canonical ID)
  speakerName: string;      // Original name as mentioned
  documentId: string;
  documentName: string;
  documentType: 'interview' | 'police_report' | 'forensic_report' | 'witness_statement' |
                'tip' | 'media' | 'court_document' | 'autopsy' | 'lab_report' | 'other';
  pageNumber?: number;
  recordedBy?: string;      // Officer/interviewer who recorded this
  dateRecorded?: string;    // When the statement was recorded
  originalQuote: string;    // Exact text from document
}

export interface AtomicFact {
  id: string;
  caseId: string;

  // The fact itself
  factType: FactType;
  subject: string;          // Who/what is this fact about
  predicate: string;        // What happened/is claimed
  object?: string;          // Target of action (if applicable)

  // Context
  location?: string;
  timeReference?: TimeReference;

  // Source attribution
  source: FactSource;

  // Entities mentioned
  mentionedPersons: string[];
  mentionedLocations: string[];
  mentionedEvidence: string[];
  mentionedVehicles: string[];

  // Cross-referencing (populated by contradiction engine)
  corroboratingFactIds: string[];
  contradictingFactIds: string[];
  relatedFactIds: string[];

  // Verification
  verificationStatus: VerificationStatus;
  confidenceScore: number;  // 0-1, how confident are we in this extraction

  // Suspicion indicators
  isSuspicious: boolean;
  suspicionReason?: string;

  // Metadata
  extractedAt: string;
  lastUpdated: string;
  embedding?: number[];     // For semantic search
}

export interface FactExtractionResult {
  facts: AtomicFact[];
  documentId: string;
  documentName: string;
  totalFactsExtracted: number;
  personsIdentified: string[];
  locationsIdentified: string[];
  timeReferencesFound: number;
  processingTimeMs: number;
  errors?: string[];
}

// ============================================================================
// Extraction Engine
// ============================================================================

const FACT_EXTRACTION_PROMPT = `You are an expert cold case analyst extracting atomic facts from investigative documents.

Your task is to extract EVERY factual claim, observation, and statement from the document into structured atomic facts.

CRITICAL RULES:
1. Extract EVERY claim, no matter how small - small details often crack cases
2. Preserve exact quotes when possible
3. Identify WHO said/observed WHAT, WHEN, and WHERE
4. Note any claims about time, even vague ones like "late that night"
5. Flag anything suspicious or that contradicts common sense
6. Identify all persons, locations, vehicles, and evidence mentioned

For each fact, determine:
- factType: The category of this fact
- subject: Who or what is this fact about
- predicate: What is being claimed or observed
- object: Target of the action (if any)
- location: Where did this happen (if mentioned)
- timeReference: When did this happen (extract exact text and estimate dates if possible)
- source: Who said this, in what document, on what page
- mentionedPersons: All people mentioned in this fact
- mentionedLocations: All locations mentioned
- mentionedEvidence: Any physical evidence mentioned
- mentionedVehicles: Any vehicles mentioned
- isSuspicious: Does this raise red flags?
- suspicionReason: If suspicious, why?

IMPORTANT: For timeReference, extract:
- originalText: The exact time reference from the document ("around 10pm", "after dinner", etc.)
- earliest/latest: If you can estimate dates, provide ISO format (YYYY-MM-DDTHH:mm:ss)
- certainty: How certain is this time (exact, approximate, estimated, range, unknown)
- relativeAnchor: If time is relative ("after the party"), note the anchor event

Return a JSON array of facts. Be exhaustive - extract EVERY piece of information.`;

export async function extractFactsFromDocument(
  caseId: string,
  documentId: string,
  documentName: string,
  documentType: FactSource['documentType'],
  content: string,
  pageNumber?: number
): Promise<FactExtractionResult> {
  const startTime = Date.now();

  if (!isAnthropicConfigured()) {
    return {
      facts: [],
      documentId,
      documentName,
      totalFactsExtracted: 0,
      personsIdentified: [],
      locationsIdentified: [],
      timeReferencesFound: 0,
      processingTimeMs: Date.now() - startTime,
      errors: ['Anthropic API not configured']
    };
  }

  const client = getAnthropicClient();

  try {
    const response = await client.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `${FACT_EXTRACTION_PROMPT}

Document Name: ${documentName}
Document Type: ${documentType}
${pageNumber ? `Page Number: ${pageNumber}` : ''}

DOCUMENT CONTENT:
${content}

Extract all atomic facts as a JSON array. Return ONLY valid JSON, no other text.`
        }
      ]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse JSON from response
    let extractedFacts: Partial<AtomicFact>[];
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedFacts = JSON.parse(jsonMatch[0]);
      } else {
        extractedFacts = JSON.parse(responseText);
      }
    } catch (parseError) {
      console.error('Failed to parse fact extraction response:', parseError);
      return {
        facts: [],
        documentId,
        documentName,
        totalFactsExtracted: 0,
        personsIdentified: [],
        locationsIdentified: [],
        timeReferencesFound: 0,
        processingTimeMs: Date.now() - startTime,
        errors: [`Failed to parse extraction response: ${parseError}`]
      };
    }

    // Transform to full AtomicFact objects
    const facts: AtomicFact[] = extractedFacts.map((f, index) => ({
      id: `${documentId}-fact-${index}`,
      caseId,
      factType: f.factType || 'other',
      subject: f.subject || 'Unknown',
      predicate: f.predicate || '',
      object: f.object,
      location: f.location,
      timeReference: f.timeReference,
      source: {
        speakerName: f.source?.speakerName || 'Unknown',
        speakerId: f.source?.speakerId,
        documentId,
        documentName,
        documentType,
        pageNumber,
        recordedBy: f.source?.recordedBy,
        dateRecorded: f.source?.dateRecorded,
        originalQuote: f.source?.originalQuote || ''
      },
      mentionedPersons: f.mentionedPersons || [],
      mentionedLocations: f.mentionedLocations || [],
      mentionedEvidence: f.mentionedEvidence || [],
      mentionedVehicles: f.mentionedVehicles || [],
      corroboratingFactIds: [],
      contradictingFactIds: [],
      relatedFactIds: [],
      verificationStatus: 'unverified',
      confidenceScore: 0.8, // Default confidence
      isSuspicious: f.isSuspicious || false,
      suspicionReason: f.suspicionReason,
      extractedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    }));

    // Collect unique entities
    const allPersons = new Set<string>();
    const allLocations = new Set<string>();
    let timeRefCount = 0;

    facts.forEach(fact => {
      fact.mentionedPersons.forEach(p => allPersons.add(p));
      fact.mentionedLocations.forEach(l => allLocations.add(l));
      if (fact.timeReference) timeRefCount++;
    });

    return {
      facts,
      documentId,
      documentName,
      totalFactsExtracted: facts.length,
      personsIdentified: Array.from(allPersons),
      locationsIdentified: Array.from(allLocations),
      timeReferencesFound: timeRefCount,
      processingTimeMs: Date.now() - startTime
    };

  } catch (error) {
    console.error('Fact extraction failed:', error);
    return {
      facts: [],
      documentId,
      documentName,
      totalFactsExtracted: 0,
      personsIdentified: [],
      locationsIdentified: [],
      timeReferencesFound: 0,
      processingTimeMs: Date.now() - startTime,
      errors: [`Extraction failed: ${error}`]
    };
  }
}

// ============================================================================
// Database Operations
// ============================================================================

export async function saveFactsToDatabase(facts: AtomicFact[]): Promise<{ saved: number; errors: string[] }> {
  const errors: string[] = [];
  let saved = 0;

  for (const fact of facts) {
    try {
      const { error } = await supabaseServer
        .from('atomic_facts')
        .upsert({
          id: fact.id,
          case_id: fact.caseId,
          fact_type: fact.factType,
          subject: fact.subject,
          predicate: fact.predicate,
          object: fact.object,
          location: fact.location,
          time_reference: fact.timeReference,
          source: fact.source,
          mentioned_persons: fact.mentionedPersons,
          mentioned_locations: fact.mentionedLocations,
          mentioned_evidence: fact.mentionedEvidence,
          mentioned_vehicles: fact.mentionedVehicles,
          corroborating_fact_ids: fact.corroboratingFactIds,
          contradicting_fact_ids: fact.contradictingFactIds,
          related_fact_ids: fact.relatedFactIds,
          verification_status: fact.verificationStatus,
          confidence_score: fact.confidenceScore,
          is_suspicious: fact.isSuspicious,
          suspicion_reason: fact.suspicionReason,
          extracted_at: fact.extractedAt,
          last_updated: fact.lastUpdated,
          embedding: fact.embedding
        }, { onConflict: 'id' });

      if (error) {
        errors.push(`Failed to save fact ${fact.id}: ${error.message}`);
      } else {
        saved++;
      }
    } catch (err) {
      errors.push(`Exception saving fact ${fact.id}: ${err}`);
    }
  }

  return { saved, errors };
}

export async function getFactsForCase(caseId: string): Promise<AtomicFact[]> {
  const { data, error } = await supabaseServer
    .from('atomic_facts')
    .select('*')
    .eq('case_id', caseId)
    .order('extracted_at', { ascending: true });

  if (error) {
    console.error('Failed to get facts:', error);
    return [];
  }

  return (data || []).map(transformDbFactToAtomicFact);
}

export async function getFactsForPerson(caseId: string, personName: string): Promise<AtomicFact[]> {
  const { data, error } = await supabaseServer
    .from('atomic_facts')
    .select('*')
    .eq('case_id', caseId)
    .or(`subject.ilike.%${personName}%,mentioned_persons.cs.{${personName}}`);

  if (error) {
    console.error('Failed to get facts for person:', error);
    return [];
  }

  return (data || []).map(transformDbFactToAtomicFact);
}

export async function getFactsByType(caseId: string, factType: FactType): Promise<AtomicFact[]> {
  const { data, error } = await supabaseServer
    .from('atomic_facts')
    .select('*')
    .eq('case_id', caseId)
    .eq('fact_type', factType);

  if (error) {
    console.error('Failed to get facts by type:', error);
    return [];
  }

  return (data || []).map(transformDbFactToAtomicFact);
}

export async function getSuspiciousFacts(caseId: string): Promise<AtomicFact[]> {
  const { data, error } = await supabaseServer
    .from('atomic_facts')
    .select('*')
    .eq('case_id', caseId)
    .eq('is_suspicious', true)
    .order('confidence_score', { ascending: false });

  if (error) {
    console.error('Failed to get suspicious facts:', error);
    return [];
  }

  return (data || []).map(transformDbFactToAtomicFact);
}

export async function getContradictedFacts(caseId: string): Promise<AtomicFact[]> {
  const { data, error } = await supabaseServer
    .from('atomic_facts')
    .select('*')
    .eq('case_id', caseId)
    .eq('verification_status', 'contradicted');

  if (error) {
    console.error('Failed to get contradicted facts:', error);
    return [];
  }

  return (data || []).map(transformDbFactToAtomicFact);
}

// Helper to transform DB row to AtomicFact
function transformDbFactToAtomicFact(row: Record<string, unknown>): AtomicFact {
  return {
    id: row.id as string,
    caseId: row.case_id as string,
    factType: row.fact_type as FactType,
    subject: row.subject as string,
    predicate: row.predicate as string,
    object: row.object as string | undefined,
    location: row.location as string | undefined,
    timeReference: row.time_reference as TimeReference | undefined,
    source: row.source as FactSource,
    mentionedPersons: row.mentioned_persons as string[] || [],
    mentionedLocations: row.mentioned_locations as string[] || [],
    mentionedEvidence: row.mentioned_evidence as string[] || [],
    mentionedVehicles: row.mentioned_vehicles as string[] || [],
    corroboratingFactIds: row.corroborating_fact_ids as string[] || [],
    contradictingFactIds: row.contradicting_fact_ids as string[] || [],
    relatedFactIds: row.related_fact_ids as string[] || [],
    verificationStatus: row.verification_status as VerificationStatus,
    confidenceScore: row.confidence_score as number,
    isSuspicious: row.is_suspicious as boolean,
    suspicionReason: row.suspicion_reason as string | undefined,
    extractedAt: row.extracted_at as string,
    lastUpdated: row.last_updated as string,
    embedding: row.embedding as number[] | undefined
  };
}

// ============================================================================
// Query Functions for RAG
// ============================================================================

export interface FactQuery {
  caseId: string;
  subject?: string;
  factTypes?: FactType[];
  personMentioned?: string;
  locationMentioned?: string;
  timeRange?: {
    start: string;
    end: string;
  };
  verificationStatus?: VerificationStatus[];
  onlySuspicious?: boolean;
  limit?: number;
}

export async function queryFacts(query: FactQuery): Promise<AtomicFact[]> {
  let dbQuery = supabaseServer
    .from('atomic_facts')
    .select('*')
    .eq('case_id', query.caseId);

  if (query.subject) {
    dbQuery = dbQuery.ilike('subject', `%${query.subject}%`);
  }

  if (query.factTypes && query.factTypes.length > 0) {
    dbQuery = dbQuery.in('fact_type', query.factTypes);
  }

  if (query.personMentioned) {
    dbQuery = dbQuery.contains('mentioned_persons', [query.personMentioned]);
  }

  if (query.locationMentioned) {
    dbQuery = dbQuery.contains('mentioned_locations', [query.locationMentioned]);
  }

  if (query.verificationStatus && query.verificationStatus.length > 0) {
    dbQuery = dbQuery.in('verification_status', query.verificationStatus);
  }

  if (query.onlySuspicious) {
    dbQuery = dbQuery.eq('is_suspicious', true);
  }

  if (query.limit) {
    dbQuery = dbQuery.limit(query.limit);
  }

  const { data, error } = await dbQuery;

  if (error) {
    console.error('Fact query failed:', error);
    return [];
  }

  return (data || []).map(transformDbFactToAtomicFact);
}

// ============================================================================
// Batch Processing for Large Documents
// ============================================================================

export async function extractFactsFromChunks(
  caseId: string,
  documentId: string,
  documentName: string,
  documentType: FactSource['documentType'],
  chunks: { content: string; pageNumber?: number }[]
): Promise<FactExtractionResult> {
  const allFacts: AtomicFact[] = [];
  const allPersons = new Set<string>();
  const allLocations = new Set<string>();
  let totalTimeRefs = 0;
  const errors: string[] = [];
  const startTime = Date.now();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    try {
      const result = await extractFactsFromDocument(
        caseId,
        `${documentId}-chunk-${i}`,
        documentName,
        documentType,
        chunk.content,
        chunk.pageNumber
      );

      // Renumber fact IDs to be globally unique
      result.facts.forEach((fact, idx) => {
        fact.id = `${documentId}-chunk-${i}-fact-${idx}`;
        allFacts.push(fact);
      });

      result.personsIdentified.forEach(p => allPersons.add(p));
      result.locationsIdentified.forEach(l => allLocations.add(l));
      totalTimeRefs += result.timeReferencesFound;

      if (result.errors) {
        errors.push(...result.errors.map(e => `Chunk ${i}: ${e}`));
      }
    } catch (err) {
      errors.push(`Failed to process chunk ${i}: ${err}`);
    }
  }

  return {
    facts: allFacts,
    documentId,
    documentName,
    totalFactsExtracted: allFacts.length,
    personsIdentified: Array.from(allPersons),
    locationsIdentified: Array.from(allLocations),
    timeReferencesFound: totalTimeRefs,
    processingTimeMs: Date.now() - startTime,
    errors: errors.length > 0 ? errors : undefined
  };
}

// ============================================================================
// Statistics
// ============================================================================

export async function getFactStatistics(caseId: string): Promise<{
  totalFacts: number;
  byType: Record<FactType, number>;
  byVerificationStatus: Record<VerificationStatus, number>;
  suspiciousFacts: number;
  uniquePersons: number;
  uniqueLocations: number;
  factsWithTimeReference: number;
}> {
  const facts = await getFactsForCase(caseId);

  const byType: Record<string, number> = {};
  const byVerificationStatus: Record<string, number> = {};
  const persons = new Set<string>();
  const locations = new Set<string>();
  let suspiciousCount = 0;
  let timeRefCount = 0;

  facts.forEach(fact => {
    byType[fact.factType] = (byType[fact.factType] || 0) + 1;
    byVerificationStatus[fact.verificationStatus] = (byVerificationStatus[fact.verificationStatus] || 0) + 1;
    fact.mentionedPersons.forEach(p => persons.add(p));
    fact.mentionedLocations.forEach(l => locations.add(l));
    if (fact.isSuspicious) suspiciousCount++;
    if (fact.timeReference) timeRefCount++;
  });

  return {
    totalFacts: facts.length,
    byType: byType as Record<FactType, number>,
    byVerificationStatus: byVerificationStatus as Record<VerificationStatus, number>,
    suspiciousFacts: suspiciousCount,
    uniquePersons: persons.size,
    uniqueLocations: locations.size,
    factsWithTimeReference: timeRefCount
  };
}
