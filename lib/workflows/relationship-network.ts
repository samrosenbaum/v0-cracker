/**
 * Workflow: Relationship Network Mapping
 *
 * Maps connections between all persons of interest and identifies hidden relationships.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { mapRelationshipNetwork } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface RelationshipNetworkParams {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'RelationshipNetworkWorkflow');
}

/**
 * Relationship Network Mapping Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive
 *   event.data → direct function parameters
 */
export async function processRelationshipNetwork(params: RelationshipNetworkParams) {
  'use workflow';

  const { jobId, caseId } = params;

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
    async function initializeJob() {
      await updateProcessingJob(jobId, {
        status: 'running',
        total_units: totalUnits,
        started_at: new Date().toISOString(),
        metadata: initialMetadata,
      });
    }
    await initializeJob();

    // Step 2: Fetch case data
    async function fetchCaseData() {
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
          console.warn('[Relationship Network] persons_of_interest table not found, using empty suspects list');
        } else {
          throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
        }
      }

      if (witnessesError) {
        if (witnessesError.message.includes('does not exist')) {
          console.warn('[Relationship Network] persons_of_interest table not found, using empty witnesses list');
        } else {
          throw new Error(`Failed to fetch witnesses: ${witnessesError.message}`);
        }
      }

      // Handle missing case_documents table gracefully
      if (docsError) {
        if (docsError.message.includes('does not exist')) {
          console.warn('[Relationship Network] case_documents table not found, using empty documents list');
        } else {
          throw new Error(`Failed to fetch documents: ${docsError.message}`);
        }
      }

      console.log(`[Relationship Network] Found: ${suspects?.length || 0} suspects, ${witnesses?.length || 0} witnesses, ${documents?.length || 0} documents`);

      await updateProcessingJob(jobId, {
        completed_units: 1,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return { suspects: suspects || [], witnesses: witnesses || [], documents: documents || [] };
    }
    const { suspects, witnesses, documents } = await fetchCaseData();

    // Step 3: Extract document content
    async function extractContent() {
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

      console.log(`[Relationship Network] Extracted ${documentEntries.length} documents successfully`);

      await updateProcessingJob(jobId, {
        completed_units: 2,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return { documentEntries };
    }
    const { documentEntries } = await extractContent();

    // Step 4: Run relationship network analysis
    async function analyzeNetwork() {
      console.log('[Relationship Network] Mapping relationship network...');

      const network = await mapRelationshipNetwork(
        suspects.map((s) => s.name).filter(Boolean),
        witnesses.map((w) => w.name).filter(Boolean),
        documentEntries
      );

      console.log(`[Relationship Network] Found ${countConnections(network)} relationships`);

      await updateProcessingJob(jobId, {
        completed_units: 3,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return network;
    }
    const network = await analyzeNetwork();

    // Step 5: Save analysis results
    async function saveResults() {
      const relationshipCount = countConnections(network);
      const hiddenCount = network.hiddenConnections?.length || 0;
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
        // progress_percentage auto-calculates from completed_units/total_units
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          summary: {
            totalRelationships: relationshipCount,
            hiddenConnections: hiddenCount,
            suspectGroups: network.suspectGroups?.length || 0,
          },
        },
      });
    }
    await saveResults();

    return {
      success: true,
      jobId,
    };
  } catch (error: any) {
    await updateProcessingJob(jobId, {
      status: 'failed',
      completed_units: totalUnits,
      failed_units: 1,
      // progress_percentage auto-calculates from completed_units/total_units
      completed_at: new Date().toISOString(),
      metadata: {
        ...initialMetadata,
        error: error?.message || 'Relationship network analysis failed',
      },
    });

    console.error('[RelationshipNetworkWorkflow] Failed to process relationship network:', error);
    throw error;
  }
}
