/**
 * Workflow: Overlooked Details Detection
 *
 * Identifies small details in case files that may have been previously missed.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import { findOverlookedDetails } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface OverlookedDetailsParams {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[OverlookedDetailsWorkflow] Failed to update job', jobId, error);
  }
}

/**
 * Overlooked Details Detection Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive
 *   event.data → direct function parameters
 */
export async function processOverlookedDetails(params: OverlookedDetailsParams) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch, Extract, Analyze, Save
  const initialMetadata = {
    analysisType: 'overlooked_details',
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

    // Step 2: Fetch case documents
    async function fetchDocuments() {
      'use step';
      console.log('[Overlooked Details] Fetching documents for:', caseId);

      const { data: documents, error: docsError } = await supabaseServer
        .from('case_documents')
        .select('*')
        .eq('case_id', caseId);

      if (docsError) throw new Error(`Failed to fetch documents: ${docsError.message}`);

      if (!documents || documents.length === 0) {
        throw new Error('No documents found for this case');
      }

      console.log(`[Overlooked Details] Found ${documents.length} documents`);

      await updateProcessingJob(jobId, {
        completed_units: 1,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return { documents };
    }
    const { documents } = await fetchDocuments();

    // Step 3: Extract document content
    async function extractContent() {
      'use step';
      console.log(`[Overlooked Details] Extracting content from ${documents.length} documents...`);

      const storagePaths = documents.map((d) => d.storage_path).filter(Boolean) as string[];
      const extractionResults = await extractMultipleDocuments(storagePaths, 5);

      const documentContents = documents.map((doc) => {
        const extraction = extractionResults.get(doc.storage_path);
        return {
          filename: doc.file_name,
          content: extraction?.text || '[Could not extract content]',
          confidence: extraction?.confidence || 0,
        };
      }).filter((doc) => doc.content.length > 50);

      const successfulExtractions = documentContents.filter((doc) => doc.confidence > 0.5).length;
      console.log(`[Overlooked Details] Extracted ${successfulExtractions}/${documents.length} documents successfully`);

      await updateProcessingJob(jobId, {
        completed_units: 2,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return { documentContents };
    }
    const { documentContents } = await extractContent();

    // Step 4: Run overlooked details analysis
    async function analyzeOverlookedDetails() {
      'use step';
      if (documentContents.length === 0) {
        throw new Error('No documents found to analyze for overlooked details');
      }

      console.log('[Overlooked Details] Analyzing documents for overlooked details...');

      const details = await findOverlookedDetails(documentContents);

      console.log(`[Overlooked Details] Found ${details.length} potentially overlooked details`);

      await updateProcessingJob(jobId, {
        completed_units: 3,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return details;
    }
    const details = await analyzeOverlookedDetails();

    // Step 5: Save analysis results
    async function saveResults() {
      'use step';
      const { error: saveError } = await supabaseServer
        .from('case_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'overlooked-details',
          analysis_data: { details } as any,
          confidence_score: 0.83,
          used_prompt: 'Overlooked details detection to identify small but potentially significant details',
        });

      if (saveError) {
        console.error('[Overlooked Details] Error saving analysis:', saveError);
      } else {
        console.log('[Overlooked Details] Saved overlooked details analysis results');
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
            totalDetails: details.length,
            highPriority: details.filter((d) => d.priority === 'high' || d.priority === 'critical').length,
            documentsAnalyzed: documentContents.length,
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
        error: error?.message || 'Overlooked details analysis failed',
      },
    });

    console.error('[OverlookedDetailsWorkflow] Failed to process overlooked details:', error);
    throw error;
  }
}
