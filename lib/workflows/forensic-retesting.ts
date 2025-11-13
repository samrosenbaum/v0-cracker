/**
 * Workflow: Forensic Retesting Recommendations
 *
 * Recommends evidence for modern forensic techniques and retesting.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { recommendForensicRetesting } from '@/lib/cold-case-analyzer';
import {
  mapEvidenceRowsToAnalyzerInput,
  sanitizeForensicRecommendations,
  summarizeForensicRecommendations,
} from '@/lib/forensic-retesting-utils';
import { resolveAnalysisEngineMetadata } from '@/lib/analysis-engine-metadata';

interface ForensicRetestingParams {
  jobId: string;
  caseId: string;
  requestedAt?: string;
}

/**
 * Forensic Retesting Recommendations Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive
 *   event.data → direct function parameters
 */
export async function processForensicRetesting(params: ForensicRetestingParams) {
  'use workflow';

  const { jobId, caseId, requestedAt } = params;

  const totalUnits = 4; // Fetch Case, Fetch Evidence, Analyze, Save
  const { metadata: initialMetadata } = resolveAnalysisEngineMetadata('forensic_retesting', {
    requestedAt,
  });

  try {
    // Step 1: Initialize job
    async function initializeJob() {
      await updateProcessingJobRecord(jobId, {
        status: 'running',
        total_units: totalUnits,
        started_at: new Date().toISOString(),
        metadata: initialMetadata,
      }, 'ForensicRetestingWorkflow');
    }
    await initializeJob();

    // Step 2: Fetch case data
    async function fetchCaseData() {
      console.log('[Forensic Retesting] Fetching case data for:', caseId);

      const { data: caseData, error: caseError } = await supabaseServer
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();

      if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

      console.log(`[Forensic Retesting] Case: ${caseData.title || caseData.name || 'Unnamed'}`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 1,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'ForensicRetestingWorkflow');

      return { caseData };
    }
    const { caseData } = await fetchCaseData();

    // Step 3: Fetch evidence inventory
    async function fetchEvidence() {
      console.log('[Forensic Retesting] Fetching evidence inventory...');

      const { data: evidence, error: evidenceError } = await supabaseServer
        .from('case_files')
        .select('*')
        .eq('case_id', caseId);

      if (evidenceError) throw new Error(`Failed to fetch evidence: ${evidenceError.message}`);

      const evidenceItems = mapEvidenceRowsToAnalyzerInput(evidence || []);

      console.log(`[Forensic Retesting] Found ${evidenceItems.length} evidence items`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 2,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'ForensicRetestingWorkflow');

      return { evidenceItems };
    }
    const { evidenceItems } = await fetchEvidence();

    // Step 4: Generate retesting recommendations
    async function generateRecommendations() {
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

      const highPriority = summary.highPriority;
      console.log(
        `[Forensic Retesting] Generated ${sanitizedRecommendations.length} recommendations (${highPriority} high priority)`,
      );

      await updateProcessingJobRecord(jobId, {
        completed_units: 3,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'ForensicRetestingWorkflow');

      return { recommendations: sanitizedRecommendations, summary };
    }
    const { recommendations, summary } = await generateRecommendations();

    // Step 5: Save analysis results
    async function saveResults() {
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
      await updateProcessingJobRecord(
        jobId,
        {
          status: 'completed',
          completed_units: totalUnits,
          // progress_percentage auto-calculates from completed_units/total_units
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            summary,
          },
        },
        'ForensicRetestingWorkflow',
      );
    }
    await saveResults();

    return {
      success: true,
      jobId,
    };
  } catch (error: any) {
    await updateProcessingJobRecord(jobId, {
      status: 'failed',
      completed_units: totalUnits,
      failed_units: 1,
      // progress_percentage auto-calculates from completed_units/total_units
      completed_at: new Date().toISOString(),
      metadata: {
        ...initialMetadata,
        error: error?.message || 'Forensic retesting analysis failed',
      },
    }, 'ForensicRetestingWorkflow');

    console.error('[ForensicRetestingWorkflow] Failed to process forensic retesting:', error);
    throw error;
  }
}
