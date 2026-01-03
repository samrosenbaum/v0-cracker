/**
 * Inngest Job: Timeline Generation
 *
 * Generates comprehensive timelines for each person in the case.
 * Detects gaps, inconsistencies, and assesses credibility.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import {
  generatePersonTimeline,
  generateAllPersonTimelines,
} from '@/lib/person-timeline-generator';

interface TimelineGenerationEventData {
  jobId: string;
  caseId: string;
  entityId?: string;
  options?: {
    detectGaps?: boolean;
    minGapDurationMinutes?: number;
    includeInconsistencies?: boolean;
    assessCredibility?: boolean;
  };
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'TimelineGenerationJob');
}

export const processTimelineGenerationJob = inngest.createFunction(
  {
    id: 'timeline-generation',
    name: 'Timeline Generation - Person Movement Tracking',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/generate-timelines' },
  async ({ event, step }) => {
    const { jobId, caseId, entityId, options } = event.data as TimelineGenerationEventData;

    const timelineOptions = {
      detectGaps: options?.detectGaps !== false,
      minGapDurationMinutes: options?.minGapDurationMinutes || 60,
      includeInconsistencies: options?.includeInconsistencies !== false,
    };

    const totalUnits = entityId ? 2 : 3; // Single vs All persons
    const initialMetadata = {
      analysisType: 'timeline_generation',
      requestedAt: new Date().toISOString(),
      targetEntity: entityId || 'all',
      options: timelineOptions,
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

      // Generate timeline(s)
      if (entityId) {
        // Generate for single person
        const timeline = await step.run('generate-single-timeline', async () => {
          console.log(`[Timeline Generation] Generating timeline for entity ${entityId}`);

          const result = await generatePersonTimeline(caseId, entityId, timelineOptions);

          console.log(`[Timeline Generation] Generated timeline with ${result.events.length} events, ${result.gaps.length} gaps`);

          await updateProcessingJob(jobId, {
            status: 'completed',
            completed_units: totalUnits,
            progress_percentage: 100,
            completed_at: new Date().toISOString(),
            metadata: {
              ...initialMetadata,
              results: {
                personName: result.personName,
                eventCount: result.events.length,
                gapCount: result.gaps.length,
                inconsistencyCount: result.inconsistencies.length,
                credibilityScore: result.credibilityAssessment.overallScore,
                timeSpan: {
                  start: result.events[0]?.eventTime,
                  end: result.events[result.events.length - 1]?.eventTime,
                },
              },
            },
          });

          return result;
        });

        return {
          success: true,
          jobId,
          timeline: {
            personName: timeline.personName,
            events: timeline.events.length,
            gaps: timeline.gaps.length,
            credibility: timeline.credibilityAssessment.overallScore,
          },
        };

      } else {
        // Generate for all persons
        const timelines = await step.run('generate-all-timelines', async () => {
          console.log(`[Timeline Generation] Generating timelines for all persons`);

          await updateProcessingJob(jobId, {
            completed_units: 1,
            progress_percentage: 33,
          });

          const results = await generateAllPersonTimelines(caseId, timelineOptions);

          console.log(`[Timeline Generation] Generated ${results.size} timelines`);

          return results;
        });

        // Compile statistics
        await step.run('compile-statistics', async () => {
          let totalEvents = 0;
          let totalGaps = 0;
          let totalInconsistencies = 0;
          let avgCredibility = 0;

          const summaries = [];

          for (const [entityId, timeline] of timelines) {
            totalEvents += timeline.events.length;
            totalGaps += timeline.gaps.length;
            totalInconsistencies += timeline.inconsistencies.length;
            avgCredibility += timeline.credibilityAssessment.overallScore;

            summaries.push({
              entityId,
              personName: timeline.personName,
              eventCount: timeline.events.length,
              gapCount: timeline.gaps.length,
              inconsistencyCount: timeline.inconsistencies.length,
              credibilityScore: timeline.credibilityAssessment.overallScore,
            });
          }

          if (timelines.size > 0) {
            avgCredibility /= timelines.size;
          }

          // Sort by suspicion (lowest credibility first)
          summaries.sort((a, b) => a.credibilityScore - b.credibilityScore);

          await updateProcessingJob(jobId, {
            status: 'completed',
            completed_units: totalUnits,
            progress_percentage: 100,
            completed_at: new Date().toISOString(),
            metadata: {
              ...initialMetadata,
              results: {
                personsAnalyzed: timelines.size,
                totalEvents,
                totalGaps,
                totalInconsistencies,
                averageCredibilityScore: avgCredibility,
                lowestCredibility: summaries.slice(0, 5), // Top 5 suspicious
              },
            },
          });

          return { totalEvents, totalGaps, avgCredibility };
        });

        return {
          success: true,
          jobId,
          stats: {
            personsAnalyzed: timelines.size,
            totalEvents: Array.from(timelines.values()).reduce((sum, t) => sum + t.events.length, 0),
            totalGaps: Array.from(timelines.values()).reduce((sum, t) => sum + t.gaps.length, 0),
          },
        };
      }

    } catch (error: any) {
      await updateProcessingJob(jobId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          error: error.message,
        },
      });

      console.error(`[Timeline Generation] Job ${jobId} failed:`, error);
      throw error;
    }
  }
);
