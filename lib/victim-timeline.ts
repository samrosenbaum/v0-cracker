import { DEFAULT_ANTHROPIC_MODEL, getAnthropicClient } from './anthropic-client';

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

  const anthropic = getAnthropicClient();

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

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

export async function detectRoutineDeviations(
  victimProfile: {
    name: string;
    typicalRoutine: string;
    knownHabits: string[];
    regularContacts: string[];
  },
  actualTimeline: VictimMovement[]
): Promise<RoutineDeviation[]> {

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

  const anthropic = getAnthropicClient();

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse JSON response');

  return JSON.parse(jsonMatch[0]);
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

  const anthropic = getAnthropicClient();

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON response');

  return JSON.parse(jsonMatch[0]);
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

export async function validateWitnessAccounts(
  witnessStatements: {
    witnessName: string;
    statement: string;
    timeReported: string;
  }[],
  physicalEvidence: string[],
  digitalEvidence: DigitalFootprint[]
): Promise<WitnessAccountValidation[]> {

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

  const anthropic = getAnthropicClient();

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse JSON response');

  return JSON.parse(jsonMatch[0]);
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
