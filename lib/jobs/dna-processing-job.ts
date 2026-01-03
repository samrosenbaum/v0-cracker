/**
 * Inngest Job: DNA Evidence Processing
 *
 * Processes DNA evidence, runs comparisons, and finds matches.
 * Tracks samples through testing lifecycle.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import {
  getDNAEvidenceStatus,
  getCaseSamples,
  getCaseTests,
  getCaseMatches,
  findPotentialMatches,
  compareProfiles,
} from '@/lib/dna-tracking';

interface DNAProcessingEventData {
  jobId: string;
  caseId: string;
  sampleIds?: string[];
  options?: {
    compareProfiles?: boolean;
    findMatches?: boolean;
    generateReport?: boolean;
  };
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'DNAProcessingJob');
}

export const processDNAProcessingJob = inngest.createFunction(
  {
    id: 'dna-processing',
    name: 'DNA Evidence Processing - Profile Comparison',
    retries: 2,
    concurrency: {
      limit: 2,
    },
  },
  { event: 'analysis/process-dna' },
  async ({ event, step }) => {
    const { jobId, caseId, sampleIds, options } = event.data as DNAProcessingEventData;

    const processOptions = {
      compareProfiles: options?.compareProfiles !== false,
      findMatches: options?.findMatches !== false,
      generateReport: options?.generateReport !== false,
    };

    const totalUnits = 4; // Status, Compare, Match, Report
    const initialMetadata = {
      analysisType: 'dna_processing',
      requestedAt: new Date().toISOString(),
      options: processOptions,
    };

    try {
      // Step 1: Initialize and get current status
      const currentStatus = await step.run('get-dna-status', async () => {
        await updateProcessingJob(jobId, {
          status: 'running',
          total_units: totalUnits,
          started_at: new Date().toISOString(),
          metadata: initialMetadata,
        });

        console.log(`[DNA Processing] Getting DNA evidence status for case ${caseId}`);

        const status = await getDNAEvidenceStatus(caseId);

        console.log(`[DNA Processing] Status:`, status);

        await updateProcessingJob(jobId, {
          completed_units: 1,
          progress_percentage: 25,
        });

        return status;
      });

      // Step 2: Compare profiles
      let comparisonResults: any[] = [];
      if (processOptions.compareProfiles) {
        comparisonResults = await step.run('compare-profiles', async () => {
          console.log(`[DNA Processing] Comparing DNA profiles`);

          // Get all profiles for the case
          const { data: profiles, error } = await supabaseServer
            .from('dna_profiles')
            .select('id, profile_number, profile_type')
            .eq('case_id', caseId);

          if (error) {
            console.warn(`[DNA Processing] Could not fetch profiles:`, error.message);
            return [];
          }

          const results = [];

          // Compare unknown profiles against known reference profiles
          const unknownProfiles = profiles?.filter(p => p.profile_type === 'unknown_perpetrator') || [];
          const referenceProfiles = profiles?.filter(p =>
            ['suspect_reference', 'victim_reference', 'elimination'].includes(p.profile_type)
          ) || [];

          for (const unknown of unknownProfiles) {
            for (const reference of referenceProfiles) {
              try {
                const match = await compareProfiles(unknown.id, reference.id);
                results.push({
                  profile1: unknown.profile_number,
                  profile2: reference.profile_number,
                  match,
                });
              } catch (error: any) {
                console.warn(`[DNA Processing] Comparison failed:`, error.message);
              }
            }
          }

          console.log(`[DNA Processing] Completed ${results.length} profile comparisons`);

          await updateProcessingJob(jobId, {
            completed_units: 2,
            progress_percentage: 50,
          });

          return results;
        });
      }

      // Step 3: Find potential matches
      let matchResults: any[] = [];
      if (processOptions.findMatches) {
        matchResults = await step.run('find-matches', async () => {
          console.log(`[DNA Processing] Finding potential matches`);

          // Get profiles to check
          const { data: profiles } = await supabaseServer
            .from('dna_profiles')
            .select('id, profile_number')
            .eq('case_id', caseId)
            .eq('profile_type', 'unknown_perpetrator');

          const allMatches = [];

          for (const profile of profiles || []) {
            try {
              const matches = await findPotentialMatches(profile.id, caseId);
              if (matches.length > 0) {
                allMatches.push({
                  profileId: profile.id,
                  profileNumber: profile.profile_number,
                  matches,
                });
              }
            } catch (error: any) {
              console.warn(`[DNA Processing] Match search failed for ${profile.id}:`, error.message);
            }
          }

          console.log(`[DNA Processing] Found ${allMatches.length} profiles with potential matches`);

          await updateProcessingJob(jobId, {
            completed_units: 3,
            progress_percentage: 75,
          });

          return allMatches;
        });
      }

      // Step 4: Generate report
      await step.run('generate-report', async () => {
        console.log(`[DNA Processing] Generating final report`);

        // Get comprehensive stats
        const samples = await getCaseSamples(caseId, {});
        const tests = await getCaseTests(caseId, {});
        const matches = await getCaseMatches(caseId, {});

        // Categorize by status
        const samplesByStatus: Record<string, number> = {};
        for (const sample of samples) {
          samplesByStatus[sample.status] = (samplesByStatus[sample.status] || 0) + 1;
        }

        const testsByStatus: Record<string, number> = {};
        for (const test of tests) {
          testsByStatus[test.status] = (testsByStatus[test.status] || 0) + 1;
        }

        // Find critical findings
        const identityMatches = matches.filter(m => m.matchType === 'identity');
        const familialMatches = matches.filter(m => m.matchType.startsWith('familial'));
        const codisHits = matches.filter(m => m.profile1?.codisHit || m.profile2?.codisHit);

        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            results: {
              overview: currentStatus,
              samples: {
                total: samples.length,
                byStatus: samplesByStatus,
              },
              tests: {
                total: tests.length,
                byStatus: testsByStatus,
              },
              matches: {
                total: matches.length,
                identityMatches: identityMatches.length,
                familialMatches: familialMatches.length,
                codisHits: codisHits.length,
              },
              comparisons: {
                total: comparisonResults.length,
                significantMatches: comparisonResults.filter(c =>
                  c.match?.matchType === 'identity' || c.match?.matchType?.startsWith('familial')
                ).length,
              },
              potentialMatches: matchResults.length,
            },
          },
        });

        return {
          samplesProcessed: samples.length,
          testsTracked: tests.length,
          matchesFound: matches.length,
        };
      });

      console.log(`[DNA Processing] Job ${jobId} completed`);

      return {
        success: true,
        jobId,
        stats: {
          ...currentStatus,
          comparisons: comparisonResults.length,
          potentialMatches: matchResults.length,
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

      console.error(`[DNA Processing] Job ${jobId} failed:`, error);
      throw error;
    }
  }
);
