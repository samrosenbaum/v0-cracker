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
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

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
  event_type: 'victim_action' | 'suspect_movement' | 'witness_account' | 'evidence_found' | 'phone_call' | 'transaction' | 'sighting' | 'other';
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

    console.log(`[Board Population] Starting for case: ${caseId}`);

    // Step 1: Fetch all completed chunks for the case
    const chunks = await step.run('fetch-chunks', async () => {
      let query = supabaseServer
        .from('document_chunks')
        .select('id, content, case_file_id, chunk_index, metadata')
        .eq('processing_status', 'completed')
        .not('content', 'is', null);

      // Filter by specific file if provided, otherwise all files in case
      if (caseFileId) {
        query = query.eq('case_file_id', caseFileId);
      } else {
        // Get all files for this case
        const { data: caseFiles } = await supabaseServer
          .from('case_files')
          .select('id')
          .eq('case_id', caseId);

        if (caseFiles && caseFiles.length > 0) {
          const fileIds = caseFiles.map(f => f.id);
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

    if (chunks.length === 0) {
      console.log('[Board Population] No chunks found, exiting');
      return { entities: 0, events: 0, connections: 0, alibis: 0 };
    }

    // Step 2: Extract entities from chunks
    const extractedEntities = await step.run('extract-entities', async () => {
      const entities: ExtractedEntity[] = [];

      // Process chunks in batches to avoid token limits
      const batchSize = 5;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const combinedText = batch.map((c, idx) => `[Page ${c.chunk_index + 1}]\n${c.content}`).join('\n\n---\n\n');

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

Return ONLY a valid JSON array of entities. No markdown, no explanations.`
              },
              {
                role: 'user',
                content: combinedText.substring(0, 12000) // Limit to avoid token limits
              }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' }
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

      console.log(`[Board Population] Extracted ${entities.length} entities`);
      return entities;
    });

    // Step 3: Extract timeline events
    const extractedEvents = await step.run('extract-timeline-events', async () => {
      const events: ExtractedTimelineEvent[] = [];

      const batchSize = 5;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const combinedText = batch.map((c, idx) => `[Page ${c.chunk_index + 1}]\n${c.content}`).join('\n\n---\n\n');

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

Return ONLY a valid JSON array of events. No markdown, no explanations.`
              },
              {
                role: 'user',
                content: combinedText.substring(0, 12000)
              }
            ],
            temperature: 0.3,
            response_format: { type: 'json_object' }
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

      console.log(`[Board Population] Extracted ${events.length} timeline events`);
      return events;
    });

    // Step 4: Extract connections between entities
    const extractedConnections = await step.run('extract-connections', async () => {
      const connections: ExtractedConnection[] = [];

      // Use full document context for connections
      const combinedText = chunks.slice(0, 10).map((c, idx) => `[Page ${c.chunk_index + 1}]\n${c.content}`).join('\n\n---\n\n');

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

Return ONLY a valid JSON array of connections. No markdown, no explanations.`
            },
            {
              role: 'user',
              content: combinedText.substring(0, 12000)
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
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
        console.error(`[Board Population] Error extracting connections:`, error);
      }

      console.log(`[Board Population] Extracted ${connections.length} connections`);
      return connections;
    });

    // Step 5: Extract alibi statements
    const extractedAlibis = await step.run('extract-alibis', async () => {
      const alibis: ExtractedAlibi[] = [];

      const combinedText = chunks.slice(0, 10).map((c, idx) => `[Page ${c.chunk_index + 1}]\n${c.content}`).join('\n\n---\n\n');

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

Return ONLY a valid JSON array of alibis. No markdown, no explanations.`
            },
            {
              role: 'user',
              content: combinedText.substring(0, 12000)
            }
          ],
          temperature: 0.3,
          response_format: { type: 'json_object' }
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
        console.error(`[Board Population] Error extracting alibis:`, error);
      }

      console.log(`[Board Population] Extracted ${alibis.length} alibis`);
      return alibis;
    });

    // Step 6: Insert entities into database (with deduplication)
    const entityIds = await step.run('insert-entities', async () => {
      const inserted: Record<string, string> = {}; // name -> id mapping

      for (const entity of extractedEntities) {
        try {
          // Check if entity already exists (by name and case_id)
          const { data: existing } = await supabaseServer
            .from('case_entities')
            .select('id, name')
            .eq('case_id', caseId)
            .ilike('name', entity.name)
            .single();

          if (existing) {
            inserted[entity.name] = existing.id;
            console.log(`[Board Population] Entity already exists: ${entity.name}`);
            continue;
          }

          // Insert new entity
          const { data, error } = await supabaseServer
            .from('case_entities')
            .insert({
              case_id: caseId,
              entity_type: entity.type,
              name: entity.name,
              role: entity.role,
              description: entity.description,
            })
            .select('id, name')
            .single();

          if (error) {
            console.error(`[Board Population] Error inserting entity ${entity.name}:`, error);
          } else if (data) {
            inserted[entity.name] = data.id;
            console.log(`[Board Population] Inserted entity: ${entity.name}`);
          }
        } catch (error) {
          console.error(`[Board Population] Error processing entity ${entity.name}:`, error);
        }
      }

      return inserted;
    });

    // Step 7: Insert timeline events
    const eventCount = await step.run('insert-timeline-events', async () => {
      let count = 0;

      for (const event of extractedEvents) {
        try {
          // Find primary entity ID
          const primaryEntityId = event.entity_names && event.entity_names.length > 0
            ? entityIds[event.entity_names[0]]
            : undefined;

          const { error } = await supabaseServer
            .from('timeline_events')
            .insert({
              case_id: caseId,
              event_type: event.event_type,
              title: event.title,
              description: event.description,
              event_time: event.event_time ? new Date(event.event_time).toISOString() : null,
              time_precision: event.time_precision || 'unknown',
              location: event.location,
              primary_entity_id: primaryEntityId,
              verification_status: event.verification_status || 'unverified',
              confidence_score: event.confidence_score || 50,
            });

          if (error) {
            console.error(`[Board Population] Error inserting event:`, error);
          } else {
            count++;
          }
        } catch (error) {
          console.error(`[Board Population] Error processing event:`, error);
        }
      }

      console.log(`[Board Population] Inserted ${count} timeline events`);
      return count;
    });

    // Step 8: Insert connections
    const connectionCount = await step.run('insert-connections', async () => {
      let count = 0;

      for (const conn of extractedConnections) {
        try {
          const fromId = entityIds[conn.from_entity];
          const toId = entityIds[conn.to_entity];

          if (!fromId || !toId) {
            console.log(`[Board Population] Skipping connection, entities not found: ${conn.from_entity} -> ${conn.to_entity}`);
            continue;
          }

          const { error } = await supabaseServer
            .from('case_connections')
            .insert({
              case_id: caseId,
              from_entity_id: fromId,
              to_entity_id: toId,
              connection_type: conn.connection_type,
              label: conn.label,
              description: conn.description,
              confidence: conn.confidence || 'unverified',
            });

          if (error) {
            console.error(`[Board Population] Error inserting connection:`, error);
          } else {
            count++;
          }
        } catch (error) {
          console.error(`[Board Population] Error processing connection:`, error);
        }
      }

      console.log(`[Board Population] Inserted ${count} connections`);
      return count;
    });

    // Step 9: Insert alibis
    const alibiCount = await step.run('insert-alibis', async () => {
      let count = 0;

      // Group alibis by subject to assign version numbers
      const alibisBySubject: Record<string, ExtractedAlibi[]> = {};
      for (const alibi of extractedAlibis) {
        if (!alibisBySubject[alibi.subject_name]) {
          alibisBySubject[alibi.subject_name] = [];
        }
        alibisBySubject[alibi.subject_name].push(alibi);
      }

      for (const [subjectName, alibis] of Object.entries(alibisBySubject)) {
        const subjectId = entityIds[subjectName];
        if (!subjectId) {
          console.log(`[Board Population] Skipping alibis, subject not found: ${subjectName}`);
          continue;
        }

        // Get existing version count for this subject
        const { data: existingAlibis } = await supabaseServer
          .from('alibi_entries')
          .select('version_number')
          .eq('subject_entity_id', subjectId)
          .order('version_number', { ascending: false })
          .limit(1);

        let nextVersion = 1;
        if (existingAlibis && existingAlibis.length > 0) {
          nextVersion = (existingAlibis[0].version_number || 0) + 1;
        }

        // Insert each alibi
        for (const alibi of alibis) {
          try {
            const { error } = await supabaseServer
              .from('alibi_entries')
              .insert({
                case_id: caseId,
                subject_entity_id: subjectId,
                version_number: nextVersion++,
                statement_date: alibi.statement_date ? new Date(alibi.statement_date).toISOString() : new Date().toISOString(),
                alibi_start_time: new Date(alibi.alibi_start_time).toISOString(),
                alibi_end_time: new Date(alibi.alibi_end_time).toISOString(),
                location_claimed: alibi.location_claimed,
                activity_claimed: alibi.activity_claimed,
                full_statement: alibi.full_statement,
                verification_status: alibi.verification_status || 'unverified',
              });

            if (error) {
              console.error(`[Board Population] Error inserting alibi:`, error);
            } else {
              count++;
            }
          } catch (error) {
            console.error(`[Board Population] Error processing alibi:`, error);
          }
        }
      }

      console.log(`[Board Population] Inserted ${alibiCount} alibis`);
      return count;
    });

    return {
      caseId,
      entities: Object.keys(entityIds).length,
      events: eventCount,
      connections: connectionCount,
      alibis: alibiCount,
    };
  }
);
