/**
 * Inngest Job: Populate Investigation Board
 *
 * Automatically extracts structured data from case documents to populate:
 * - Entities (people, locations, evidence, vehicles, organizations)
 * - Timeline events (with dates, times, locations)
 * - Connections between entities
 * - Alibi statements from suspects
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { analyzeCaseDocuments } from '@/lib/ai-analysis';
import OpenAI from 'openai';

type StepRunner = {
  run<T>(name: string, fn: () => Promise<T>): Promise<T>;
};

const createStepRunner = (step?: StepRunner): StepRunner => {
  if (step && typeof step.run === 'function') {
    return step;
  }

  return {
    async run<T>(_name: string, fn: () => Promise<T>): Promise<T> {
      return await fn();
    },
  };
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

const textDecoder = new TextDecoder();

/**
 * Types for extracted data
 */
interface ExtractedEntity {
  name: string;
  type: 'person' | 'location' | 'evidence' | 'vehicle' | 'organization' | 'other';
  role?: string; // victim, suspect, witness, etc.
  description?: string;
}

interface ExtractedTimelineEvent {
  title: string;
  description?: string;
  event_type:
    | 'victim_action'
    | 'suspect_movement'
    | 'witness_account'
    | 'evidence_found'
    | 'phone_call'
    | 'transaction'
    | 'sighting'
    | 'other';
  event_time?: string; // ISO timestamp
  time_precision?: 'exact' | 'approximate' | 'estimated' | 'unknown';
  location?: string;
  entity_names?: string[]; // Names of involved entities
  verification_status?: 'verified' | 'unverified' | 'disputed' | 'false';
  confidence_score?: number; // 0-100
}

interface ExtractedConnection {
  from_entity: string;
  to_entity: string;
  connection_type: string; // saw, knows, owns, located_at, etc.
  label?: string;
  description?: string;
  confidence?: 'confirmed' | 'probable' | 'possible' | 'unverified';
}

interface ExtractedAlibi {
  subject_name: string;
  statement_date?: string;
  alibi_start_time: string;
  alibi_end_time: string;
  location_claimed: string;
  activity_claimed: string;
  full_statement?: string;
  verification_status?: 'verified' | 'partial' | 'unverified' | 'contradicted' | 'false';
}

type DocumentForAnalysis = {
  content: string;
  filename: string;
  type: string;
};

interface BoardExtractionResult {
  entities: ExtractedEntity[];
  events: ExtractedTimelineEvent[];
  connections: ExtractedConnection[];
  alibis: ExtractedAlibi[];
}

export interface PopulateInvestigationBoardOptions {
  caseId: string;
  caseFileId?: string;
  step?: StepRunner;
}

/**
 * Shared implementation used by both the background job and synchronous fallback
 */
export async function populateInvestigationBoardFromDocuments({
  caseId,
  caseFileId,
  step,
}: PopulateInvestigationBoardOptions) {
  const runner = createStepRunner(step);

  console.log(`[Board Population] Starting for case: ${caseId}`);

  // Step 1: Fetch all completed chunks for the case. We'll fall back to direct
  // document analysis if no chunks or no OpenAI key is available.
  const chunks = await runner.run('fetch-chunks', async () => {
    let query = supabaseServer
      .from('document_chunks')
      .select('id, content, case_file_id, chunk_index, metadata')
      .eq('processing_status', 'completed')
      .not('content', 'is', null);

    if (caseFileId) {
      query = query.eq('case_file_id', caseFileId);
    } else {
      const { data: caseFiles } = await supabaseServer
        .from('case_files')
        .select('id')
        .eq('case_id', caseId);

      if (caseFiles && caseFiles.length > 0) {
        const fileIds = caseFiles.map((f) => f.id);
        query = query.in('case_file_id', fileIds);
      }
    }

    const { data, error } = await query.order('chunk_index');

    if (error) {
      console.error('[Board Population] Error fetching chunks:', error);
      throw error;
    }

    console.log(`[Board Population] Found ${data?.length || 0} chunks to analyze`);
    return data || [];
  });

  const shouldUseLLMExtraction = Boolean(process.env.OPENAI_API_KEY) && chunks.length > 0;
  let extraction: BoardExtractionResult;

  if (shouldUseLLMExtraction) {
    console.log('[Board Population] Using OpenAI-powered extraction pipeline');
    extraction = await runLLMExtraction({ chunks, runner });
  } else {
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[Board Population] OPENAI_API_KEY missing. Falling back to deterministic extraction.');
    } else if (!chunks.length) {
      console.warn('[Board Population] No document chunks found. Falling back to deterministic extraction.');
    }

    extraction = await runFallbackExtraction({ caseId, caseFileId, chunks, runner });
  }

  if (
    extraction.entities.length === 0 &&
    extraction.events.length === 0 &&
    extraction.connections.length === 0 &&
    extraction.alibis.length === 0
  ) {
    console.log('[Board Population] No structured data extracted. Skipping persistence.');
    return { caseId, entities: 0, events: 0, connections: 0, alibis: 0 };
  }

  const persistenceResult = await persistBoardData({ caseId, extraction, runner });

  return {
    caseId,
    ...persistenceResult,
  };
}

async function runLLMExtraction({
  chunks,
  runner,
}: {
  chunks: Array<{
    id: string;
    content: string | null;
    case_file_id: string | null;
    chunk_index: number;
    metadata: Record<string, any> | null;
  }>;
  runner: StepRunner;
}): Promise<BoardExtractionResult> {
  const extractedEntities = await runner.run('extract-entities', async () => {
    const entities: ExtractedEntity[] = [];
    const batchSize = 5;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const combinedText = batch
        .map((c) => `[Page ${c.chunk_index + 1}]\n${c.content ?? ''}`)
        .join('\n\n---\n\n');

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are analyzing police/legal documents to extract entities for a cold case investigation.

Extract ALL entities mentioned in the documents:
- People (victims, suspects, witnesses, investigators, family members)
- Locations (addresses, crime scenes, buildings, cities)
- Evidence (weapons, items, vehicles, biological samples)
- Vehicles (cars, motorcycles, boats with make/model/color if available)
- Organizations (police departments, companies, groups)

For each entity provide:
- name: The full name or description
- type: person, location, evidence, vehicle, organization, or other
- role: For people - victim, suspect, witness, investigator, family, other. Leave empty for non-people.
- description: Brief description with any important details

Return ONLY a valid JSON array of entities. No markdown, no explanations.`,
            },
            {
              role: 'user',
              content: combinedText.substring(0, 12000),
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });

        const result = response.choices[0]?.message?.content;
        if (result) {
          const parsed = JSON.parse(result);
          const entityArray = parsed.entities || parsed;
          if (Array.isArray(entityArray)) {
            entities.push(...entityArray);
          }
        }
      } catch (error) {
        console.error(`[Board Population] Error extracting entities from batch ${i / batchSize}:`, error);
      }
    }

    console.log(`[Board Population] Extracted ${entities.length} entities via OpenAI`);
    return entities;
  });

  const extractedEvents = await runner.run('extract-timeline-events', async () => {
    const events: ExtractedTimelineEvent[] = [];
    const batchSize = 5;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const combinedText = batch
        .map((c) => `[Page ${c.chunk_index + 1}]\n${c.content ?? ''}`)
        .join('\n\n---\n\n');

      try {
        const response = await openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are analyzing police/legal documents to extract timeline events for a cold case investigation.

Extract ALL time-based events mentioned:
- Victim's last known actions
- Suspect movements and whereabouts
- Witness sightings and accounts
- Evidence discovery
- Phone calls, transactions, communications
- Any dated/timed occurrence

For each event provide:
- title: Short title (e.g., "Victim last seen at coffee shop")
- description: Detailed description
- event_type: victim_action, suspect_movement, witness_account, evidence_found, phone_call, transaction, sighting, or other
- event_time: ISO timestamp if date/time is known (e.g., "2024-01-15T14:30:00Z")
- time_precision: exact, approximate, estimated, or unknown
- location: Where it happened
- entity_names: Array of names of people/entities involved
- verification_status: verified, unverified, disputed, or false
- confidence_score: 0-100 how confident this event is accurate

Return ONLY a valid JSON array of events. No markdown, no explanations.`,
            },
            {
              role: 'user',
              content: combinedText.substring(0, 12000),
            },
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        });

        const result = response.choices[0]?.message?.content;
        if (result) {
          const parsed = JSON.parse(result);
          const eventArray = parsed.events || parsed;
          if (Array.isArray(eventArray)) {
            events.push(...eventArray);
          }
        }
      } catch (error) {
        console.error(`[Board Population] Error extracting events from batch ${i / batchSize}:`, error);
      }
    }

    console.log(`[Board Population] Extracted ${events.length} timeline events via OpenAI`);
    return events;
  });

  const extractedConnections = await runner.run('extract-connections', async () => {
    const connections: ExtractedConnection[] = [];

    const combinedText = chunks
      .slice(0, 10)
      .map((c) => `[Page ${c.chunk_index + 1}]\n${c.content ?? ''}`)
      .join('\n\n---\n\n');

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are analyzing police/legal documents to extract relationships between entities for a cold case investigation.

Extract ALL connections/relationships mentioned:
- Who knows who
- Who saw who
- Who owns what
- Who was where (person at location)
- What was found where (evidence at location)
- Family relationships
- Professional relationships
- Any other connections

For each connection provide:
- from_entity: Name of the first entity
- to_entity: Name of the second entity
- connection_type: saw, knows, owns, located_at, related_to, alibi_with, works_at, family_of, etc.
- label: Short description (e.g., "saw victim at 3pm")
- description: Detailed explanation
- confidence: confirmed, probable, possible, or unverified

Return ONLY a valid JSON array of connections. No markdown, no explanations.`,
          },
          {
            role: 'user',
            content: combinedText.substring(0, 12000),
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = response.choices[0]?.message?.content;
      if (result) {
        const parsed = JSON.parse(result);
        const connectionArray = parsed.connections || parsed;
        if (Array.isArray(connectionArray)) {
          connections.push(...connectionArray);
        }
      }
    } catch (error) {
      console.error('[Board Population] Error extracting connections:', error);
    }

    console.log(`[Board Population] Extracted ${connections.length} connections via OpenAI`);
    return connections;
  });

  const extractedAlibis = await runner.run('extract-alibis', async () => {
    const alibis: ExtractedAlibi[] = [];

    const combinedText = chunks
      .slice(0, 10)
      .map((c) => `[Page ${c.chunk_index + 1}]\n${c.content ?? ''}`)
      .join('\n\n---\n\n');

    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are analyzing police/legal documents to extract alibi statements for a cold case investigation.

Extract ALL alibi statements where suspects claim their whereabouts:
- Look for statements like "I was at..." or "I spent the evening..."
- Interview transcripts
- Written statements
- Witness corroboration of alibis

For each alibi provide:
- subject_name: Name of person giving the alibi
- statement_date: When the statement was given (ISO format if available)
- alibi_start_time: When the alibi period starts (ISO format)
- alibi_end_time: When the alibi period ends (ISO format)
- location_claimed: Where they claim to have been
- activity_claimed: What they claim to have been doing
- full_statement: The full statement text if available
- verification_status: verified, partial, unverified, contradicted, or false

Return ONLY a valid JSON array of alibis. No markdown, no explanations.`,
          },
          {
            role: 'user',
            content: combinedText.substring(0, 12000),
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const result = response.choices[0]?.message?.content;
      if (result) {
        const parsed = JSON.parse(result);
        const alibiArray = parsed.alibis || parsed;
        if (Array.isArray(alibiArray)) {
          alibis.push(...alibiArray);
        }
      }
    } catch (error) {
      console.error('[Board Population] Error extracting alibis:', error);
    }

    console.log(`[Board Population] Extracted ${alibis.length} alibis via OpenAI`);
    return alibis;
  });

  return {
    entities: extractedEntities,
    events: extractedEvents,
    connections: extractedConnections,
    alibis: extractedAlibis,
  };
}

async function runFallbackExtraction({
  caseId,
  caseFileId,
  chunks,
  runner,
}: {
  caseId: string;
  caseFileId?: string;
  chunks: Array<{
    id: string;
    content: string | null;
    case_file_id: string | null;
    chunk_index: number;
    metadata: Record<string, any> | null;
  }>;
  runner: StepRunner;
}): Promise<BoardExtractionResult> {
  const documents = await runner.run('collect-documents', async () =>
    collectDocumentsForFallback({ caseId, caseFileId, chunks })
  );

  if (!documents.length) {
    console.warn('[Board Population] No documents available for fallback extraction.');
    return { entities: [], events: [], connections: [], alibis: [] };
  }

  const analysis = await runner.run('offline-analysis', async () =>
    analyzeCaseDocuments(
      documents.map((doc) => ({
        content: doc.content,
        filename: doc.filename,
        type: doc.type,
      })),
      caseId,
    ),
  );

  const caseDetails = await runner.run('load-case-details', async () => {
    const { data } = await supabaseServer
      .from('cases')
      .select('victim_name, name, title')
      .eq('id', caseId)
      .maybeSingle();
    return data || null;
  });

  const entityMap = new Map<string, ExtractedEntity>();

  const addEntity = (entity: ExtractedEntity) => {
    const key = entity.name.trim().toLowerCase();
    if (!key) return;
    if (entityMap.has(key)) return;
    entityMap.set(key, entity);
  };

  if (caseDetails?.victim_name) {
    addEntity({
      name: caseDetails.victim_name,
      type: 'person',
      role: 'victim',
      description: `Primary victim associated with case ${caseDetails.name || caseDetails.title || caseId}.`,
    });
  }

  analysis.personMentions.forEach((person) => {
    if (!person.name) return;
    const role = inferRoleFromContext(person.name, person.contexts);
    addEntity({
      name: person.name,
      type: 'person',
      role,
      description: `Mentioned ${person.mentionCount} time(s) across ${person.mentionedBy.length} document(s). ${
        person.contexts[0] ? `Context: ${person.contexts[0]}` : ''
      }`.trim(),
    });
  });

  const timelineEvents: ExtractedTimelineEvent[] = analysis.timeline.slice(0, 80).map((event, index) => {
    const isoTime = toISODateTime(event.date, event.time || event.startTime);
    const entityNames = event.involvedPersons.filter(Boolean);

    entityNames.forEach((name) => {
      if (!entityMap.has(name.toLowerCase())) {
        addEntity({
          name,
          type: 'person',
          role: inferRoleFromContext(name, [event.description]),
          description: `Referenced in timeline event: ${event.description.slice(0, 120)}`,
        });
      }
    });

    if (event.location) {
      addEntity({
        name: event.location,
        type: 'location',
        description: `Referenced in timeline reconstruction (event ${index + 1}).`,
      });
    }

    return {
      title: event.description.slice(0, 72) || `Event ${index + 1}`,
      description: event.description,
      event_type: determineEventType(event.description, entityNames),
      event_time: isoTime || undefined,
      time_precision: isoTime ? 'approximate' : 'unknown',
      location: event.location || undefined,
      entity_names: entityNames,
      verification_status: 'unverified',
      confidence_score: Math.round((event.confidence || 0.5) * 100),
    };
  });

  const connectionKeys = new Set<string>();
  const connections: ExtractedConnection[] = [];

  const pushConnection = (
    from: string,
    to: string,
    connection_type: string,
    label: string | undefined,
    description: string,
    confidence: ExtractedConnection['confidence'] = 'probable',
  ) => {
    const key = createConnectionKey(from, to, connection_type, label);
    if (connectionKeys.has(key)) return;
    connectionKeys.add(key);
    connections.push({
      from_entity: from,
      to_entity: to,
      connection_type,
      label,
      description,
      confidence,
    });
  };

  timelineEvents.forEach((event, index) => {
    const participants = event.entity_names || [];
    for (let i = 0; i < participants.length; i += 1) {
      for (let j = i + 1; j < participants.length; j += 1) {
        pushConnection(
          participants[i],
          participants[j],
          'associated_with',
          event.title,
          `Jointly referenced in timeline event #${index + 1}. ${event.description}`,
        );
      }
    }

    if (event.location) {
      participants.forEach((participant) => {
        pushConnection(
          participant,
          event.location!,
          'located_at',
          event.title,
          `Timeline event places ${participant} at ${event.location}. ${event.description}`,
        );
      });
    }
  });

  const alibiKeys = new Set<string>();
  const alibis: ExtractedAlibi[] = [];

  analysis.timeline.forEach((event) => {
    if (!event.involvedPersons.length) return;
    const normalized = event.description.toLowerCase();
    const mentionsAlibi =
      normalized.includes('alibi') ||
      normalized.includes('claims') ||
      normalized.includes('states he was') ||
      normalized.includes('states she was');

    if (!mentionsAlibi) return;

    const subject = event.involvedPersons[0];
    const start = toISODateTime(event.date, event.time || event.startTime);
    if (!subject || !start) return;

    const endDate = new Date(start);
    endDate.setHours(endDate.getHours() + 1);

    const alibi: ExtractedAlibi = {
      subject_name: subject,
      statement_date: toISODateTime(event.date) || new Date().toISOString(),
      alibi_start_time: start,
      alibi_end_time: endDate.toISOString(),
      location_claimed: event.location || 'Unknown location',
      activity_claimed: event.description,
      full_statement: event.description,
      verification_status: 'unverified',
    };

    const key = createAlibiKey(alibi);
    if (alibiKeys.has(key)) return;
    alibiKeys.add(key);
    alibis.push(alibi);
  });

  console.log(
    `[Board Population] Fallback extraction prepared ${entityMap.size} entities, ${timelineEvents.length} events, ${connections.length} connections, ${alibis.length} alibis`,
  );

  return {
    entities: Array.from(entityMap.values()),
    events: timelineEvents,
    connections,
    alibis,
  };
}

async function persistBoardData({
  caseId,
  extraction,
  runner,
}: {
  caseId: string;
  extraction: BoardExtractionResult;
  runner: StepRunner;
}): Promise<{ entities: number; events: number; connections: number; alibis: number }> {
  const entityIds = await runner.run('insert-entities', async () => {
    const inserted: Record<string, string> = {};

    for (const entity of extraction.entities) {
      try {
        const name = entity.name.trim();
        if (!name) continue;

        const { data: existing } = await supabaseServer
          .from('case_entities')
          .select('id, name')
          .eq('case_id', caseId)
          .ilike('name', name)
          .maybeSingle();

        if (existing) {
          inserted[name] = existing.id;
          continue;
        }

        const { data, error } = await supabaseServer
          .from('case_entities')
          .insert({
            case_id: caseId,
            entity_type: entity.type,
            name,
            role: entity.role,
            description: entity.description?.slice(0, 500) || null,
          })
          .select('id, name')
          .single();

        if (error) {
          console.error(`[Board Population] Error inserting entity ${name}:`, error);
        } else if (data) {
          inserted[name] = data.id;
        }
      } catch (error) {
        console.error(`[Board Population] Error processing entity ${entity.name}:`, error);
      }
    }

    return inserted;
  });

  const eventCount = await runner.run('insert-timeline-events', async () => {
    const { data: existingEvents } = await supabaseServer
      .from('timeline_events')
      .select('title, description, event_time')
      .eq('case_id', caseId);

    const existingKeys = new Set<string>();
    existingEvents?.forEach((event) => {
      const key = createEventKey(event.title, event.event_time, event.description);
      existingKeys.add(key);
    });

    let count = 0;

    for (const event of extraction.events) {
      try {
        const isoTime = event.event_time ? toISODateTime(event.event_time) : null;
        const key = createEventKey(event.title, isoTime, event.description);
        if (existingKeys.has(key)) {
          continue;
        }

        const primaryEntityId =
          event.entity_names && event.entity_names.length > 0
            ? entityIds[event.entity_names[0]]
            : undefined;

        const { error } = await supabaseServer
          .from('timeline_events')
          .insert({
            case_id: caseId,
            event_type: event.event_type,
            title: truncate(event.title, 120) || event.title || 'Timeline Event',
            description: event.description,
            event_time: isoTime,
            time_precision: event.time_precision || 'unknown',
            location: event.location,
            primary_entity_id: primaryEntityId || null,
            verification_status: event.verification_status || 'unverified',
            confidence_score: event.confidence_score || 50,
          });

        if (error) {
          console.error('[Board Population] Error inserting timeline event:', error);
        } else {
          existingKeys.add(key);
          count += 1;
        }
      } catch (error) {
        console.error('[Board Population] Error processing timeline event:', error);
      }
    }

    return count;
  });

  const connectionCount = await runner.run('insert-connections', async () => {
    const nameById = new Map<string, string>();
    Object.entries(entityIds).forEach(([name, id]) => {
      nameById.set(id, name);
    });

    const { data: existingConnections } = await supabaseServer
      .from('case_connections')
      .select('from_entity_id, to_entity_id, connection_type, label')
      .eq('case_id', caseId);

    const existingKeys = new Set<string>();
    existingConnections?.forEach((conn) => {
      const fromName = nameById.get(conn.from_entity_id);
      const toName = nameById.get(conn.to_entity_id);
      if (!fromName || !toName) return;
      existingKeys.add(createConnectionKey(fromName, toName, conn.connection_type, conn.label));
    });

    let count = 0;

    for (const conn of extraction.connections) {
      const fromId = entityIds[conn.from_entity];
      const toId = entityIds[conn.to_entity];

      if (!fromId || !toId) {
        continue;
      }

      const key = createConnectionKey(conn.from_entity, conn.to_entity, conn.connection_type, conn.label);
      if (existingKeys.has(key)) {
        continue;
      }

      const { error } = await supabaseServer
        .from('case_connections')
        .insert({
          case_id: caseId,
          from_entity_id: fromId,
          to_entity_id: toId,
          connection_type: conn.connection_type,
          label: truncate(conn.label, 140) || conn.label || null,
          description: truncate(conn.description, 600) || conn.description || null,
          confidence: conn.confidence || 'unverified',
        });

      if (error) {
        console.error('[Board Population] Error inserting connection:', error);
      } else {
        existingKeys.add(key);
        count += 1;
      }
    }

    return count;
  });

  const alibiCount = await runner.run('insert-alibis', async () => {
    const nameToId = new Map<string, string>();
    Object.entries(entityIds).forEach(([name, id]) => nameToId.set(name, id));

    const { data: existingAlibis } = await supabaseServer
      .from('alibi_entries')
      .select('subject_entity_id, alibi_start_time, alibi_end_time, location_claimed')
      .eq('case_id', caseId);

    const existingKeys = new Set<string>();
    existingAlibis?.forEach((alibi) => {
      const subjectName = Array.from(nameToId.entries()).find(([, id]) => id === alibi.subject_entity_id)?.[0];
      if (!subjectName) return;
      if (!alibi.alibi_start_time || !alibi.alibi_end_time) return;
      existingKeys.add(
        createAlibiKey({
          subject_name: subjectName,
          alibi_start_time: alibi.alibi_start_time,
          alibi_end_time: alibi.alibi_end_time,
          location_claimed: alibi.location_claimed || 'Unknown',
          activity_claimed: '',
        }),
      );
    });

    let count = 0;

    const grouped = new Map<string, ExtractedAlibi[]>();
    extraction.alibis.forEach((alibi) => {
      const subject = alibi.subject_name.trim();
      if (!subject) return;
      if (!grouped.has(subject)) {
        grouped.set(subject, []);
      }
      grouped.get(subject)!.push(alibi);
    });

    for (const [subjectName, alibis] of grouped.entries()) {
      const subjectId = nameToId.get(subjectName);
      if (!subjectId) continue;

      const { data: existingVersions } = await supabaseServer
        .from('alibi_entries')
        .select('version_number')
        .eq('subject_entity_id', subjectId)
        .order('version_number', { ascending: false })
        .limit(1);

      let nextVersion = existingVersions && existingVersions.length > 0 ? (existingVersions[0].version_number || 0) + 1 : 1;

      for (const alibi of alibis) {
        const key = createAlibiKey(alibi);
        if (existingKeys.has(key)) {
          continue;
        }

        try {
          const { error } = await supabaseServer
            .from('alibi_entries')
            .insert({
              case_id: caseId,
              subject_entity_id: subjectId,
              version_number: nextVersion++,
              statement_date: alibi.statement_date
                ? toISODateTime(alibi.statement_date)
                : new Date().toISOString(),
              alibi_start_time: toISODateTime(alibi.alibi_start_time) || new Date().toISOString(),
              alibi_end_time: toISODateTime(alibi.alibi_end_time) || new Date().toISOString(),
              location_claimed: alibi.location_claimed || 'Unknown location',
              activity_claimed: truncate(alibi.activity_claimed, 400) || alibi.activity_claimed || '',
              full_statement: truncate(alibi.full_statement, 1000) || alibi.full_statement || null,
              verification_status: alibi.verification_status || 'unverified',
            });

          if (error) {
            console.error('[Board Population] Error inserting alibi:', error);
          } else {
            existingKeys.add(key);
            count += 1;
          }
        } catch (error) {
          console.error('[Board Population] Error processing alibi:', error);
        }
      }
    }

    return count;
  });

  return {
    entities: Object.keys(entityIds).length,
    events: eventCount,
    connections: connectionCount,
    alibis: alibiCount,
  };
}

async function collectDocumentsForFallback({
  caseId,
  caseFileId,
  chunks,
}: {
  caseId: string;
  caseFileId?: string;
  chunks: Array<{
    id: string;
    content: string | null;
    case_file_id: string | null;
    chunk_index: number;
    metadata: Record<string, any> | null;
  }>;
}): Promise<DocumentForAnalysis[]> {
  if (chunks.length) {
    const grouped = new Map<string, { contents: string[]; metadata: Record<string, any> | null }>();

    chunks.forEach((chunk) => {
      const key = chunk.case_file_id || chunk.metadata?.case_file_id || `chunk-${chunk.id}`;
      if (!grouped.has(key)) {
        grouped.set(key, { contents: [], metadata: chunk.metadata });
      }
      const entry = grouped.get(key)!;
      if (chunk.content) {
        entry.contents.push(chunk.content);
      }
    });

    const documents: DocumentForAnalysis[] = [];
    let docIndex = 1;
    grouped.forEach(({ contents, metadata }) => {
      const combined = contents.join('\n\n');
      if (!combined.trim()) return;
      documents.push({
        content: combined,
        filename: metadata?.file_name || metadata?.original_filename || `Document ${docIndex++}`,
        type: metadata?.document_type || metadata?.type || 'document',
      });
    });

    if (documents.length) {
      return documents;
    }
  }

  const documents: DocumentForAnalysis[] = [];

  const fetchAndAdd = async (rows: Array<{ id: string; file_name: string; storage_path: string | null; file_type?: string | null }>) => {
    for (const row of rows) {
      if (caseFileId && row.id !== caseFileId) continue;
      if (!row.storage_path) continue;

      const text = await downloadTextFromStorage(row.storage_path);
      if (!text) continue;

      documents.push({
        content: text,
        filename: row.file_name,
        type: row.file_type || 'document',
      });
    }
  };

  const { data: caseFiles } = await supabaseServer
    .from('case_files')
    .select('id, file_name, storage_path, file_type')
    .eq('case_id', caseId);

  if (caseFiles && caseFiles.length) {
    await fetchAndAdd(caseFiles);
  }

  if (!documents.length) {
    const { data: caseDocuments } = await supabaseServer
      .from('case_documents')
      .select('id, file_name, storage_path, document_type')
      .eq('case_id', caseId);

    if (caseDocuments && caseDocuments.length) {
      await fetchAndAdd(
        caseDocuments.map((doc) => ({
          id: doc.id,
          file_name: doc.file_name,
          storage_path: doc.storage_path,
          file_type: doc.document_type || 'document',
        })),
      );
    }
  }

  return documents;
}

async function downloadTextFromStorage(storagePath: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseServer.storage.from('case-files').download(storagePath);
    if (error || !data) {
      return null;
    }

    const buffer = await data.arrayBuffer();
    return textDecoder.decode(buffer);
  } catch (error) {
    console.error('[Board Population] Failed to download storage object:', error);
    return null;
  }
}

function inferRoleFromContext(name: string, contexts: string[]): ExtractedEntity['role'] | undefined {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('detective') || lowerName.includes('officer')) {
    return 'investigator';
  }

  const combined = contexts.join(' ').toLowerCase();
  if (combined.includes('victim')) return 'victim';
  if (combined.includes('suspect') || combined.includes('unknown male') || combined.includes('person of interest')) {
    return 'suspect';
  }
  if (combined.includes('witness') || combined.includes('testified')) return 'witness';
  if (combined.includes('mother') || combined.includes('father') || combined.includes('brother') || combined.includes('sister')) {
    return 'family';
  }

  return undefined;
}

function determineEventType(description: string, entityNames: string[]): ExtractedTimelineEvent['event_type'] {
  const lower = description.toLowerCase();
  if (lower.includes('call') || lower.includes('phone')) return 'phone_call';
  if (lower.includes('sighting') || lower.includes('saw') || lower.includes('spotted')) return 'sighting';
  if (lower.includes('evidence') || lower.includes('found') || lower.includes('recovered')) return 'evidence_found';
  if (lower.includes('transaction') || lower.includes('purchase')) return 'transaction';
  if (lower.includes('interview') || lower.includes('statement')) return 'witness_account';
  if (entityNames.some((name) => name.toLowerCase().includes('victim'))) return 'victim_action';
  if (lower.includes('alibi') || lower.includes('claimed')) return 'suspect_movement';
  return 'other';
}

function toISODateTime(dateInput?: string | null, timeInput?: string | null): string | null {
  if (!dateInput) return null;
  const date = new Date(dateInput);
  if (Number.isNaN(date.getTime())) return null;

  if (timeInput) {
    const match = timeInput.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = match[3]?.toLowerCase();
      if (meridiem === 'pm' && hours < 12) hours += 12;
      if (meridiem === 'am' && hours === 12) hours = 0;
      date.setHours(hours, minutes, 0, 0);
    }
  }

  return date.toISOString();
}

function createEventKey(title?: string | null, isoTime?: string | null, description?: string | null) {
  const normalizedTitle = (title || '').trim().toLowerCase();
  const normalizedTime = isoTime ? new Date(isoTime).toISOString() : '';
  const normalizedDescription = (description || '').slice(0, 160).toLowerCase();
  return `${normalizedTitle}|${normalizedTime}|${normalizedDescription}`;
}

function createConnectionKey(
  from: string,
  to: string,
  type: string,
  label?: string | null,
) {
  return `${from.toLowerCase()}|${to.toLowerCase()}|${type.toLowerCase()}|${(label || '').toLowerCase()}`;
}

function createAlibiKey(alibi: Pick<ExtractedAlibi, 'subject_name' | 'alibi_start_time' | 'alibi_end_time' | 'location_claimed'>) {
  return `${alibi.subject_name.toLowerCase()}|${alibi.alibi_start_time}|${alibi.alibi_end_time}|${alibi.location_claimed.toLowerCase()}`;
}

function truncate(value: string | undefined | null, maxLength: number): string | undefined {
  if (!value) return undefined;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

/**
 * Main job: Populate Investigation Board
 */
export const populateInvestigationBoardJob = inngest.createFunction(
  {
    id: 'populate-investigation-board',
    name: 'Populate Investigation Board from Documents',
    retries: 2,
  },
  { event: 'board/populate' },
  async ({ event, step }) => {
    const { caseId, caseFileId } = event.data;
    return populateInvestigationBoardFromDocuments({ caseId, caseFileId, step });
  },
);
