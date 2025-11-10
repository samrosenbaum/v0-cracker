/**
 * Workflow: Relationship Network Mapping
 *
 * Maps connections between all persons of interest and identifies hidden relationships.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 *
 * ⚠️  IMPORTANT: Step functions MUST be defined at module level (top-level scope),
 * not nested inside the workflow function. This is required by Workflow DevKit.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { mapRelationshipNetwork } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';
import { handleWorkflowFailure } from './helpers';

interface RelationshipNetworkParams {
  jobId: string;
  caseId: string;
}

interface CaseData {
  suspects: string[];
  witnesses: string[];
  documents: string[];
}

// ============================================================================
// STEP 1: Initialize Job
// ============================================================================
async function initializeJob(
  jobId: string,
  totalUnits: number,
  initialMetadata: Record<string, any>,
) {
  'use step';
  await updateProcessingJobRecord(
    jobId,
    {
      status: 'running',
      total_units: totalUnits,
      started_at: new Date().toISOString(),
      metadata: initialMetadata,
    },
    'RelationshipNetworkWorkflow',
  );
}

// ============================================================================
// STEP 2: Fetch Case Data
// ============================================================================
async function fetchCaseData(jobId: string, caseId: string): Promise<CaseData> {
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

  if (suspectsError)
    throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
  if (witnessesError)
    throw new Error(`Failed to fetch witnesses: ${witnessesError.message}`);
  if (docsError)
    throw new Error(`Failed to fetch documents: ${docsError.message}`);

  console.log(
    `[Relationship Network] Found: ${suspects?.length || 0} suspects, ${witnesses?.length || 0} witnesses, ${documents?.length || 0} documents`,
  );

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 1,
    },
    'RelationshipNetworkWorkflow',
  );

  return {
    suspects: (suspects || []).map((s) => s.name),
    witnesses: (witnesses || []).map((w) => w.name),
    documents: (documents || []).map((d) => d.storage_path),
  };
}

// ============================================================================
// STEP 3: Extract Content
// ============================================================================
async function extractContent(
  jobId: string,
  documents: any[],
): Promise<{ documentTexts: string[] }> {
  'use step';
  console.log(
    `[Relationship Network] Extracting content from ${documents.length} documents...`,
  );

  const storagePaths = documents.filter(Boolean) as string[];
  const extractionResults = await extractMultipleDocuments(storagePaths, 5);

  const documentTexts = documents
    .map((doc) => {
      const extraction = extractionResults.get(doc);
      return extraction?.text || '';
    })
    .filter((text) => text.length > 0);

  console.log(
    `[Relationship Network] Extracted ${documentTexts.length} documents successfully`,
  );

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 2,
    },
    'RelationshipNetworkWorkflow',
  );

  return { documentTexts };
}

// ============================================================================
// STEP 4: Analyze Network
// ============================================================================
async function analyzeNetwork(
  jobId: string,
  suspects: string[],
  witnesses: string[],
  documentTexts: string[],
): Promise<any> {
  'use step';
  console.log('[Relationship Network] Mapping relationship network...');

  const network = await mapRelationshipNetwork(documentTexts);

  console.log(
    `[Relationship Network] Found ${network.nodes?.length || 0} relationship nodes`,
  );

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 3,
    },
    'RelationshipNetworkWorkflow',
  );

  return network;
}

// ============================================================================
// STEP 5: Save Results
// ============================================================================
async function saveResults(
  jobId: string,
  caseId: string,
  network: any,
  totalUnits: number,
  initialMetadata: Record<string, any>,
): Promise<void> {
  'use step';
  const { error: saveError } = await supabaseServer
    .from('case_analysis')
    .insert({
      case_id: caseId,
      analysis_type: 'relationship-network',
      analysis_data: { network } as any,
      confidence_score: 0.87,
      used_prompt:
        'Relationship network mapping to identify hidden connections between persons of interest',
    });

  if (saveError) {
    console.error('[Relationship Network] Error saving analysis:', saveError);
  } else {
    console.log(
      '[Relationship Network] Saved relationship network analysis results',
    );
  }

  // Mark job as completed
  await updateProcessingJobRecord(
    jobId,
    {
      status: 'completed',
      completed_units: totalUnits,
      completed_at: new Date().toISOString(),
      metadata: {
        ...initialMetadata,
        summary: {
          totalNodes: network.nodes?.length || 0,
          hiddenConnections: network.hiddenConnections?.length || 0,
          suspectGroups: (network as any).suspectGroups?.length || 0,
        },
      },
    },
    'RelationshipNetworkWorkflow',
  );
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================
/**
 * Relationship Network Mapping Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive (at module level)
 *   event.data → direct function parameters
 */
export async function processRelationshipNetwork(
  params: RelationshipNetworkParams,
) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch, Extract, Analyze, Save
  const initialMetadata = {
    analysisType: 'relationship_network',
    requestedAt: new Date().toISOString(),
  };

  try {
    await initializeJob(jobId, totalUnits, initialMetadata);

    const { suspects, witnesses, documents } = await fetchCaseData(
      jobId,
      caseId,
    );

    const { documentTexts } = await extractContent(jobId, documents as any);

    const network = await analyzeNetwork(
      jobId,
      suspects as any,
      witnesses as any,
      documentTexts,
    );

    await saveResults(jobId, caseId, network, totalUnits, initialMetadata);

    return {
      success: true,
      jobId,
    };
  } catch (error: any) {
    await handleWorkflowFailure({
      jobId,
      totalUnits,
      initialMetadata,
      error,
      workflowName: 'RelationshipNetworkWorkflow',
    });
    throw error;
  }
}
