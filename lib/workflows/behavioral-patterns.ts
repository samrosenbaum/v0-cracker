/**
 * Workflow: Behavioral Pattern Analysis
 *
 * Analyzes interview transcripts for behavioral red flags and deception patterns.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 *
 * ⚠️  IMPORTANT: Step functions MUST be defined at module level (top-level scope),
 * not nested inside the workflow function. This is required by Workflow DevKit.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { analyzeBehavioralPatterns } from '@/lib/cold-case-analyzer';
import { handleWorkflowFailure } from './helpers';
import { extractMultipleDocuments } from '@/lib/document-parser';

interface BehavioralPatternsParams {
  jobId: string;
  caseId: string;
}

interface Document {
  id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
}

interface Interview {
  speaker: string;
  content: string;
  date: string;
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
    'BehavioralPatternsWorkflow',
  );
}

// ============================================================================
// STEP 2: Fetch Documents
// ============================================================================
async function fetchDocuments(
  jobId: string,
  caseId: string,
): Promise<Document[]> {
  'use step';
  console.log('[Behavioral Patterns] Fetching documents for:', caseId);

  const { data: documents, error: docsError } = await supabaseServer
    .from('case_documents')
    .select('*')
    .eq('case_id', caseId);

  if (docsError)
    throw new Error(`Failed to fetch documents: ${docsError.message}`);

  console.log(
    `[Behavioral Patterns] Found ${documents?.length || 0} documents`,
  );

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 1,
    },
    'BehavioralPatternsWorkflow',
  );

  return documents || [];
}

// ============================================================================
// STEP 3: Extract Content from Documents
// ============================================================================
async function extractContent(
  jobId: string,
  documents: Document[],
): Promise<Interview[]> {
  'use step';
  console.log(
    `[Behavioral Patterns] Extracting content from ${documents.length} documents...`,
  );

  const storagePaths = documents
    .map((d) => d.storage_path)
    .filter(Boolean) as string[];
  const extractionResults = await extractMultipleDocuments(storagePaths, 5);

  // Parse interviews from documents
  // For now, treat each document as a potential interview transcript
  const interviews = documents
    .map((doc) => {
      const extraction = extractionResults.get(doc.storage_path);
      return {
        speaker: doc.file_name.replace(/\.(pdf|txt|docx?)$/i, ''),
        content: extraction?.text || '[Could not extract content]',
        date: doc.created_at,
      };
    })
    .filter((interview) => interview.content.length > 50); // Filter out empty/short docs

  console.log(
    `[Behavioral Patterns] Found ${interviews.length} interview transcripts`,
  );

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 2,
    },
    'BehavioralPatternsWorkflow',
  );

  return interviews;
}

// ============================================================================
// STEP 4: Analyze Patterns
// ============================================================================
async function analyzePatterns(
  jobId: string,
  interviews: Interview[],
): Promise<any[]> {
  'use step';
  if (interviews.length === 0) {
    throw new Error('No interview transcripts found to analyze');
  }

  console.log('[Behavioral Patterns] Analyzing behavioral patterns...');
  const patterns = await analyzeBehavioralPatterns(interviews);

  await updateProcessingJobRecord(
    jobId,
    {
      completed_units: 3,
    },
    'BehavioralPatternsWorkflow',
  );

  return patterns;
}

// ============================================================================
// STEP 5: Save Results
// ============================================================================
async function saveResults(
  jobId: string,
  caseId: string,
  patterns: any[],
  interviews: Interview[],
  totalUnits: number,
  initialMetadata: Record<string, any>,
) {
  'use step';
  const { error: saveError } = await supabaseServer
    .from('case_analysis')
    .insert({
      case_id: caseId,
      analysis_type: 'behavioral-patterns',
      analysis_data: { patterns } as any,
      confidence_score: 0.85,
      used_prompt:
        'Behavioral pattern analysis for deception detection in interview transcripts',
    });

  if (saveError) {
    console.error('[Behavioral Patterns] Error saving analysis:', saveError);
  } else {
    console.log(
      '[Behavioral Patterns] Saved behavioral pattern analysis results',
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
          totalPatterns: patterns.length,
          highSuspicionPatterns: patterns.filter((p) =>
            p.patterns.some((pat) => pat.suspicionLevel > 0.7),
          ).length,
          interviewsAnalyzed: interviews.length,
        },
      },
    },
    'BehavioralPatternsWorkflow',
  );
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================
export async function processBehavioralPatterns(
  params: BehavioralPatternsParams,
) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch, Extract, Analyze, Save
  const initialMetadata = {
    analysisType: 'behavioral_patterns',
    requestedAt: new Date().toISOString(),
  };

  try {
    await initializeJob(jobId, totalUnits, initialMetadata);

    const documents = await fetchDocuments(jobId, caseId);

    const interviews = await extractContent(jobId, documents);

    const patterns = await analyzePatterns(jobId, interviews);

    await saveResults(
      jobId,
      caseId,
      patterns,
      interviews,
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
      workflowName: 'BehavioralPatternsWorkflow',
    });
    throw error;
  }
}
