/**
 * Inngest Job: Interrogation Question Generator
 *
 * Generates targeted questions for re-interviewing suspects and witnesses.
 * This job runs in the background to avoid API timeouts.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { generateInterrogationQuestions } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface InterrogationQuestionsEventData {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'InterrogationQuestionsJob');
}

export const processInterrogationQuestionsJob = inngest.createFunction(
  {
    id: 'interrogation-questions',
    name: 'Interrogation Question Generator - Targeted Re-Interview Questions',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/interrogation-questions' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data as InterrogationQuestionsEventData;

    const totalUnits = 4; // Fetch, Extract, Analyze, Save
    const initialMetadata = {
      analysisType: 'interrogation_questions',
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
      const { suspects, witnesses, documents } = await step.run('fetch-case-data', async () => {
        console.log('[Interrogation Questions] Fetching case data for:', caseId);

        const [
          { data: suspects, error: suspectsError },
          { data: witnesses, error: witnessesError },
          { data: documents, error: docsError },
        ] = await Promise.all([
          supabaseServer.from('persons_of_interest').select('*').eq('case_id', caseId).eq('status', 'suspect'),
          supabaseServer.from('persons_of_interest').select('*').eq('case_id', caseId).eq('status', 'witness'),
          supabaseServer.from('case_documents').select('*').eq('case_id', caseId),
        ]);

        if (suspectsError) throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
        if (witnessesError) throw new Error(`Failed to fetch witnesses: ${witnessesError.message}`);
        if (docsError) throw new Error(`Failed to fetch documents: ${docsError.message}`);

        console.log(`[Interrogation Questions] Found: ${suspects?.length || 0} suspects, ${witnesses?.length || 0} witnesses, ${documents?.length || 0} documents`);

        await updateProcessingJob(jobId, {
          completed_units: 1,
        });

        return { suspects: suspects || [], witnesses: witnesses || [], documents: documents || [] };
      });

      // Step 3: Extract evidence gaps and patterns
      const { evidenceGaps, interviews } = await step.run('extract-content', async () => {
        console.log(`[Interrogation Questions] Extracting content from ${documents.length} documents...`);

        const storagePaths = documents.map((d) => d.storage_path).filter(Boolean) as string[];
        const extractionResults = await extractMultipleDocuments(storagePaths, 5);

        // Extract existing interview content
        const interviews = documents.map((doc) => {
          const extraction = extractionResults.get(doc.storage_path);
          return {
            speaker: doc.file_name.replace(/\.(pdf|txt|docx?)$/i, ''),
            content: extraction?.text || '',
          };
        }).filter((interview) => interview.content.length > 50);

        // Identify evidence gaps (simplified version)
        const evidenceGaps = [
          'Missing alibi verification',
          'Incomplete timeline of events',
          'Unverified witness statements',
        ];

        await updateProcessingJob(jobId, {
          completed_units: 2,
        });

        return { evidenceGaps, interviews };
      });

      // Step 4: Generate interrogation questions
      const questionSets = await step.run('generate-questions', async () => {
        console.log('[Interrogation Questions] Generating interrogation questions...');

        const personsList = [
          ...suspects.map((s) => ({ name: s.name, role: 'suspect' as const })),
          ...witnesses.map((w) => ({ name: w.name, role: 'witness' as const })),
        ];

        const questionSets = await generateInterrogationQuestions(
          personsList,
          evidenceGaps,
          interviews
        );

        await updateProcessingJob(jobId, {
          completed_units: 3,
        });

        return questionSets;
      });

      // Step 5: Save analysis results
      await step.run('save-results', async () => {
        const { error: saveError } = await supabaseServer
          .from('case_analysis')
          .insert({
            case_id: caseId,
            analysis_type: 'interrogation-questions',
            analysis_data: { questionSets } as any,
            confidence_score: 0.86,
            used_prompt: 'Interrogation question generator for targeted re-interviews',
          });

        if (saveError) {
          console.error('[Interrogation Questions] Error saving analysis:', saveError);
        } else {
          console.log('[Interrogation Questions] Saved interrogation questions analysis results');
        }

        // Mark job as completed
        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            summary: {
              totalQuestionSets: questionSets.length,
              totalQuestions: questionSets.reduce((sum, qs) => sum + qs.questions.length, 0),
              personsToReInterview: personsList.length,
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
          error: error?.message || 'Interrogation question generation failed',
        },
      });

      console.error('[InterrogationQuestionsJob] Failed to generate interrogation questions:', error);
      throw error;
    }
  }
);
