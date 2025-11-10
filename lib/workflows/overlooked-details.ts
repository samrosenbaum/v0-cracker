/**
 * Workflow: Overlooked Details Detection
 *
 * Identifies small details in case files that may have been previously missed.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 *
 * ⚠️  IMPORTANT: Step functions MUST be defined at module level (top-level scope),
 * not nested inside the workflow function. This is required by Workflow DevKit.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { findOverlookedDetails } from '@/lib/cold-case-analyzer';
import { handleWorkflowFailure } from './helpers';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface OverlookedDetailsParams {
  jobId: string;
  caseId: string;
}

interface DocumentContent {
  filename: string;
  content: string;
  confidence: number;
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
    'OverlookedDetailsWorkflow',
  );
}

// ============================================================================
// STEP 2: Fetch Documents
// ============================================================================
async function fetchDocuments(
  jobId: string,
  caseId: string,
): Promise<{ documents: any[] }> {
  'use step';
  console.log('[Overlooked Details] Fetching documents for:', caseId);

  const { data: documents, error: docsError } = await supabaseServer
    .from('case_documents')
    .select('*')
    .eq('case_id', caseId);

  if (docsError)
    throw new Error(`Failed to fetch documents: ${docsError.message}`);

  if (!documents || documents.length === 0) {
    throw new Error('No documents found for this case');
  }

  console.log(`[Overlooked Details] Found ${documents.length} documents`);

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 1,
    },
    'OverlookedDetailsWorkflow',
  );

  return { documents };
}

// ============================================================================
// STEP 3: Extract Content
// ============================================================================
async function extractContent(
  jobId: string,
  documents: any[],
): Promise<{ documentContents: DocumentContent[] }> {
  'use step';
  console.log(
    `[Overlooked Details] Extracting content from ${documents.length} documents...`,
  );

  const storagePaths = documents
    .map((d) => d.storage_path)
    .filter(Boolean) as string[];
  const extractionResults = await extractMultipleDocuments(storagePaths, 5);

  const documentContents: DocumentContent[] = documents
    .map((doc) => {
      const extraction = extractionResults.get(doc.storage_path);
      return {
        filename: doc.file_name,
        content: extraction?.text || '[Could not extract content]',
        confidence: extraction?.confidence || 0,
      };
    })
    .filter((doc) => doc.content.length > 50);

  const successfulExtractions = documentContents.filter(
    (doc) => doc.confidence > 0.5,
  ).length;
  console.log(
    `[Overlooked Details] Extracted ${successfulExtractions}/${documents.length} documents successfully`,
  );

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 2,
    },
    'OverlookedDetailsWorkflow',
  );

  return { documentContents };
}

// ============================================================================
// STEP 4: Analyze Overlooked Details
// ============================================================================
async function analyzeOverlookedDetails(
  jobId: string,
  documentContents: DocumentContent[],
): Promise<any[]> {
  'use step';
  if (documentContents.length === 0) {
    throw new Error('No documents found to analyze for overlooked details');
  }

  console.log(
    '[Overlooked Details] Analyzing documents for overlooked details...',
  );

  const details = await findOverlookedDetails(documentContents);

  console.log(
    `[Overlooked Details] Found ${details.length} potentially overlooked details`,
  );

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 3,
    },
    'OverlookedDetailsWorkflow',
  );

  return details;
}

// ============================================================================
// STEP 5: Save Results
// ============================================================================
async function saveResults(
  jobId: string,
  caseId: string,
  details: any[],
  documentContents: DocumentContent[],
  totalUnits: number,
  initialMetadata: Record<string, any>,
): Promise<void> {
  'use step';
  const { error: saveError } = await supabaseServer
    .from('case_analysis')
    .insert({
      case_id: caseId,
      analysis_type: 'overlooked-details',
      analysis_data: { details } as any,
      confidence_score: 0.83,
      used_prompt:
        'Overlooked details detection to identify small but potentially significant details',
    });

  if (saveError) {
    console.error('[Overlooked Details] Error saving analysis:', saveError);
  } else {
    console.log(
      '[Overlooked Details] Saved overlooked details analysis results',
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
          totalDetails: details.length,
          highPriority: details.filter(
            (d) => d.priority === 'high' || d.priority === 'critical',
          ).length,
          documentsAnalyzed: documentContents.length,
        },
      },
    },
    'OverlookedDetailsWorkflow',
  );
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================
/**
 * Overlooked Details Detection Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive (at module level)
 *   event.data → direct function parameters
 */
export async function processOverlookedDetails(
  params: OverlookedDetailsParams,
) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch, Extract, Analyze, Save
  const initialMetadata = {
    analysisType: 'overlooked_details',
    requestedAt: new Date().toISOString(),
  };

  try {
    await initializeJob(jobId, totalUnits, initialMetadata);

    const { documents } = await fetchDocuments(jobId, caseId);

    const { documentContents } = await extractContent(jobId, documents);

    const details = await analyzeOverlookedDetails(jobId, documentContents);

    await saveResults(
      jobId,
      caseId,
      details,
      documentContents,
      totalUnits,
      initialMetadata,
    );

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
      workflowName: 'OverlookedDetailsWorkflow',
    });
    throw error;
  }
}
