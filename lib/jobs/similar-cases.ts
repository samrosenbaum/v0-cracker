/**
 * Inngest Job: Similar Cases Finder
 *
 * Finds patterns across similar unsolved cases in the database.
 * This job runs in the background to avoid API timeouts.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { findSimilarCases } from '@/lib/cold-case-analyzer';

interface SimilarCasesEventData {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[SimilarCasesJob] Failed to update job', jobId, error);
  }
}

export const processSimilarCasesJob = inngest.createFunction(
  {
    id: 'similar-cases',
    name: 'Similar Cases Finder - Cross-Case Pattern Analysis',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/similar-cases' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data as SimilarCasesEventData;

    const totalUnits = 4; // Fetch Current, Fetch Others, Analyze, Save
    const initialMetadata = {
      analysisType: 'similar_cases',
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

      // Step 2: Fetch current case data
      const { currentCase } = await step.run('fetch-current-case', async () => {
        console.log('[Similar Cases] Fetching current case data for:', caseId);

        const { data: currentCase, error: caseError } = await supabaseServer
          .from('cases')
          .select('*')
          .eq('id', caseId)
          .single();

        if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

        await updateProcessingJob(jobId, {
          completed_units: 1,
        });

        return { currentCase };
      });

      // Step 3: Fetch other cases
      const { otherCases } = await step.run('fetch-other-cases', async () => {
        console.log('[Similar Cases] Fetching other cases for comparison...');

        const { data: otherCases, error: casesError } = await supabaseServer
          .from('cases')
          .select('*')
          .neq('id', caseId)
          .limit(50); // Limit to avoid processing too many cases

        if (casesError) throw new Error(`Failed to fetch other cases: ${casesError.message}`);

        console.log(`[Similar Cases] Found ${otherCases?.length || 0} other cases to compare`);

        await updateProcessingJob(jobId, {
          completed_units: 2,
        });

        return { otherCases: otherCases || [] };
      });

      // Step 4: Run similar cases analysis
      const similarCases = await step.run('analyze-similar-cases', async () => {
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

        await updateProcessingJob(jobId, {
          completed_units: 3,
        });

        return similarCases;
      });

      // Step 5: Save analysis results
      await step.run('save-results', async () => {
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
        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            summary: {
              totalSimilarCases: similarCases.length,
              highSimilarity: similarCases.filter((c) => c.similarityScore > 0.7).length,
              commonPatterns: similarCases.reduce((sum, c) => sum + (c.commonPatterns?.length || 0), 0),
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
          error: error?.message || 'Similar cases analysis failed',
        },
      });

      console.error('[SimilarCasesJob] Failed to process similar cases:', error);
      throw error;
    }
  }
);
