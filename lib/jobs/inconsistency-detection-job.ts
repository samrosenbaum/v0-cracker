/**
 * Inngest Job: Inconsistency Detection
 *
 * Detects contradictions and inconsistencies across witness statements.
 * Identifies self-contradictions, cross-witness conflicts, and alibi issues.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import {
  detectInconsistencies,
  getCaseInconsistencies,
  trackClaimEvolution,
} from '@/lib/inconsistency-detector';

interface InconsistencyDetectionEventData {
  jobId: string;
  caseId: string;
  entityIds?: string[];
  options?: {
    detectSelfContradictions?: boolean;
    detectCrossWitness?: boolean;
    detectAlibiIssues?: boolean;
    trackClaimEvolution?: boolean;
  };
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'InconsistencyDetectionJob');
}

export const processInconsistencyDetectionJob = inngest.createFunction(
  {
    id: 'inconsistency-detection',
    name: 'Inconsistency Detection - Cross-Statement Analysis',
    retries: 2,
    concurrency: {
      limit: 2, // Resource intensive
    },
  },
  { event: 'analysis/detect-inconsistencies' },
  async ({ event, step }) => {
    const { jobId, caseId, entityIds, options } = event.data as InconsistencyDetectionEventData;

    // Default all options to true if not specified
    const detectOpts = {
      detectSelfContradictions: options?.detectSelfContradictions !== false,
      detectCrossWitness: options?.detectCrossWitness !== false,
      detectAlibiIssues: options?.detectAlibiIssues !== false,
      trackClaimEvolution: options?.trackClaimEvolution !== false,
    };

    const totalUnits = 5; // Init, Self, Cross, Alibi, Evolution
    const initialMetadata = {
      analysisType: 'inconsistency_detection',
      requestedAt: new Date().toISOString(),
      options: detectOpts,
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

      // Step 2: Run comprehensive inconsistency detection
      const allInconsistencies = await step.run('detect-all-inconsistencies', async () => {
        console.log(`[Inconsistency Detection] Running comprehensive detection`);

        // Get statements for the case
        const { data: statements, error } = await supabaseServer
          .from('statements')
          .select('id')
          .eq('case_id', caseId);

        if (error || !statements || statements.length === 0) {
          console.log(`[Inconsistency Detection] No statements found`);
          return [];
        }

        const inconsistencies: any[] = [];

        // Detect inconsistencies for each statement pair
        for (let i = 0; i < statements.length; i++) {
          for (let j = i + 1; j < statements.length; j++) {
            try {
              const found = await detectInconsistencies(
                caseId,
                statements[i].id,
                statements[j].id
              );
              inconsistencies.push(...found);
            } catch (err: any) {
              console.warn(`[Inconsistency Detection] Warning:`, err.message);
            }
          }
        }

        console.log(`[Inconsistency Detection] Found ${inconsistencies.length} inconsistencies`);

        await updateProcessingJob(jobId, {
          completed_units: 2,
          progress_percentage: 50,
        });

        return inconsistencies;
      });

      // Step 3: Track claim evolution
      let claimEvolutions: any[] = [];
      if (detectOpts.trackClaimEvolution) {
        claimEvolutions = await step.run('track-claim-evolution', async () => {
          console.log(`[Inconsistency Detection] Tracking claim evolution`);

          // Get all claims for the case
          const { data: claims } = await supabaseServer
            .from('statement_claims')
            .select('id')
            .eq('case_id', caseId);

          const evolutions = [];
          for (const claim of claims || []) {
            try {
              const evolution = await trackClaimEvolution(claim.id, caseId);
              if (evolution.versions && evolution.versions.length > 1) {
                evolutions.push(evolution);
              }
            } catch (error: any) {
              // Skip claims that can't be tracked
            }
          }

          console.log(`[Inconsistency Detection] Found ${evolutions.length} evolving claims`);

          await updateProcessingJob(jobId, {
            completed_units: 3,
            progress_percentage: 75,
          });

          return evolutions;
        });
      }

      // Step 4: Compile results
      await step.run('compile-results', async () => {

        // Categorize by severity
        const critical = allInconsistencies.filter(i => i.severity === 'critical');
        const high = allInconsistencies.filter(i => i.severity === 'high');
        const medium = allInconsistencies.filter(i => i.severity === 'medium');
        const low = allInconsistencies.filter(i => i.severity === 'low');

        // Categorize by type
        const typeBreakdown: Record<string, number> = {};
        for (const inc of allInconsistencies) {
          typeBreakdown[inc.inconsistencyType] = (typeBreakdown[inc.inconsistencyType] || 0) + 1;
        }

        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            results: {
              totalInconsistencies: allInconsistencies.length,
              evolvingClaims: claimEvolutions.length,
              severityBreakdown: {
                critical: critical.length,
                high: high.length,
                medium: medium.length,
                low: low.length,
              },
              typeBreakdown,
            },
          },
        });

        return {
          total: allInconsistencies.length,
          severityBreakdown: { critical: critical.length, high: high.length, medium: medium.length, low: low.length },
        };
      });

      console.log(`[Inconsistency Detection] Job ${jobId} completed`);

      return {
        success: true,
        jobId,
        stats: {
          totalInconsistencies: allInconsistencies.length,
          evolvingClaims: claimEvolutions.length,
        },
      };

    } catch (error: any) {
      await updateProcessingJob(jobId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          error: error.message,
        },
      });

      console.error(`[Inconsistency Detection] Job ${jobId} failed:`, error);
      throw error;
    }
  }
);
