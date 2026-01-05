/**
 * Automated Contradiction Detection Engine
 *
 * Automatically detects contradictions across all facts in a case:
 * - Timeline impossibilities (person in two places at once)
 * - Self-contradictions (same person says opposite things)
 * - Cross-witness conflicts (different people describe events differently)
 * - Story evolution (how statements change over time)
 * - Evidence vs testimony conflicts
 */

import { supabaseServer } from './supabase-server';
import { getAnthropicClient, DEFAULT_ANTHROPIC_MODEL, isAnthropicConfigured } from './anthropic-client';
import type { AtomicFact, TimeReference } from './atomic-facts';
import { getFactsForCase, queryFacts } from './atomic-facts';

// ============================================================================
// Type Definitions
// ============================================================================

export type ContradictionType =
  | 'timeline_impossible'    // Person in two places at once
  | 'statement_conflict'     // Two people say opposite things
  | 'self_contradiction'     // Same person contradicts themselves
  | 'physical_impossible'    // Claim defies physics/logic
  | 'evidence_contradiction' // Statement contradicts physical evidence
  | 'witness_conflict'       // Multiple witnesses disagree
  | 'alibi_failure'          // Alibi proven false
  | 'story_evolution'        // Story changed significantly
  | 'detail_inconsistency';  // Small but significant detail mismatch

export type ContradictionSeverity = 'minor' | 'significant' | 'major' | 'critical';
export type ResolutionStatus = 'unresolved' | 'explained' | 'confirmed_lie' | 'error_in_record' | 'dismissed';

export interface Contradiction {
  id: string;
  caseId: string;

  // The conflicting facts
  fact1Id: string;
  fact2Id: string;
  fact1Summary: string;
  fact2Summary: string;

  // Classification
  contradictionType: ContradictionType;
  severity: ContradictionSeverity;

  // Details
  description: string;
  analysis: string;
  implications: string;
  suggestedFollowup: string;

  // Persons involved
  involvedPersons: string[];

  // Resolution
  resolutionStatus: ResolutionStatus;
  resolutionNotes?: string;
  resolvedBy?: string;
  resolvedAt?: string;

  // Detection metadata
  detectedAt: string;
  detectionMethod: 'automatic' | 'manual' | 'ai_enhanced';
  confidenceScore: number;
}

export interface ContradictionDetectionResult {
  caseId: string;
  totalContradictionsFound: number;
  newContradictions: Contradiction[];
  bySeverity: Record<ContradictionSeverity, number>;
  byType: Record<ContradictionType, number>;
  involvedPersons: string[];
  processingTimeMs: number;
}

// ============================================================================
// Main Detection Engine
// ============================================================================

export async function detectAllContradictions(caseId: string): Promise<ContradictionDetectionResult> {
  const startTime = Date.now();
  const facts = await getFactsForCase(caseId);

  const contradictions: Contradiction[] = [];

  // 1. Detect timeline impossibilities
  const timelineContradictions = await detectTimelineContradictions(caseId, facts);
  contradictions.push(...timelineContradictions);

  // 2. Detect self-contradictions
  const selfContradictions = await detectSelfContradictions(caseId, facts);
  contradictions.push(...selfContradictions);

  // 3. Detect cross-witness conflicts
  const witnessConflicts = await detectWitnessConflicts(caseId, facts);
  contradictions.push(...witnessConflicts);

  // 4. Detect evidence contradictions
  const evidenceContradictions = await detectEvidenceContradictions(caseId, facts);
  contradictions.push(...evidenceContradictions);

  // 5. AI-enhanced detection for subtle contradictions
  if (isAnthropicConfigured()) {
    const aiContradictions = await detectWithAI(caseId, facts);
    contradictions.push(...aiContradictions);
  }

  // Deduplicate
  const uniqueContradictions = deduplicateContradictions(contradictions);

  // Save to database
  await saveContradictions(uniqueContradictions);

  // Update fact verification statuses
  await updateFactVerificationStatuses(uniqueContradictions);

  // Calculate statistics
  const bySeverity = countBySeverity(uniqueContradictions);
  const byType = countByType(uniqueContradictions);
  const involvedPersons = extractInvolvedPersons(uniqueContradictions);

  return {
    caseId,
    totalContradictionsFound: uniqueContradictions.length,
    newContradictions: uniqueContradictions,
    bySeverity,
    byType,
    involvedPersons,
    processingTimeMs: Date.now() - startTime
  };
}

// ============================================================================
// Timeline Contradiction Detection
// ============================================================================

async function detectTimelineContradictions(
  caseId: string,
  facts: AtomicFact[]
): Promise<Contradiction[]> {
  const contradictions: Contradiction[] = [];

  // Get all facts with time and location
  const locationFacts = facts.filter(f =>
    f.factType === 'location_claim' ||
    f.factType === 'alibi' ||
    (f.timeReference && f.location)
  );

  // Group by person
  const factsByPerson = new Map<string, AtomicFact[]>();

  locationFacts.forEach(fact => {
    const speaker = fact.source.speakerName.toLowerCase();
    if (!factsByPerson.has(speaker)) {
      factsByPerson.set(speaker, []);
    }
    factsByPerson.get(speaker)!.push(fact);

    // Also track if they're the subject
    const subject = fact.subject.toLowerCase();
    if (subject !== speaker) {
      if (!factsByPerson.has(subject)) {
        factsByPerson.set(subject, []);
      }
      factsByPerson.get(subject)!.push(fact);
    }
  });

  // Check for timeline conflicts for each person
  for (const [person, personFacts] of factsByPerson) {
    for (let i = 0; i < personFacts.length; i++) {
      for (let j = i + 1; j < personFacts.length; j++) {
        const fact1 = personFacts[i];
        const fact2 = personFacts[j];

        const conflict = checkTimelineConflict(fact1, fact2, person);
        if (conflict) {
          contradictions.push({
            id: `timeline-${fact1.id}-${fact2.id}`,
            caseId,
            fact1Id: fact1.id,
            fact2Id: fact2.id,
            fact1Summary: `${person} at ${fact1.location} (${fact1.timeReference?.originalText || 'unknown time'})`,
            fact2Summary: `${person} at ${fact2.location} (${fact2.timeReference?.originalText || 'unknown time'})`,
            contradictionType: 'timeline_impossible',
            severity: conflict.severity,
            description: conflict.description,
            analysis: conflict.analysis,
            implications: `${person} cannot have been at both locations during the overlapping timeframe`,
            suggestedFollowup: `Re-interview ${person} about their whereabouts. Check for witnesses at both locations.`,
            involvedPersons: [person],
            resolutionStatus: 'unresolved',
            detectedAt: new Date().toISOString(),
            detectionMethod: 'automatic',
            confidenceScore: conflict.confidence
          });
        }
      }
    }
  }

  return contradictions;
}

interface TimelineConflictResult {
  severity: ContradictionSeverity;
  description: string;
  analysis: string;
  confidence: number;
}

function checkTimelineConflict(
  fact1: AtomicFact,
  fact2: AtomicFact,
  person: string
): TimelineConflictResult | null {
  if (!fact1.timeReference || !fact2.timeReference) return null;
  if (!fact1.location || !fact2.location) return null;

  // Same location = no conflict
  if (fact1.location.toLowerCase() === fact2.location.toLowerCase()) return null;

  // Check time overlap
  const time1 = parseTimeReference(fact1.timeReference);
  const time2 = parseTimeReference(fact2.timeReference);

  if (!time1 || !time2) return null;

  // Check if times overlap
  if (time1.end < time2.start || time2.end < time1.start) {
    // No overlap
    return null;
  }

  // Calculate overlap
  const overlapStart = Math.max(time1.start, time2.start);
  const overlapEnd = Math.min(time1.end, time2.end);
  const overlapMinutes = (overlapEnd - overlapStart) / (1000 * 60);

  if (overlapMinutes <= 0) return null;

  // Determine severity based on overlap and distance
  let severity: ContradictionSeverity = 'minor';
  if (overlapMinutes > 60) severity = 'major';
  else if (overlapMinutes > 30) severity = 'significant';

  // If locations are far apart, increase severity
  // (In a real system, we'd geocode and calculate actual distance)

  return {
    severity,
    description: `${person} claims to be at "${fact1.location}" and "${fact2.location}" during overlapping time periods`,
    analysis: `Time overlap of approximately ${Math.round(overlapMinutes)} minutes detected. ${person} cannot physically be at both locations simultaneously.`,
    confidence: calculateTimeConfidence(fact1.timeReference, fact2.timeReference)
  };
}

function parseTimeReference(ref: TimeReference): { start: number; end: number } | null {
  try {
    const start = ref.earliest ? new Date(ref.earliest).getTime() : null;
    const end = ref.latest ? new Date(ref.latest).getTime() : start;

    if (!start) return null;

    return { start, end: end || start };
  } catch {
    return null;
  }
}

function calculateTimeConfidence(ref1: TimeReference, ref2: TimeReference): number {
  let confidence = 0.5;

  if (ref1.certainty === 'exact') confidence += 0.2;
  else if (ref1.certainty === 'approximate') confidence += 0.1;

  if (ref2.certainty === 'exact') confidence += 0.2;
  else if (ref2.certainty === 'approximate') confidence += 0.1;

  return Math.min(0.95, confidence);
}

// ============================================================================
// Self-Contradiction Detection
// ============================================================================

async function detectSelfContradictions(
  caseId: string,
  facts: AtomicFact[]
): Promise<Contradiction[]> {
  const contradictions: Contradiction[] = [];

  // Group facts by speaker
  const factsBySpeaker = new Map<string, AtomicFact[]>();

  facts.forEach(fact => {
    const speaker = fact.source.speakerName.toLowerCase();
    if (!factsBySpeaker.has(speaker)) {
      factsBySpeaker.set(speaker, []);
    }
    factsBySpeaker.get(speaker)!.push(fact);
  });

  // For each speaker, look for contradictory claims
  for (const [speaker, speakerFacts] of factsBySpeaker) {
    // Group by topic/subject
    const factsByTopic = groupFactsByTopic(speakerFacts);

    for (const [topic, topicFacts] of factsByTopic) {
      if (topicFacts.length < 2) continue;

      // Sort by date
      topicFacts.sort((a, b) => {
        const dateA = a.source.dateRecorded ? new Date(a.source.dateRecorded).getTime() : 0;
        const dateB = b.source.dateRecorded ? new Date(b.source.dateRecorded).getTime() : 0;
        return dateA - dateB;
      });

      // Compare sequential statements
      for (let i = 0; i < topicFacts.length - 1; i++) {
        const earlier = topicFacts[i];
        const later = topicFacts[i + 1];

        const conflict = detectStatementConflict(earlier, later);
        if (conflict) {
          contradictions.push({
            id: `self-${earlier.id}-${later.id}`,
            caseId,
            fact1Id: earlier.id,
            fact2Id: later.id,
            fact1Summary: `${speaker} said: "${earlier.predicate}" (${earlier.source.dateRecorded || 'unknown date'})`,
            fact2Summary: `${speaker} later said: "${later.predicate}" (${later.source.dateRecorded || 'unknown date'})`,
            contradictionType: conflict.isEvolution ? 'story_evolution' : 'self_contradiction',
            severity: conflict.severity,
            description: `${speaker}'s statements about ${topic} conflict`,
            analysis: conflict.analysis,
            implications: `${speaker} has provided inconsistent information, which may indicate deception or memory issues`,
            suggestedFollowup: `Confront ${speaker} with both statements and request explanation for the discrepancy`,
            involvedPersons: [speaker],
            resolutionStatus: 'unresolved',
            detectedAt: new Date().toISOString(),
            detectionMethod: 'automatic',
            confidenceScore: conflict.confidence
          });
        }
      }
    }
  }

  return contradictions;
}

function groupFactsByTopic(facts: AtomicFact[]): Map<string, AtomicFact[]> {
  const byTopic = new Map<string, AtomicFact[]>();

  facts.forEach(fact => {
    // Create topic key from subject + fact type
    const topic = `${fact.subject.toLowerCase()}_${fact.factType}`;
    if (!byTopic.has(topic)) {
      byTopic.set(topic, []);
    }
    byTopic.get(topic)!.push(fact);
  });

  return byTopic;
}

interface StatementConflict {
  severity: ContradictionSeverity;
  analysis: string;
  confidence: number;
  isEvolution: boolean;
}

function detectStatementConflict(earlier: AtomicFact, later: AtomicFact): StatementConflict | null {
  const pred1 = earlier.predicate.toLowerCase();
  const pred2 = later.predicate.toLowerCase();

  // Look for direct negation patterns
  const negationPatterns = [
    { positive: 'did', negative: "didn't" },
    { positive: 'did', negative: 'did not' },
    { positive: 'was', negative: "wasn't" },
    { positive: 'was', negative: 'was not' },
    { positive: 'saw', negative: "didn't see" },
    { positive: 'knew', negative: "didn't know" },
    { positive: 'went', negative: "didn't go" },
    { positive: 'yes', negative: 'no' },
    { positive: 'never', negative: 'always' },
  ];

  for (const pattern of negationPatterns) {
    if (
      (pred1.includes(pattern.positive) && pred2.includes(pattern.negative)) ||
      (pred1.includes(pattern.negative) && pred2.includes(pattern.positive))
    ) {
      return {
        severity: 'major',
        analysis: `Direct contradiction detected: earlier statement affirms what later statement denies (or vice versa)`,
        confidence: 0.85,
        isEvolution: false
      };
    }
  }

  // Check for significant detail differences
  if (earlier.location && later.location && earlier.location !== later.location) {
    return {
      severity: 'significant',
      analysis: `Location discrepancy: earlier said "${earlier.location}", later said "${later.location}"`,
      confidence: 0.75,
      isEvolution: true
    };
  }

  // Check for time discrepancies
  if (earlier.timeReference?.originalText && later.timeReference?.originalText) {
    if (earlier.timeReference.originalText !== later.timeReference.originalText) {
      return {
        severity: 'significant',
        analysis: `Time discrepancy: earlier said "${earlier.timeReference.originalText}", later said "${later.timeReference.originalText}"`,
        confidence: 0.7,
        isEvolution: true
      };
    }
  }

  return null;
}

// ============================================================================
// Cross-Witness Conflict Detection
// ============================================================================

async function detectWitnessConflicts(
  caseId: string,
  facts: AtomicFact[]
): Promise<Contradiction[]> {
  const contradictions: Contradiction[] = [];

  // Group facts by what they're describing (the subject/event)
  const factsByEvent = new Map<string, AtomicFact[]>();

  facts.forEach(fact => {
    // Create event key from subject + rough time
    const eventKey = normalizeEventKey(fact);
    if (!factsByEvent.has(eventKey)) {
      factsByEvent.set(eventKey, []);
    }
    factsByEvent.get(eventKey)!.push(fact);
  });

  // For each event, compare witness accounts
  for (const [event, eventFacts] of factsByEvent) {
    if (eventFacts.length < 2) continue;

    // Get unique speakers
    const speakers = new Set(eventFacts.map(f => f.source.speakerName.toLowerCase()));
    if (speakers.size < 2) continue; // Same person, not a witness conflict

    // Compare facts from different speakers
    for (let i = 0; i < eventFacts.length; i++) {
      for (let j = i + 1; j < eventFacts.length; j++) {
        const fact1 = eventFacts[i];
        const fact2 = eventFacts[j];

        // Only compare different speakers
        if (fact1.source.speakerName.toLowerCase() === fact2.source.speakerName.toLowerCase()) {
          continue;
        }

        const conflict = compareWitnessStatements(fact1, fact2);
        if (conflict) {
          contradictions.push({
            id: `witness-${fact1.id}-${fact2.id}`,
            caseId,
            fact1Id: fact1.id,
            fact2Id: fact2.id,
            fact1Summary: `${fact1.source.speakerName}: "${fact1.predicate}"`,
            fact2Summary: `${fact2.source.speakerName}: "${fact2.predicate}"`,
            contradictionType: 'witness_conflict',
            severity: conflict.severity,
            description: `Witnesses disagree about ${event}`,
            analysis: conflict.analysis,
            implications: 'At least one witness is mistaken or being deceptive',
            suggestedFollowup: `Re-interview both witnesses separately about this specific detail`,
            involvedPersons: [fact1.source.speakerName, fact2.source.speakerName],
            resolutionStatus: 'unresolved',
            detectedAt: new Date().toISOString(),
            detectionMethod: 'automatic',
            confidenceScore: conflict.confidence
          });
        }
      }
    }
  }

  return contradictions;
}

function normalizeEventKey(fact: AtomicFact): string {
  // Create a normalized key for grouping related facts
  const subject = fact.subject.toLowerCase().replace(/[^a-z0-9]/g, '');
  const time = fact.timeReference?.originalText?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
  return `${subject}_${time}`;
}

function compareWitnessStatements(fact1: AtomicFact, fact2: AtomicFact): StatementConflict | null {
  // Check for opposing claims about the same thing
  const pred1 = fact1.predicate.toLowerCase();
  const pred2 = fact2.predicate.toLowerCase();

  // Check for yes/no conflicts
  if (
    (pred1.includes(' did ') && pred2.includes(' did not ')) ||
    (pred1.includes(' was ') && pred2.includes(' was not ')) ||
    (pred1.includes(' saw ') && pred2.includes(' did not see '))
  ) {
    return {
      severity: 'major',
      analysis: 'Witnesses directly contradict each other',
      confidence: 0.85,
      isEvolution: false
    };
  }

  // Check for different descriptions
  if (fact1.factType === 'physical_description' && fact2.factType === 'physical_description') {
    return {
      severity: 'significant',
      analysis: 'Witnesses provide different physical descriptions',
      confidence: 0.7,
      isEvolution: false
    };
  }

  // Check for vehicle conflicts
  if (fact1.factType === 'vehicle_sighting' && fact2.factType === 'vehicle_sighting') {
    if (fact1.mentionedVehicles.length > 0 && fact2.mentionedVehicles.length > 0) {
      if (!fact1.mentionedVehicles.some(v =>
        fact2.mentionedVehicles.some(v2 =>
          v.toLowerCase().includes(v2.toLowerCase()) || v2.toLowerCase().includes(v.toLowerCase())
        )
      )) {
        return {
          severity: 'significant',
          analysis: 'Witnesses describe different vehicles',
          confidence: 0.75,
          isEvolution: false
        };
      }
    }
  }

  return null;
}

// ============================================================================
// Evidence vs Testimony Contradiction
// ============================================================================

async function detectEvidenceContradictions(
  caseId: string,
  facts: AtomicFact[]
): Promise<Contradiction[]> {
  const contradictions: Contradiction[] = [];

  // Separate evidence facts from testimony facts
  const evidenceFacts = facts.filter(f =>
    f.factType === 'physical_evidence' ||
    f.factType === 'forensic_finding'
  );

  const testimonyFacts = facts.filter(f =>
    f.factType !== 'physical_evidence' &&
    f.factType !== 'forensic_finding'
  );

  // Check if any testimony contradicts physical evidence
  for (const evidence of evidenceFacts) {
    for (const testimony of testimonyFacts) {
      const conflict = checkEvidenceVsTestimony(evidence, testimony);
      if (conflict) {
        contradictions.push({
          id: `evidence-${evidence.id}-${testimony.id}`,
          caseId,
          fact1Id: evidence.id,
          fact2Id: testimony.id,
          fact1Summary: `Physical evidence: ${evidence.predicate}`,
          fact2Summary: `${testimony.source.speakerName} claims: ${testimony.predicate}`,
          contradictionType: 'evidence_contradiction',
          severity: 'critical', // Evidence contradictions are always critical
          description: 'Physical evidence contradicts witness testimony',
          analysis: conflict.analysis,
          implications: `${testimony.source.speakerName}'s statement is contradicted by physical evidence, suggesting possible deception`,
          suggestedFollowup: 'Confront witness with physical evidence and observe reaction',
          involvedPersons: [testimony.source.speakerName],
          resolutionStatus: 'unresolved',
          detectedAt: new Date().toISOString(),
          detectionMethod: 'automatic',
          confidenceScore: 0.9
        });
      }
    }
  }

  return contradictions;
}

function checkEvidenceVsTestimony(evidence: AtomicFact, testimony: AtomicFact): { analysis: string } | null {
  const evidenceText = evidence.predicate.toLowerCase();
  const testimonyText = testimony.predicate.toLowerCase();

  // Check for presence/absence contradictions
  if (
    (evidenceText.includes('found') && testimonyText.includes('never')) ||
    (evidenceText.includes('present') && testimonyText.includes('absent')) ||
    (evidenceText.includes('detected') && testimonyText.includes('no'))
  ) {
    return {
      analysis: 'Physical evidence indicates presence where testimony claims absence'
    };
  }

  // Check for DNA/fingerprint contradictions
  if (
    (evidenceText.includes('dna') || evidenceText.includes('fingerprint')) &&
    (testimonyText.includes('never') || testimonyText.includes('never touched'))
  ) {
    return {
      analysis: 'Forensic evidence places subject at scene despite denial'
    };
  }

  return null;
}

// ============================================================================
// AI-Enhanced Detection
// ============================================================================

async function detectWithAI(caseId: string, facts: AtomicFact[]): Promise<Contradiction[]> {
  if (facts.length === 0) return [];

  const client = getAnthropicClient();

  // Sample facts for AI analysis (to avoid token limits)
  const sampleSize = Math.min(50, facts.length);
  const sampledFacts = facts
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize);

  const factsText = sampledFacts.map(f =>
    `[${f.id}] ${f.source.speakerName}: "${f.predicate}" (${f.factType}, ${f.timeReference?.originalText || 'no time'})`
  ).join('\n');

  const prompt = `You are an expert cold case analyst looking for contradictions in witness statements and evidence.

Analyze these facts from a cold case investigation and identify any contradictions:

${factsText}

For each contradiction found, provide:
1. The two fact IDs that conflict
2. The type of contradiction (timeline_impossible, self_contradiction, statement_conflict, witness_conflict, evidence_contradiction, story_evolution, detail_inconsistency)
3. Severity (minor, significant, major, critical)
4. Brief description
5. Analysis of implications
6. Confidence (0-1)

Respond in JSON format:
{
  "contradictions": [
    {
      "fact1Id": string,
      "fact2Id": string,
      "type": string,
      "severity": string,
      "description": string,
      "analysis": string,
      "implications": string,
      "confidence": number
    }
  ]
}

Only include genuine contradictions, not minor variations in wording. Focus on substantive conflicts.`;

  try {
    const response = await client.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    });

    const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);

    if (!jsonMatch) return [];

    const result = JSON.parse(jsonMatch[0]);
    const aiContradictions: Contradiction[] = [];

    for (const c of result.contradictions || []) {
      const fact1 = sampledFacts.find(f => f.id === c.fact1Id);
      const fact2 = sampledFacts.find(f => f.id === c.fact2Id);

      if (!fact1 || !fact2) continue;

      aiContradictions.push({
        id: `ai-${c.fact1Id}-${c.fact2Id}`,
        caseId,
        fact1Id: c.fact1Id,
        fact2Id: c.fact2Id,
        fact1Summary: fact1.predicate,
        fact2Summary: fact2.predicate,
        contradictionType: c.type as ContradictionType,
        severity: c.severity as ContradictionSeverity,
        description: c.description,
        analysis: c.analysis,
        implications: c.implications,
        suggestedFollowup: 'AI-identified contradiction requires human review',
        involvedPersons: [...fact1.mentionedPersons, ...fact2.mentionedPersons, fact1.source.speakerName, fact2.source.speakerName].filter((v, i, a) => a.indexOf(v) === i),
        resolutionStatus: 'unresolved',
        detectedAt: new Date().toISOString(),
        detectionMethod: 'ai_enhanced',
        confidenceScore: c.confidence
      });
    }

    return aiContradictions;
  } catch (error) {
    console.error('AI contradiction detection failed:', error);
    return [];
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

function deduplicateContradictions(contradictions: Contradiction[]): Contradiction[] {
  const seen = new Set<string>();
  const unique: Contradiction[] = [];

  for (const c of contradictions) {
    // Create canonical key (sorted fact IDs)
    const key = [c.fact1Id, c.fact2Id].sort().join('-');
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
  }

  return unique;
}

async function saveContradictions(contradictions: Contradiction[]): Promise<void> {
  for (const c of contradictions) {
    await supabaseServer
      .from('fact_contradictions')
      .upsert({
        id: c.id,
        case_id: c.caseId,
        fact1_id: c.fact1Id,
        fact2_id: c.fact2Id,
        contradiction_type: c.contradictionType,
        severity: c.severity,
        description: c.description,
        analysis: c.analysis,
        implications: c.implications,
        suggested_followup: c.suggestedFollowup,
        involved_persons: c.involvedPersons,
        resolution_status: c.resolutionStatus,
        detected_at: c.detectedAt,
        detection_method: c.detectionMethod,
        confidence_score: c.confidenceScore
      }, { onConflict: 'id' });
  }
}

async function updateFactVerificationStatuses(contradictions: Contradiction[]): Promise<void> {
  const factIds = new Set<string>();
  contradictions.forEach(c => {
    factIds.add(c.fact1Id);
    factIds.add(c.fact2Id);
  });

  for (const factId of factIds) {
    await supabaseServer
      .from('atomic_facts')
      .update({
        verification_status: 'contradicted',
        last_updated: new Date().toISOString()
      })
      .eq('id', factId);
  }
}

function countBySeverity(contradictions: Contradiction[]): Record<ContradictionSeverity, number> {
  const counts: Record<ContradictionSeverity, number> = {
    minor: 0,
    significant: 0,
    major: 0,
    critical: 0
  };

  contradictions.forEach(c => {
    counts[c.severity]++;
  });

  return counts;
}

function countByType(contradictions: Contradiction[]): Record<ContradictionType, number> {
  const counts: Record<ContradictionType, number> = {
    timeline_impossible: 0,
    statement_conflict: 0,
    self_contradiction: 0,
    physical_impossible: 0,
    evidence_contradiction: 0,
    witness_conflict: 0,
    alibi_failure: 0,
    story_evolution: 0,
    detail_inconsistency: 0
  };

  contradictions.forEach(c => {
    counts[c.contradictionType]++;
  });

  return counts;
}

function extractInvolvedPersons(contradictions: Contradiction[]): string[] {
  const persons = new Set<string>();
  contradictions.forEach(c => {
    c.involvedPersons.forEach(p => persons.add(p));
  });
  return Array.from(persons);
}

// ============================================================================
// Query Functions
// ============================================================================

export async function getContradictionsForCase(caseId: string): Promise<Contradiction[]> {
  const { data, error } = await supabaseServer
    .from('fact_contradictions')
    .select('*')
    .eq('case_id', caseId)
    .order('severity', { ascending: false });

  if (error) return [];

  return (data || []).map(transformDbContradiction);
}

export async function getContradictionsForPerson(
  caseId: string,
  personName: string
): Promise<Contradiction[]> {
  const { data, error } = await supabaseServer
    .from('fact_contradictions')
    .select('*')
    .eq('case_id', caseId)
    .contains('involved_persons', [personName]);

  if (error) return [];

  return (data || []).map(transformDbContradiction);
}

export async function getUnresolvedContradictions(caseId: string): Promise<Contradiction[]> {
  const { data, error } = await supabaseServer
    .from('fact_contradictions')
    .select('*')
    .eq('case_id', caseId)
    .eq('resolution_status', 'unresolved')
    .order('severity', { ascending: false });

  if (error) return [];

  return (data || []).map(transformDbContradiction);
}

export async function getCriticalContradictions(caseId: string): Promise<Contradiction[]> {
  const { data, error } = await supabaseServer
    .from('fact_contradictions')
    .select('*')
    .eq('case_id', caseId)
    .in('severity', ['critical', 'major'])
    .order('detected_at', { ascending: false });

  if (error) return [];

  return (data || []).map(transformDbContradiction);
}

function transformDbContradiction(row: Record<string, unknown>): Contradiction {
  return {
    id: row.id as string,
    caseId: row.case_id as string,
    fact1Id: row.fact1_id as string,
    fact2Id: row.fact2_id as string,
    fact1Summary: '', // Would need to join with facts table
    fact2Summary: '',
    contradictionType: row.contradiction_type as ContradictionType,
    severity: row.severity as ContradictionSeverity,
    description: row.description as string,
    analysis: row.analysis as string || '',
    implications: row.implications as string || '',
    suggestedFollowup: row.suggested_followup as string || '',
    involvedPersons: row.involved_persons as string[] || [],
    resolutionStatus: row.resolution_status as ResolutionStatus,
    resolutionNotes: row.resolution_notes as string | undefined,
    resolvedBy: row.resolved_by as string | undefined,
    resolvedAt: row.resolved_at as string | undefined,
    detectedAt: row.detected_at as string,
    detectionMethod: row.detection_method as Contradiction['detectionMethod'],
    confidenceScore: row.confidence_score as number
  };
}
