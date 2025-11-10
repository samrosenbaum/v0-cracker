/**
 * Workflow: Victim Timeline Reconstruction
 *
 * Generates comprehensive victim movement timeline with gap analysis.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import { generateComprehensiveVictimTimeline } from '@/lib/victim-timeline';

interface VictimTimelineParams {
  jobId: string;
  caseId: string;
  victimInfo: {
    name: string;
    incidentTime: string;
    incidentLocation?: string | null;
    typicalRoutine?: string | null;
    knownHabits?: string | null;
    regularContacts?: string[] | null;
  };
  requestContext?: {
    digitalRecords?: any;
  };
  requestedAt: string;
}

async function updateProcessingJob(
  jobId: string,
  updates: Record<string, any>
) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[VictimTimelineWorkflow] Failed to update job', jobId, error);
  }
}

export async function processVictimTimeline(params: VictimTimelineParams) {
  'use workflow';

  const { jobId, caseId, victimInfo, requestContext, requestedAt } = params;

  const totalUnits = 4;
  const initialMetadata = {
    analysisType: 'victim_timeline',
    victimName: victimInfo.name,
    incidentTime: victimInfo.incidentTime,
    incidentLocation: victimInfo.incidentLocation,
    requestedAt,
  };

  try {
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

    async function fetchCaseData() {
      'use step';
      const { data: documents, error: docError } = await supabaseServer
        .from('case_documents')
        .select('*')
        .eq('case_id', caseId);

      if (docError) {
        throw new Error(`Failed to fetch case documents: ${docError.message}`);
      }

      const { data: files, error: fileError } = await supabaseServer
        .from('case_files')
        .select('*')
        .eq('case_id', caseId);

      if (fileError) {
        throw new Error(`Failed to fetch case files: ${fileError.message}`);
      }

      await updateProcessingJob(jobId, {
        completed_units: 1,
        progress_percentage: Math.round((1 / totalUnits) * 100),
      });

      return { documents: documents || [], files: files || [] };
    }
    const { documents, files } = await fetchCaseData();

    const docsForAnalysis = documents.map(doc => ({
      filename: doc.file_name,
      content: `[Document content would be loaded from: ${doc.storage_path}]`,
      type: doc.document_type as any,
    }));

    const caseData = {
      documents: docsForAnalysis,
      witnesses: [],
      digitalRecords: requestContext?.digitalRecords || undefined,
      physicalEvidence: files.map(file => file.file_name),
    };

    async function generateTimeline() {
      'use step';
      const result = await generateComprehensiveVictimTimeline(
        {
          name: victimInfo.name,
          incidentTime: victimInfo.incidentTime,
          incidentLocation: victimInfo.incidentLocation || undefined,
          typicalRoutine: victimInfo.typicalRoutine || undefined,
          knownHabits: victimInfo.knownHabits || undefined,
          regularContacts: victimInfo.regularContacts || undefined,
        },
        caseData
      );

      await updateProcessingJob(jobId, {
        completed_units: 2,
        progress_percentage: Math.round((2 / totalUnits) * 100),
      });

      return result;
    }
    const analysisResult = await generateTimeline();

    async function persistResults() {
      'use step';
      const timelineInserts = analysisResult.timeline.movements.map(movement => ({
        case_id: caseId,
        title: movement.activity.substring(0, 100),
        description: movement.activity,
        type: 'victim_movement',
        date: movement.timestamp.split('T')[0],
        time: new Date(movement.timestamp).toLocaleTimeString(),
        location: movement.location,
        personnel: [...movement.witnessedBy, ...movement.accompaniedBy].join(', '),
        tags: [...movement.witnessedBy, ...movement.accompaniedBy],
        status: movement.significance,
        priority: movement.significance,
      }));

      if (timelineInserts.length > 0) {
        const { error: timelineError } = await supabaseServer
          .from('evidence_events')
          .insert(timelineInserts);

        if (timelineError) {
          console.error('[VictimTimelineWorkflow] Error saving timeline:', timelineError);
        }
      }

      const gapFlags = analysisResult.timeline.timelineGaps
        .filter(gap => gap.significance === 'critical' || gap.significance === 'high')
        .map(gap => ({
          case_id: caseId,
          type: 'missing_data' as const,
          severity: gap.significance as 'low' | 'medium' | 'high' | 'critical',
          title: `Timeline gap: ${gap.durationMinutes} minutes unaccounted`,
          description: `Victim's whereabouts unknown between ${gap.lastKnownLocation} and ${gap.nextKnownLocation}`,
          recommendation: gap.questionsToAnswer.join('; '),
          metadata: {
            startTime: gap.startTime,
            endTime: gap.endTime,
            durationMinutes: gap.durationMinutes,
            potentialEvidence: gap.potentialEvidence,
          } as any,
        }));

      if (gapFlags.length > 0) {
        const { error: flagError } = await supabaseServer
          .from('quality_flags')
          .insert(gapFlags);

        if (flagError) {
          console.error('[VictimTimelineWorkflow] Error saving gap flags:', flagError);
        }
      }

      const { error: analysisError } = await supabaseServer
        .from('case_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'victim_timeline',
          analysis_data: analysisResult as any,
          confidence_score: 0.85,
          used_prompt: 'Victim last movements reconstruction with gap analysis',
        });

      if (analysisError) {
        console.error('[VictimTimelineWorkflow] Error saving analysis:', analysisError);
      }

      await updateProcessingJob(jobId, {
        completed_units: 3,
        progress_percentage: Math.round((3 / totalUnits) * 100),
      });
    }
    await persistResults();

    async function finalizeJob() {
      'use step';
      await updateProcessingJob(jobId, {
        status: 'completed',
        completed_units: totalUnits,
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          timelineSummary: {
            totalMovements: analysisResult.timeline.movements.length,
            criticalGaps: analysisResult.timeline.timelineGaps.filter(
              gap => gap.significance === 'critical'
            ).length,
          },
        },
      });
    }
    await finalizeJob();

    return {
      success: true,
      jobId,
    };
  } catch (error: any) {
    await updateProcessingJob(jobId, {
      status: 'failed',
      completed_units: totalUnits,
      failed_units: 1,
      progress_percentage: 100,
      completed_at: new Date().toISOString(),
      metadata: {
        ...initialMetadata,
        error: error?.message || 'Victim timeline analysis failed',
      },
    });

    console.error('[VictimTimelineWorkflow] Failed to process victim timeline:', error);
    throw error;
  }
}
