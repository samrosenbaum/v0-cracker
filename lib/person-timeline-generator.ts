/**
 * Person Timeline Generator
 *
 * Creates comprehensive timelines for individuals by aggregating:
 * - Direct timeline events
 * - Claims they made about their own whereabouts
 * - Claims others made about seeing/interacting with them
 * - Phone records, transactions, camera sightings
 * - Identifies gaps and inconsistencies
 */

import { supabaseServer } from './supabase-server';
import { getCaseInconsistencies, DetectedInconsistency } from './inconsistency-detector';

export interface PersonTimeline {
  entityId: string;
  caseId: string;
  personName: string;
  role: string;
  events: PersonTimelineEvent[];
  gaps: TimelineGap[];
  inconsistencies: DetectedInconsistency[];
  interactionsWith: InteractionSummary[];
  activitySummary: ActivitySummary;
  credibilityAssessment: CredibilityAssessment;
  metadata: {
    generatedAt: Date;
    totalEvents: number;
    verifiedEvents: number;
    unverifiedEvents: number;
    timeRange: { start: Date; end: Date } | null;
  };
}

export interface PersonTimelineEvent {
  id: string;
  timestamp: Date;
  timestampPrecision: 'exact' | 'approximate' | 'estimated' | 'range' | 'unknown';
  timeRangeStart?: Date;
  timeRangeEnd?: Date;
  eventType: TimelineEventType;
  title: string;
  description: string;
  location?: string;
  locationCoordinates?: { lat: number; lng: number };
  source: EventSource;
  verificationStatus: 'verified' | 'unverified' | 'contradicted' | 'partial';
  confidence: number;
  relatedPersonIds: string[];
  linkedClaimId?: string;
  isSuspicious: boolean;
  flags: string[];
}

export type TimelineEventType =
  | 'location_sighting'
  | 'phone_activity'
  | 'social_media_activity'
  | 'financial_transaction'
  | 'vehicle_movement'
  | 'witness_observation'
  | 'camera_footage'
  | 'interview_statement'
  | 'physical_evidence'
  | 'digital_footprint'
  | 'interaction_with_victim'
  | 'interaction_with_suspect'
  | 'alibi_claim'
  | 'work_activity'
  | 'other';

export interface EventSource {
  type: 'statement' | 'document' | 'phone_record' | 'camera' | 'witness' | 'financial_record' | 'digital' | 'physical_evidence' | 'other';
  documentId?: string;
  claimId?: string;
  reportedBy?: string;
  reportedDate?: Date;
}

export interface TimelineGap {
  id?: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  lastKnownLocation?: string;
  lastKnownActivity?: string;
  nextKnownLocation?: string;
  nextKnownActivity?: string;
  significance: 'low' | 'medium' | 'high' | 'critical';
  coversIncidentTime: boolean;
  hasExplanation: boolean;
  explanation?: string;
}

export interface InteractionSummary {
  otherPersonId: string;
  otherPersonName: string;
  otherPersonRole: string;
  interactionCount: number;
  firstInteraction: Date;
  lastInteraction: Date;
  interactionTypes: string[];
  suspicionLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface ActivitySummary {
  totalLocationsVisited: number;
  mostFrequentLocations: { location: string; count: number }[];
  activityByHour: { hour: number; count: number }[];
  activityByDayOfWeek: { day: string; count: number }[];
  typicalRoutine: string;
  unusualActivities: string[];
}

export interface CredibilityAssessment {
  overallScore: number; // 0-100
  consistencyScore: number;
  verificationScore: number;
  contradictionCount: number;
  storyChanges: number;
  redFlags: string[];
  positiveIndicators: string[];
}

export interface TimelineGenerationOptions {
  startTime?: Date;
  endTime?: Date;
  includeUnverified?: boolean;
  detectGaps?: boolean;
  minGapDurationMinutes?: number;
  includeInconsistencies?: boolean;
}

const DEFAULT_OPTIONS: TimelineGenerationOptions = {
  includeUnverified: true,
  detectGaps: true,
  minGapDurationMinutes: 60,
  includeInconsistencies: true,
};

/**
 * Generate a comprehensive timeline for a person
 */
export async function generatePersonTimeline(
  caseId: string,
  entityId: string,
  options: TimelineGenerationOptions = {}
): Promise<PersonTimeline> {
  const fullOptions = { ...DEFAULT_OPTIONS, ...options };

  console.log(`[Timeline Generator] Generating timeline for entity ${entityId}`);

  // Get entity information
  const { data: entity } = await supabaseServer
    .from('canonical_entities')
    .select('*')
    .eq('id', entityId)
    .single();

  if (!entity) {
    throw new Error(`Entity not found: ${entityId}`);
  }

  // Collect all timeline events from various sources
  const events: PersonTimelineEvent[] = [];

  // 1. Get events from person_timeline_events table
  const directEvents = await getDirectTimelineEvents(entityId, fullOptions);
  events.push(...directEvents);

  // 2. Get events from statement claims (what they said about themselves)
  const selfClaimEvents = await getEventsFromSelfClaims(caseId, entityId, fullOptions);
  events.push(...selfClaimEvents);

  // 3. Get events from observations by others
  const observationEvents = await getEventsFromObservations(caseId, entityId, fullOptions);
  events.push(...observationEvents);

  // 4. Get events from existing timeline_events table
  const legacyEvents = await getLegacyTimelineEvents(caseId, entityId, fullOptions);
  events.push(...legacyEvents);

  // Sort events by timestamp
  events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  // Deduplicate similar events
  const deduplicatedEvents = deduplicateEvents(events);

  // Detect gaps
  let gaps: TimelineGap[] = [];
  if (fullOptions.detectGaps && deduplicatedEvents.length >= 2) {
    gaps = detectTimelineGaps(deduplicatedEvents, fullOptions.minGapDurationMinutes!);
  }

  // Get inconsistencies for this person
  let inconsistencies: DetectedInconsistency[] = [];
  if (fullOptions.includeInconsistencies) {
    inconsistencies = await getCaseInconsistencies(caseId, { speakerId: entityId });
  }

  // Calculate interactions with others
  const interactions = calculateInteractions(deduplicatedEvents);

  // Generate activity summary
  const activitySummary = generateActivitySummary(deduplicatedEvents);

  // Assess credibility
  const credibilityAssessment = assessCredibility(
    deduplicatedEvents,
    inconsistencies,
    gaps
  );

  // Calculate time range
  const timeRange = deduplicatedEvents.length > 0
    ? {
        start: deduplicatedEvents[0].timestamp,
        end: deduplicatedEvents[deduplicatedEvents.length - 1].timestamp,
      }
    : null;

  // Save timeline events to database
  await saveTimelineEvents(entityId, caseId, deduplicatedEvents);
  await saveTimelineGaps(entityId, caseId, gaps);

  return {
    entityId,
    caseId,
    personName: entity.canonical_name,
    role: entity.role || 'unknown',
    events: deduplicatedEvents,
    gaps,
    inconsistencies,
    interactionsWith: interactions,
    activitySummary,
    credibilityAssessment,
    metadata: {
      generatedAt: new Date(),
      totalEvents: deduplicatedEvents.length,
      verifiedEvents: deduplicatedEvents.filter(e => e.verificationStatus === 'verified').length,
      unverifiedEvents: deduplicatedEvents.filter(e => e.verificationStatus === 'unverified').length,
      timeRange,
    },
  };
}

/**
 * Generate timelines for all people in a case
 */
export async function generateAllPersonTimelines(
  caseId: string,
  options: TimelineGenerationOptions = {}
): Promise<Map<string, PersonTimeline>> {
  const { data: entities } = await supabaseServer
    .from('canonical_entities')
    .select('id')
    .eq('case_id', caseId)
    .eq('entity_type', 'person');

  const timelines = new Map<string, PersonTimeline>();

  for (const entity of entities || []) {
    try {
      const timeline = await generatePersonTimeline(caseId, entity.id, options);
      timelines.set(entity.id, timeline);
    } catch (error) {
      console.error(`[Timeline Generator] Failed to generate timeline for ${entity.id}:`, error);
    }
  }

  return timelines;
}

/**
 * Get a person's timeline from the database
 */
export async function getPersonTimeline(
  caseId: string,
  entityId: string
): Promise<PersonTimeline | null> {
  // Get entity info
  const { data: entity } = await supabaseServer
    .from('canonical_entities')
    .select('*')
    .eq('id', entityId)
    .single();

  if (!entity) return null;

  // Get saved timeline events
  const { data: events } = await supabaseServer
    .from('person_timeline_events')
    .select('*')
    .eq('entity_id', entityId)
    .order('event_time', { ascending: true });

  // Get gaps
  const { data: gaps } = await supabaseServer
    .from('timeline_gaps')
    .select('*')
    .eq('entity_id', entityId)
    .order('gap_start', { ascending: true });

  // Get inconsistencies
  const inconsistencies = await getCaseInconsistencies(caseId, { speakerId: entityId });

  const mappedEvents = (events || []).map(mapToTimelineEvent);
  const mappedGaps = (gaps || []).map(mapToTimelineGap);

  return {
    entityId,
    caseId,
    personName: entity.canonical_name,
    role: entity.role || 'unknown',
    events: mappedEvents,
    gaps: mappedGaps,
    inconsistencies,
    interactionsWith: calculateInteractions(mappedEvents),
    activitySummary: generateActivitySummary(mappedEvents),
    credibilityAssessment: assessCredibility(mappedEvents, inconsistencies, mappedGaps),
    metadata: {
      generatedAt: new Date(),
      totalEvents: mappedEvents.length,
      verifiedEvents: mappedEvents.filter(e => e.verificationStatus === 'verified').length,
      unverifiedEvents: mappedEvents.filter(e => e.verificationStatus === 'unverified').length,
      timeRange: mappedEvents.length > 0
        ? { start: mappedEvents[0].timestamp, end: mappedEvents[mappedEvents.length - 1].timestamp }
        : null,
    },
  };
}

// ============================================================================
// DATA COLLECTION FUNCTIONS
// ============================================================================

async function getDirectTimelineEvents(
  entityId: string,
  options: TimelineGenerationOptions
): Promise<PersonTimelineEvent[]> {
  let query = supabaseServer
    .from('person_timeline_events')
    .select('*')
    .eq('entity_id', entityId);

  if (options.startTime) {
    query = query.gte('event_time', options.startTime.toISOString());
  }
  if (options.endTime) {
    query = query.lte('event_time', options.endTime.toISOString());
  }

  const { data } = await query.order('event_time', { ascending: true });

  return (data || []).map(mapToTimelineEvent);
}

async function getEventsFromSelfClaims(
  caseId: string,
  entityId: string,
  options: TimelineGenerationOptions
): Promise<PersonTimelineEvent[]> {
  // Get claims where this person is the speaker talking about themselves
  let query = supabaseServer
    .from('statement_claims')
    .select(`
      *,
      statements!inner(speaker_entity_id, speaker_name, statement_date)
    `)
    .eq('case_id', caseId)
    .eq('subject_entity_id', entityId)
    .eq('statements.speaker_entity_id', entityId)
    .not('claimed_datetime', 'is', null);

  if (options.startTime) {
    query = query.gte('claimed_datetime', options.startTime.toISOString());
  }
  if (options.endTime) {
    query = query.lte('claimed_datetime', options.endTime.toISOString());
  }

  const { data: claims } = await query;

  return (claims || []).map(claim => ({
    id: `claim-${claim.id}`,
    timestamp: new Date(claim.claimed_datetime),
    timestampPrecision: claim.time_precision || 'approximate',
    eventType: claim.is_alibi_claim ? 'alibi_claim' : 'interview_statement',
    title: claim.claim_type === 'location_at_time' ? 'Location claim' : 'Self-reported activity',
    description: claim.claim_text,
    location: claim.claimed_location,
    source: {
      type: 'statement' as const,
      claimId: claim.id,
      reportedBy: claim.statements?.speaker_name,
      reportedDate: claim.statements?.statement_date ? new Date(claim.statements.statement_date) : undefined,
    },
    verificationStatus: claim.verification_status || 'unverified',
    confidence: claim.extraction_confidence || 0.7,
    relatedPersonIds: [],
    linkedClaimId: claim.id,
    isSuspicious: false,
    flags: claim.is_alibi_claim ? ['alibi'] : [],
  } as PersonTimelineEvent));
}

async function getEventsFromObservations(
  caseId: string,
  entityId: string,
  options: TimelineGenerationOptions
): Promise<PersonTimelineEvent[]> {
  // Get claims where others observed this person
  let query = supabaseServer
    .from('statement_claims')
    .select(`
      *,
      statements!inner(speaker_entity_id, speaker_name, statement_date)
    `)
    .eq('case_id', caseId)
    .eq('subject_entity_id', entityId)
    .neq('statements.speaker_entity_id', entityId)
    .eq('claim_type', 'observation')
    .not('claimed_datetime', 'is', null);

  if (options.startTime) {
    query = query.gte('claimed_datetime', options.startTime.toISOString());
  }
  if (options.endTime) {
    query = query.lte('claimed_datetime', options.endTime.toISOString());
  }

  const { data: claims } = await query;

  return (claims || []).map(claim => ({
    id: `obs-${claim.id}`,
    timestamp: new Date(claim.claimed_datetime),
    timestampPrecision: claim.time_precision || 'approximate',
    eventType: 'witness_observation',
    title: `Observed by ${claim.statements?.speaker_name}`,
    description: claim.claim_text,
    location: claim.claimed_location,
    source: {
      type: 'witness' as const,
      claimId: claim.id,
      reportedBy: claim.statements?.speaker_name,
      reportedDate: claim.statements?.statement_date ? new Date(claim.statements.statement_date) : undefined,
    },
    verificationStatus: 'unverified',
    confidence: claim.extraction_confidence || 0.6,
    relatedPersonIds: [claim.statements?.speaker_entity_id].filter(Boolean),
    linkedClaimId: claim.id,
    isSuspicious: false,
    flags: ['third_party_observation'],
  } as PersonTimelineEvent));
}

async function getLegacyTimelineEvents(
  caseId: string,
  entityId: string,
  options: TimelineGenerationOptions
): Promise<PersonTimelineEvent[]> {
  // Get events from the existing timeline_events table
  let query = supabaseServer
    .from('timeline_events')
    .select('*')
    .eq('case_id', caseId)
    .or(`primary_entity_id.eq.${entityId},related_entity_ids.cs.{${entityId}}`);

  if (options.startTime) {
    query = query.gte('event_time', options.startTime.toISOString());
  }
  if (options.endTime) {
    query = query.lte('event_time', options.endTime.toISOString());
  }

  const { data } = await query.order('event_time', { ascending: true });

  return (data || []).map(event => ({
    id: `legacy-${event.id}`,
    timestamp: event.event_time ? new Date(event.event_time) : new Date(event.event_date),
    timestampPrecision: event.time_precision || 'approximate',
    eventType: mapLegacyEventType(event.event_type),
    title: event.title,
    description: event.description,
    location: event.location,
    source: {
      type: event.source_type || 'other',
      documentId: event.source_document_id,
    },
    verificationStatus: event.verification_status || 'unverified',
    confidence: event.confidence_score || 0.7,
    relatedPersonIds: event.related_entity_ids || [],
    isSuspicious: event.is_suspicious || false,
    flags: event.flags || [],
  } as PersonTimelineEvent));
}

// ============================================================================
// ANALYSIS FUNCTIONS
// ============================================================================

function detectTimelineGaps(
  events: PersonTimelineEvent[],
  minGapMinutes: number
): TimelineGap[] {
  const gaps: TimelineGap[] = [];

  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1];
    const curr = events[i];

    const gapMinutes = (curr.timestamp.getTime() - prev.timestamp.getTime()) / 60000;

    if (gapMinutes >= minGapMinutes) {
      // Determine significance based on gap duration
      let significance: TimelineGap['significance'] = 'low';
      if (gapMinutes > 480) significance = 'critical'; // 8+ hours
      else if (gapMinutes > 240) significance = 'high'; // 4+ hours
      else if (gapMinutes > 120) significance = 'medium'; // 2+ hours

      gaps.push({
        startTime: prev.timestamp,
        endTime: curr.timestamp,
        durationMinutes: Math.round(gapMinutes),
        lastKnownLocation: prev.location,
        lastKnownActivity: prev.title,
        nextKnownLocation: curr.location,
        nextKnownActivity: curr.title,
        significance,
        coversIncidentTime: false, // Would need incident time to determine
        hasExplanation: false,
      });
    }
  }

  return gaps;
}

function calculateInteractions(events: PersonTimelineEvent[]): InteractionSummary[] {
  const interactionMap = new Map<string, {
    count: number;
    types: Set<string>;
    first: Date;
    last: Date;
  }>();

  for (const event of events) {
    for (const personId of event.relatedPersonIds) {
      if (!interactionMap.has(personId)) {
        interactionMap.set(personId, {
          count: 0,
          types: new Set(),
          first: event.timestamp,
          last: event.timestamp,
        });
      }

      const data = interactionMap.get(personId)!;
      data.count++;
      data.types.add(event.eventType);
      if (event.timestamp < data.first) data.first = event.timestamp;
      if (event.timestamp > data.last) data.last = event.timestamp;
    }
  }

  // Convert to array
  const interactions: InteractionSummary[] = [];
  for (const [personId, data] of interactionMap) {
    interactions.push({
      otherPersonId: personId,
      otherPersonName: 'Unknown', // Would need to fetch
      otherPersonRole: 'unknown',
      interactionCount: data.count,
      firstInteraction: data.first,
      lastInteraction: data.last,
      interactionTypes: Array.from(data.types),
      suspicionLevel: data.count > 10 ? 'high' : data.count > 5 ? 'medium' : 'low',
    });
  }

  return interactions.sort((a, b) => b.interactionCount - a.interactionCount);
}

function generateActivitySummary(events: PersonTimelineEvent[]): ActivitySummary {
  // Count locations
  const locationCounts = new Map<string, number>();
  for (const event of events) {
    if (event.location) {
      const count = locationCounts.get(event.location) || 0;
      locationCounts.set(event.location, count + 1);
    }
  }

  const mostFrequentLocations = Array.from(locationCounts.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Activity by hour
  const hourCounts = new Array(24).fill(0);
  for (const event of events) {
    const hour = event.timestamp.getHours();
    hourCounts[hour]++;
  }

  const activityByHour = hourCounts.map((count, hour) => ({ hour, count }));

  // Activity by day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayCounts = new Array(7).fill(0);
  for (const event of events) {
    const day = event.timestamp.getDay();
    dayCounts[day]++;
  }

  const activityByDayOfWeek = dayCounts.map((count, i) => ({ day: dayNames[i], count }));

  // Detect unusual activities
  const unusualActivities: string[] = [];
  for (const event of events) {
    if (event.isSuspicious || event.flags.length > 0) {
      unusualActivities.push(event.title);
    }
  }

  return {
    totalLocationsVisited: locationCounts.size,
    mostFrequentLocations,
    activityByHour,
    activityByDayOfWeek,
    typicalRoutine: mostFrequentLocations.length > 0
      ? `Frequently at: ${mostFrequentLocations.slice(0, 3).map(l => l.location).join(', ')}`
      : 'No routine pattern detected',
    unusualActivities: [...new Set(unusualActivities)].slice(0, 10),
  };
}

function assessCredibility(
  events: PersonTimelineEvent[],
  inconsistencies: DetectedInconsistency[],
  gaps: TimelineGap[]
): CredibilityAssessment {
  const redFlags: string[] = [];
  const positiveIndicators: string[] = [];

  // Count verified vs unverified
  const verified = events.filter(e => e.verificationStatus === 'verified').length;
  const contradicted = events.filter(e => e.verificationStatus === 'contradicted').length;
  const total = events.length;

  const verificationScore = total > 0 ? (verified / total) * 100 : 50;

  // Assess inconsistencies
  const criticalInconsistencies = inconsistencies.filter(i => i.severity === 'critical').length;
  const significantInconsistencies = inconsistencies.filter(i => i.severity === 'significant').length;

  if (criticalInconsistencies > 0) {
    redFlags.push(`${criticalInconsistencies} critical inconsistency(ies) detected`);
  }
  if (significantInconsistencies > 0) {
    redFlags.push(`${significantInconsistencies} significant inconsistency(ies) detected`);
  }

  // Assess gaps
  const criticalGaps = gaps.filter(g => g.significance === 'critical').length;
  if (criticalGaps > 0) {
    redFlags.push(`${criticalGaps} major unexplained gap(s) in timeline`);
  }

  // Positive indicators
  if (verified > 5) {
    positiveIndicators.push(`${verified} events independently verified`);
  }
  if (inconsistencies.length === 0) {
    positiveIndicators.push('No inconsistencies detected in statements');
  }

  // Calculate consistency score
  const consistencyScore = Math.max(0, 100 - (inconsistencies.length * 10) - (contradicted * 5));

  // Calculate overall score
  const overallScore = Math.round(
    (verificationScore * 0.3) +
    (consistencyScore * 0.5) +
    ((100 - criticalGaps * 20) * 0.2)
  );

  return {
    overallScore: Math.max(0, Math.min(100, overallScore)),
    consistencyScore: Math.max(0, Math.min(100, consistencyScore)),
    verificationScore: Math.round(verificationScore),
    contradictionCount: contradicted + inconsistencies.length,
    storyChanges: inconsistencies.filter(i => i.inconsistencyType === 'self_contradiction').length,
    redFlags,
    positiveIndicators,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function deduplicateEvents(events: PersonTimelineEvent[]): PersonTimelineEvent[] {
  const seen = new Map<string, PersonTimelineEvent>();

  for (const event of events) {
    // Create a key based on time, location, and type
    const timeKey = Math.floor(event.timestamp.getTime() / (5 * 60 * 1000)); // 5-minute windows
    const key = `${timeKey}-${event.location || 'unknown'}-${event.eventType}`;

    const existing = seen.get(key);
    if (!existing || event.confidence > existing.confidence) {
      seen.set(key, event);
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
}

async function saveTimelineEvents(
  entityId: string,
  caseId: string,
  events: PersonTimelineEvent[]
): Promise<void> {
  // Clear existing events for this entity
  await supabaseServer
    .from('person_timeline_events')
    .delete()
    .eq('entity_id', entityId);

  if (events.length === 0) return;

  const records = events.map(e => ({
    case_id: caseId,
    entity_id: entityId,
    event_time: e.timestamp.toISOString(),
    time_precision: e.timestampPrecision,
    time_range_start: e.timeRangeStart?.toISOString(),
    time_range_end: e.timeRangeEnd?.toISOString(),
    event_type: e.eventType,
    title: e.title,
    description: e.description,
    location: e.location,
    location_coordinates: e.locationCoordinates,
    source_type: e.source.type,
    source_document_id: e.source.documentId,
    source_claim_id: e.source.claimId,
    reported_by: e.source.reportedBy,
    verification_status: e.verificationStatus,
    confidence_score: e.confidence,
    related_entity_ids: e.relatedPersonIds,
    is_suspicious: e.isSuspicious,
  }));

  // Insert in batches
  const batchSize = 100;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    await supabaseServer
      .from('person_timeline_events')
      .insert(batch);
  }
}

async function saveTimelineGaps(
  entityId: string,
  caseId: string,
  gaps: TimelineGap[]
): Promise<void> {
  // Clear existing gaps
  await supabaseServer
    .from('timeline_gaps')
    .delete()
    .eq('entity_id', entityId);

  if (gaps.length === 0) return;

  const records = gaps.map(g => ({
    case_id: caseId,
    entity_id: entityId,
    gap_start: g.startTime.toISOString(),
    gap_end: g.endTime.toISOString(),
    duration_minutes: g.durationMinutes,
    last_known_location: g.lastKnownLocation,
    last_known_activity: g.lastKnownActivity,
    next_known_location: g.nextKnownLocation,
    next_known_activity: g.nextKnownActivity,
    significance: g.significance,
    covers_incident_time: g.coversIncidentTime,
    explanation_provided: g.hasExplanation,
    explanation: g.explanation,
  }));

  await supabaseServer
    .from('timeline_gaps')
    .insert(records);
}

function mapToTimelineEvent(data: any): PersonTimelineEvent {
  return {
    id: data.id,
    timestamp: new Date(data.event_time),
    timestampPrecision: data.time_precision || 'approximate',
    timeRangeStart: data.time_range_start ? new Date(data.time_range_start) : undefined,
    timeRangeEnd: data.time_range_end ? new Date(data.time_range_end) : undefined,
    eventType: data.event_type,
    title: data.title,
    description: data.description,
    location: data.location,
    locationCoordinates: data.location_coordinates,
    source: {
      type: data.source_type || 'other',
      documentId: data.source_document_id,
      claimId: data.source_claim_id,
      reportedBy: data.reported_by,
    },
    verificationStatus: data.verification_status || 'unverified',
    confidence: data.confidence_score || 0.7,
    relatedPersonIds: data.related_entity_ids || [],
    linkedClaimId: data.source_claim_id,
    isSuspicious: data.is_suspicious || false,
    flags: [],
  };
}

function mapToTimelineGap(data: any): TimelineGap {
  return {
    id: data.id,
    startTime: new Date(data.gap_start),
    endTime: new Date(data.gap_end),
    durationMinutes: data.duration_minutes,
    lastKnownLocation: data.last_known_location,
    lastKnownActivity: data.last_known_activity,
    nextKnownLocation: data.next_known_location,
    nextKnownActivity: data.next_known_activity,
    significance: data.significance || 'medium',
    coversIncidentTime: data.covers_incident_time || false,
    hasExplanation: data.explanation_provided || false,
    explanation: data.explanation,
  };
}

function mapLegacyEventType(type: string): TimelineEventType {
  const mapping: Record<string, TimelineEventType> = {
    'sighting': 'location_sighting',
    'phone': 'phone_activity',
    'social': 'social_media_activity',
    'financial': 'financial_transaction',
    'vehicle': 'vehicle_movement',
    'witness': 'witness_observation',
    'camera': 'camera_footage',
    'statement': 'interview_statement',
    'evidence': 'physical_evidence',
    'digital': 'digital_footprint',
    'work': 'work_activity',
  };

  return mapping[type] || 'other';
}
