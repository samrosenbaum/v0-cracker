/**
 * Workflow: Behavioral Pattern Analysis
 *
 * Analyzes interview transcripts for behavioral red flags and deception patterns.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { analyzeBehavioralPatterns } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface BehavioralPatternsParams {
  jobId: string;
  caseId: string;
}

export async function processBehavioralPatterns(params: BehavioralPatternsParams) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch, Extract, Analyze, Save
  const initialMetadata = {
    analysisType: 'behavioral_patterns',
    requestedAt: new Date().toISOString(),
  };

  try {
    async function initializeJob() {
      'use step';
      await updateProcessingJobRecord(jobId, {
        status: 'running',
        total_units: totalUnits,
        started_at: new Date().toISOString(),
        metadata: initialMetadata,
      }, 'BehavioralPatternsWorkflow');
    }
    await initializeJob();

    async function fetchDocuments() {
      'use step';
      console.log('[Behavioral Patterns] Fetching documents for:', caseId);

      const { data: documents, error: docsError } = await supabaseServer
        .from('case_documents')
        .select('*')
        .eq('case_id', caseId);

      if (docsError) throw new Error(`Failed to fetch documents: ${docsError.message}`);

      console.log(`[Behavioral Patterns] Found ${documents?.length || 0} documents`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 1,
      }, 'BehavioralPatternsWorkflow');

      return { documents: documents || [] };
    }
    const { documents } = await fetchDocuments();

    async function extractContent() {
      'use step';
      console.log(`[Behavioral Patterns] Extracting content from ${documents.length} documents...`);

      const storagePaths = documents.map((d) => d.storage_path).filter(Boolean) as string[];
      const extractionResults = await extractMultipleDocuments(storagePaths, 5);

      // Parse interviews from documents
      // For now, treat each document as a potential interview transcript
      const interviews = documents.map((doc) => {
        const extraction = extractionResults.get(doc.storage_path);
        return {
          speaker: doc.file_name.replace(/\.(pdf|txt|docx?)$/i, ''),
          content: extraction?.text || '[Could not extract content]',
          date: doc.created_at,
        };
      }).filter((interview) => interview.content.length > 50); // Filter out empty/short docs

      console.log(`[Behavioral Patterns] Found ${interviews.length} interview transcripts`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 2,
      }, 'BehavioralPatternsWorkflow');

      return { interviews };
    }
    const { interviews } = await extractContent();

    async function analyzePatterns() {
      'use step';
      if (interviews.length === 0) {
        throw new Error('No interview transcripts found to analyze');
      }

      console.log('[Behavioral Patterns] Analyzing behavioral patterns...');
      const patterns = await analyzeBehavioralPatterns(interviews);

      await updateProcessingJobRecord(jobId, {
        completed_units: 3,
      }, 'BehavioralPatternsWorkflow');

      return patterns;
    }
    const patterns = await analyzePatterns();

    async function saveResults() {
      'use step';
      const { error: saveError } = await supabaseServer
        .from('case_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'behavioral-patterns',
          analysis_data: { patterns } as any,
          confidence_score: 0.85,
          used_prompt: 'Behavioral pattern analysis for deception detection in interview transcripts',
        });

      if (saveError) {
        console.error('[Behavioral Patterns] Error saving analysis:', saveError);
      } else {
        console.log('[Behavioral Patterns] Saved behavioral pattern analysis results');
      }

      // Mark job as completed
      await updateProcessingJobRecord(jobId, {
        status: 'completed',
        completed_units: totalUnits,
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          summary: {
            totalPatterns: patterns.length,
            highSuspicionPatterns: patterns.filter((p) =>
              p.patterns.some((pat) => pat.suspicionLevel > 0.7)
            ).length,
            interviewsAnalyzed: interviews.length,
          },
        },
      }, 'BehavioralPatternsWorkflow');
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
        error: error?.message || 'Behavioral pattern analysis failed',
      },
    }, 'BehavioralPatternsWorkflow');

    console.error('[BehavioralPatternsWorkflow] Failed to process behavioral patterns:', error);
    throw error;
  }
}
