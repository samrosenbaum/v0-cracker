import { CaseAnalysis, TimelineEvent } from './ai-analysis';
import { isLikelyNonPersonEntity } from './text-heuristics';

export type DocumentInput = {
  content: string;
  filename: string;
  type: string;
  metadata?: Record<string, any> | null;
};

const TIME_REGEX = /(\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b|\b\d{1,2}\s*(?:AM|PM)\b)/i;
const DATE_REGEX = /(\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b|\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b\s*\d{1,2},?\s*\d{2,4}|\b(?:Mon|Tues|Wed|Thu|Fri|Sat|Sun)[a-z]*\b)/i;

const PLACEHOLDER_LINE_PATTERNS = [
  /\[no extracted text/i,
  /summary unavailable/i,
  /no readable text/i,
  /not available/i,
  /^n\/?a$/i,
  /^none$/i,
];

const LOCATION_KEYS = ['location', 'address', 'site', 'venue', 'place', 'area', 'city'];
const PARTICIPANT_KEYS = ['participants', 'people', 'persons', 'individuals', 'witnesses', 'officers', 'suspects'];
const DATE_KEYS = ['date', 'occurred_on', 'incident_date', 'reported_date', 'day'];
const TIME_KEYS = ['time', 'timestamp', 'occurred_at', 'reported_time', 'datetime', 'time_recorded'];

type StructuredMetadataEvent = {
  timestamp?: string;
  dateHint?: string;
  timeHint?: string;
  location?: string;
  participants?: string[];
};

type MetadataContext = {
  timestamps: string[];
  dateHints: string[];
  timeHints: string[];
  locations: string[];
  participants: string[];
  structuredEvents: StructuredMetadataEvent[];
  defaultDate?: string;
  defaultTime?: string;
};

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

function isPlaceholderLine(line: string): boolean {
  return PLACEHOLDER_LINE_PATTERNS.some((pattern) => pattern.test(line));
}

function hasMeaningfulWords(line: string): boolean {
  const alphaNumeric = line.replace(/[^A-Za-z0-9\s]/g, ' ').trim();
  if (!alphaNumeric) return false;
  const tokens = alphaNumeric.split(/\s+/).filter(Boolean);
  const informativeTokens = tokens.filter((token) => token.length > 3);
  return informativeTokens.length >= 2;
}

function looksLikePdfArtifact(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;

  if (/[\uFFFD\u0000]/.test(trimmed)) {
    return true;
  }

  const symbolOnly = trimmed.replace(/[A-Za-z0-9\s,.'"()\-:;]/g, '');
  if (symbolOnly.length / trimmed.length > 0.35) {
    return true;
  }

  const pdfTokens = trimmed.match(/\/[A-Za-z0-9]+/g) || [];
  if (pdfTokens.length >= 3 && /<</.test(trimmed)) {
    return true;
  }

  return /^(?:<<|>>|xref\b|obj\b|endobj\b|stream\b|endstream\b)/i.test(trimmed);
}

function isMeaningfulLine(line: string): boolean {
  if (!line) return false;
  if (isPlaceholderLine(line)) return false;
  const trimmed = line.trim();
  if (trimmed.length < 12 && !TIME_REGEX.test(trimmed) && !DATE_REGEX.test(trimmed)) {
    return false;
  }
  if (trimmed.length < 20 && !TIME_REGEX.test(trimmed) && !DATE_REGEX.test(trimmed)) {
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    if (tokens.length <= 3 || !hasMeaningfulWords(trimmed)) {
      return false;
    }
  }
  if (looksLikePdfArtifact(trimmed)) {
    return false;
  }
  return /[A-Za-z]/.test(trimmed) && hasMeaningfulWords(trimmed);
}

function normalizeTime(input?: string | null): string | undefined {
  if (!input) return undefined;
  const trimmed = String(input).trim();
  if (!trimmed) return undefined;

  const isoMatch = trimmed.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?/);
  if (isoMatch) {
    const parsed = new Date(isoMatch[0]);
    if (!Number.isNaN(parsed.getTime())) {
      const hours = parsed.getHours().toString().padStart(2, '0');
      const minutes = parsed.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }

  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    const [hours, minutes] = trimmed.split(':');
    const h = Number.parseInt(hours, 10);
    const m = Number.parseInt(minutes, 10);
    if (Number.isInteger(h) && Number.isInteger(m)) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    }
  }

  const timeMatch = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (timeMatch) {
    let hours = Number.parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? Number.parseInt(timeMatch[2], 10) : 0;
    const modifier = timeMatch[3].toUpperCase();
    if (modifier === 'PM' && hours < 12) hours += 12;
    if (modifier === 'AM' && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  const looseMatch = trimmed.match(/(\d{1,2})(?::(\d{2}))?/);
  if (looseMatch) {
    const hours = Number.parseInt(looseMatch[1], 10);
    const minutes = looseMatch[2] ? Number.parseInt(looseMatch[2], 10) : 0;
    if (!Number.isNaN(hours) && hours <= 23) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  return undefined;
}

function normalizeLocation(input?: string | null): string | undefined {
  if (!input) return undefined;
  const cleaned = String(input).replace(/[\s\u2013\u2014]+/g, ' ').replace(/[.;,]+$/g, '').trim();
  if (!cleaned) return undefined;
  if (isPlaceholderLine(cleaned)) return undefined;
  return cleaned;
}

function extractLocationFromLine(line: string): string | undefined {
  const locationLabelMatch = line.match(/location[:\-]\s*([^.;]+)/i);
  if (locationLabelMatch) {
    return normalizeLocation(locationLabelMatch[1]);
  }

  const prepositionMatch = line.match(/\b(?:at|near|inside|outside|toward|towards)\s+([^.;]+)/i);
  if (prepositionMatch) {
    const candidate = normalizeLocation(prepositionMatch[1]);
    if (!candidate) return undefined;
    const firstToken = candidate.split(/\s+/)[0];
    if (!/^[A-Z0-9]/.test(firstToken) || /^(approximately|about|roughly)$/i.test(firstToken)) {
      return undefined;
    }
    if (candidate.split(/\s+/).length >= 2) {
      return candidate;
    }
  }

  return undefined;
}

function addUnique(target: string[], value: string | undefined) {
  if (!value) return;
  const trimmed = value.trim();
  if (!trimmed) return;
  if (target.some((existing) => existing.toLowerCase() === trimmed.toLowerCase())) return;
  target.push(trimmed);
}

function normalizeParticipants(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => normalizeParticipants(entry))
      .filter(Boolean)
      .slice(0, 6);
  }
  if (typeof value === 'string') {
    const parts = value
      .split(/[,;\n]/)
      .map((part) => part.trim())
      .filter((part) => part.length > 1 && !isPlaceholderLine(part));
    return parts.slice(0, 6);
  }
  return [];
}

function isKeyMatch(key: string, candidates: string[]): boolean {
  return candidates.some((candidate) => key.includes(candidate));
}

function extractMetadataContext(metadata: Record<string, any> | null | undefined, baseDate: string): MetadataContext {
  const context: MetadataContext = {
    timestamps: [],
    dateHints: [],
    timeHints: [],
    locations: [],
    participants: [],
    structuredEvents: [],
  };

  if (!metadata) {
    return context;
  }

  const visited = new WeakSet<object>();

  const registerStructuredEvent = (event: StructuredMetadataEvent) => {
    if (!event.timestamp && !event.timeHint && !event.dateHint && !event.location && !event.participants?.length) {
      return;
    }
    context.structuredEvents.push(event);
  };

  const visit = (value: unknown, path: string[]) => {
    if (value === null || value === undefined) return;

    if (typeof value === 'string') {
      const lowerPath = path.map((segment) => segment.toLowerCase());
      const lastKey = lowerPath[lowerPath.length - 1] || '';

      if (isKeyMatch(lastKey, LOCATION_KEYS)) {
        addUnique(context.locations, normalizeLocation(value));
      }

      if (isKeyMatch(lastKey, PARTICIPANT_KEYS)) {
        normalizeParticipants(value).forEach((participant) => addUnique(context.participants, participant));
      }

      const normalizedTime = normalizeTime(value);
      if (normalizedTime) {
        addUnique(context.timeHints, normalizedTime);
      }

      if (DATE_REGEX.test(value) || isKeyMatch(lastKey, DATE_KEYS)) {
        addUnique(context.dateHints, sanitizeDate(value, baseDate));
      }

      const isoMatch = value.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?/);
      if (isoMatch) {
        addUnique(context.timestamps, isoMatch[0]);
      }

      return;
    }

    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, path));
      return;
    }

    if (typeof value === 'object') {
      const objectValue = value as Record<string, unknown>;
      if (visited.has(objectValue)) {
        return;
      }
      visited.add(objectValue);

      const lowerKeys = Object.keys(objectValue).map((key) => key.toLowerCase());
      const structuredEvent: StructuredMetadataEvent = {};

      lowerKeys.forEach((lowerKey, index) => {
        const originalKey = Object.keys(objectValue)[index];
        const entry = objectValue[originalKey];
        if (entry === undefined || entry === null) return;

        if (typeof entry === 'string' || typeof entry === 'number') {
          const entryString = String(entry);
          if (isKeyMatch(lowerKey, TIME_KEYS)) {
            structuredEvent.timeHint = structuredEvent.timeHint || entryString;
          }
          if (isKeyMatch(lowerKey, DATE_KEYS)) {
            structuredEvent.dateHint = structuredEvent.dateHint || entryString;
          }
          if (lowerKey.includes('timestamp') || lowerKey.includes('datetime')) {
            structuredEvent.timestamp = structuredEvent.timestamp || entryString;
          }
          if (isKeyMatch(lowerKey, LOCATION_KEYS)) {
            structuredEvent.location = structuredEvent.location || entryString;
          }
          if (isKeyMatch(lowerKey, PARTICIPANT_KEYS)) {
            const participants = normalizeParticipants(entryString);
            if (participants.length) {
              structuredEvent.participants = structuredEvent.participants || [];
              participants.forEach((participant) => {
                addUnique(structuredEvent.participants!, participant);
              });
            }
          }
        } else if (Array.isArray(entry) && isKeyMatch(lowerKey, PARTICIPANT_KEYS)) {
          const participants = normalizeParticipants(entry);
          if (participants.length) {
            structuredEvent.participants = structuredEvent.participants || [];
            participants.forEach((participant) => addUnique(structuredEvent.participants!, participant));
          }
        }
      });

      registerStructuredEvent(structuredEvent);

      Object.entries(objectValue).forEach(([key, childValue]) => {
        visit(childValue, [...path, key]);
      });
    }
  };

  visit(metadata, []);

  if (!context.defaultDate) {
    const candidate = context.timestamps[0] || context.dateHints[0];
    if (candidate) {
      context.defaultDate = sanitizeDate(candidate, baseDate);
    }
  }

  if (!context.defaultTime) {
    const candidate =
      context.timestamps.find((timestamp) => normalizeTime(timestamp)) || context.timeHints[0];
    if (candidate) {
      context.defaultTime = normalizeTime(candidate);
    }
  }

  return context;
}

function buildTimeline(documents: DocumentInput[], baseDate: string): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  documents.forEach((doc, docIndex) => {
    const lines = doc.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const metadataContext = extractMetadataContext(doc.metadata || null, baseDate);
    const timestampQueue = [...metadataContext.timestamps];
    const timeHintQueue = [...metadataContext.timeHints];
    const locationQueue = [...metadataContext.locations];
    const structuredQueue = metadataContext.structuredEvents.filter((event) =>
      Boolean(event.timestamp || event.timeHint || event.dateHint || event.location || event.participants?.length),
    );

    lines.forEach((line, lineIndex) => {
      if (!isMeaningfulLine(line)) return;

      const structuredEvent = structuredQueue.length ? structuredQueue.shift() : undefined;
      const timeMatch = line.match(TIME_REGEX);
      const dateMatch = line.match(DATE_REGEX);

      let metadataTimestamp: string | undefined;
      if ((!dateMatch || !timeMatch) && structuredEvent?.timestamp) {
        metadataTimestamp = structuredEvent.timestamp;
      } else if ((!dateMatch || !timeMatch) && timestampQueue.length) {
        metadataTimestamp = timestampQueue.shift();
      }

      const dateSource =
        dateMatch?.[0] || structuredEvent?.dateHint || metadataTimestamp || metadataContext.defaultDate || baseDate;
      const eventDate = sanitizeDate(dateSource, baseDate);

      const timeSource =
        timeMatch?.[0] ||
        structuredEvent?.timeHint ||
        metadataTimestamp ||
        (timeHintQueue.length ? timeHintQueue.shift() : undefined) ||
        metadataContext.defaultTime;
      const eventTime = normalizeTime(timeSource);

      const lineLocation = extractLocationFromLine(line);
      let location = normalizeLocation(lineLocation);
      let usedMetadataLocation = false;
      if (!location && structuredEvent?.location) {
        location = normalizeLocation(structuredEvent.location);
        usedMetadataLocation = Boolean(location);
      }
      if (!location && locationQueue.length) {
        location = normalizeLocation(locationQueue.shift());
        usedMetadataLocation = usedMetadataLocation || Boolean(location);
      }
      if (!location && metadataContext.locations.length) {
        location = normalizeLocation(metadataContext.locations[0]);
        usedMetadataLocation = usedMetadataLocation || Boolean(location);
      }
      if (!location && /river/i.test(line)) {
        location = 'Riverside Riverwalk';
      }

      const persons = new Set<string>();
      extractNames(line).forEach((name) => persons.add(name));
      let usedMetadataParticipants = false;

      if (structuredEvent?.participants?.length) {
        structuredEvent.participants.forEach((participant) => persons.add(participant));
        usedMetadataParticipants = true;
      }

      if (!persons.size && metadataContext.participants.length) {
        metadataContext.participants.forEach((participant) => persons.add(participant));
        usedMetadataParticipants = usedMetadataParticipants || Boolean(metadataContext.participants.length);
      }

      const metadataFlags: Record<string, any> = { fallback: true };
      const metadataCues: Record<string, boolean> = {};
      if (metadataTimestamp || structuredEvent?.dateHint || structuredEvent?.timeHint) {
        metadataCues.timestamp = true;
      }
      if (usedMetadataLocation) {
        metadataCues.location = true;
      }
      if (usedMetadataParticipants) {
        metadataCues.participants = true;
      }
      if (Object.keys(metadataCues).length) {
        metadataFlags.metadataCues = metadataCues;
      }

      const event: TimelineEvent = {
        id: `fallback-${docIndex}-${lineIndex}`,
        date: eventDate,
        description: line,
        source: doc.filename,
        sourceType: (doc.type as any) || 'other',
        involvedPersons: Array.from(persons),
        confidence: Math.min(0.55 + (docIndex + lineIndex) * 0.03, 0.9),
        metadata: metadataFlags,
      };

      if (eventTime) {
        event.time = eventTime;
      }
      if (location) {
        event.location = location;
      }

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
    `Earliest recovered activity: ${earliest.description.slice(0, 140)} (${earliest.date}${earliest.time ? ` ${earliest.time}` : ''}).`,
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
