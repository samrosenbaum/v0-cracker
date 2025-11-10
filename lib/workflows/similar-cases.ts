/**
 * Workflow: Similar Cases Finder
 *
 * Finds patterns across similar unsolved cases in the database.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { findSimilarCases } from '@/lib/cold-case-analyzer';

interface SimilarCasesParams {
  jobId: string;
  caseId: string;
}

/**
 * Similar Cases Finder Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive
 *   event.data → direct function parameters
 */
export async function processSimilarCases(params: SimilarCasesParams) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch Current, Fetch Others, Analyze, Save
  const initialMetadata = {
    analysisType: 'similar_cases',
    requestedAt: new Date().toISOString(),
  };

  try {
    // Step 1: Initialize job
    async function initializeJob() {
      'use step';
      await updateProcessingJobRecord(jobId, {
        status: 'running',
        total_units: totalUnits,
        started_at: new Date().toISOString(),
        metadata: initialMetadata,
      }, 'SimilarCasesWorkflow');
    }
    await initializeJob();

    // Step 2: Fetch current case data
    async function fetchCurrentCase() {
      'use step';
      console.log('[Similar Cases] Fetching current case data for:', caseId);

      const { data: currentCase, error: caseError } = await supabaseServer
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();

      if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

      console.log(`[Similar Cases] Current case: ${currentCase.title || currentCase.name}`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 1,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'SimilarCasesWorkflow');

      return { currentCase };
    }
    const { currentCase } = await fetchCurrentCase();

    // Step 3: Fetch other cases
    async function fetchOtherCases() {
      'use step';
      console.log('[Similar Cases] Fetching other cases for comparison...');

      const { data: otherCases, error: casesError } = await supabaseServer
        .from('cases')
        .select('*')
        .neq('id', caseId)
        .limit(50); // Limit to avoid processing too many cases

      if (casesError) throw new Error(`Failed to fetch other cases: ${casesError.message}`);

      console.log(`[Similar Cases] Found ${otherCases?.length || 0} other cases to compare`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 2,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'SimilarCasesWorkflow');

      return { otherCases: otherCases || [] };
    }
    const { otherCases } = await fetchOtherCases();

    // Step 4: Run similar cases analysis
    async function analyzeSimilarCases() {
      'use step';
      console.log('[Similar Cases] Finding similar cases...');

      const caseProfile = {
        incidentType: currentCase.description || 'Unknown',
        location: currentCase.location || 'Unknown',
        victimAge: null, // Would extract from victim data
        weaponUsed: null, // Would extract from evidence
        timeOfDay: null, // Would extract from timeline
        suspectDescription: null, // Would extract from suspects
        unusualDetails: [], // Would extract from documents
      };

      const databaseCases = otherCases.map((c) => ({
        id: c.id,
        title: c.title || c.name || 'Unnamed Case',
        description: c.description || '',
        location: c.location || 'Unknown',
        date: c.created_at,
      }));

      const similarCases = await findSimilarCases(caseProfile, databaseCases);

      console.log(`[Similar Cases] Found ${similarCases.length} similar cases`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 3,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'SimilarCasesWorkflow');

      return similarCases;
    }
    const similarCases = await analyzeSimilarCases();

    // Step 5: Save analysis results
    async function saveResults() {
      'use step';
      const { error: saveError } = await supabaseServer
        .from('case_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'similar-cases',
          analysis_data: { similarCases } as any,
          confidence_score: 0.82,
          used_prompt: 'Similar cases finder to identify patterns across unsolved cases',
        });

      if (saveError) {
        console.error('[Similar Cases] Error saving analysis:', saveError);
      } else {
        console.log('[Similar Cases] Saved similar cases analysis results');
      }

      // Mark job as completed
      await updateProcessingJobRecord(jobId, {
        status: 'completed',
        completed_units: totalUnits,
        // progress_percentage auto-calculates from completed_units/total_units
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          summary: {
            totalSimilarCases: similarCases.length,
            highSimilarity: similarCases.filter((c) => c.similarityScore > 0.7).length,
            commonPatterns: similarCases.reduce((sum, c) => sum + (c.commonPatterns?.length || 0), 0),
          },
        },
      }, 'SimilarCasesWorkflow');
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
        error: error?.message || 'Similar cases analysis failed',
      },
    }, 'SimilarCasesWorkflow');

    console.error('[SimilarCasesWorkflow] Failed to process similar cases:', error);
    throw error;
  }
}
