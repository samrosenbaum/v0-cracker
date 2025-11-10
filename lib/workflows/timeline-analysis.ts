/**
 * Workflow: Timeline Analysis
 *
 * Performs asynchronous timeline extraction and conflict detection.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import {
  analyzeCaseDocuments,
  detectTimeConflicts,
  identifyOverlookedSuspects,
  generateConflictSummary,
} from '@/lib/ai-analysis';
import { extractMultipleDocuments, queueDocumentForReview } from '@/lib/document-parser';

interface TimelineAnalysisParams {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[TimelineAnalysisWorkflow] Failed to update job', jobId, error);
  }
}

/**
 * Timeline Analysis Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive
 *   event.data → direct function parameters
 */
export async function processTimelineAnalysis(params: TimelineAnalysisParams) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 5; // Fetch, Extract, Analyze, Save Events, Save Conflicts
  const initialMetadata = {
    analysisType: 'timeline_and_conflicts',
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

    // Step 2: Fetch documents
    async function fetchDocuments() {
      'use step';
      const { data: documents, error: docError } = await supabaseServer
        .from('case_documents')
        .select('*')
        .eq('case_id', caseId);

      if (docError) {
        throw new Error(`Failed to fetch case documents: ${docError.message}`);
      }

      if (!documents || documents.length === 0) {
        throw new Error('No documents found for this case');
      }

      console.log(`[Timeline Analysis] Found ${documents.length} documents to analyze`);

      await updateProcessingJob(jobId, {
        completed_units: 1,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return documents;
    }
    const documents = await fetchDocuments();

    // Step 3: Extract document content
    async function extractContent() {
      'use step';
      const storagePaths = documents.map((doc) => doc.storage_path).filter(Boolean) as string[];

      console.log(`[Timeline Analysis] Extracting content from ${storagePaths.length} files...`);
      const extractionResults = await extractMultipleDocuments(storagePaths, 5);

      // Queue documents that need human review (low confidence OCR)
      let queuedForReview = 0;
      for (const doc of documents) {
        const extractionResult = extractionResults.get(doc.storage_path);
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
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return { extractionResults, queuedForReview };
    }
    const { extractionResults, queuedForReview } = await extractContent();

    // Step 4: Run AI analysis
    async function runAiAnalysis() {
      'use step';
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
      const analysis = await analyzeCaseDocuments(docsForAnalysis, caseId);

      // Detect additional conflicts using our algorithm
      const timeConflicts = detectTimeConflicts(analysis.timeline);
      analysis.conflicts.push(...timeConflicts);

      await updateProcessingJob(jobId, {
        completed_units: 3,
        // progress_percentage auto-calculates from completed_units/total_units
      });

      return analysis;
    }
    const analysis = await runAiAnalysis();

    // Step 5: Save timeline events
    async function saveTimelineEvents() {
      'use step';
      // Map AI analysis timeline events to the timeline_events table schema
      const eventTypeMap: Record<string, string> = {
        interview: 'witness_account',
        witness_statement: 'witness_account',
        police_report: 'other',
        forensic_report: 'evidence_found',
        tip: 'other',
        other: 'other',
      };

      const timelineInserts = analysis.timeline.map((event) => ({
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
        // progress_percentage auto-calculates from completed_units/total_units
      });
    }
    await saveTimelineEvents();

    // Step 6: Save conflicts and complete analysis
    async function saveConflictsAndFinalize() {
      'use step';
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
      const conflictInserts = analysis.conflicts.map((conflict) => ({
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
        // progress_percentage auto-calculates from completed_units/total_units
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          summary: {
            totalEvents: analysis.timeline.length,
            totalConflicts: analysis.conflicts.length,
            criticalConflicts: analysis.conflicts.filter((c) => c.severity === 'critical').length,
            overlookedSuspects: overlookedSuspects.length,
            documentsReviewed: queuedForReview,
          },
        },
      });
    }
    await saveConflictsAndFinalize();

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
        error: error?.message || 'Timeline analysis failed',
      },
    });

    console.error('[TimelineAnalysisWorkflow] Failed to process timeline analysis:', error);
    throw error;
  }
}
