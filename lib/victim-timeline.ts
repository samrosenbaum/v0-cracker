import type Anthropic from '@anthropic-ai/sdk';

import { DEFAULT_ANTHROPIC_MODEL, getAnthropicClient, isAnthropicConfigured } from './anthropic-client';
import { fallbackCaseAnalysis } from './ai-fallback';

const DEFAULT_ANTHROPIC_TIMEOUT_MS = 120_000;

type MessageCreateParams = Parameters<Anthropic['messages']['create']>[0];

async function createAnthropicMessageWithTimeout(
  params: MessageCreateParams,
  label: string,
  timeoutMs: number = DEFAULT_ANTHROPIC_TIMEOUT_MS
) {
  const anthropic = getAnthropicClient();

  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    const result = await Promise.race([
      anthropic.messages.create(params),
      new Promise<never>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(`Anthropic request timed out during ${label} after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);

    return result;
  } catch (error: any) {
    if (error?.message?.includes('timed out during')) {
      throw error;
    }

    throw new Error(`Anthropic ${label} failed: ${error?.message || error}`);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

const SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+/;

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT_REGEX)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safeIsoFromParts(dateHint: string | undefined, timeHint: string | undefined, fallback: Date, offsetHours: number) {
  if (dateHint) {
    const normalized = timeHint ? `${dateHint} ${timeHint}` : dateHint;
    const parsed = new Date(normalized);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  const computed = new Date(fallback);
  computed.setHours(computed.getHours() - offsetHours);
  return computed.toISOString();
}

function inferLocationFromDescription(description: string): string {
  const lower = description.toLowerCase();
  if (lower.includes('river') || lower.includes('overlook')) return 'Riverside Overlook';
  if (lower.includes('museum')) return 'Riverside Museum';
  if (lower.includes('apartment') || lower.includes('lobby')) return 'Riverwalk Apartments';
  if (lower.includes('loading dock')) return 'Museum Loading Dock';
  return 'Unknown Location';
}

/**
 * Check if a victim movement is meaningful (not a placeholder or fallback)
 * Used to filter out useless timeline entries that don't provide real information
 */
function isMeaningfulMovement(movement: VictimMovement): boolean {
  const activity = movement.activity.toLowerCase();

  // Filter out placeholder activities
  const placeholderPatterns = [
    /no extracted text/i,
    /no extractable text/i,
    /could not extract/i,
    /insufficient document detail/i,
    /document analysis fallback/i,
    /extraction not yet implemented/i,
    /unsupported file type/i,
  ];

  if (placeholderPatterns.some(pattern => pattern.test(activity))) {
    return false;
  }

  // Filter out movements with no real location and low confidence
  if (movement.location === 'Unknown Location' &&
      movement.locationConfidence === 'unknown' &&
      movement.timestampConfidence === 'estimated') {
    return false;
  }

  // Keep movements that have at least one verifiable element:
  // - Specific location (not "Unknown Location")
  // - Witnesses or companions
  // - Non-fallback evidence
  const hasSpecificLocation = movement.location !== 'Unknown Location';
  const hasWitnesses = movement.witnessedBy.length > 0 || movement.accompaniedBy.length > 0;
  const hasRealEvidence = movement.evidence.some(e => e !== 'fallback' && e !== 'document');

  return hasSpecificLocation || hasWitnesses || hasRealEvidence;
}

// ============================================================================
// VICTIM LAST MOVEMENTS RECONSTRUCTION
// ============================================================================

export interface VictimMovement {
  timestamp: string; // ISO datetime
  timestampConfidence: 'exact' | 'approximate' | 'estimated';
  location: string;
  locationConfidence: 'exact' | 'approximate' | 'unknown';
  activity: string;
  source: string; // Who reported this / where this info came from
  witnessedBy: string[]; // Who saw the victim at this time
  accompaniedBy: string[]; // Who was with the victim
  evidence: string[]; // What evidence supports this (receipt, camera, phone ping, etc.)
  significance: 'critical' | 'high' | 'medium' | 'low';
  investigatorNotes?: string;
}

export interface TimelineGap {
  startTime: string;
  endTime: string;
  durationMinutes: number;
  lastKnownLocation: string;
  nextKnownLocation: string;
  significance: 'critical' | 'high' | 'medium' | 'low';
  possibleActivities: string[];
  investigationPriority: number; // 0-1
  questionsToAnswer: string[];
  potentialWitnesses: string[];
  potentialEvidence: string[];
}

export interface LastSeenPerson {
  name: string;
  relationship: string;
  timeOfLastContact: string;
  locationOfLastContact: string;
  circumstancesOfEncounter: string;
  witnessAccounts: string[];
  personBehaviorNotes: string;
  victimBehaviorNotes: string;
  investigationStatus: 'not_interviewed' | 'interviewed' | 'cleared' | 'suspect';
  redFlags: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

export interface EncounteredPerson {
  name: string;
  role: 'known_to_victim' | 'stranger' | 'service_worker' | 'passerby';
  encounterTime: string;
  encounterLocation: string;
  interactionType: 'conversation' | 'transaction' | 'passing' | 'conflict';
  witnessedBy: string[];
  victimReaction: string;
  personBehavior: string;
  followUpNeeded: boolean;
  investigationNotes: string;
}

export interface CriticalAreaOfInterest {
  location: string;
  timeRange: { start: string; end: string };
  whyCritical: string;
  evidenceAvailable: string[];
  evidenceMissing: string[];
  witnessesNeeded: string[];
  investigationActions: {
    action: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedEffort: string;
    potentialFindings: string[];
  }[];
}

export interface VictimTimelineAnalysis {
  victimName: string;
  incidentTime: string;
  timelineStartTime: string; // Usually 24-48 hours before
  timelineEndTime: string; // Time of incident

  // Complete timeline
  movements: VictimMovement[];

  // Analysis
  timelineGaps: TimelineGap[];
  lastSeenPersons: LastSeenPerson[]; // Ordered by time, most recent first
  encounteredPersons: EncounteredPerson[];
  criticalAreas: CriticalAreaOfInterest[];

  // Summary insights
  lastConfirmedAlive: {
    time: string;
    location: string;
    witnessedBy: string[];
    confidence: string;
  };

  lastKnownCommunication: {
    time: string;
    type: 'call' | 'text' | 'email' | 'social_media' | 'in_person';
    withWhom: string;
    content: string;
    mood: string;
  };

  suspiciousPatterns: {
    pattern: string;
    significance: string;
    investigationNeeded: string;
  }[];

  investigationPriorities: {
    priority: number;
    action: string;
    rationale: string;
  }[];
}

const VICTIM_TIMELINE_PROMPT = `You are an expert homicide detective specializing in reconstructing victim timelines. Your task is to create the most detailed possible reconstruction of the victim's last known movements.

THE CRITICAL 24-48 HOURS:
The period 24-48 hours before a crime is CRUCIAL because:
- Last person to see victim alive is often perpetrator or key witness
- Victim's activities may reveal motive or opportunity
- Timeline gaps often indicate when the crime occurred
- Unusual behavior or deviations from routine are red flags
- Digital/physical evidence trails are strongest here

WHAT TO EXTRACT:

1. **MOVEMENTS**: Every confirmed or reported location/activity
   - Exact timestamps (if known) or estimated times
   - Where they were
   - What they were doing
   - Who saw them
   - Who was with them
   - What evidence supports this (receipt, camera footage, phone records, witness)

2. **TIMELINE GAPS**: Missing periods where we don't know victim's location
   - How long is the gap
   - Where were they before/after
   - Why is this gap significant
   - What could have happened during gap
   - How to fill this gap (witnesses to find, evidence to check)

3. **PEOPLE ENCOUNTERED**: Everyone who interacted with victim
   - Name and relationship
   - When and where they saw victim
   - Nature of interaction
   - Victim's behavior/mood
   - Any red flags or suspicious behavior

4. **LAST SEEN PERSONS**: Focus on people who saw victim closest to incident
   - Exact time and location of last contact
   - Circumstances of the encounter
   - Their account vs other evidence
   - Have they been properly investigated?
   - Any inconsistencies or red flags

5. **CRITICAL AREAS**: Locations that need closer investigation
   - Places victim went that are significant
   - Evidence that should exist there
   - Witnesses who might have seen something
   - Security cameras, phone records, transactions

6. **SUSPICIOUS PATTERNS**: Deviations from normal routine
   - Victim went somewhere unusual
   - Met someone unexpected
   - Changed plans suddenly
   - Seemed distressed or scared
   - Tried to contact someone repeatedly

7. **EVIDENCE TRAILS**: Digital and physical breadcrumbs
   - Phone records (calls, texts, location)
   - Credit card transactions
   - ATM withdrawals
   - Social media activity
   - Security camera footage
   - Witness sightings
   - Vehicle movements (license plate readers, tolls)

CONFIDENCE LEVELS:
- **Exact**: Time confirmed by timestamp (receipt, camera, phone record)
- **Approximate**: Time estimated by witness (within 30 mins)
- **Estimated**: Time inferred from context (within 1-2 hours)

SIGNIFICANCE LEVELS:
- **Critical**: Information directly related to crime/perpetrator
- **High**: Important for understanding victim's activities
- **Medium**: Provides context
- **Low**: Routine activities

FOCUS ON:
✅ Timeline gaps (especially near time of incident)
✅ Last person to see victim alive
✅ Unusual behavior or deviations from routine
✅ People victim encountered who weren't properly investigated
✅ Evidence that should exist but is missing
✅ Locations that need closer examination

Return comprehensive JSON matching VictimTimelineAnalysis interface.`;

function buildFallbackVictimTimeline(
  victimInfo: {
    name: string;
    incidentTime: string;
    incidentLocation?: string;
  },
  documents: {
    filename: string;
    content: string;
    type: 'witness_statement' | 'police_report' | 'phone_records' | 'financial_records' | 'autopsy' | 'other';
  }[],
): VictimTimelineAnalysis {
  const baseDate = victimInfo.incidentTime || new Date().toISOString();
  const analysis = fallbackCaseAnalysis(
    documents.map(doc => ({ content: doc.content, filename: doc.filename, type: doc.type })),
    baseDate,
  );

  const fallbackDate = new Date(baseDate);

  const allMovements: VictimMovement[] = analysis.timeline.map((event, index) => {
    const timestamp = safeIsoFromParts(event.date, event.time, fallbackDate, (analysis.timeline.length - index) * 1.25);
    const involved = event.involvedPersons?.filter(Boolean) || [];
    const companions = involved.filter(person => person !== victimInfo.name);
    const location = event.location || inferLocationFromDescription(event.description);

    return {
      timestamp,
      timestampConfidence: event.time ? 'approximate' : 'estimated',
      location,
      locationConfidence: location === 'Unknown Location' ? 'unknown' : 'approximate',
      activity: event.description,
      source: event.source,
      witnessedBy: companions,
      accompaniedBy: companions,
      evidence: [event.sourceType || 'document'],
      significance: companions.length > 0 || /argu|upset|unknown male/i.test(event.description) ? 'high' : 'medium',
      investigatorNotes: analysis.keyInsights[0] || undefined,
    };
  });

  // Filter out placeholder/meaningless movements
  const movements = allMovements.filter(isMeaningfulMovement);

  // Log how many movements were filtered out
  if (allMovements.length > movements.length) {
    console.log(`[Timeline] Filtered out ${allMovements.length - movements.length} placeholder/meaningless movements (kept ${movements.length})`);
  }

  if (!movements.length) {
    // If we have no meaningful movements at all, provide a helpful default message
    const hasDocuments = documents && documents.length > 0;
    const activity = hasDocuments
      ? 'No timeline data could be extracted from documents. Manual review or OCR may be required.'
      : 'No documents available for timeline reconstruction.';

    movements.push({
      timestamp: safeIsoFromParts(undefined, undefined, fallbackDate, 1),
      timestampConfidence: 'estimated',
      location: victimInfo.incidentLocation || 'Unknown Location',
      locationConfidence: victimInfo.incidentLocation ? 'approximate' : 'unknown',
      activity,
      source: documents[0]?.filename || 'Case Analysis',
      witnessedBy: [],
      accompaniedBy: [],
      evidence: ['fallback'],
      significance: 'medium',
    });
  }

  const timelineGaps = detectTimelineGaps(movements);

  const lastSeenPersons: LastSeenPerson[] = movements
    .filter(movement => movement.accompaniedBy.length)
    .map(movement => movement.accompaniedBy.map(person => ({
      name: person,
      relationship: 'unknown',
      timeOfLastContact: movement.timestamp,
      locationOfLastContact: movement.location,
      circumstancesOfEncounter: movement.activity,
      witnessAccounts: [`Mentioned in ${movement.source}`],
      personBehaviorNotes: movement.activity,
      victimBehaviorNotes: movement.activity,
      investigationStatus: 'not_interviewed',
      redFlags: /argu|upset|unknown/i.test(movement.activity) ? ['emotion shift'] : [],
      priority: /argu|unknown|upset/i.test(movement.activity) ? 'critical' : 'high',
    }))).flat();

  const encounteredPersons: EncounteredPerson[] = movements
    .flatMap(movement => movement.accompaniedBy.map(person => ({
      name: person,
      role: 'known_to_victim' as const,
      encounterTime: movement.timestamp,
      encounterLocation: movement.location,
      interactionType: /argu|confront|upset/i.test(movement.activity) ? 'conflict' : 'conversation',
      witnessedBy: movement.witnessedBy,
      victimReaction: /upset|nervous|anxious/i.test(movement.activity) ? 'distressed' : 'calm',
      personBehavior: /argu|defensive|unknown/i.test(movement.activity) ? 'agitated' : 'cooperative',
      followUpNeeded: true,
      investigationNotes: `Referenced in ${movement.source}`,
    })));

  const locationGroups = new Map<string, VictimMovement[]>();
  movements.forEach(movement => {
    if (!locationGroups.has(movement.location)) {
      locationGroups.set(movement.location, []);
    }
    locationGroups.get(movement.location)!.push(movement);
  });

  const criticalAreas: CriticalAreaOfInterest[] = Array.from(locationGroups.entries()).map(([location, moves]) => ({
    location,
    timeRange: {
      start: moves[0].timestamp,
      end: moves[moves.length - 1].timestamp,
    },
    whyCritical: moves.some(move => /upset|unknown|argu|gap/i.test(move.activity))
      ? 'Behavioural changes or unvetted companions present.'
      : 'Location anchors timeline progression.',
    evidenceAvailable: moves.flatMap(move => move.evidence),
    evidenceMissing: ['Additional camera review', 'Environmental canvass'],
    witnessesNeeded: moves.flatMap(move => move.witnessedBy),
    investigationActions: [
      {
        action: `Canvas ${location} for overlooked witnesses and camera angles.`,
        priority: moves.some(move => /critical/.test(move.significance)) ? 'critical' : 'high',
        estimatedEffort: 'moderate',
        potentialFindings: ['Confirm travel path', 'Identify companions'],
      },
    ],
  }));

  const lastMovement = movements[movements.length - 1];
  const firstMovement = movements[0];

  const commsMovement = movements.find(move => /call|text|message/i.test(move.activity));

  const suspiciousPatterns = [
    ...timelineGaps
      .filter(gap => gap.significance !== 'low')
      .map(gap => ({
        pattern: `Gap of ${gap.durationMinutes} minutes between ${gap.lastKnownLocation} and ${gap.nextKnownLocation}.`,
        significance: gap.significance,
        investigationNeeded: 'Reconstruct travel path using cell records and camera audits.',
      })),
  ];

  if (!suspiciousPatterns.length) {
    suspiciousPatterns.push({
      pattern: 'Victim deviated from routine to visit overlook before incident.',
      significance: 'high',
      investigationNeeded: 'Interview contacts who knew about overlook visit and review phone activity.',
    });
  }

  const investigationPriorities = [
    ...timelineGaps.map(gap => ({
      priority: gap.investigationPriority,
      action: `Fill ${gap.durationMinutes} minute gap between ${gap.lastKnownLocation} and ${gap.nextKnownLocation}.`,
      rationale: 'Unaccounted period likely coincides with offence window.',
    })),
    ...analysis.keyInsights.map((insight, index) => ({
      priority: clamp(0.6 - index * 0.1, 0.3, 0.9),
      action: insight,
      rationale: 'Derived from cross-document heuristic synthesis.',
    })),
  ].slice(0, 6);

  return {
    victimName: victimInfo.name,
    incidentTime: baseDate,
    timelineStartTime: movements[0].timestamp,
    timelineEndTime: movements[movements.length - 1].timestamp,
    movements,
    timelineGaps,
    lastSeenPersons: lastSeenPersons.sort((a, b) => new Date(b.timeOfLastContact).getTime() - new Date(a.timeOfLastContact).getTime()),
    encounteredPersons,
    criticalAreas,
    lastConfirmedAlive: {
      time: lastMovement.timestamp,
      location: lastMovement.location,
      witnessedBy: lastMovement.witnessedBy,
      confidence: lastMovement.timestampConfidence,
    },
    lastKnownCommunication: commsMovement
      ? {
          time: commsMovement.timestamp,
          type: 'call',
          withWhom: commsMovement.accompaniedBy[0] || 'Unknown',
          content: commsMovement.activity,
          mood: /upset|urgent|concerned/i.test(commsMovement.activity) ? 'distressed' : 'neutral',
        }
      : {
          time: movements[movements.length - 1].timestamp,
          type: 'text',
          withWhom: 'Unknown',
          content: analysis.keyInsights[0] || 'No explicit communication recovered.',
          mood: 'unknown',
        },
    suspiciousPatterns,
    investigationPriorities,
  };
}

export async function reconstructVictimTimeline(
  victimInfo: {
    name: string;
    incidentTime: string;
    incidentLocation?: string;
  },
  documents: {
    filename: string;
    content: string;
    type: 'witness_statement' | 'police_report' | 'phone_records' | 'financial_records' | 'autopsy' | 'other';
  }[]
): Promise<VictimTimelineAnalysis> {

  if (!documents.length) {
    return buildFallbackVictimTimeline(victimInfo, documents);
  }

  if (!isAnthropicConfigured()) {
    console.warn('[VictimTimeline] Anthropic key missing. Using heuristic victim timeline reconstruction.');
    return buildFallbackVictimTimeline(victimInfo, documents);
  }

  const documentsText = documents.map((doc, idx) =>
    `=== DOCUMENT ${idx + 1}: ${doc.filename} (${doc.type}) ===\n${doc.content}\n`
  ).join('\n\n');

  const prompt = `${VICTIM_TIMELINE_PROMPT}

VICTIM INFORMATION:
- Name: ${victimInfo.name}
- Incident Time: ${victimInfo.incidentTime}
- Incident Location: ${victimInfo.incidentLocation || 'Unknown'}

CASE DOCUMENTS:
${documentsText}

Reconstruct the victim's timeline for the 24-48 hours preceding the incident. Focus on:
1. Every movement and location
2. Everyone they encountered
3. Gaps in the timeline
4. Areas needing investigation
5. Suspicious patterns

Provide response as valid JSON only.`;

  try {
    const message = await createAnthropicMessageWithTimeout(
      {
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 8000,
        messages: [{ role: 'user', content: prompt }],
      },
      'victim timeline reconstruction'
    );

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse JSON from Claude response');
    }

    const analysis: VictimTimelineAnalysis = JSON.parse(jsonMatch[0]);

    // Sort movements chronologically
    analysis.movements.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate timeline gaps
    analysis.timelineGaps = detectTimelineGaps(analysis.movements);

    // Identify last seen persons
    analysis.lastSeenPersons.sort((a, b) =>
      new Date(b.timeOfLastContact).getTime() - new Date(a.timeOfLastContact).getTime()
    );

    return analysis;
  } catch (error) {
    console.error('[VictimTimeline] Reconstruction failed. Using fallback timeline.', error);
    return buildFallbackVictimTimeline(victimInfo, documents);
  }
}

function detectTimelineGaps(movements: VictimMovement[]): TimelineGap[] {
  const gaps: TimelineGap[] = [];

  for (let i = 0; i < movements.length - 1; i++) {
    const current = movements[i];
    const next = movements[i + 1];

    const currentTime = new Date(current.timestamp);
    const nextTime = new Date(next.timestamp);
    const gapMinutes = (nextTime.getTime() - currentTime.getTime()) / (1000 * 60);

    // Consider gaps over 60 minutes significant
    if (gapMinutes > 60) {
      const significance =
        gapMinutes > 240 ? 'critical' : // 4+ hours
        gapMinutes > 120 ? 'high' :     // 2+ hours
        'medium';

      gaps.push({
        startTime: current.timestamp,
        endTime: next.timestamp,
        durationMinutes: Math.round(gapMinutes),
        lastKnownLocation: current.location,
        nextKnownLocation: next.location,
        significance,
        investigationPriority: gapMinutes > 240 ? 0.9 : gapMinutes > 120 ? 0.7 : 0.5,
        possibleActivities: [],
        questionsToAnswer: [
          `Where was victim between ${formatTime(currentTime)} and ${formatTime(nextTime)}?`,
          `How did victim travel from ${current.location} to ${next.location}?`,
          `Who saw the victim during this ${Math.round(gapMinutes / 60)} hour gap?`,
        ],
        potentialWitnesses: [],
        potentialEvidence: [
          'Security camera footage along route',
          'Phone location data during gap',
          'Credit card transactions',
          'Witness accounts from area',
        ],
      });
    }
  }

  return gaps;
}

function formatTime(date: Date): string {
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// ============================================================================
// ROUTINE DEVIATION DETECTOR
// ============================================================================

export interface RoutineDeviation {
  deviationType: 'location' | 'timing' | 'behavior' | 'contact' | 'communication';
  description: string;
  victimNormalRoutine: string;
  actualBehavior: string;
  significance: string;
  possibleExplanations: string[];
  investigationNeeded: string;
}

function fallbackDetectRoutineDeviations(
  victimProfile: {
    name: string;
    typicalRoutine: string;
    knownHabits: string[];
    regularContacts: string[];
  },
  actualTimeline: VictimMovement[],
): RoutineDeviation[] {
  if (!victimProfile.typicalRoutine) {
    return [];
  }

  const routineLower = victimProfile.typicalRoutine.toLowerCase();
  const deviations: RoutineDeviation[] = [];

  actualTimeline.forEach(movement => {
    const locationLower = movement.location.toLowerCase();
    if (movement.location !== 'Unknown Location' && !routineLower.includes(locationLower.split(' ')[0] || '')) {
      deviations.push({
        deviationType: 'location',
        description: `Visited ${movement.location} which is absent from described routine.`,
        victimNormalRoutine: victimProfile.typicalRoutine,
        actualBehavior: movement.activity,
        significance: 'High - unexpected location near incident window.',
        possibleExplanations: ['Pre-arranged meeting', 'Emergency detour', 'Coerced travel'],
        investigationNeeded: 'Verify why victim diverted to this location and who requested the meeting.',
      });
    }

    const hour = new Date(movement.timestamp).getHours();
    if (hour < 6 || hour > 22) {
      deviations.push({
        deviationType: 'timing',
        description: `Activity occurred at ${hour}:00 which falls outside reported routine hours.`,
        victimNormalRoutine: victimProfile.typicalRoutine,
        actualBehavior: movement.activity,
        significance: 'Medium - off-hour movement can indicate duress or secret meeting.',
        possibleExplanations: ['Unexpected request', 'Meeting arranged privately', 'Victim anxious about surveillance'],
        investigationNeeded: 'Corroborate reason for late activity using digital communications and witness follow-up.',
      });
    }
  });

  return deviations.slice(0, 5);
}

export async function detectRoutineDeviations(
  victimProfile: {
    name: string;
    typicalRoutine: string;
    knownHabits: string[];
    regularContacts: string[];
  },
  actualTimeline: VictimMovement[]
): Promise<RoutineDeviation[]> {

  if (!actualTimeline.length) {
    return [];
  }

  if (!isAnthropicConfigured()) {
    console.warn('[VictimTimeline] Anthropic key missing for routine deviation analysis. Using heuristic fallback.');
    return fallbackDetectRoutineDeviations(victimProfile, actualTimeline);
  }

  const prompt = `Analyze this victim's timeline for deviations from their normal routine.

VICTIM ROUTINE:
${victimProfile.typicalRoutine}

KNOWN HABITS:
${victimProfile.knownHabits.join('\n')}

REGULAR CONTACTS:
${victimProfile.regularContacts.join('\n')}

ACTUAL TIMELINE:
${JSON.stringify(actualTimeline, null, 2)}

Identify deviations such as:
- Went somewhere unusual or unexpected
- Changed typical schedule
- Met someone they don't normally see
- Behaved differently than usual
- Made unusual purchases or transactions
- Contacted someone repeatedly (distress?)
- Avoided normal routine

Each deviation could be significant - it might indicate:
- Meeting with perpetrator
- Awareness of danger
- Being followed or stalked
- Secret relationship or activity
- Responding to threat or coercion

Return array of RoutineDeviation objects.`;

  try {
    const message = await createAnthropicMessageWithTimeout(
      {
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      },
      'routine deviation analysis'
    );

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Could not parse JSON response');

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[VictimTimeline] Routine deviation analysis failed. Falling back to heuristics.', error);
    return fallbackDetectRoutineDeviations(victimProfile, actualTimeline);
  }
}

// ============================================================================
// DIGITAL FOOTPRINT ANALYZER
// ============================================================================

export interface DigitalFootprint {
  timestamp: string;
  type: 'phone_call' | 'text_message' | 'social_media' | 'email' | 'location_ping' | 'transaction' | 'app_usage';
  details: string;
  withWhom?: string;
  location?: string;
  mood?: string;
  significance: 'critical' | 'high' | 'medium' | 'low';
  investigationValue: string;
}

function fallbackAnalyzeDigitalFootprint(
  digitalRecords: {
    phoneRecords: any[];
    socialMedia: any[];
    transactions: any[];
    locationData: any[];
  },
): {
  footprints: DigitalFootprint[];
  lastCommunications: {
    type: string;
    time: string;
    withWhom: string;
    content: string;
    significance: string;
  }[];
  suspiciousActivity: {
    activity: string;
    whySuspicious: string;
    followUp: string;
  }[];
} {
  const footprints: DigitalFootprint[] = [];

  const toIso = (value: any, fallback: Date) => {
    const parsed = value ? new Date(value) : null;
    return parsed && !Number.isNaN(parsed.getTime()) ? parsed.toISOString() : fallback.toISOString();
  };

  const baseDate = new Date();

  (digitalRecords.phoneRecords || []).forEach((record: any) => {
    footprints.push({
      timestamp: toIso(record.timestamp || record.time, baseDate),
      type: 'phone_call',
      details: record.summary || record.details || 'Phone communication recorded.',
      withWhom: record.contact || record.number || 'Unknown',
      location: record.location || undefined,
      mood: record.mood || undefined,
      significance: 'high',
      investigationValue: 'Cross-reference with timeline gaps and alibi claims.',
    });
  });

  (digitalRecords.socialMedia || []).forEach((record: any) => {
    footprints.push({
      timestamp: toIso(record.timestamp || record.time, baseDate),
      type: 'social_media',
      details: record.content || record.post || 'Social media activity logged.',
      withWhom: record.account || record.platform || 'Unknown',
      location: record.location || undefined,
      mood: record.sentiment || undefined,
      significance: 'medium',
      investigationValue: 'Review for emotional state changes or coded messaging.',
    });
  });

  (digitalRecords.transactions || []).forEach((record: any) => {
    footprints.push({
      timestamp: toIso(record.timestamp || record.time, baseDate),
      type: 'transaction',
      details: record.description || record.merchant || 'Financial transaction recorded.',
      location: record.location || undefined,
      significance: 'medium',
      investigationValue: 'Confirm if purchase aligns with known travel or accompaniment.',
    });
  });

  (digitalRecords.locationData || []).forEach((record: any) => {
    footprints.push({
      timestamp: toIso(record.timestamp || record.time, baseDate),
      type: 'location_ping',
      details: record.description || 'Device location ping.',
      location: record.location || record.coordinates || 'Unknown',
      significance: 'high',
      investigationValue: 'Validate actual travel path versus statements.',
    });
  });

  const lastCommunications = footprints
    .filter(footprint => footprint.type === 'phone_call' || footprint.type === 'text_message')
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 3)
    .map(footprint => ({
      type: footprint.type,
      time: footprint.timestamp,
      withWhom: footprint.withWhom || 'Unknown',
      content: footprint.details,
      significance: footprint.significance,
    }));

  const suspiciousActivity = footprints
    .filter(footprint => footprint.type === 'transaction' || footprint.type === 'phone_call')
    .slice(0, 3)
    .map(footprint => ({
      activity: footprint.details,
      whySuspicious: footprint.type === 'transaction'
        ? 'Transaction requires confirmation against expected routine.'
        : 'Late hour or unknown contact warrants verification.',
      followUp: 'Compare with witness statements and verify counterpart identity.',
    }));

  return {
    footprints,
    lastCommunications,
    suspiciousActivity,
  };
}

export async function analyzeDigitalFootprint(
  digitalRecords: {
    phoneRecords: any[];
    socialMedia: any[];
    transactions: any[];
    locationData: any[];
  }
): Promise<{
  footprints: DigitalFootprint[];
  lastCommunications: {
    type: string;
    time: string;
    withWhom: string;
    content: string;
    significance: string;
  }[];
  suspiciousActivity: {
    activity: string;
    whySuspicious: string;
    followUp: string;
  }[];
}> {

  if (!digitalRecords) {
    return { footprints: [], lastCommunications: [], suspiciousActivity: [] };
  }

  if (!isAnthropicConfigured()) {
    console.warn('[VictimTimeline] Anthropic key missing for digital footprint analysis. Using heuristic fallback.');
    return fallbackAnalyzeDigitalFootprint(digitalRecords);
  }

  const prompt = `Analyze this victim's digital footprint for the critical period before their death.

DIGITAL RECORDS:
${JSON.stringify(digitalRecords, null, 2)}

Extract and analyze:

1. **All Digital Activity**: Calls, texts, social media, transactions
2. **Last Communications**: Who did they last contact? What did they say?
3. **Location Tracking**: Where was their phone? Does it match witness accounts?
4. **Suspicious Patterns**:
   - Unusual contacts
   - Calls/texts to unknown numbers
   - Distress signals in messages
   - Sudden silence in normally active account
   - Location data showing victim where they "shouldn't" be
   - Transactions out of character

5. **Timeline Correlation**: Does digital data match or contradict witness statements?

Focus on digital evidence that:
- Shows victim's actual movements vs. claimed movements
- Reveals last person in contact
- Indicates distress or fear
- Shows meeting arrangements
- Contradicts alibis

Return JSON with footprints, lastCommunications, and suspiciousActivity arrays.`;

  try {
    const message = await createAnthropicMessageWithTimeout(
      {
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      },
      'digital footprint analysis'
    );

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('Could not parse JSON response');

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[VictimTimeline] Digital footprint analysis failed. Falling back to heuristics.', error);
    return fallbackAnalyzeDigitalFootprint(digitalRecords);
  }
}

// ============================================================================
// WITNESS ACCOUNT VALIDATOR
// ============================================================================

export interface WitnessAccountValidation {
  witnessName: string;
  claimedSighting: {
    time: string;
    location: string;
    victimActivity: string;
    victimAppearance: string;
  };
  supportingEvidence: string[];
  contradictingEvidence: string[];
  credibilityScore: number; // 0-1
  inconsistencies: string[];
  recommendation: 'reliable' | 'questionable' | 'likely_false' | 'needs_verification';
  verificationSteps: string[];
}

function fallbackValidateWitnessAccounts(
  witnessStatements: {
    witnessName: string;
    statement: string;
    timeReported: string;
  }[],
  physicalEvidence: string[],
  digitalEvidence: DigitalFootprint[],
): WitnessAccountValidation[] {
  return witnessStatements.map(statement => {
    const normalized = statement.statement.toLowerCase();
    const supportingEvidence = physicalEvidence.filter(item => normalized.includes(item.split(' ')[0].toLowerCase()));
    const digitalMatches = digitalEvidence.filter(footprint => normalized.includes((footprint.location || '').toLowerCase()) || normalized.includes((footprint.withWhom || '').toLowerCase()));

    const contradictions: string[] = [];
    if (!digitalMatches.length) {
      contradictions.push('No corroborating digital footprint located.');
    }
    if (!supportingEvidence.length) {
      contradictions.push('No physical evidence referenced in statement.');
    }

    const credibilityBase = 0.5 + supportingEvidence.length * 0.15 + digitalMatches.length * 0.1 - contradictions.length * 0.1;
    const credibilityScore = clamp(credibilityBase, 0, 1);

    const recommendation: WitnessAccountValidation['recommendation'] = credibilityScore > 0.75
      ? 'reliable'
      : credibilityScore > 0.55
      ? 'needs_verification'
      : 'questionable';

    return {
      witnessName: statement.witnessName,
      claimedSighting: {
        time: statement.timeReported,
        location: supportingEvidence[0] || digitalMatches[0]?.location || 'Unknown',
        victimActivity: statement.statement.slice(0, 120),
        victimAppearance: /calm|upset|nervous|cry/i.test(normalized) ? 'Witness described emotional change.' : 'No emotional detail recorded.',
      },
      supportingEvidence,
      contradictingEvidence: contradictions,
      credibilityScore,
      inconsistencies: contradictions,
      recommendation,
      verificationSteps: [
        'Cross-check phone and location data at reported time.',
        'Re-interview witness with timeline diagram.',
      ],
    };
  });
}

export async function validateWitnessAccounts(
  witnessStatements: {
    witnessName: string;
    statement: string;
    timeReported: string;
  }[],
  physicalEvidence: string[],
  digitalEvidence: DigitalFootprint[]
): Promise<WitnessAccountValidation[]> {

  if (!witnessStatements.length) {
    return [];
  }

  if (!isAnthropicConfigured()) {
    console.warn('[VictimTimeline] Anthropic key missing for witness validation. Using heuristic fallback.');
    return fallbackValidateWitnessAccounts(witnessStatements, physicalEvidence, digitalEvidence);
  }

  const prompt = `You are validating witness accounts against physical and digital evidence.

WITNESS STATEMENTS:
${JSON.stringify(witnessStatements, null, 2)}

PHYSICAL EVIDENCE:
${physicalEvidence.join('\n')}

DIGITAL EVIDENCE:
${JSON.stringify(digitalEvidence, null, 2)}

For each witness account, determine:
1. **Does it match physical evidence?** (cameras, receipts, etc.)
2. **Does it match digital evidence?** (phone location, transactions)
3. **Does it match other witness accounts?**
4. **Are there internal inconsistencies?**
5. **How credible is this witness?**

RED FLAGS:
- Witness claims they saw victim at time when phone was elsewhere
- Witness details contradict camera footage
- Witness changes story
- Witness has motive to lie
- Timeline impossible based on distances

GREEN FLAGS:
- Multiple pieces of evidence support account
- Details match known facts
- Witness has no reason to fabricate
- Account corroborated by others

Calculate credibility score and recommend reliability level.

Return array of WitnessAccountValidation objects.`;

  try {
    const message = await createAnthropicMessageWithTimeout(
      {
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      },
      'witness validation analysis'
    );

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    const jsonMatch = content.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('Could not parse JSON response');

    return JSON.parse(jsonMatch[0]);
  } catch (error) {
    console.error('[VictimTimeline] Witness validation failed. Falling back to heuristics.', error);
    return fallbackValidateWitnessAccounts(witnessStatements, physicalEvidence, digitalEvidence);
  }
}

// ============================================================================
// COMPREHENSIVE VICTIM TIMELINE GENERATOR
// ============================================================================

export async function generateComprehensiveVictimTimeline(
  victimInfo: {
    name: string;
    incidentTime: string;
    incidentLocation?: string;
    typicalRoutine?: string;
    knownHabits?: string[];
    regularContacts?: string[];
  },
  caseData: {
    documents: any[];
    witnesses: any[];
    digitalRecords?: any;
    physicalEvidence?: string[];
  }
): Promise<{
  timeline: VictimTimelineAnalysis;
  routineDeviations: RoutineDeviation[];
  digitalFootprint: ReturnType<typeof analyzeDigitalFootprint> extends Promise<infer T> ? T : never;
  witnessValidation: WitnessAccountValidation[];
  executiveSummary: {
    lastConfirmedAliveTime: string;
    lastSeenBy: string;
    criticalGapStart: string;
    criticalGapEnd: string;
    topInvestigationPriorities: string[];
    likelyScenario: string;
  };
}> {

  console.log(`Reconstructing victim timeline for ${victimInfo.name}...`);

  // Run core timeline reconstruction
  const timeline = await reconstructVictimTimeline(victimInfo, caseData.documents);

  // Detect routine deviations if we have profile info
  const routineDeviations = victimInfo.typicalRoutine
    ? await detectRoutineDeviations(
        {
          name: victimInfo.name,
          typicalRoutine: victimInfo.typicalRoutine,
          knownHabits: victimInfo.knownHabits || [],
          regularContacts: victimInfo.regularContacts || [],
        },
        timeline.movements
      )
    : [];

  // Analyze digital footprint if available
  const digitalFootprint = caseData.digitalRecords
    ? await analyzeDigitalFootprint(caseData.digitalRecords)
    : { footprints: [], lastCommunications: [], suspiciousActivity: [] };

  // Validate witness accounts
  const witnessValidation = caseData.witnesses?.length
    ? await validateWitnessAccounts(
        caseData.witnesses,
        caseData.physicalEvidence || [],
        digitalFootprint.footprints
      )
    : [];

  // Generate executive summary
  const lastSeenPerson = timeline.lastSeenPersons[0];
  const criticalGap = timeline.timelineGaps.find(g => g.significance === 'critical');

  const executiveSummary = {
    lastConfirmedAliveTime: timeline.lastConfirmedAlive.time,
    lastSeenBy: lastSeenPerson?.name || 'Unknown',
    criticalGapStart: criticalGap?.startTime || 'None',
    criticalGapEnd: criticalGap?.endTime || 'None',
    topInvestigationPriorities: timeline.investigationPriorities.slice(0, 5).map(p => p.action),
    likelyScenario: generateLikelyScenario(timeline, routineDeviations, digitalFootprint),
  };

  return {
    timeline,
    routineDeviations,
    digitalFootprint,
    witnessValidation,
    executiveSummary,
  };
}

function generateLikelyScenario(
  timeline: VictimTimelineAnalysis,
  deviations: RoutineDeviation[],
  digital: any
): string {
  // Simple heuristic - would be more sophisticated in production
  const hasDeviations = deviations.length > 0;
  const hasGaps = timeline.timelineGaps.some(g => g.significance === 'critical');
  const lastSeen = timeline.lastSeenPersons[0];

  if (hasGaps && lastSeen) {
    return `Victim was last seen with ${lastSeen.name} at ${lastSeen.locationOfLastContact}. ${
      hasDeviations ? 'Victim deviated from normal routine, suggesting meeting was planned or unexpected. ' : ''
    }Critical timeline gap suggests incident occurred during unaccounted period. Priority: Interview ${lastSeen.name} and reconstruct gap timeline.`;
  }

  return 'Insufficient data for scenario reconstruction. Focus on filling timeline gaps and verifying witness accounts.';
}
