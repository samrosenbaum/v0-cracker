/**
 * Inngest Job: Behavioral Pattern Analysis
 *
 * Analyzes interview transcripts for behavioral red flags and deception patterns.
 * This job runs in the background to avoid API timeouts.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { analyzeBehavioralPatterns } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface BehavioralPatternsEventData {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[BehavioralPatternsJob] Failed to update job', jobId, error);
  }
}

export const processBehavioralPatternsJob = inngest.createFunction(
  {
    id: 'behavioral-patterns',
    name: 'Behavioral Pattern Analysis - Interview Transcript Analysis',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/behavioral-patterns' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data as BehavioralPatternsEventData;

    const totalUnits = 4; // Fetch, Extract, Analyze, Save
    const initialMetadata = {
      analysisType: 'behavioral_patterns',
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

      // Step 2: Fetch case documents
      const { documents } = await step.run('fetch-documents', async () => {
        console.log('[Behavioral Patterns] Fetching documents for:', caseId);

        const { data: documents, error: docsError } = await supabaseServer
          .from('case_documents')
          .select('*')
          .eq('case_id', caseId);

        if (docsError) throw new Error(`Failed to fetch documents: ${docsError.message}`);

        console.log(`[Behavioral Patterns] Found ${documents?.length || 0} documents`);

        await updateProcessingJob(jobId, {
          completed_units: 1,
        });

        return { documents: documents || [] };
      });

      // Step 3: Extract document content
      const { interviews } = await step.run('extract-content', async () => {
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

        await updateProcessingJob(jobId, {
          completed_units: 2,
        });

        return { interviews };
      });

      // Step 4: Run behavioral pattern analysis
      const patterns = await step.run('analyze-patterns', async () => {
        if (interviews.length === 0) {
          throw new Error('No interview transcripts found to analyze');
        }

        console.log('[Behavioral Patterns] Analyzing behavioral patterns...');
        const patterns = await analyzeBehavioralPatterns(interviews);

        await updateProcessingJob(jobId, {
          completed_units: 3,
        });

        return patterns;
      });

      // Step 5: Save analysis results
      await step.run('save-results', async () => {
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
        await updateProcessingJob(jobId, {
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
          error: error?.message || 'Behavioral pattern analysis failed',
        },
      });

      console.error('[BehavioralPatternsJob] Failed to process behavioral patterns:', error);
      throw error;
    }
  }
);
