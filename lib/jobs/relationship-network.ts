/**
 * Inngest Job: Relationship Network Mapping
 *
 * Maps connections between all persons of interest and identifies hidden relationships.
 * This job runs in the background to avoid API timeouts.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { mapRelationshipNetwork } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface RelationshipNetworkEventData {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[RelationshipNetworkJob] Failed to update job', jobId, error);
  }
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
          supabaseServer.from('suspects').select('*').eq('case_id', caseId),
          supabaseServer.from('witnesses').select('*').eq('case_id', caseId),
          supabaseServer.from('case_documents').select('*').eq('case_id', caseId),
        ]);

        if (suspectsError) throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
        if (witnessesError) throw new Error(`Failed to fetch witnesses: ${witnessesError.message}`);
        if (docsError) throw new Error(`Failed to fetch documents: ${docsError.message}`);

        console.log(`[Relationship Network] Found: ${suspects?.length || 0} suspects, ${witnesses?.length || 0} witnesses, ${documents?.length || 0} documents`);

        await updateProcessingJob(jobId, {
          completed_units: 1,
        });

        return { suspects: suspects || [], witnesses: witnesses || [], documents: documents || [] };
      });

      // Step 3: Extract document content
      const { documentTexts } = await step.run('extract-content', async () => {
        console.log(`[Relationship Network] Extracting content from ${documents.length} documents...`);

        const storagePaths = documents.map((d) => d.storage_path).filter(Boolean) as string[];
        const extractionResults = await extractMultipleDocuments(storagePaths, 5);

        const documentTexts = documents.map((doc) => {
          const extraction = extractionResults.get(doc.storage_path);
          return extraction?.text || '';
        }).filter((text) => text.length > 0);

        await updateProcessingJob(jobId, {
          completed_units: 2,
        });

        return { documentTexts };
      });

      // Step 4: Run relationship network analysis
      const network = await step.run('analyze-network', async () => {
        console.log('[Relationship Network] Mapping relationship network...');
        const network = await mapRelationshipNetwork(
          suspects.map((s) => s.name),
          witnesses.map((w) => w.name),
          documentTexts
        );

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
              totalRelationships: network.relationships?.length || 0,
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
