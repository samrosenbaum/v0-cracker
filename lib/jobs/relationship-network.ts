/**
 * Inngest Job: Relationship Network Mapping
 *
 * Maps connections between all persons of interest and identifies hidden relationships.
 * This job runs in the background to avoid API timeouts.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { mapRelationshipNetwork } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface RelationshipNetworkEventData {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'RelationshipNetworkJob');
}

export const processRelationshipNetworkJob = inngest.createFunction(
  {
    id: 'relationship-network',
    name: 'Relationship Network Mapping - Hidden Connections Analysis',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/relationship-network' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data as RelationshipNetworkEventData;

    const totalUnits = 4; // Fetch, Extract, Analyze, Save
    const initialMetadata = {
      analysisType: 'relationship_network',
      requestedAt: new Date().toISOString(),
    };

    const countConnections = (network: { nodes?: { connections?: { to: string }[] }[] }) => {
      if (!network?.nodes?.length) {
        return 0;
      }
      const total = network.nodes.reduce((sum, node) => sum + (node.connections?.length || 0), 0);
      return Math.round(total / 2);
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

      // Step 2: Fetch case data
      const { suspects, witnesses, documents } = await step.run('fetch-case-data', async () => {
        console.log('[Relationship Network] Fetching case data for:', caseId);

        const [
          { data: suspects, error: suspectsError },
          { data: witnesses, error: witnessesError },
          { data: documents, error: docsError },
        ] = await Promise.all([
          supabaseServer.from('persons_of_interest').select('*').eq('case_id', caseId).eq('status', 'suspect'),
          supabaseServer.from('persons_of_interest').select('*').eq('case_id', caseId).eq('status', 'witness'),
          supabaseServer.from('case_documents').select('*').eq('case_id', caseId),
        ]);

        // Handle missing persons_of_interest table gracefully
        if (suspectsError) {
          if (suspectsError.message.includes('does not exist')) {
            console.warn('[Relationship Network Job] persons_of_interest table not found, using empty suspects list');
          } else {
            throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
          }
        }

        if (witnessesError) {
          if (witnessesError.message.includes('does not exist')) {
            console.warn('[Relationship Network Job] persons_of_interest table not found, using empty witnesses list');
          } else {
            throw new Error(`Failed to fetch witnesses: ${witnessesError.message}`);
          }
        }

        // Handle missing case_documents table gracefully
        if (docsError) {
          if (docsError.message.includes('does not exist')) {
            console.warn('[Relationship Network Job] case_documents table not found, using empty documents list');
          } else {
            throw new Error(`Failed to fetch documents: ${docsError.message}`);
          }
        }

        console.log(`[Relationship Network] Found: ${suspects?.length || 0} suspects, ${witnesses?.length || 0} witnesses, ${documents?.length || 0} documents`);

        await updateProcessingJob(jobId, {
          completed_units: 1,
        });

        return { suspects: suspects || [], witnesses: witnesses || [], documents: documents || [] };
      });

      // Step 3: Extract document content
      const { documentEntries } = await step.run('extract-content', async () => {
        console.log(`[Relationship Network] Extracting content from ${documents.length} documents...`);

        const storagePaths = documents.map((d) => d.storage_path).filter(Boolean) as string[];
        const extractionResults = await extractMultipleDocuments(storagePaths, 5);

        const documentEntries = documents
          .map((doc, index) => {
            const extraction = extractionResults.get(doc.storage_path);
            const text = extraction?.text?.trim();
            if (!text) {
              return null;
            }
            return {
              filename: doc.file_name || doc.title || `Document ${index + 1}`,
              content: text,
            };
          })
          .filter((entry): entry is { filename: string; content: string } => Boolean(entry));

        await updateProcessingJob(jobId, {
          completed_units: 2,
        });

        return { documentEntries };
      });

      // Step 4: Run relationship network analysis
      const network = await step.run('analyze-network', async () => {
        console.log('[Relationship Network] Mapping relationship network...');
        const network = await mapRelationshipNetwork(
          suspects.map((s) => s.name).filter(Boolean),
          witnesses.map((w) => w.name).filter(Boolean),
          documentEntries
        );

        console.log(`[Relationship Network] Found ${countConnections(network)} relationships`);

        await updateProcessingJob(jobId, {
          completed_units: 3,
        });

        return network;
      });

      // Step 5: Save analysis results
      await step.run('save-results', async () => {
        const { error: saveError } = await supabaseServer
          .from('case_analysis')
          .insert({
            case_id: caseId,
            analysis_type: 'relationship-network',
            analysis_data: { network } as any,
            confidence_score: 0.87,
            used_prompt: 'Relationship network mapping to identify hidden connections between persons of interest',
          });

        if (saveError) {
          console.error('[Relationship Network] Error saving analysis:', saveError);
        } else {
          console.log('[Relationship Network] Saved relationship network analysis results');
        }

        // Mark job as completed
        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            summary: {
              totalRelationships: countConnections(network),
              hiddenConnections: network.hiddenConnections?.length || 0,
              suspectGroups: network.suspectGroups?.length || 0,
            },
          },
        });
      });

      return {
        success: true,
        jobId,
      };
    } catch (error: any) {
      await updateProcessingJob(jobId, {
        status: 'failed',
        completed_units: totalUnits,
        failed_units: 1,
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          error: error?.message || 'Relationship network analysis failed',
        },
      });

      console.error('[RelationshipNetworkJob] Failed to process relationship network:', error);
      throw error;
    }
  }
);
