import { DEFAULT_ANTHROPIC_MODEL, getAnthropicClient, isAnthropicConfigured } from './anthropic-client';
import { fallbackCaseAnalysis, fallbackDeepCaseAnalysis } from './ai-fallback';
import { getCaseById } from './demo-data';

export interface TimelineEvent {
  id: string;
  date: string;
  time?: string;
  startTime?: string;
  endTime?: string;
  description: string;
  source: string; // Which document/interview this came from
  sourceType: 'interview' | 'witness_statement' | 'police_report' | 'forensic_report' | 'tip' | 'other';
  location?: string;
  involvedPersons: string[];
  confidence: number; // 0-1 score of how confident the extraction is
  metadata?: Record<string, any>;
}

export interface PersonMention {
  name: string;
  aliases: string[];
  mentionedBy: string[]; // Who mentioned this person
  mentionCount: number;
  contexts: string[]; // Context snippets where they were mentioned
  role?: 'suspect' | 'witness' | 'victim' | 'associate' | 'unknown';
  suspicionScore: number; // How suspicious based on mentions
}

export interface Conflict {
  type: 'time_inconsistency' | 'location_mismatch' | 'statement_contradiction' | 'alibi_conflict';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  events: TimelineEvent[];
  affectedPersons: string[];
  details: string;
  recommendation?: string;
}

export interface UnfollowedTip {
  tipId: string;
  source: string;
  description: string;
  suggestedAction: string;
  priority: 'low' | 'medium' | 'high';
  mentioned: Date;
  reason: string; // Why it appears unfollowed
}

export interface CaseAnalysis {
  timeline: TimelineEvent[];
  conflicts: Conflict[];
  personMentions: PersonMention[];
  unfollowedTips: UnfollowedTip[];
  keyInsights: string[];
  suspectAnalysis: {
    name: string;
    riskScore: number;
    reasoning: string;
  }[];
}

const ANALYSIS_PROMPT = `You are an expert forensic analyst helping investigators organize and analyze case information. Your job is to extract structured data from case documents and identify critical insights.

Analyze the provided case documents and extract the following information:

1. TIMELINE EVENTS: Extract all events with dates/times. For each event include:
   - Date and time (or time range)
   - What happened
   - Where it happened
   - Who was involved
   - Source document
   - Confidence level (0-1)

2. PERSON MENTIONS: Track all people mentioned. For each person:
   - Name and any aliases
   - Who mentioned them
   - Context of mentions
   - Potential role (suspect, witness, victim, etc.)
   - Calculate a "suspicion score" based on:
     * Number of different sources mentioning them
     * Negative context of mentions
     * Proximity to the incident
     * Inconsistencies in their statements

3. CONFLICTS & INCONSISTENCIES: Identify contradictions like:
   - Time conflicts (person says they were at two places at once)
   - Statement contradictions (different accounts of same event)
   - Alibi conflicts (alibi doesn't match other evidence)
   - Location mismatches

4. UNFOLLOWED TIPS: Identify tips or leads that weren't followed up:
   - Tips mentioned but no follow-up documented
   - Persons of interest mentioned but not interviewed
   - Evidence suggested but not collected
   - Locations suggested but not searched

5. KEY INSIGHTS: Strategic observations that investigators should know

Return your analysis as a JSON object matching the CaseAnalysis interface.

Be thorough, objective, and flag anything suspicious or requiring attention.`;

export async function analyzeCaseDocuments(
  documents: { content: string; filename: string; type: string }[],
  caseId?: string
): Promise<CaseAnalysis> {
  const baseCase = caseId ? getCaseById(caseId) : null;
  const baseDate = baseCase?.incident_date || new Date().toISOString();

  if (!isAnthropicConfigured()) {
    console.warn('[AI Analysis] Anthropic key not configured. Using deterministic fallback analysis.');
    return fallbackCaseAnalysis(documents, baseDate);
  }

  try {
    const documentsText = documents
      .map((doc, idx) => `=== DOCUMENT ${idx + 1}: ${doc.filename} (${doc.type}) ===\n${doc.content}\n`)
      .join('\n\n');

    const anthropic = getAnthropicClient();

    const message = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: `${ANALYSIS_PROMPT}\n\nCASE DOCUMENTS:\n\n${documentsText}\n\nProvide your analysis as valid JSON only, no other text.`,
        },
      ],
    });

    const content = message.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude');
    }

    // Extract JSON from the response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('Claude response text:', content.text.substring(0, 500));
      throw new Error('Could not parse JSON from Claude response');
    }

    let analysis: CaseAnalysis;
    try {
      analysis = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Attempted to parse:', jsonMatch[0].substring(0, 500));
      throw new Error('Failed to parse JSON from Claude response');
    }

    // Validate and provide defaults for missing fields
    if (!analysis.timeline) {
      console.warn('Claude response missing timeline array');
      analysis.timeline = [];
    }
    if (!analysis.conflicts) analysis.conflicts = [];
    if (!analysis.personMentions) analysis.personMentions = [];
    if (!analysis.unfollowedTips) analysis.unfollowedTips = [];
    if (!analysis.keyInsights) analysis.keyInsights = [];
    if (!analysis.suspectAnalysis) analysis.suspectAnalysis = [];

    // Add unique IDs to timeline events if not present
    analysis.timeline = analysis.timeline.map((event, idx) => ({
      ...event,
      id: event.id || `event-${idx}`,
    }));

    return analysis;
  } catch (error) {
    console.error('[AI Analysis] Falling back to heuristic analysis due to error:', error);
    return fallbackCaseAnalysis(documents, baseDate);
  }
}

export function detectTimeConflicts(timeline: TimelineEvent[]): Conflict[] {
  const conflicts: Conflict[] = [];

  // Group events by person
  const eventsByPerson = new Map<string, TimelineEvent[]>();

  timeline.forEach(event => {
    event.involvedPersons.forEach(person => {
      if (!eventsByPerson.has(person)) {
        eventsByPerson.set(person, []);
      }
      eventsByPerson.get(person)!.push(event);
    });
  });

  // Check each person for time conflicts
  eventsByPerson.forEach((events, person) => {
    // Sort by date/time
    const sortedEvents = events.sort((a, b) => {
      const dateA = new Date(`${a.date} ${a.startTime || a.time || '00:00'}`);
      const dateB = new Date(`${b.date} ${b.startTime || b.time || '00:00'}`);
      return dateA.getTime() - dateB.getTime();
    });

    // Check for overlapping time ranges
    for (let i = 0; i < sortedEvents.length - 1; i++) {
      for (let j = i + 1; j < sortedEvents.length; j++) {
        const event1 = sortedEvents[i];
        const event2 = sortedEvents[j];

        // Skip if not same date
        if (event1.date !== event2.date) continue;

        const overlap = checkTimeOverlap(
          event1.startTime || event1.time,
          event1.endTime,
          event2.startTime || event2.time,
          event2.endTime
        );

        if (overlap && event1.location !== event2.location) {
          conflicts.push({
            type: 'time_inconsistency',
            severity: 'high',
            description: `${person} reported at two different locations during overlapping times`,
            events: [event1, event2],
            affectedPersons: [person],
            details: `According to ${event1.source}, ${person} was at ${event1.location} at ${event1.startTime || event1.time}. However, ${event2.source} places them at ${event2.location} at ${event2.startTime || event2.time}.`,
            recommendation: 'Re-interview subject about their whereabouts during this time period. Verify with additional witnesses or evidence.'
          });
        }
      }
    }
  });

  return conflicts;
}

function checkTimeOverlap(
  start1?: string,
  end1?: string,
  start2?: string,
  end2?: string
): boolean {
  if (!start1 || !start2) return false;

  const s1 = parseTime(start1);
  const e1 = end1 ? parseTime(end1) : s1 + 60; // Assume 1 hour if no end time
  const s2 = parseTime(start2);
  const e2 = end2 ? parseTime(end2) : s2 + 60;

  // Check if ranges overlap
  return (s1 < e2 && e1 > s2);
}

function parseTime(timeStr: string): number {
  // Convert time string like "7:30 PM" to minutes since midnight
  const match = timeStr.match(/(\d+):?(\d+)?\s*(AM|PM)?/i);
  if (!match) return 0;

  let hours = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const period = match[3]?.toUpperCase();

  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

export function identifyOverlookedSuspects(
  personMentions: PersonMention[],
  formalSuspects: string[]
): PersonMention[] {

  // Find people mentioned multiple times by different sources who aren't formal suspects
  return personMentions.filter(person => {
    const isFormalSuspect = formalSuspects.some(suspect =>
      suspect.toLowerCase().includes(person.name.toLowerCase()) ||
      person.aliases.some(alias => suspect.toLowerCase().includes(alias.toLowerCase()))
    );

    // Flag if mentioned by 3+ different sources and has high suspicion score
    return !isFormalSuspect &&
           person.mentionedBy.length >= 3 &&
           person.suspicionScore > 0.5;
  });
}

export function generateConflictSummary(conflicts: Conflict[]): string {
  if (conflicts.length === 0) {
    return 'No conflicts detected in the timeline.';
  }

  const critical = conflicts.filter(c => c.severity === 'critical').length;
  const high = conflicts.filter(c => c.severity === 'high').length;
  const medium = conflicts.filter(c => c.severity === 'medium').length;
  const low = conflicts.filter(c => c.severity === 'low').length;

  let summary = `Found ${conflicts.length} conflict${conflicts.length > 1 ? 's' : ''}: `;
  const parts = [];
  if (critical) parts.push(`${critical} critical`);
  if (high) parts.push(`${high} high`);
  if (medium) parts.push(`${medium} medium`);
  if (low) parts.push(`${low} low`);

  return summary + parts.join(', ') + ' severity.';
}
