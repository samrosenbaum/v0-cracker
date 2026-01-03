/**
 * Inngest Job: Entity Resolution
 *
 * Resolves entities (people, places, organizations) across all case documents.
 * Uses fuzzy matching, phonetic algorithms, and AI disambiguation.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import {
  extractEntitiesFromText,
  resolveEntity,
  getEntityMergeSuggestions,
} from '@/lib/entity-resolution';

interface EntityResolutionEventData {
  jobId: string;
  caseId: string;
  documentId?: string;
  options?: {
    fuzzyThreshold?: number;
    usePhonemicMatching?: boolean;
    useAIDisambiguation?: boolean;
  };
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'EntityResolutionJob');
}

export const processEntityResolutionJob = inngest.createFunction(
  {
    id: 'entity-resolution',
    name: 'Entity Resolution - Cross-Document Identity Matching',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/entity-resolution' },
  async ({ event, step }) => {
    const { jobId, caseId, documentId, options } = event.data as EntityResolutionEventData;

    const totalUnits = 4; // Fetch, Extract, Resolve, Suggest Merges
    const initialMetadata = {
      analysisType: 'entity_resolution',
      requestedAt: new Date().toISOString(),
      options,
    };

    try {
      // Step 1: Initialize job
      await step.run('initialize-job', async () => {
        await updateProcessingJob(jobId, {
          status: 'running',
          total_units: totalUnits,
          started_at: new Date().toISOString(),
          metadata: initialMetadata,
        });
      });

      // Step 2: Fetch documents
      const documents = await step.run('fetch-documents', async () => {
        console.log(`[Entity Resolution] Fetching documents for case ${caseId}`);

        let query = supabaseServer
          .from('case_files')
          .select('id, file_name, extracted_text, storage_path')
          .eq('case_id', caseId)
          .not('extracted_text', 'is', null);

        if (documentId) {
          query = query.eq('id', documentId);
        }

        const { data: docs, error } = await query;

        if (error) {
          throw new Error(`Failed to fetch documents: ${error.message}`);
        }

        console.log(`[Entity Resolution] Found ${docs?.length || 0} documents with extracted text`);

        await updateProcessingJob(jobId, {
          completed_units: 1,
          progress_percentage: 25,
        });

        return docs || [];
      });

      // Step 3: Extract entities from all documents
      const extractionStats = await step.run('extract-entities', async () => {
        console.log(`[Entity Resolution] Extracting entities from ${documents.length} documents`);

        let totalEntities = 0;
        let peopleCount = 0;
        let locationsCount = 0;
        let organizationsCount = 0;

        for (const doc of documents) {
          if (!doc.extracted_text) continue;

          try {
            const entities = await extractEntitiesFromText(caseId, doc.id, doc.extracted_text);

            for (const entity of entities) {
              totalEntities++;
              if (entity.entityType === 'person') peopleCount++;
              if (entity.entityType === 'location') locationsCount++;
              if (entity.entityType === 'organization') organizationsCount++;
            }
          } catch (error: any) {
            console.warn(`[Entity Resolution] Warning extracting from ${doc.file_name}:`, error.message);
          }
        }

        console.log(`[Entity Resolution] Extracted ${totalEntities} entities`);

        await updateProcessingJob(jobId, {
          completed_units: 2,
          progress_percentage: 50,
        });

        return {
          totalEntities,
          people: peopleCount,
          locations: locationsCount,
          organizations: organizationsCount,
        };
      });

      // Step 4: Resolve entities (deduplicate)
      const resolutionStats = await step.run('resolve-entities', async () => {
        console.log(`[Entity Resolution] Resolving entity mentions`);

        // Get all unresolved mentions
        const { data: mentions, error } = await supabaseServer
          .from('entity_mentions')
          .select('id, raw_text, context, source_file_id, entity_type')
          .eq('case_id', caseId)
          .is('canonical_entity_id', null);

        if (error) {
          throw new Error(`Failed to fetch mentions: ${error.message}`);
        }

        let resolved = 0;
        let newEntities = 0;

        for (const mention of mentions || []) {
          try {
            const result = await resolveEntity(
              caseId,
              mention.raw_text,
              mention.entity_type,
              mention.context,
              {
                fuzzyThreshold: options?.fuzzyThreshold || 0.8,
              }
            );

            if (result.isNew) {
              newEntities++;
            }
            resolved++;

            // Link mention to canonical entity
            await supabaseServer
              .from('entity_mentions')
              .update({ canonical_entity_id: result.entityId })
              .eq('id', mention.id);

          } catch (error: any) {
            console.warn(`[Entity Resolution] Could not resolve "${mention.raw_text}":`, error.message);
          }
        }

        console.log(`[Entity Resolution] Resolved ${resolved} mentions, created ${newEntities} new entities`);

        await updateProcessingJob(jobId, {
          completed_units: 3,
          progress_percentage: 75,
        });

        return { resolved, newEntities };
      });

      // Step 5: Generate merge suggestions
      const mergeSuggestions = await step.run('generate-merge-suggestions', async () => {
        console.log(`[Entity Resolution] Generating merge suggestions`);

        const suggestions = await getEntityMergeSuggestions(caseId, 50);

        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            results: {
              documentsProcessed: documents.length,
              entitiesExtracted: extractionStats.totalEntities,
              peopleFound: extractionStats.people,
              locationsFound: extractionStats.locations,
              organizationsFound: extractionStats.organizations,
              mentionsResolved: resolutionStats.resolved,
              newEntitiesCreated: resolutionStats.newEntities,
              mergeSuggestionsGenerated: suggestions.length,
            },
          },
        });

        return suggestions;
      });

      console.log(`[Entity Resolution] Job ${jobId} completed`);

      return {
        success: true,
        jobId,
        stats: {
          ...extractionStats,
          ...resolutionStats,
          mergeSuggestions: mergeSuggestions.length,
        },
      };

    } catch (error: any) {
      await updateProcessingJob(jobId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          error: error.message,
        },
      });

      console.error(`[Entity Resolution] Job ${jobId} failed:`, error);
      throw error;
    }
  }
);
