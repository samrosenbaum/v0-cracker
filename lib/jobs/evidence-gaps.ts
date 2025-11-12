/**
 * Inngest Job: Evidence Gap Analysis
 *
 * Identifies missing evidence that should exist but hasn't been collected.
 * This job runs in the background to avoid API timeouts.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { identifyEvidenceGaps } from '@/lib/cold-case-analyzer';

interface EvidenceGapsEventData {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'EvidenceGapsJob');
}

export const processEvidenceGapsJob = inngest.createFunction(
  {
    id: 'evidence-gaps',
    name: 'Evidence Gap Analysis - Missing Evidence Identification',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/evidence-gaps' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data as EvidenceGapsEventData;

    const totalUnits = 4; // Fetch, Prepare, Analyze, Save
    const initialMetadata = {
      analysisType: 'evidence_gaps',
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
      const { caseData, evidence, suspects, witnesses } = await step.run('fetch-case-data', async () => {
        console.log('[Evidence Gaps] Fetching case data for:', caseId);

        const { data: caseData, error: caseError } = await supabaseServer
          .from('cases')
          .select('*')
          .eq('id', caseId)
          .single();

        if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

        const [
          { data: evidence, error: evidenceError },
          { data: suspects, error: suspectsError },
          { data: witnesses, error: witnessesError },
        ] = await Promise.all([
          supabaseServer.from('case_files').select('*').eq('case_id', caseId),
          supabaseServer.from('persons_of_interest').select('*').eq('case_id', caseId).eq('status', 'suspect'),
          supabaseServer.from('persons_of_interest').select('*').eq('case_id', caseId).eq('status', 'witness'),
        ]);

        if (evidenceError) throw new Error(`Failed to fetch evidence: ${evidenceError.message}`);

        // Handle missing persons_of_interest table gracefully
        if (suspectsError) {
          if (suspectsError.message.includes('does not exist')) {
            console.warn('[Evidence Gaps Job] persons_of_interest table not found, using empty suspects list');
          } else {
            throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
          }
        }

        if (witnessesError) {
          if (witnessesError.message.includes('does not exist')) {
            console.warn('[Evidence Gaps Job] persons_of_interest table not found, using empty witnesses list');
          } else {
            throw new Error(`Failed to fetch witnesses: ${witnessesError.message}`);
          }
        }

        console.log(`[Evidence Gaps] Found: ${evidence?.length || 0} evidence items, ${suspects?.length || 0} suspects, ${witnesses?.length || 0} witnesses`);

        await updateProcessingJob(jobId, {
          completed_units: 1,
        });

        return { caseData, evidence: evidence || [], suspects: suspects || [], witnesses: witnesses || [] };
      });

      // Step 3: Prepare data for analysis
      const caseInput = await step.run('prepare-data', async () => {
        const caseInput = {
          incidentType: caseData.description || 'Unknown',
          date: caseData.created_at,
          location: caseData.location || 'Unknown',
          availableEvidence: evidence.map((e) => e.file_name || e.evidence_type || 'Unknown'),
          suspects: suspects.map((s) => s.name),
          witnesses: witnesses.map((w) => w.name),
        };

        await updateProcessingJob(jobId, {
          completed_units: 2,
        });

        return caseInput;
      });

      // Step 4: Run evidence gap analysis
      const gaps = await step.run('analyze-gaps', async () => {
        console.log('[Evidence Gaps] Identifying missing evidence...');
        const gaps = await identifyEvidenceGaps(caseInput);

        await updateProcessingJob(jobId, {
          completed_units: 3,
        });

        return gaps;
      });

      // Step 5: Save analysis results
      await step.run('save-results', async () => {
        const { error: saveError } = await supabaseServer
          .from('case_analysis')
          .insert({
            case_id: caseId,
            analysis_type: 'evidence-gaps',
            analysis_data: { gaps } as any,
            confidence_score: 0.88,
            used_prompt: 'Evidence gap analysis to identify missing evidence that should have been collected',
          });

        if (saveError) {
          console.error('[Evidence Gaps] Error saving analysis:', saveError);
        } else {
          console.log('[Evidence Gaps] Saved evidence gap analysis results');
        }

        // Mark job as completed
        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            summary: {
              totalGaps: gaps.length,
              criticalGaps: gaps.filter((g) => g.priority === 'critical').length,
              highPriorityGaps: gaps.filter((g) => g.priority === 'high').length,
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
          error: error?.message || 'Evidence gap analysis failed',
        },
      });

      console.error('[EvidenceGapsJob] Failed to process evidence gaps:', error);
      throw error;
    }
  }
);
