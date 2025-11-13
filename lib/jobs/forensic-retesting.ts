/**
 * Inngest Job: Forensic Retesting Recommendations
 *
 * Recommends evidence for modern forensic techniques and retesting.
 * This job runs in the background to avoid API timeouts.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { recommendForensicRetesting } from '@/lib/cold-case-analyzer';
import {
  mapEvidenceRowsToAnalyzerInput,
  sanitizeForensicRecommendations,
  summarizeForensicRecommendations,
} from '@/lib/forensic-retesting-utils';

interface ForensicRetestingEventData {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'ForensicRetestingJob');
}

export const processForensicRetestingJob = inngest.createFunction(
  {
    id: 'forensic-retesting',
    name: 'Forensic Retesting Recommendations - Modern Forensic Techniques',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/forensic-retesting' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data as ForensicRetestingEventData;

    const totalUnits = 4; // Fetch Case, Fetch Evidence, Analyze, Save
    const initialMetadata = {
      analysisType: 'forensic_retesting',
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
      const { caseData } = await step.run('fetch-case-data', async () => {
        console.log('[Forensic Retesting] Fetching case data for:', caseId);

        const { data: caseData, error: caseError } = await supabaseServer
          .from('cases')
          .select('*')
          .eq('id', caseId)
          .single();

        if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

        await updateProcessingJob(jobId, {
          completed_units: 1,
        });

        return { caseData };
      });

      // Step 3: Fetch evidence inventory
      const { evidenceItems } = await step.run('fetch-evidence', async () => {
        console.log('[Forensic Retesting] Fetching evidence inventory...');

        const { data: evidence, error: evidenceError } = await supabaseServer
          .from('case_files')
          .select('*')
          .eq('case_id', caseId);

        if (evidenceError) throw new Error(`Failed to fetch evidence: ${evidenceError.message}`);

        const evidenceItems = mapEvidenceRowsToAnalyzerInput(evidence || []);

        console.log(`[Forensic Retesting] Found ${evidenceItems.length} evidence items`);

        await updateProcessingJob(jobId, {
          completed_units: 2,
        });

        return { evidenceItems };
      });

      // Step 4: Generate retesting recommendations
      const recommendationsResult = await step.run('generate-recommendations', async () => {
        console.log('[Forensic Retesting] Generating retesting recommendations...');

        const caseAgeYears = caseData?.created_at
          ? new Date().getFullYear() - new Date(caseData.created_at).getFullYear()
          : undefined;

        if (typeof caseAgeYears === 'number' && Number.isFinite(caseAgeYears)) {
          console.log(`[Forensic Retesting] Case age approximately ${caseAgeYears} years`);
        }

        const recommendations = await recommendForensicRetesting(evidenceItems);
        const sanitizedRecommendations = sanitizeForensicRecommendations(recommendations);
        const summary = summarizeForensicRecommendations(sanitizedRecommendations);

        await updateProcessingJob(jobId, {
          completed_units: 3,
        });

        return { recommendations: sanitizedRecommendations, summary };
      });

      // Step 5: Save analysis results
      await step.run('save-results', async () => {
        const { recommendations, summary } = recommendationsResult;

        const { error: saveError } = await supabaseServer
          .from('case_analysis')
          .insert({
            case_id: caseId,
            analysis_type: 'forensic-retesting',
            analysis_data: { recommendations, summary } as any,
            confidence_score: 0.89,
            used_prompt: 'Forensic retesting recommendations for modern forensic techniques',
          });

        if (saveError) {
          console.error('[Forensic Retesting] Error saving analysis:', saveError);
        } else {
          console.log('[Forensic Retesting] Saved forensic retesting analysis results');
        }

        // Mark job as completed
        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            summary,
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
          error: error?.message || 'Forensic retesting analysis failed',
        },
      });

      console.error('[ForensicRetestingJob] Failed to process forensic retesting:', error);
      throw error;
    }
  }
);
