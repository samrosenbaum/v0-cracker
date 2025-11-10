/**
 * Workflow: Interrogation Question Generator
 *
 * Generates targeted questions for re-interviewing suspects and witnesses.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 *
 * ⚠️  IMPORTANT: Step functions MUST be defined at module level (top-level scope),
 * not nested inside the workflow function. This is required by Workflow DevKit.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { generateInterrogationQuestions } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';
import { handleWorkflowFailure } from './helpers';

interface InterrogationQuestionsParams {
  jobId: string;
  caseId: string;
}

interface CaseDataResult {
  suspects: any[];
  witnesses: any[];
  documents: any[];
}

interface ExtractContentResult {
  evidenceGaps: string[];
  interviews: Array<{ speaker: string; content: string }>;
}

interface GenerateQuestionsResult {
  questionSets: Record<string, unknown>;
  personsList: Array<{ name: string; role: 'suspect' | 'witness' }>;
}

// ============================================================================
// STEP 1: Initialize Job
// ============================================================================
async function initializeJob(
  jobId: string,
  totalUnits: number,
  initialMetadata: Record<string, any>,
) {
  'use step';
  await updateProcessingJobRecord(
    jobId,
    {
      status: 'running',
      total_units: totalUnits,
      started_at: new Date().toISOString(),
      metadata: initialMetadata,
    },
    'InterrogationQuestionsWorkflow',
  );
}

// ============================================================================
// STEP 2: Fetch Case Data
// ============================================================================
async function fetchCaseData(
  jobId: string,
  caseId: string,
): Promise<CaseDataResult> {
  'use step';
  console.log('[Interrogation Questions] Fetching case data for:', caseId);

  const [
    { data: suspects, error: suspectsError },
    { data: witnesses, error: witnessesError },
    { data: documents, error: docsError },
  ] = await Promise.all([
    supabaseServer.from('suspects').select('*').eq('case_id', caseId),
    supabaseServer.from('witnesses').select('*').eq('case_id', caseId),
    supabaseServer.from('case_documents').select('*').eq('case_id', caseId),
  ]);

  if (suspectsError)
    throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
  if (witnessesError)
    throw new Error(`Failed to fetch witnesses: ${witnessesError.message}`);
  if (docsError)
    throw new Error(`Failed to fetch documents: ${docsError.message}`);

  console.log(
    `[Interrogation Questions] Found: ${suspects?.length || 0} suspects, ${witnesses?.length || 0} witnesses, ${documents?.length || 0} documents`,
  );

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 1,
    },
    'InterrogationQuestionsWorkflow',
  );

  return {
    suspects: suspects || [],
    witnesses: witnesses || [],
    documents: documents || [],
  };
}

// ============================================================================
// STEP 3: Extract Content and Identify Evidence Gaps
// ============================================================================
async function extractContent(
  jobId: string,
  documents: any[],
): Promise<ExtractContentResult> {
  'use step';
  console.log(
    `[Interrogation Questions] Extracting content from ${documents.length} documents...`,
  );

  const storagePaths = documents
    .map((d) => d.storage_path)
    .filter(Boolean) as string[];
  const extractionResults = await extractMultipleDocuments(storagePaths, 5);

  // Extract existing interview content
  const interviews = documents
    .map((doc) => {
      const extraction = extractionResults.get(doc.storage_path);
      return {
        speaker: doc.file_name.replace(/\.(pdf|txt|docx?)$/i, ''),
        content: extraction?.text || '',
      };
    })
    .filter((interview) => interview.content.length > 50);

  // Identify evidence gaps (simplified version)
  const evidenceGaps = [
    'Missing alibi verification',
    'Incomplete timeline of events',
    'Unverified witness statements',
  ];

  console.log(
    `[Interrogation Questions] Extracted ${interviews.length} interviews`,
  );

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 2,
    },
    'InterrogationQuestionsWorkflow',
  );

  return { evidenceGaps, interviews };
}

// ============================================================================
// STEP 4: Generate Interrogation Questions
// ============================================================================
async function generateQuestions(
  jobId: string,
  suspects: any[],
  witnesses: any[],
  evidenceGaps: string[],
  interviews: Array<{ speaker: string; content: string }>,
): Promise<GenerateQuestionsResult> {
  'use step';
  console.log(
    '[Interrogation Questions] Generating interrogation questions...',
  );

  const personsList = [
    ...suspects.map((s) => ({ name: s.name, role: 'suspect' as const })),
    ...witnesses.map((w) => ({ name: w.name, role: 'witness' as const })),
  ];

  // Generate interrogation strategies for first suspect (or we could loop through all)
  const questionSets: Record<string, unknown> = {};
  if (suspects.length > 0) {
    const suspect = suspects[0];
    questionSets[suspect.name] = await generateInterrogationQuestions({
      name: suspect.name,
      statements: [suspect.statement || ''],
      knownFacts: evidenceGaps,
      inconsistencies: [],
      relationships: witnesses.map((w) => w.name),
    });
  }

  console.log(
    `[Interrogation Questions] Generated questions for ${personsList.length} persons`,
  );

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 3,
    },
    'InterrogationQuestionsWorkflow',
  );

  return { questionSets, personsList };
}

// ============================================================================
// STEP 5: Save Analysis Results
// ============================================================================
async function saveResults(
  jobId: string,
  caseId: string,
  questionSets: Record<string, unknown>,
  personsList: Array<{ name: string; role: 'suspect' | 'witness' }>,
  totalUnits: number,
  initialMetadata: Record<string, any>,
) {
  'use step';
  const { error: saveError } = await supabaseServer
    .from('case_analysis')
    .insert({
      case_id: caseId,
      analysis_type: 'interrogation-questions',
      analysis_data: { questionSets } as any,
      confidence_score: 0.86,
      used_prompt:
        'Interrogation question generator for targeted re-interviews',
    });

  if (saveError) {
    console.error(
      '[Interrogation Questions] Error saving analysis:',
      saveError,
    );
  } else {
    console.log(
      '[Interrogation Questions] Saved interrogation questions analysis results',
    );
  }

  // Mark job as completed
  await updateProcessingJobRecord(
    jobId,
    {
      status: 'completed',
      completed_units: totalUnits,
      completed_at: new Date().toISOString(),
      metadata: {
        ...initialMetadata,
        summary: {
          personsToReInterview: personsList.length,
        },
      },
    },
    'InterrogationQuestionsWorkflow',
  );
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================
/**
 * Interrogation Question Generator Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive (at module level)
 *   event.data → direct function parameters
 */
export async function processInterrogationQuestions(
  params: InterrogationQuestionsParams,
) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch, Extract, Analyze, Save
  const initialMetadata = {
    analysisType: 'interrogation_questions',
    requestedAt: new Date().toISOString(),
  };

  try {
    await initializeJob(jobId, totalUnits, initialMetadata);

    const { suspects, witnesses, documents } = await fetchCaseData(
      jobId,
      caseId,
    );

    const { evidenceGaps, interviews } = await extractContent(jobId, documents);

    const { questionSets, personsList } = await generateQuestions(
      jobId,
      suspects,
      witnesses,
      evidenceGaps,
      interviews,
    );

    await saveResults(
      jobId,
      caseId,
      questionSets,
      personsList,
      totalUnits,
      initialMetadata,
    );

    return {
      success: true,
      jobId,
    };
  } catch (error: any) {
    await handleWorkflowFailure({
      jobId,
      totalUnits,
      initialMetadata,
      error,
      workflowName: 'InterrogationQuestionsWorkflow',
    });
    throw error;
  }
}
