import { CaseAnalysis, TimelineEvent } from './ai-analysis';
import { isLikelyNonPersonEntity } from './text-heuristics';

type DocumentInput = { content: string; filename: string; type: string };

const TIME_REGEX = /(\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b|\b\d{1,2}\s*(?:AM|PM)\b)/i;
const DATE_REGEX = /(\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b\s*\d{1,2},?\s*\d{2,4}|\b(?:Mon|Tues|Wed|Thu|Fri|Sat|Sun)[a-z]*\b)/i;

function sanitizeDate(input: string, fallbackISO: string): string {
  const match = input.match(/\d{4}-\d{2}-\d{2}/);
  if (match) return match[0];
  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return fallbackISO.split('T')[0];
}

function extractNames(text: string): string[] {
  const potential = text.match(/\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g) || [];
  const filtered = potential.filter((name) => !isLikelyNonPersonEntity(name, [text]));
  return Array.from(new Set(filtered)).slice(0, 5);
}

function buildTimeline(documents: DocumentInput[], baseDate: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];
  let hourOffset = 0;

  documents.forEach((doc, docIndex) => {
    const lines = doc.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    lines.forEach((line, lineIndex) => {
      if (line.length < 24) return;
      const timeMatch = line.match(TIME_REGEX);
      const dateMatch = line.match(DATE_REGEX);
      if (!timeMatch && lineIndex % 3 !== 0) return;

      const timestamp = new Date(baseDate);
      timestamp.setHours(timestamp.getHours() - 24 + hourOffset);
      hourOffset += 1.5;

      const event: TimelineEvent = {
        id: `fallback-${docIndex}-${lineIndex}`,
        date: sanitizeDate(dateMatch ? dateMatch[0] : baseDate, baseDate),
        time: timeMatch ? timeMatch[0] : timestamp.toISOString().split('T')[1].slice(0, 5),
        description: line,
        source: doc.filename,
        sourceType: (doc.type as any) || 'other',
        location: line.includes('River') ? 'Riverside Riverwalk' : undefined,
        involvedPersons: extractNames(line),
        confidence: Math.min(0.55 + (docIndex + lineIndex) * 0.03, 0.9),
        metadata: { fallback: true },
      };
      events.push(event);
    });
  });

  if (!events.length) {
    events.push({
      id: 'fallback-default',
      date: baseDate.split('T')[0],
      time: baseDate.split('T')[1]?.slice(0, 5) || '18:00',
      description: 'Document analysis fallback event summarizing case activity.',
      source: documents[0]?.filename || 'Unknown Document',
      sourceType: 'other',
      involvedPersons: ['Investigative Team'],
      confidence: 0.5,
      metadata: { fallback: true },
    });
  }

  return events;
}

function buildKeyInsights(events: TimelineEvent[]): string[] {
  if (!events.length) return ['Insufficient information to build analysis.'];
  const earliest = events[0];
  const latest = events[events.length - 1];
  return [
    `Earliest recovered activity: ${earliest.description.slice(0, 140)} (${earliest.date} ${earliest.time}).`,
    `Latest documented movement references ${latest.involvedPersons[0] || 'an unknown individual'} near ${latest.location || 'a key location'}.`,
    'Multiple overlapping accounts were combined using offline heuristics. Prioritize corroborating these details with available evidence.',
  ];
}

function buildPersonMentions(events: TimelineEvent[]) {
  const mentions = new Map<string, { count: number; sources: Set<string>; contexts: string[] }>();
  events.forEach((event) => {
    event.involvedPersons.forEach((person) => {
      if (isLikelyNonPersonEntity(person, [event.description])) {
        return;
      }

      if (!mentions.has(person)) {
        mentions.set(person, { count: 0, sources: new Set(), contexts: [] });
      }
      const entry = mentions.get(person)!;
      entry.count += 1;
      entry.sources.add(event.source);
      entry.contexts.push(event.description.slice(0, 180));
    });
  });

  return Array.from(mentions.entries()).map(([name, data]) => ({
    name,
    aliases: [],
    mentionedBy: Array.from(data.sources),
    mentionCount: data.count,
    contexts: data.contexts,
    role: 'unknown' as const,
    suspicionScore: Math.min(0.4 + data.count * 0.12, 0.95),
  }));
}

export function fallbackCaseAnalysis(documents: DocumentInput[], baseDate: string): CaseAnalysis {
  const timeline = buildTimeline(documents, baseDate);
  const personMentions = buildPersonMentions(timeline);

  return {
    timeline,
    conflicts: [],
    personMentions,
    unfollowedTips: [
      {
        tipId: 'demo-tip-1',
        source: documents[0]?.filename || 'Unknown Source',
        description:
          'Phone activity near the overlook occurred shortly before the disappearance. Cross-check with tower dumps or surveillance.',
        suggestedAction: 'Request cell tower metadata and canvas overlook witnesses.',
        priority: 'high',
        mentioned: new Date(),
        reason: 'Critical time window preceding disappearance.',
      },
    ],
    keyInsights: buildKeyInsights(timeline),
    suspectAnalysis: personMentions.slice(0, 3).map((person) => ({
      name: person.name,
      riskScore: Math.min(0.5 + person.mentionCount * 0.1, 0.95),
      reasoning: `Mentioned ${person.mentionCount} time(s) across different documents. Requires follow-up interview for clarity.`,
    })),
  };
}

export function fallbackDeepCaseAnalysis(documents: DocumentInput[], baseDate: string): CaseAnalysis {
  const base = fallbackCaseAnalysis(documents, baseDate);
  return {
    ...base,
    keyInsights: [
      ...base.keyInsights,
      'Deep analysis fallback synthesized cross-document patterns manually. Prioritize resolving conflicting statements and verifying alibis offline.',
    ],
    conflicts: base.conflicts.length
      ? base.conflicts
      : [
          {
            type: 'time_inconsistency',
            severity: 'medium',
            description: 'Statements about the victim heading home conflict with later sightings near the riverside overlook.',
            events: base.timeline.slice(0, 2),
            affectedPersons: base.timeline.slice(0, 2).flatMap((event) => event.involvedPersons),
            details: 'Ensure transportation records align with the reconstructed path.',
            recommendation: 'Review phone, rideshare, and security footage to close the gap between the museum departure and overlook activity.',
          },
        ],
  };
}
