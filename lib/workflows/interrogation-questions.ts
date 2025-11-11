/**
 * Workflow: Interrogation Question Generator
 *
 * Generates targeted questions for re-interviewing suspects and witnesses.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { generateInterrogationQuestions } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface InterrogationQuestionsParams {
  jobId: string;
  caseId: string;
}

/**
 * Interrogation Question Generator Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive
 *   event.data → direct function parameters
 */
export async function processInterrogationQuestions(params: InterrogationQuestionsParams) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch, Extract, Analyze, Save
  const initialMetadata = {
    analysisType: 'interrogation_questions',
    requestedAt: new Date().toISOString(),
  };

  try {
    // Step 1: Initialize job
    async function initializeJob() {
      await updateProcessingJobRecord(jobId, {
        status: 'running',
        total_units: totalUnits,
        started_at: new Date().toISOString(),
        metadata: initialMetadata,
      }, 'InterrogationQuestionsWorkflow');
    }
    await initializeJob();

    // Step 2: Fetch case data
    async function fetchCaseData() {
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

      await updateProcessingJobRecord(jobId, {
        completed_units: 1,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'InterrogationQuestionsWorkflow');

      return { suspects: suspects || [], witnesses: witnesses || [], documents: documents || [] };
    }
    const { suspects, witnesses, documents } = await fetchCaseData();

    // Step 3: Extract evidence gaps and patterns
    async function extractContent() {
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

      console.log(`[Interrogation Questions] Extracted ${interviews.length} interviews`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 2,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'InterrogationQuestionsWorkflow');

      return { evidenceGaps, interviews };
    }
    const { evidenceGaps, interviews } = await extractContent();

    // Step 4: Generate interrogation questions
    async function generateQuestions() {
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

      const totalQuestions = questionSets.reduce((sum, qs) => sum + qs.questions.length, 0);
      console.log(`[Interrogation Questions] Generated ${totalQuestions} questions for ${questionSets.length} persons`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 3,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'InterrogationQuestionsWorkflow');

      return { questionSets, personsList };
    }
    const { questionSets, personsList } = await generateQuestions();

    // Step 5: Save analysis results
    async function saveResults() {
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
      await updateProcessingJobRecord(jobId, {
        status: 'completed',
        completed_units: totalUnits,
        // progress_percentage auto-calculates from completed_units/total_units
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          summary: {
            totalQuestionSets: questionSets.length,
            totalQuestions: questionSets.reduce((sum, qs) => sum + qs.questions.length, 0),
            personsToReInterview: personsList.length,
          },
        },
      }, 'InterrogationQuestionsWorkflow');
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
        error: error?.message || 'Interrogation question generation failed',
      },
    }, 'InterrogationQuestionsWorkflow');

    console.error('[InterrogationQuestionsWorkflow] Failed to generate interrogation questions:', error);
    throw error;
  }
}
