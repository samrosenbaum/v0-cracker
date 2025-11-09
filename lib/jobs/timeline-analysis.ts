/**
 * Inngest Job: Timeline Analysis
 *
 * Performs asynchronous timeline extraction and conflict detection.
 * This job runs in the background to avoid API timeouts.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import {
  analyzeCaseDocuments,
  detectTimeConflicts,
  identifyOverlookedSuspects,
  generateConflictSummary,
} from '@/lib/ai-analysis';
import { extractMultipleDocuments, queueDocumentForReview } from '@/lib/document-parser';
import type { CaseAnalysis } from '@/lib/ai-analysis';
import type { ExtractionResult } from '@/lib/document-parser';
import type { Database } from '@/app/types/database';

interface TimelineAnalysisEventData {
  jobId: string;
  caseId: string;
}

type StepRunner = <T>(stepName: string, executor: () => Promise<T>) => Promise<T>;

const defaultStepRunner: StepRunner = async (_stepName, executor) => executor();

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[TimelineAnalysisJob] Failed to update job', jobId, error);
  }
}

type CaseDocument = Database['public']['Tables']['case_documents']['Row'];

type TimelineEventInput = CaseAnalysis['timeline'][number];
type ConflictInsight = CaseAnalysis['conflicts'][number];

export async function runTimelineAnalysis(
  jobId: string,
  caseId: string,
  stepRunner: StepRunner = defaultStepRunner
) {
  const totalUnits = 5; // Fetch, Extract, Analyze, Save Events, Save Conflicts
  const initialMetadata = {
    analysisType: 'timeline_and_conflicts',
    requestedAt: new Date().toISOString(),
  };

  let documents: CaseDocument[] = [];
  let extractionResults: Map<string, ExtractionResult> = new Map();
  let queuedForReviewCount = 0;
  let analysis: CaseAnalysis | null = null;

  try {
    // Step 1: Initialize job
    await stepRunner('initialize-job', async () => {
      await updateProcessingJob(jobId, {
        status: 'running',
        total_units: totalUnits,
        started_at: new Date().toISOString(),
        metadata: initialMetadata,
      });
    });

    // Step 2: Fetch documents
    documents = await stepRunner('fetch-documents', async () => {
      const { data: fetchedDocuments, error: docError } = await supabaseServer
        .from('case_documents')
        .select('*')
        .eq('case_id', caseId);

      if (docError) {
        throw new Error(`Failed to fetch case documents: ${docError.message}`);
      }

      if (!fetchedDocuments || fetchedDocuments.length === 0) {
        throw new Error('No documents found for this case');
      }

      console.log(`[Timeline Analysis] Found ${fetchedDocuments.length} documents to analyze`);

      await updateProcessingJob(jobId, {
        completed_units: 1,
        progress_percentage: Math.round((1 / totalUnits) * 100),
      });

      return fetchedDocuments;
    });

    // Step 3: Extract document content
    const extractionOutput = await stepRunner(
      'extract-content',
      async (): Promise<{ extractionResults: Map<string, ExtractionResult>; queuedForReview: number }> => {
        const storagePaths = documents.map((doc) => doc.storage_path).filter(Boolean) as string[];

        console.log(`[Timeline Analysis] Extracting content from ${storagePaths.length} files...`);
        const extractedResults = await extractMultipleDocuments(storagePaths, 5);

        // Queue documents that need human review (low confidence OCR)
        let queuedForReview = 0;
        for (const doc of documents) {
          const extractionResult = extractedResults.get(doc.storage_path);
          if (extractionResult && extractionResult.needsReview) {
            const queued = await queueDocumentForReview(doc.id, caseId, extractionResult);
            if (queued) {
              queuedForReview++;
            }
          }
        }

        if (queuedForReview > 0) {
          console.log(`[Timeline Analysis] ⚠️  ${queuedForReview} document(s) queued for human review`);
        }

        await updateProcessingJob(jobId, {
          completed_units: 2,
          progress_percentage: Math.round((2 / totalUnits) * 100),
        });

        return { extractionResults: extractedResults, queuedForReview };
      }
    );

    extractionResults = extractionOutput.extractionResults;
    queuedForReviewCount = extractionOutput.queuedForReview;

    // Step 4: Run AI analysis
    analysis = await stepRunner('ai-analysis', async () => {
      // Build documents for AI analysis with REAL extracted content
      const docsForAnalysis = documents.map((doc) => {
        const extractionResult = extractionResults.get(doc.storage_path);

        return {
          content: extractionResult?.text || `[Could not extract text from ${doc.file_name}]`,
          filename: doc.file_name,
          type: doc.document_type,
          confidence: extractionResult?.confidence || 0,
          extractionMethod: extractionResult?.method || 'unknown',
        };
      });

      // Log extraction results
      const totalChars = docsForAnalysis.reduce((sum, doc) => sum + doc.content.length, 0);
      const successfulExtractions = docsForAnalysis.filter((doc) => doc.confidence > 0.5).length;

      console.log(`[Timeline Analysis] Extraction complete:`);
      console.log(`  - ${successfulExtractions}/${documents.length} documents extracted successfully`);
      console.log(`  - Total characters extracted: ${totalChars.toLocaleString()}`);

      // Run AI analysis on REAL document content
      console.log(`[Timeline Analysis] Running AI analysis...`);
      const aiAnalysis = await analyzeCaseDocuments(docsForAnalysis);

      // Detect additional conflicts using our algorithm
      const timeConflicts = detectTimeConflicts(aiAnalysis.timeline);
      aiAnalysis.conflicts.push(...timeConflicts);

      await updateProcessingJob(jobId, {
        completed_units: 3,
        progress_percentage: Math.round((3 / totalUnits) * 100),
      });

      return aiAnalysis;
    });

    // Step 5: Save timeline events
    await stepRunner('save-timeline-events', async () => {
      // Map AI analysis timeline events to the timeline_events table schema
      const eventTypeMap: Record<string, string> = {
        interview: 'witness_account',
        witness_statement: 'witness_account',
        police_report: 'other',
        forensic_report: 'evidence_found',
        tip: 'other',
        other: 'other',
      };

      if (!analysis) {
        throw new Error('Timeline analysis results were not generated.');
      }

      const timelineInserts = analysis.timeline.map((event: TimelineEventInput) => ({
        case_id: caseId,
        event_type: eventTypeMap[event.sourceType] || 'other',
        title: event.description?.substring(0, 100) || 'Timeline Event',
        description: event.description || null,
        event_time: event.time || event.startTime || null,
        event_date: event.date || null,
        time_precision:
          event.startTime && event.endTime
            ? ('approximate' as const)
            : event.time
            ? ('exact' as const)
            : ('estimated' as const),
        time_range_start: event.startTime || null,
        time_range_end: event.endTime || null,
        location: event.location || null,
        primary_entity_id: null, // Will be linked later if entities are created
        verification_status: 'unverified' as const,
        confidence_score: event.confidence || 0.5,
        source_type: event.sourceType,
        source_notes: event.source || null,
        metadata: event.metadata || {},
      }));

      if (timelineInserts.length > 0) {
        const { error: timelineError } = await supabaseServer
          .from('timeline_events')
          .insert(timelineInserts);

        if (timelineError) {
          console.error('[Timeline Analysis] Error saving timeline:', timelineError);
        } else {
          console.log(`[Timeline Analysis] Saved ${timelineInserts.length} timeline events`);
        }
      }

      await updateProcessingJob(jobId, {
        completed_units: 4,
        progress_percentage: Math.round((4 / totalUnits) * 100),
      });
    });

    // Step 6: Save conflicts and complete analysis
    await stepRunner('save-conflicts-and-finalize', async () => {
      if (!analysis) {
        throw new Error('Timeline analysis results were not generated.');
      }

      // Identify overlooked suspects
      const { data: formalSuspects } = await supabaseServer
        .from('suspects')
        .select('name')
        .eq('case_id', caseId);

      const overlookedSuspects = identifyOverlookedSuspects(
        analysis.personMentions,
        formalSuspects?.map((s) => s.name) || []
      );

      // Save conflicts as quality flags
      const conflictInserts = analysis.conflicts.map((conflict: ConflictInsight) => ({
        case_id: caseId,
        type: (conflict.type === 'time_inconsistency'
          ? 'inconsistency'
          : conflict.type === 'statement_contradiction'
          ? 'inconsistency'
          : conflict.type === 'alibi_conflict'
          ? 'inconsistency'
          : 'incomplete_analysis') as 'inconsistency' | 'incomplete_analysis',
        severity: conflict.severity as 'low' | 'medium' | 'high' | 'critical',
        title: conflict.description,
        description: conflict.details,
        recommendation: conflict.recommendation,
        affected_findings: conflict.affectedPersons,
        metadata: {
          conflictType: conflict.type,
          eventIds: conflict.events.map((e) => e.id),
        } as any,
      }));

      if (conflictInserts.length > 0) {
        const { error: flagError } = await supabaseServer
          .from('quality_flags')
          .insert(conflictInserts);

        if (flagError) {
          console.error('[Timeline Analysis] Error saving quality flags:', flagError);
        } else {
          console.log(`[Timeline Analysis] Saved ${conflictInserts.length} conflict flags`);
        }
      }

      // Save complete analysis results
      const { error: analysisError } = await supabaseServer
        .from('case_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'timeline_and_conflicts',
          analysis_data: {
            timeline: analysis.timeline,
            conflicts: analysis.conflicts,
            personMentions: analysis.personMentions,
            unfollowedTips: analysis.unfollowedTips,
            keyInsights: analysis.keyInsights,
            suspectAnalysis: analysis.suspectAnalysis,
            overlookedSuspects,
            conflictSummary: generateConflictSummary(analysis.conflicts),
          } as any,
          confidence_score: 0.85,
          used_prompt: 'Timeline and conflict analysis',
        });

      if (analysisError) {
        console.error('[Timeline Analysis] Error saving analysis:', analysisError);
      }

      // Mark job as completed
      await updateProcessingJob(jobId, {
        status: 'completed',
        completed_units: totalUnits,
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          summary: {
            totalEvents: analysis.timeline.length,
            totalConflicts: analysis.conflicts.length,
            criticalConflicts: analysis.conflicts.filter((c) => c.severity === 'critical').length,
            overlookedSuspects: overlookedSuspects.length,
            documentsReviewed: queuedForReviewCount,
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
      progress_percentage: 100,
      completed_at: new Date().toISOString(),
      metadata: {
        ...initialMetadata,
        error: error?.message || 'Timeline analysis failed',
      },
    });

    console.error('[TimelineAnalysisJob] Failed to process timeline analysis:', error);
    throw error;
  }
}

export const processTimelineAnalysisJob = inngest.createFunction(
  {
    id: 'timeline-analysis',
    name: 'Timeline Analysis - Extract Events & Detect Conflicts',
    retries: 2,
    concurrency: {
      limit: 3, // Allow up to 3 concurrent timeline analyses
    },
  },
  { event: 'analysis/timeline' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data as TimelineAnalysisEventData;

    return runTimelineAnalysis(jobId, caseId, (stepName, executor) => step.run(stepName, executor));
  }
);
