/**
 * DNA/Evidence Tracking System
 *
 * Manages the complete lifecycle of DNA evidence:
 * - Sample collection and storage
 * - Test requests and tracking
 * - Profile extraction and storage
 * - Match detection and analysis
 * - CODIS integration tracking
 */

import { supabaseServer } from './supabase-server';

// ============================================================================
// TYPES
// ============================================================================

export type DNASampleType =
  | 'blood' | 'saliva' | 'hair' | 'skin_cells' | 'semen' | 'tissue'
  | 'touch_dna' | 'fingernail_scrapings' | 'swab' | 'bone' | 'teeth' | 'other';

export type DNASampleStatus =
  | 'collected' | 'stored' | 'queued_for_testing' | 'in_testing'
  | 'tested' | 'inconclusive' | 'degraded' | 'consumed' | 'retained';

export type DNATestType =
  | 'str_analysis' | 'y_str' | 'mitochondrial' | 'snp_analysis'
  | 'rapid_dna' | 'phenotyping' | 'familial_search' | 'touch_dna' | 'other';

export type DNATestStatus =
  | 'requested' | 'sample_received' | 'in_progress' | 'analysis_complete'
  | 'report_pending' | 'completed' | 'failed' | 'cancelled';

export type ProfileType =
  | 'known_reference' | 'unknown_crime_scene' | 'unknown_evidence'
  | 'victim' | 'suspect' | 'elimination' | 'familial';

export type ProfileQuality = 'full' | 'partial' | 'degraded' | 'mixture' | 'none';

export type MatchType =
  | 'identity' | 'familial_parent' | 'familial_sibling'
  | 'familial_distant' | 'exclusion' | 'inconclusive';

export type Priority = 'critical' | 'high' | 'normal' | 'low';

export interface DNASample {
  id: string;
  caseId: string;
  evidenceItemId?: string;
  sampleNumber: string;
  sampleType: DNASampleType;
  collectionMethod?: string;
  collectedAt: Date;
  collectedBy: string;
  collectionLocation: string;
  collectionNotes?: string;
  status: DNASampleStatus;
  storageLocation?: string;
  storageConditions?: string;
  quantityRemaining?: string;
  testingPriority: Priority;
  priorityReason?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DNATest {
  id: string;
  sampleId: string;
  caseId: string;
  testType: DNATestType;
  labName: string;
  labCaseNumber?: string;
  analystName?: string;
  status: DNATestStatus;
  requestedAt: Date;
  receivedAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  estimatedCompletion?: Date;
  profileObtained?: boolean;
  profileQuality?: ProfileQuality;
  lociCount?: number;
  reportDocumentId?: string;
  summary?: string;
  detailedResults?: Record<string, any>;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DNAProfile {
  id: string;
  caseId: string;
  testId?: string;
  sampleId?: string;
  profileNumber: string;
  profileType: ProfileType;
  personEntityId?: string;
  personName?: string;
  relationshipToCase?: string;
  quality: ProfileQuality;
  lociCount?: number;
  isMixture: boolean;
  contributorCount?: number;
  strProfile?: Record<string, [string, string]>; // Locus -> [Allele1, Allele2]
  yStrProfile?: Record<string, string>;
  mtDnaProfile?: string;
  uploadedToCodis: boolean;
  codisUploadDate?: Date;
  codisHit: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DNAMatch {
  id: string;
  caseId: string;
  profile1Id: string;
  profile2Id: string;
  matchType: MatchType;
  matchProbability?: number;
  likelihoodRatio?: number;
  lociCompared?: number;
  lociMatched?: number;
  verified: boolean;
  verifiedBy?: string;
  verifiedAt?: Date;
  investigativeValue?: 'critical' | 'high' | 'medium' | 'low';
  notes?: string;
  isCodisHit: boolean;
  codisHitDetails?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface DNAEvidenceStatus {
  caseId: string;
  totalSamples: number;
  samplesByStatus: Record<DNASampleStatus, number>;
  totalTests: number;
  testsByStatus: Record<DNATestStatus, number>;
  totalProfiles: number;
  totalMatches: number;
  criticalMatches: number;
  pendingTests: number;
  codisHits: number;
  queuedForTesting: QueuedSample[];
}

export interface QueuedSample {
  sampleId: string;
  sampleNumber: string;
  sampleType: DNASampleType;
  priority: Priority;
  priorityReason?: string;
  collectedAt: Date;
  collectionLocation: string;
  evidenceDescription?: string;
  daysInQueue: number;
}

// ============================================================================
// SAMPLE MANAGEMENT
// ============================================================================

/**
 * Create a new DNA sample record
 */
export async function createDNASample(
  caseId: string,
  data: {
    evidenceItemId?: string;
    sampleNumber: string;
    sampleType: DNASampleType;
    collectionMethod?: string;
    collectedAt: Date;
    collectedBy: string;
    collectionLocation: string;
    collectionNotes?: string;
    storageLocation?: string;
    testingPriority?: Priority;
    priorityReason?: string;
  }
): Promise<DNASample> {
  const { data: sample, error } = await supabaseServer
    .from('dna_samples')
    .insert({
      case_id: caseId,
      evidence_item_id: data.evidenceItemId,
      sample_number: data.sampleNumber,
      sample_type: data.sampleType,
      collection_method: data.collectionMethod,
      collected_at: data.collectedAt.toISOString(),
      collected_by: data.collectedBy,
      collection_location: data.collectionLocation,
      collection_notes: data.collectionNotes,
      storage_location: data.storageLocation,
      testing_priority: data.testingPriority || 'normal',
      priority_reason: data.priorityReason,
      status: 'collected',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create DNA sample: ${error.message}`);
  }

  return mapToSample(sample);
}

/**
 * Update sample status
 */
export async function updateSampleStatus(
  sampleId: string,
  status: DNASampleStatus,
  notes?: string
): Promise<DNASample> {
  const { data: sample, error } = await supabaseServer
    .from('dna_samples')
    .update({
      status,
      ...(notes ? { collection_notes: notes } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', sampleId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update sample status: ${error.message}`);
  }

  return mapToSample(sample);
}

/**
 * Set sample testing priority
 */
export async function setSamplePriority(
  sampleId: string,
  priority: Priority,
  reason: string
): Promise<DNASample> {
  const { data: sample, error } = await supabaseServer
    .from('dna_samples')
    .update({
      testing_priority: priority,
      priority_reason: reason,
      status: 'queued_for_testing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', sampleId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to set sample priority: ${error.message}`);
  }

  return mapToSample(sample);
}

/**
 * Get all samples for a case
 */
export async function getCaseSamples(
  caseId: string,
  filters?: { status?: DNASampleStatus; priority?: Priority }
): Promise<DNASample[]> {
  let query = supabaseServer
    .from('dna_samples')
    .select('*')
    .eq('case_id', caseId);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.priority) {
    query = query.eq('testing_priority', filters.priority);
  }

  const { data, error } = await query.order('collected_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch samples: ${error.message}`);
  }

  return (data || []).map(mapToSample);
}

// ============================================================================
// TEST MANAGEMENT
// ============================================================================

/**
 * Request a DNA test
 */
export async function requestDNATest(
  sampleId: string,
  data: {
    testType: DNATestType;
    labName: string;
    labCaseNumber?: string;
    analystName?: string;
    estimatedCompletion?: Date;
  }
): Promise<DNATest> {
  // Get the sample to get case ID
  const { data: sample } = await supabaseServer
    .from('dna_samples')
    .select('case_id')
    .eq('id', sampleId)
    .single();

  if (!sample) {
    throw new Error('Sample not found');
  }

  // Create test record
  const { data: test, error } = await supabaseServer
    .from('dna_tests')
    .insert({
      sample_id: sampleId,
      case_id: sample.case_id,
      test_type: data.testType,
      lab_name: data.labName,
      lab_case_number: data.labCaseNumber,
      analyst_name: data.analystName,
      status: 'requested',
      estimated_completion: data.estimatedCompletion?.toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to request DNA test: ${error.message}`);
  }

  // Update sample status
  await supabaseServer
    .from('dna_samples')
    .update({ status: 'in_testing' })
    .eq('id', sampleId);

  return mapToTest(test);
}

/**
 * Update test status with optional results
 */
export async function updateTestStatus(
  testId: string,
  status: DNATestStatus,
  results?: {
    profileObtained?: boolean;
    profileQuality?: ProfileQuality;
    lociCount?: number;
    summary?: string;
    detailedResults?: Record<string, any>;
  }
): Promise<DNATest> {
  const updateData: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (status === 'sample_received') {
    updateData.received_at = new Date().toISOString();
  } else if (status === 'in_progress') {
    updateData.started_at = new Date().toISOString();
  } else if (status === 'completed' || status === 'failed') {
    updateData.completed_at = new Date().toISOString();
  }

  if (results) {
    if (results.profileObtained !== undefined) updateData.profile_obtained = results.profileObtained;
    if (results.profileQuality) updateData.profile_quality = results.profileQuality;
    if (results.lociCount) updateData.loci_count = results.lociCount;
    if (results.summary) updateData.summary = results.summary;
    if (results.detailedResults) updateData.detailed_results = results.detailedResults;
  }

  const { data: test, error } = await supabaseServer
    .from('dna_tests')
    .update(updateData)
    .eq('id', testId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update test status: ${error.message}`);
  }

  // Update sample status based on test result
  if (status === 'completed') {
    await supabaseServer
      .from('dna_samples')
      .update({ status: 'tested' })
      .eq('id', test.sample_id);
  }

  return mapToTest(test);
}

/**
 * Get all tests for a case
 */
export async function getCaseTests(
  caseId: string,
  filters?: { status?: DNATestStatus }
): Promise<DNATest[]> {
  let query = supabaseServer
    .from('dna_tests')
    .select('*')
    .eq('case_id', caseId);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  const { data, error } = await query.order('requested_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch tests: ${error.message}`);
  }

  return (data || []).map(mapToTest);
}

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

/**
 * Create a DNA profile from test results
 */
export async function createDNAProfile(
  testId: string,
  data: {
    profileNumber: string;
    profileType: ProfileType;
    personEntityId?: string;
    personName?: string;
    relationshipToCase?: string;
    quality: ProfileQuality;
    lociCount?: number;
    isMixture?: boolean;
    contributorCount?: number;
    strProfile?: Record<string, [string, string]>;
    yStrProfile?: Record<string, string>;
    mtDnaProfile?: string;
  }
): Promise<DNAProfile> {
  // Get test info
  const { data: test } = await supabaseServer
    .from('dna_tests')
    .select('case_id, sample_id')
    .eq('id', testId)
    .single();

  if (!test) {
    throw new Error('Test not found');
  }

  const { data: profile, error } = await supabaseServer
    .from('dna_profiles')
    .insert({
      case_id: test.case_id,
      test_id: testId,
      sample_id: test.sample_id,
      profile_number: data.profileNumber,
      profile_type: data.profileType,
      person_entity_id: data.personEntityId,
      person_name: data.personName,
      relationship_to_case: data.relationshipToCase,
      quality: data.quality,
      loci_count: data.lociCount,
      is_mixture: data.isMixture || false,
      contributor_count: data.contributorCount,
      str_profile: data.strProfile,
      y_str_profile: data.yStrProfile,
      mt_dna_profile: data.mtDnaProfile,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create DNA profile: ${error.message}`);
  }

  return mapToProfile(profile);
}

/**
 * Compare two profiles and record the match
 */
export async function compareProfiles(
  profile1Id: string,
  profile2Id: string
): Promise<DNAMatch> {
  // Get both profiles
  const { data: profiles } = await supabaseServer
    .from('dna_profiles')
    .select('*')
    .in('id', [profile1Id, profile2Id]);

  if (!profiles || profiles.length !== 2) {
    throw new Error('One or both profiles not found');
  }

  const p1 = profiles.find(p => p.id === profile1Id)!;
  const p2 = profiles.find(p => p.id === profile2Id)!;

  // Compare STR profiles
  const comparisonResult = compareSTRProfiles(
    p1.str_profile as Record<string, [string, string]> || {},
    p2.str_profile as Record<string, [string, string]> || {}
  );

  // Determine match type
  let matchType: MatchType = 'inconclusive';
  let investigativeValue: 'critical' | 'high' | 'medium' | 'low' = 'low';

  if (comparisonResult.matchRatio >= 0.95) {
    matchType = 'identity';
    investigativeValue = 'critical';
  } else if (comparisonResult.matchRatio >= 0.75) {
    matchType = 'familial_parent';
    investigativeValue = 'high';
  } else if (comparisonResult.matchRatio >= 0.50) {
    matchType = 'familial_sibling';
    investigativeValue = 'high';
  } else if (comparisonResult.matchRatio >= 0.25) {
    matchType = 'familial_distant';
    investigativeValue = 'medium';
  } else if (comparisonResult.matchRatio === 0) {
    matchType = 'exclusion';
    investigativeValue = 'medium';
  }

  const { data: match, error } = await supabaseServer
    .from('dna_matches')
    .insert({
      case_id: p1.case_id,
      profile_1_id: profile1Id,
      profile_2_id: profile2Id,
      match_type: matchType,
      match_probability: comparisonResult.matchProbability,
      likelihood_ratio: comparisonResult.likelihoodRatio,
      loci_compared: comparisonResult.lociCompared,
      loci_matched: comparisonResult.lociMatched,
      investigative_value: investigativeValue,
      notes: comparisonResult.notes,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record match: ${error.message}`);
  }

  return mapToMatch(match);
}

/**
 * Find potential matches for a profile within a case
 */
export async function findPotentialMatches(
  profileId: string,
  caseId: string
): Promise<{ profile: DNAProfile; similarity: number }[]> {
  // Get the source profile
  const { data: sourceProfile } = await supabaseServer
    .from('dna_profiles')
    .select('*')
    .eq('id', profileId)
    .single();

  if (!sourceProfile) {
    throw new Error('Profile not found');
  }

  // Get all other profiles in the case
  const { data: otherProfiles } = await supabaseServer
    .from('dna_profiles')
    .select('*')
    .eq('case_id', caseId)
    .neq('id', profileId);

  const matches: { profile: DNAProfile; similarity: number }[] = [];

  for (const other of otherProfiles || []) {
    const comparison = compareSTRProfiles(
      sourceProfile.str_profile as Record<string, [string, string]> || {},
      other.str_profile as Record<string, [string, string]> || {}
    );

    if (comparison.matchRatio > 0.2) { // Only include if some similarity
      matches.push({
        profile: mapToProfile(other),
        similarity: comparison.matchRatio,
      });
    }
  }

  return matches.sort((a, b) => b.similarity - a.similarity);
}

/**
 * Update CODIS status for a profile
 */
export async function updateCodisStatus(
  profileId: string,
  uploaded: boolean,
  hit?: boolean,
  hitDetails?: Record<string, any>
): Promise<DNAProfile> {
  const updateData: any = {
    uploaded_to_codis: uploaded,
    updated_at: new Date().toISOString(),
  };

  if (uploaded && !updateData.codis_upload_date) {
    updateData.codis_upload_date = new Date().toISOString();
  }

  if (hit !== undefined) {
    updateData.codis_hit = hit;
  }

  if (hitDetails) {
    updateData.codis_hit_details = hitDetails;
  }

  const { data: profile, error } = await supabaseServer
    .from('dna_profiles')
    .update(updateData)
    .eq('id', profileId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update CODIS status: ${error.message}`);
  }

  return mapToProfile(profile);
}

// ============================================================================
// DASHBOARD & REPORTING
// ============================================================================

/**
 * Get comprehensive DNA evidence status for a case
 */
export async function getDNAEvidenceStatus(caseId: string): Promise<DNAEvidenceStatus> {
  // Get all samples
  const { data: samples } = await supabaseServer
    .from('dna_samples')
    .select('status')
    .eq('case_id', caseId);

  // Get all tests
  const { data: tests } = await supabaseServer
    .from('dna_tests')
    .select('status')
    .eq('case_id', caseId);

  // Get profiles and matches
  const { data: profiles } = await supabaseServer
    .from('dna_profiles')
    .select('codis_hit')
    .eq('case_id', caseId);

  const { data: matches } = await supabaseServer
    .from('dna_matches')
    .select('match_type, investigative_value')
    .eq('case_id', caseId);

  // Get queued samples
  const queuedSamples = await getTestingQueue(caseId);

  // Calculate status counts
  const samplesByStatus: Record<string, number> = {};
  (samples || []).forEach(s => {
    samplesByStatus[s.status] = (samplesByStatus[s.status] || 0) + 1;
  });

  const testsByStatus: Record<string, number> = {};
  (tests || []).forEach(t => {
    testsByStatus[t.status] = (testsByStatus[t.status] || 0) + 1;
  });

  const criticalMatches = (matches || []).filter(
    m => m.investigative_value === 'critical'
  ).length;

  const codisHits = (profiles || []).filter(p => p.codis_hit).length;

  const pendingTests = (tests || []).filter(
    t => !['completed', 'failed', 'cancelled'].includes(t.status)
  ).length;

  return {
    caseId,
    totalSamples: samples?.length || 0,
    samplesByStatus: samplesByStatus as Record<DNASampleStatus, number>,
    totalTests: tests?.length || 0,
    testsByStatus: testsByStatus as Record<DNATestStatus, number>,
    totalProfiles: profiles?.length || 0,
    totalMatches: matches?.length || 0,
    criticalMatches,
    pendingTests,
    codisHits,
    queuedForTesting: queuedSamples,
  };
}

/**
 * Get the testing queue for a case
 */
export async function getTestingQueue(caseId: string): Promise<QueuedSample[]> {
  const { data: samples, error } = await supabaseServer
    .from('dna_samples')
    .select(`
      id,
      sample_number,
      sample_type,
      testing_priority,
      priority_reason,
      collected_at,
      collection_location,
      evidence_items (description)
    `)
    .eq('case_id', caseId)
    .in('status', ['collected', 'stored', 'queued_for_testing'])
    .order('testing_priority', { ascending: true })
    .order('collected_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch testing queue:', error);
    return [];
  }

  const now = new Date();

  return (samples || []).map(s => ({
    sampleId: s.id,
    sampleNumber: s.sample_number,
    sampleType: s.sample_type as DNASampleType,
    priority: s.testing_priority as Priority,
    priorityReason: s.priority_reason,
    collectedAt: new Date(s.collected_at),
    collectionLocation: s.collection_location,
    evidenceDescription: (s.evidence_items as any)?.description,
    daysInQueue: Math.floor((now.getTime() - new Date(s.collected_at).getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

/**
 * Get all matches for a case
 */
export async function getCaseMatches(
  caseId: string,
  filters?: { matchType?: MatchType; verified?: boolean }
): Promise<DNAMatch[]> {
  let query = supabaseServer
    .from('dna_matches')
    .select(`
      *,
      profile1:dna_profiles!profile_1_id(profile_number, person_name, profile_type),
      profile2:dna_profiles!profile_2_id(profile_number, person_name, profile_type)
    `)
    .eq('case_id', caseId);

  if (filters?.matchType) {
    query = query.eq('match_type', filters.matchType);
  }
  if (filters?.verified !== undefined) {
    query = query.eq('verified', filters.verified);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch matches: ${error.message}`);
  }

  return (data || []).map(mapToMatch);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function compareSTRProfiles(
  profile1: Record<string, [string, string]>,
  profile2: Record<string, [string, string]>
): {
  matchRatio: number;
  matchProbability: number;
  likelihoodRatio: number;
  lociCompared: number;
  lociMatched: number;
  notes: string;
} {
  const loci1 = Object.keys(profile1);
  const loci2 = Object.keys(profile2);
  const commonLoci = loci1.filter(l => loci2.includes(l));

  if (commonLoci.length === 0) {
    return {
      matchRatio: 0,
      matchProbability: 0,
      likelihoodRatio: 0,
      lociCompared: 0,
      lociMatched: 0,
      notes: 'No common loci to compare',
    };
  }

  let matched = 0;
  for (const locus of commonLoci) {
    const alleles1 = profile1[locus];
    const alleles2 = profile2[locus];

    // Check if alleles match (accounting for heterozygotes)
    const set1 = new Set(alleles1);
    const set2 = new Set(alleles2);
    const intersection = [...set1].filter(a => set2.has(a));

    if (intersection.length > 0) {
      matched++;
    }
  }

  const matchRatio = matched / commonLoci.length;

  // Simplified probability calculation
  const matchProbability = Math.pow(0.1, commonLoci.length - matched);
  const likelihoodRatio = matchProbability > 0 ? 1 / matchProbability : Infinity;

  let notes = '';
  if (matchRatio >= 0.95) {
    notes = 'Strong match - likely same individual';
  } else if (matchRatio >= 0.75) {
    notes = 'Partial match - possible familial relationship';
  } else if (matchRatio >= 0.5) {
    notes = 'Limited match - distant relationship possible';
  } else {
    notes = 'Low similarity - unlikely related';
  }

  return {
    matchRatio,
    matchProbability,
    likelihoodRatio,
    lociCompared: commonLoci.length,
    lociMatched: matched,
    notes,
  };
}

function mapToSample(data: any): DNASample {
  return {
    id: data.id,
    caseId: data.case_id,
    evidenceItemId: data.evidence_item_id,
    sampleNumber: data.sample_number,
    sampleType: data.sample_type,
    collectionMethod: data.collection_method,
    collectedAt: new Date(data.collected_at),
    collectedBy: data.collected_by,
    collectionLocation: data.collection_location,
    collectionNotes: data.collection_notes,
    status: data.status,
    storageLocation: data.storage_location,
    storageConditions: data.storage_conditions,
    quantityRemaining: data.quantity_remaining,
    testingPriority: data.testing_priority || 'normal',
    priorityReason: data.priority_reason,
    metadata: data.metadata,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

function mapToTest(data: any): DNATest {
  return {
    id: data.id,
    sampleId: data.sample_id,
    caseId: data.case_id,
    testType: data.test_type,
    labName: data.lab_name,
    labCaseNumber: data.lab_case_number,
    analystName: data.analyst_name,
    status: data.status,
    requestedAt: new Date(data.requested_at),
    receivedAt: data.received_at ? new Date(data.received_at) : undefined,
    startedAt: data.started_at ? new Date(data.started_at) : undefined,
    completedAt: data.completed_at ? new Date(data.completed_at) : undefined,
    estimatedCompletion: data.estimated_completion ? new Date(data.estimated_completion) : undefined,
    profileObtained: data.profile_obtained,
    profileQuality: data.profile_quality,
    lociCount: data.loci_count,
    reportDocumentId: data.report_document_id,
    summary: data.summary,
    detailedResults: data.detailed_results,
    metadata: data.metadata,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

function mapToProfile(data: any): DNAProfile {
  return {
    id: data.id,
    caseId: data.case_id,
    testId: data.test_id,
    sampleId: data.sample_id,
    profileNumber: data.profile_number,
    profileType: data.profile_type,
    personEntityId: data.person_entity_id,
    personName: data.person_name,
    relationshipToCase: data.relationship_to_case,
    quality: data.quality,
    lociCount: data.loci_count,
    isMixture: data.is_mixture || false,
    contributorCount: data.contributor_count,
    strProfile: data.str_profile,
    yStrProfile: data.y_str_profile,
    mtDnaProfile: data.mt_dna_profile,
    uploadedToCodis: data.uploaded_to_codis || false,
    codisUploadDate: data.codis_upload_date ? new Date(data.codis_upload_date) : undefined,
    codisHit: data.codis_hit || false,
    metadata: data.metadata,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}

function mapToMatch(data: any): DNAMatch {
  return {
    id: data.id,
    caseId: data.case_id,
    profile1Id: data.profile_1_id,
    profile2Id: data.profile_2_id,
    matchType: data.match_type,
    matchProbability: data.match_probability,
    likelihoodRatio: data.likelihood_ratio,
    lociCompared: data.loci_compared,
    lociMatched: data.loci_matched,
    verified: data.verified || false,
    verifiedBy: data.verified_by,
    verifiedAt: data.verified_at ? new Date(data.verified_at) : undefined,
    investigativeValue: data.investigative_value,
    notes: data.notes,
    isCodisHit: data.is_codis_hit || false,
    codisHitDetails: data.codis_hit_details,
    createdAt: new Date(data.created_at),
    updatedAt: new Date(data.updated_at),
  };
}
