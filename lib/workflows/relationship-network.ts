/**
 * Workflow: Relationship Network Mapping
 *
 * Maps connections between all persons of interest and identifies hidden relationships.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import { mapRelationshipNetwork } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface RelationshipNetworkParams {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[RelationshipNetworkWorkflow] Failed to update job', jobId, error);
  }
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

  try {
    // Step 1: Initialize job
    async function initializeJob() {
      'use step';
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
      'use step';
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
        progress_percentage: Math.round((1 / totalUnits) * 100),
      });

      return { suspects: suspects || [], witnesses: witnesses || [], documents: documents || [] };
    }
    const { suspects, witnesses, documents } = await fetchCaseData();

    // Step 3: Extract document content
    async function extractContent() {
      'use step';
      console.log(`[Relationship Network] Extracting content from ${documents.length} documents...`);

      const storagePaths = documents.map((d) => d.storage_path).filter(Boolean) as string[];
      const extractionResults = await extractMultipleDocuments(storagePaths, 5);

      const documentTexts = documents.map((doc) => {
        const extraction = extractionResults.get(doc.storage_path);
        return extraction?.text || '';
      }).filter((text) => text.length > 0);

      console.log(`[Relationship Network] Extracted ${documentTexts.length} documents successfully`);

      await updateProcessingJob(jobId, {
        completed_units: 2,
        progress_percentage: Math.round((2 / totalUnits) * 100),
      });

      return { documentTexts };
    }
    const { documentTexts } = await extractContent();

    // Step 4: Run relationship network analysis
    async function analyzeNetwork() {
      'use step';
      console.log('[Relationship Network] Mapping relationship network...');

      const network = await mapRelationshipNetwork(
        suspects.map((s) => s.name),
        witnesses.map((w) => w.name),
        documentTexts
      );

      console.log(`[Relationship Network] Found ${network.relationships?.length || 0} relationships`);

      await updateProcessingJob(jobId, {
        completed_units: 3,
        progress_percentage: Math.round((3 / totalUnits) * 100),
      });

      return network;
    }
    const network = await analyzeNetwork();

    // Step 5: Save analysis results
    async function saveResults() {
      'use step';
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
        progress_percentage: 100,
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
      progress_percentage: 100,
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
