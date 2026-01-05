/**
 * Person Profile Aggregation Engine
 *
 * Builds comprehensive profiles for each person of interest by:
 * - Aggregating all claims they've made
 * - Tracking their alibi timeline
 * - Detecting contradictions in their statements
 * - Identifying guilty knowledge indicators
 * - Calculating suspicion scores
 */

import { supabaseServer } from './supabase-server';
import { getAnthropicClient, DEFAULT_ANTHROPIC_MODEL, isAnthropicConfigured } from './anthropic-client';
import type { AtomicFact, FactType } from './atomic-facts';
import { getFactsForPerson, queryFacts } from './atomic-facts';

// ============================================================================
// Type Definitions
// ============================================================================

export type PersonRole = 'victim' | 'suspect' | 'witness' | 'person_of_interest' |
  'family' | 'associate' | 'investigator' | 'expert' | 'other' | 'unknown';

export type AlibiStatus = 'verified' | 'partially_verified' | 'unverified' |
  'disputed' | 'impossible' | 'unknown';

export interface PersonProfile {
  id: string;
  caseId: string;
  canonicalName: string;
  aliases: string[];
  role: PersonRole;

  // Demographics
  ageAtTime?: number;
  gender?: string;
  occupation?: string;
  address?: string;

  // Relationship to victim
  relationshipToVictim?: string;
  relationshipStrength?: 'close' | 'acquaintance' | 'distant' | 'unknown';

  // Suspicion scoring
  suspicionScore: number;
  suspicionFactors: SuspicionFactor[];

  // Score breakdown
  opportunityScore: number;
  meansScore: number;
  motiveScore: number;
  behaviorScore: number;
  evidenceScore: number;

  // Statistics
  totalClaims: number;
  totalContradictions: number;
  totalBehavioralFlags: number;
  guiltyKnowledgeIndicators: number;

  // Interview history
  interviewCount: number;
  firstInterviewDate?: string;
  lastInterviewDate?: string;

  // Alibi
  alibiStatus: AlibiStatus;
  alibiSummary?: string;

  // DNA
  dnaSubmitted: boolean;
  dnaMatched?: boolean;
  dnaExcluded?: boolean;

  // Notes
  investigatorNotes?: string;

  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface SuspicionFactor {
  factor: string;
  weight: number;
  evidence: string[];
  category: 'opportunity' | 'means' | 'motive' | 'behavior' | 'evidence';
}

export interface PersonClaim {
  id: string;
  caseId: string;
  personProfileId: string;
  atomicFactId?: string;

  topic: string;
  claimText: string;
  claimType: 'location' | 'action' | 'observation' | 'relationship' |
    'alibi' | 'accusation' | 'denial' | 'admission' | 'knowledge' | 'other';

  documentId?: string;
  documentName?: string;
  pageNumber?: number;
  interviewDate?: string;
  interviewer?: string;

  verificationStatus: string;
  contradictedBy: string[];
  corroboratedBy: string[];

  isSuspicious: boolean;
  suspicionReason?: string;
  hasEvolved: boolean;
  evolutionNotes?: string;

  originalQuote?: string;
  createdAt: string;
}

export interface PersonAlibi {
  id: string;
  caseId: string;
  personProfileId: string;

  startTime: string;
  endTime: string;
  timeCertainty: string;

  location: string;
  locationType?: string;
  activity?: string;

  witnesses: string[];
  corroboratingEvidence?: string;

  verificationStatus: AlibiStatus;
  verificationNotes?: string;

  sourceDocumentId?: string;
  sourceFactId?: string;

  conflictingAlibiIds: string[];
  conflictDescription?: string;

  createdAt: string;
}

export interface GuiltyKnowledgeIndicator {
  id: string;
  caseId: string;
  personProfileId: string;
  sourceFactId?: string;

  knowledgeDescription: string;
  knowledgeType: 'crime_scene_detail' | 'victim_state' | 'timing_knowledge' |
    'location_knowledge' | 'method_knowledge' | 'evidence_awareness' | 'future_knowledge';

  statementContext?: string;
  documentId?: string;
  statementDate?: string;

  howCouldTheyKnow: string[];
  whySuspicious: string;

  wasPubliclyKnown: boolean;
  dateFirstPublic?: string;
  dateOfStatement?: string;

  severity: 'low' | 'medium' | 'high' | 'critical';
  verified: boolean;
  verificationNotes?: string;

  createdAt: string;
}

// ============================================================================
// Profile Creation & Updates
// ============================================================================

export async function createOrUpdatePersonProfile(
  caseId: string,
  name: string,
  role: PersonRole = 'unknown',
  additionalData?: Partial<PersonProfile>
): Promise<PersonProfile | null> {
  const { data: existing } = await supabaseServer
    .from('person_profiles')
    .select('*')
    .eq('case_id', caseId)
    .eq('canonical_name', name)
    .single();

  if (existing) {
    // Update existing profile
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (additionalData?.aliases) {
      updates.aliases = [...new Set([...(existing.aliases || []), ...additionalData.aliases])];
    }
    if (role !== 'unknown') updates.role = role;
    if (additionalData?.relationshipToVictim) updates.relationship_to_victim = additionalData.relationshipToVictim;
    if (additionalData?.investigatorNotes) updates.investigator_notes = additionalData.investigatorNotes;

    const { data, error } = await supabaseServer
      .from('person_profiles')
      .update(updates)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update person profile:', error);
      return null;
    }

    return transformDbProfileToPersonProfile(data);
  }

  // Create new profile
  const { data, error } = await supabaseServer
    .from('person_profiles')
    .insert({
      case_id: caseId,
      canonical_name: name,
      aliases: additionalData?.aliases || [],
      role,
      relationship_to_victim: additionalData?.relationshipToVictim,
      investigator_notes: additionalData?.investigatorNotes,
      suspicion_score: 0,
      opportunity_score: 0,
      means_score: 0,
      motive_score: 0,
      behavior_score: 0,
      evidence_score: 0
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create person profile:', error);
    return null;
  }

  return transformDbProfileToPersonProfile(data);
}

export async function getPersonProfile(caseId: string, name: string): Promise<PersonProfile | null> {
  const { data, error } = await supabaseServer
    .from('person_profiles')
    .select('*')
    .eq('case_id', caseId)
    .or(`canonical_name.eq.${name},aliases.cs.{${name}}`)
    .single();

  if (error || !data) return null;
  return transformDbProfileToPersonProfile(data);
}

export async function getAllPersonProfiles(caseId: string): Promise<PersonProfile[]> {
  const { data, error } = await supabaseServer
    .from('person_profiles')
    .select('*')
    .eq('case_id', caseId)
    .order('suspicion_score', { ascending: false });

  if (error) {
    console.error('Failed to get person profiles:', error);
    return [];
  }

  return (data || []).map(transformDbProfileToPersonProfile);
}

export async function getSuspects(caseId: string, minScore: number = 30): Promise<PersonProfile[]> {
  const { data, error } = await supabaseServer
    .from('person_profiles')
    .select('*')
    .eq('case_id', caseId)
    .gte('suspicion_score', minScore)
    .order('suspicion_score', { ascending: false });

  if (error) {
    console.error('Failed to get suspects:', error);
    return [];
  }

  return (data || []).map(transformDbProfileToPersonProfile);
}

// ============================================================================
// Claim Tracking
// ============================================================================

export async function addPersonClaim(
  caseId: string,
  personProfileId: string,
  claim: Omit<PersonClaim, 'id' | 'caseId' | 'personProfileId' | 'createdAt'>
): Promise<PersonClaim | null> {
  const { data, error } = await supabaseServer
    .from('person_claims')
    .insert({
      case_id: caseId,
      person_profile_id: personProfileId,
      atomic_fact_id: claim.atomicFactId,
      topic: claim.topic,
      claim_text: claim.claimText,
      claim_type: claim.claimType,
      document_id: claim.documentId,
      document_name: claim.documentName,
      page_number: claim.pageNumber,
      interview_date: claim.interviewDate,
      interviewer: claim.interviewer,
      verification_status: claim.verificationStatus,
      is_suspicious: claim.isSuspicious,
      suspicion_reason: claim.suspicionReason,
      original_quote: claim.originalQuote
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to add person claim:', error);
    return null;
  }

  // Update claim count on profile
  await supabaseServer
    .from('person_profiles')
    .update({
      total_claims: supabaseServer.rpc('increment_claims', { profile_id: personProfileId })
    })
    .eq('id', personProfileId);

  return transformDbClaimToPersonClaim(data);
}

export async function getPersonClaims(
  personProfileId: string,
  topic?: string
): Promise<PersonClaim[]> {
  let query = supabaseServer
    .from('person_claims')
    .select('*')
    .eq('person_profile_id', personProfileId);

  if (topic) {
    query = query.ilike('topic', `%${topic}%`);
  }

  const { data, error } = await query.order('interview_date', { ascending: true });

  if (error) {
    console.error('Failed to get person claims:', error);
    return [];
  }

  return (data || []).map(transformDbClaimToPersonClaim);
}

// ============================================================================
// Alibi Tracking
// ============================================================================

export async function addPersonAlibi(
  caseId: string,
  personProfileId: string,
  alibi: Omit<PersonAlibi, 'id' | 'caseId' | 'personProfileId' | 'createdAt' | 'conflictingAlibiIds'>
): Promise<PersonAlibi | null> {
  const { data, error } = await supabaseServer
    .from('person_alibis')
    .insert({
      case_id: caseId,
      person_profile_id: personProfileId,
      start_time: alibi.startTime,
      end_time: alibi.endTime,
      time_certainty: alibi.timeCertainty,
      location: alibi.location,
      location_type: alibi.locationType,
      activity: alibi.activity,
      witnesses: alibi.witnesses,
      corroborating_evidence: alibi.corroboratingEvidence,
      verification_status: alibi.verificationStatus,
      verification_notes: alibi.verificationNotes,
      source_document_id: alibi.sourceDocumentId,
      source_fact_id: alibi.sourceFactId
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to add alibi:', error);
    return null;
  }

  // Check for conflicts with other alibis
  await detectAlibiConflicts(personProfileId, data.id);

  return transformDbAlibiToPersonAlibi(data);
}

export async function getPersonAlibis(personProfileId: string): Promise<PersonAlibi[]> {
  const { data, error } = await supabaseServer
    .from('person_alibis')
    .select('*')
    .eq('person_profile_id', personProfileId)
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Failed to get alibis:', error);
    return [];
  }

  return (data || []).map(transformDbAlibiToPersonAlibi);
}

async function detectAlibiConflicts(personProfileId: string, newAlibiId: string): Promise<void> {
  const { data: conflicts } = await supabaseServer
    .rpc('find_alibi_conflicts', { p_person_id: personProfileId });

  if (conflicts && conflicts.length > 0) {
    for (const conflict of conflicts) {
      // Update both alibis with conflict info
      await supabaseServer
        .from('person_alibis')
        .update({
          conflicting_alibi_ids: supabaseServer.sql`array_append(conflicting_alibi_ids, ${conflict.alibi2_id})`,
          conflict_description: `Conflict: Claims to be at ${conflict.location1} and ${conflict.location2} during overlapping time`
        })
        .eq('id', conflict.alibi1_id);
    }
  }
}

// ============================================================================
// Guilty Knowledge Detection
// ============================================================================

export async function addGuiltyKnowledgeIndicator(
  caseId: string,
  personProfileId: string,
  indicator: Omit<GuiltyKnowledgeIndicator, 'id' | 'caseId' | 'personProfileId' | 'createdAt'>
): Promise<GuiltyKnowledgeIndicator | null> {
  const { data, error } = await supabaseServer
    .from('guilty_knowledge_indicators')
    .insert({
      case_id: caseId,
      person_profile_id: personProfileId,
      source_fact_id: indicator.sourceFactId,
      knowledge_description: indicator.knowledgeDescription,
      knowledge_type: indicator.knowledgeType,
      statement_context: indicator.statementContext,
      document_id: indicator.documentId,
      statement_date: indicator.statementDate,
      how_could_they_know: indicator.howCouldTheyKnow,
      why_suspicious: indicator.whySuspicious,
      was_publicly_known: indicator.wasPubliclyKnown,
      date_first_public: indicator.dateFirstPublic,
      date_of_statement: indicator.dateOfStatement,
      severity: indicator.severity
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to add guilty knowledge indicator:', error);
    return null;
  }

  // Update indicator count on profile
  await supabaseServer
    .from('person_profiles')
    .update({
      guilty_knowledge_indicators: supabaseServer.rpc('increment_guilty_knowledge', { profile_id: personProfileId })
    })
    .eq('id', personProfileId);

  return transformDbGuiltyKnowledgeToIndicator(data);
}

export async function getGuiltyKnowledgeIndicators(
  personProfileId: string
): Promise<GuiltyKnowledgeIndicator[]> {
  const { data, error } = await supabaseServer
    .from('guilty_knowledge_indicators')
    .select('*')
    .eq('person_profile_id', personProfileId)
    .order('severity', { ascending: false });

  if (error) {
    console.error('Failed to get guilty knowledge indicators:', error);
    return [];
  }

  return (data || []).map(transformDbGuiltyKnowledgeToIndicator);
}

// ============================================================================
// Profile Building from Facts
// ============================================================================

export async function buildProfileFromFacts(
  caseId: string,
  personName: string
): Promise<PersonProfile | null> {
  // Get or create the profile
  let profile = await getPersonProfile(caseId, personName);
  if (!profile) {
    profile = await createOrUpdatePersonProfile(caseId, personName);
  }
  if (!profile) return null;

  // Get all facts mentioning this person
  const facts = await getFactsForPerson(caseId, personName);

  // Extract claims, alibis, and suspicious knowledge
  const claims: Omit<PersonClaim, 'id' | 'caseId' | 'personProfileId' | 'createdAt'>[] = [];
  const alibis: Omit<PersonAlibi, 'id' | 'caseId' | 'personProfileId' | 'createdAt' | 'conflictingAlibiIds'>[] = [];
  const guiltyKnowledge: Omit<GuiltyKnowledgeIndicator, 'id' | 'caseId' | 'personProfileId' | 'createdAt'>[] = [];

  for (const fact of facts) {
    // If this person made the claim
    if (fact.source.speakerName.toLowerCase().includes(personName.toLowerCase())) {
      claims.push({
        atomicFactId: fact.id,
        topic: fact.factType,
        claimText: fact.predicate,
        claimType: mapFactTypeToClaim(fact.factType),
        documentId: fact.source.documentId,
        documentName: fact.source.documentName,
        pageNumber: fact.source.pageNumber,
        interviewDate: fact.source.dateRecorded,
        interviewer: fact.source.recordedBy,
        verificationStatus: fact.verificationStatus,
        contradictedBy: [],
        corroboratedBy: [],
        isSuspicious: fact.isSuspicious,
        suspicionReason: fact.suspicionReason,
        hasEvolved: false,
        originalQuote: fact.source.originalQuote
      });

      // Check for alibi claims
      if (fact.factType === 'alibi' || fact.factType === 'location_claim') {
        if (fact.timeReference && fact.location) {
          alibis.push({
            startTime: fact.timeReference.earliest || new Date().toISOString(),
            endTime: fact.timeReference.latest || fact.timeReference.earliest || new Date().toISOString(),
            timeCertainty: fact.timeReference.certainty,
            location: fact.location,
            activity: fact.predicate,
            witnesses: fact.mentionedPersons.filter(p =>
              p.toLowerCase() !== personName.toLowerCase()
            ),
            verificationStatus: 'unverified',
            sourceDocumentId: fact.source.documentId,
            sourceFactId: fact.id
          });
        }
      }

      // Check for guilty knowledge
      if (fact.isSuspicious && fact.suspicionReason) {
        guiltyKnowledge.push({
          sourceFactId: fact.id,
          knowledgeDescription: fact.predicate,
          knowledgeType: determineKnowledgeType(fact),
          statementContext: fact.source.originalQuote,
          documentId: fact.source.documentId,
          statementDate: fact.source.dateRecorded,
          howCouldTheyKnow: [],
          whySuspicious: fact.suspicionReason,
          wasPubliclyKnown: false,
          severity: determineSeverity(fact),
          verified: false
        });
      }
    }
  }

  // Save claims
  for (const claim of claims) {
    await addPersonClaim(caseId, profile.id, claim);
  }

  // Save alibis
  for (const alibi of alibis) {
    await addPersonAlibi(caseId, profile.id, alibi);
  }

  // Save guilty knowledge indicators
  for (const gk of guiltyKnowledge) {
    await addGuiltyKnowledgeIndicator(caseId, profile.id, gk);
  }

  // Refresh and return the profile
  return getPersonProfile(caseId, personName);
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapFactTypeToClaim(factType: FactType): PersonClaim['claimType'] {
  const mapping: Record<FactType, PersonClaim['claimType']> = {
    location_claim: 'location',
    timeline_claim: 'observation',
    action_claim: 'action',
    observation: 'observation',
    relationship: 'relationship',
    physical_evidence: 'observation',
    alibi: 'alibi',
    accusation: 'accusation',
    denial: 'denial',
    admission: 'admission',
    behavioral_observation: 'observation',
    forensic_finding: 'observation',
    communication: 'action',
    possession: 'observation',
    knowledge_claim: 'knowledge',
    state_of_mind: 'observation',
    prior_incident: 'observation',
    physical_description: 'observation',
    vehicle_sighting: 'observation',
    other: 'other'
  };
  return mapping[factType] || 'other';
}

function determineKnowledgeType(fact: AtomicFact): GuiltyKnowledgeIndicator['knowledgeType'] {
  const predicate = fact.predicate.toLowerCase();
  const reason = (fact.suspicionReason || '').toLowerCase();

  if (reason.includes('crime scene') || predicate.includes('crime scene')) {
    return 'crime_scene_detail';
  }
  if (reason.includes('victim') || predicate.includes('body') || predicate.includes('victim')) {
    return 'victim_state';
  }
  if (reason.includes('time') || reason.includes('when')) {
    return 'timing_knowledge';
  }
  if (reason.includes('location') || reason.includes('where')) {
    return 'location_knowledge';
  }
  if (reason.includes('how') || reason.includes('method')) {
    return 'method_knowledge';
  }
  if (reason.includes('evidence') || reason.includes('weapon')) {
    return 'evidence_awareness';
  }
  if (reason.includes('before') || reason.includes('predicted')) {
    return 'future_knowledge';
  }

  return 'crime_scene_detail';
}

function determineSeverity(fact: AtomicFact): GuiltyKnowledgeIndicator['severity'] {
  if (fact.confidenceScore > 0.9) return 'critical';
  if (fact.confidenceScore > 0.7) return 'high';
  if (fact.confidenceScore > 0.5) return 'medium';
  return 'low';
}

// Database transformation helpers
function transformDbProfileToPersonProfile(row: Record<string, unknown>): PersonProfile {
  return {
    id: row.id as string,
    caseId: row.case_id as string,
    canonicalName: row.canonical_name as string,
    aliases: row.aliases as string[] || [],
    role: row.role as PersonRole,
    ageAtTime: row.age_at_time as number | undefined,
    gender: row.gender as string | undefined,
    occupation: row.occupation as string | undefined,
    address: row.address as string | undefined,
    relationshipToVictim: row.relationship_to_victim as string | undefined,
    relationshipStrength: row.relationship_strength as PersonProfile['relationshipStrength'],
    suspicionScore: row.suspicion_score as number || 0,
    suspicionFactors: row.suspicion_factors as SuspicionFactor[] || [],
    opportunityScore: row.opportunity_score as number || 0,
    meansScore: row.means_score as number || 0,
    motiveScore: row.motive_score as number || 0,
    behaviorScore: row.behavior_score as number || 0,
    evidenceScore: row.evidence_score as number || 0,
    totalClaims: row.total_claims as number || 0,
    totalContradictions: row.total_contradictions as number || 0,
    totalBehavioralFlags: row.total_behavioral_flags as number || 0,
    guiltyKnowledgeIndicators: row.guilty_knowledge_indicators as number || 0,
    interviewCount: row.interview_count as number || 0,
    firstInterviewDate: row.first_interview_date as string | undefined,
    lastInterviewDate: row.last_interview_date as string | undefined,
    alibiStatus: row.alibi_status as AlibiStatus || 'unknown',
    alibiSummary: row.alibi_summary as string | undefined,
    dnaSubmitted: row.dna_submitted as boolean || false,
    dnaMatched: row.dna_matched as boolean | undefined,
    dnaExcluded: row.dna_excluded as boolean | undefined,
    investigatorNotes: row.investigator_notes as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string
  };
}

function transformDbClaimToPersonClaim(row: Record<string, unknown>): PersonClaim {
  return {
    id: row.id as string,
    caseId: row.case_id as string,
    personProfileId: row.person_profile_id as string,
    atomicFactId: row.atomic_fact_id as string | undefined,
    topic: row.topic as string,
    claimText: row.claim_text as string,
    claimType: row.claim_type as PersonClaim['claimType'],
    documentId: row.document_id as string | undefined,
    documentName: row.document_name as string | undefined,
    pageNumber: row.page_number as number | undefined,
    interviewDate: row.interview_date as string | undefined,
    interviewer: row.interviewer as string | undefined,
    verificationStatus: row.verification_status as string,
    contradictedBy: row.contradicted_by as string[] || [],
    corroboratedBy: row.corroborated_by as string[] || [],
    isSuspicious: row.is_suspicious as boolean,
    suspicionReason: row.suspicion_reason as string | undefined,
    hasEvolved: row.has_evolved as boolean,
    evolutionNotes: row.evolution_notes as string | undefined,
    originalQuote: row.original_quote as string | undefined,
    createdAt: row.created_at as string
  };
}

function transformDbAlibiToPersonAlibi(row: Record<string, unknown>): PersonAlibi {
  return {
    id: row.id as string,
    caseId: row.case_id as string,
    personProfileId: row.person_profile_id as string,
    startTime: row.start_time as string,
    endTime: row.end_time as string,
    timeCertainty: row.time_certainty as string,
    location: row.location as string,
    locationType: row.location_type as string | undefined,
    activity: row.activity as string | undefined,
    witnesses: row.witnesses as string[] || [],
    corroboratingEvidence: row.corroborating_evidence as string | undefined,
    verificationStatus: row.verification_status as AlibiStatus,
    verificationNotes: row.verification_notes as string | undefined,
    sourceDocumentId: row.source_document_id as string | undefined,
    sourceFactId: row.source_fact_id as string | undefined,
    conflictingAlibiIds: row.conflicting_alibi_ids as string[] || [],
    conflictDescription: row.conflict_description as string | undefined,
    createdAt: row.created_at as string
  };
}

function transformDbGuiltyKnowledgeToIndicator(row: Record<string, unknown>): GuiltyKnowledgeIndicator {
  return {
    id: row.id as string,
    caseId: row.case_id as string,
    personProfileId: row.person_profile_id as string,
    sourceFactId: row.source_fact_id as string | undefined,
    knowledgeDescription: row.knowledge_description as string,
    knowledgeType: row.knowledge_type as GuiltyKnowledgeIndicator['knowledgeType'],
    statementContext: row.statement_context as string | undefined,
    documentId: row.document_id as string | undefined,
    statementDate: row.statement_date as string | undefined,
    howCouldTheyKnow: row.how_could_they_know as string[] || [],
    whySuspicious: row.why_suspicious as string,
    wasPubliclyKnown: row.was_publicly_known as boolean,
    dateFirstPublic: row.date_first_public as string | undefined,
    dateOfStatement: row.date_of_statement as string | undefined,
    severity: row.severity as GuiltyKnowledgeIndicator['severity'],
    verified: row.verified as boolean,
    verificationNotes: row.verification_notes as string | undefined,
    createdAt: row.created_at as string
  };
}
