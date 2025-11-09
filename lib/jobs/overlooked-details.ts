/**
 * Inngest Job: Overlooked Details Detection
 *
 * Identifies small details in case files that may have been previously missed.
 * This job runs in the background to avoid API timeouts.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { findOverlookedDetails } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface OverlookedDetailsEventData {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[OverlookedDetailsJob] Failed to update job', jobId, error);
  }
}

export const processOverlookedDetailsJob = inngest.createFunction(
  {
    id: 'overlooked-details',
    name: 'Overlooked Details Detection - Micro-Detail Analysis',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/overlooked-details' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data as OverlookedDetailsEventData;

    const totalUnits = 4; // Fetch, Extract, Analyze, Save
    const initialMetadata = {
      analysisType: 'overlooked_details',
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

      // Step 2: Fetch case documents
      const { documents } = await step.run('fetch-documents', async () => {
        console.log('[Overlooked Details] Fetching documents for:', caseId);

        const { data: documents, error: docsError } = await supabaseServer
          .from('case_documents')
          .select('*')
          .eq('case_id', caseId);

        if (docsError) throw new Error(`Failed to fetch documents: ${docsError.message}`);

        console.log(`[Overlooked Details] Found ${documents?.length || 0} documents`);

        await updateProcessingJob(jobId, {
          completed_units: 1,
        });

        return { documents: documents || [] };
      });

      // Step 3: Extract document content
      const { documentContents } = await step.run('extract-content', async () => {
        console.log(`[Overlooked Details] Extracting content from ${documents.length} documents...`);

        const storagePaths = documents.map((d) => d.storage_path).filter(Boolean) as string[];
        const extractionResults = await extractMultipleDocuments(storagePaths, 5);

        const documentContents = documents.map((doc) => {
          const extraction = extractionResults.get(doc.storage_path);
          return {
            filename: doc.file_name,
            content: extraction?.text || '[Could not extract content]',
          };
        }).filter((doc) => doc.content.length > 50);

        await updateProcessingJob(jobId, {
          completed_units: 2,
        });

        return { documentContents };
      });

      // Step 4: Run overlooked details analysis
      const details = await step.run('analyze-overlooked-details', async () => {
        if (documentContents.length === 0) {
          throw new Error('No documents found to analyze for overlooked details');
        }

        console.log('[Overlooked Details] Analyzing documents for overlooked details...');
        const details = await findOverlookedDetails(documentContents);

        await updateProcessingJob(jobId, {
          completed_units: 3,
        });

        return details;
      });

      // Step 5: Save analysis results
      await step.run('save-results', async () => {
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
          error: error?.message || 'Overlooked details analysis failed',
        },
      });

      console.error('[OverlookedDetailsJob] Failed to process overlooked details:', error);
      throw error;
    }
  }
);
