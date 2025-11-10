/**
 * Workflow: Forensic Retesting Recommendations
 *
 * Recommends evidence for modern forensic techniques and retesting.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import { recommendForensicRetesting } from '@/lib/cold-case-analyzer';

interface ForensicRetestingParams {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[ForensicRetestingWorkflow] Failed to update job', jobId, error);
  }
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

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch Case, Fetch Evidence, Analyze, Save
  const initialMetadata = {
    analysisType: 'forensic_retesting',
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
      console.log('[Forensic Retesting] Fetching case data for:', caseId);

      const { data: caseData, error: caseError } = await supabaseServer
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();

      if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

      console.log(`[Forensic Retesting] Case: ${caseData.title || caseData.name || 'Unnamed'}`);

      await updateProcessingJob(jobId, {
        completed_units: 1,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return { caseData };
    }
    const { caseData } = await fetchCaseData();

    // Step 3: Fetch evidence inventory
    async function fetchEvidence() {
      'use step';
      console.log('[Forensic Retesting] Fetching evidence inventory...');

      const { data: evidence, error: evidenceError } = await supabaseServer
        .from('case_files')
        .select('*')
        .eq('case_id', caseId);

      if (evidenceError) throw new Error(`Failed to fetch evidence: ${evidenceError.message}`);

      const evidenceItems = (evidence || []).map((e) => ({
        id: e.id,
        description: e.file_name || e.evidence_type || 'Unknown',
        dateCollected: e.created_at,
        previousTesting: e.notes || 'Unknown',
        currentStorage: 'Evidence locker', // Would come from actual storage info
        condition: 'Good', // Would come from inspection records
      }));

      console.log(`[Forensic Retesting] Found ${evidenceItems.length} evidence items`);

      await updateProcessingJob(jobId, {
        completed_units: 2,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return { evidenceItems };
    }
    const { evidenceItems } = await fetchEvidence();

    // Step 4: Generate retesting recommendations
    async function generateRecommendations() {
      'use step';
      console.log('[Forensic Retesting] Generating retesting recommendations...');

      const caseAge = new Date().getFullYear() - new Date(caseData.created_at).getFullYear();
      const recommendations = await recommendForensicRetesting(evidenceItems, caseAge);

      const highPriority = recommendations.filter((r) => r.priority === 'high' || r.priority === 'critical').length;
      console.log(`[Forensic Retesting] Generated ${recommendations.length} recommendations (${highPriority} high priority)`);

      await updateProcessingJob(jobId, {
        completed_units: 3,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return recommendations;
    }
    const recommendations = await generateRecommendations();

    // Step 5: Save analysis results
    async function saveResults() {
      'use step';
      const { error: saveError } = await supabaseServer
        .from('case_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'forensic-retesting',
          analysis_data: { recommendations } as any,
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
        // progress_percentage auto-calculates from completed_units/total_units
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          summary: {
            totalRecommendations: recommendations.length,
            highPriority: recommendations.filter((r) => r.priority === 'high' || r.priority === 'critical').length,
            modernTechniques: recommendations.map((r) => r.recommendedTest).filter((v, i, a) => a.indexOf(v) === i).length,
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
        error: error?.message || 'Forensic retesting analysis failed',
      },
    });

    console.error('[ForensicRetestingWorkflow] Failed to process forensic retesting:', error);
    throw error;
  }
}
