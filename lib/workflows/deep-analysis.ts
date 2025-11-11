/**
 * Workflow: Deep/Comprehensive Cold Case Analysis
 *
 * Performs comprehensive 8-dimension cold case analysis asynchronously.
 * This workflow runs in the background using Next.js after.
 *
 * Requires Fluid Compute enabled in Vercel for reliable execution.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { performComprehensiveAnalysis } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments, queueDocumentForReview } from '@/lib/document-parser';

interface DeepAnalysisParams {
  jobId: string;
  caseId: string;
}

export async function processDeepAnalysis(params: DeepAnalysisParams) {

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch, Extract, Analyze, Save
  const initialMetadata = {
    analysisType: 'comprehensive_cold_case',
    requestedAt: new Date().toISOString(),
  };

  try {
    async function initializeJob() {
      await updateProcessingJobRecord(jobId, {
        status: 'running',
        total_units: totalUnits,
        started_at: new Date().toISOString(),
        metadata: initialMetadata,
      }, 'DeepAnalysisWorkflow');
    }
    await initializeJob();

    async function fetchCaseData() {

      console.log('[Deep Analysis] Fetching case data for:', caseId);

      // Verify case exists
      const { data: caseCheck, error: checkError } = await supabaseServer
        .from('cases')
        .select('*')
        .eq('id', caseId);

      if (checkError) {
        throw new Error(`Database error: ${checkError.message}`);
      }

      if (!caseCheck || caseCheck.length === 0) {
        throw new Error('Case not found');
      }

      if (caseCheck.length > 1) {
        throw new Error('Multiple cases found with this ID');
      }

      const caseData = caseCheck[0];

      // Fetch all case data in parallel
      const [
        { data: documents, error: docsError },
        { data: suspects, error: suspectsError },
        { data: evidence, error: evidenceError },
      ] = await Promise.all([
        supabaseServer.from('case_documents').select('*').eq('case_id', caseId),
        supabaseServer.from('persons_of_interest').select('*').eq('case_id', caseId).eq('status', 'suspect'),
        supabaseServer.from('case_files').select('*').eq('case_id', caseId),
      ]);

      if (docsError) throw new Error(`Failed to fetch documents: ${docsError.message}`);
      if (suspectsError) throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
      if (evidenceError) throw new Error(`Failed to fetch evidence: ${evidenceError.message}`);

      console.log(`[Deep Analysis] Found:`);
      console.log(`  - Case: ${caseData.title || caseData.id}`);
      console.log(`  - Documents: ${documents?.length || 0}`);
      console.log(`  - Suspects: ${suspects?.length || 0}`);
      console.log(`  - Evidence: ${evidence?.length || 0}`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 1,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'DeepAnalysisWorkflow');

      return { caseData, documents: documents || [], suspects: suspects || [], evidence: evidence || [] };
    }
    const { caseData, documents, suspects, evidence } = await fetchCaseData();

    async function extractContent() {

      console.log(`[Deep Analysis] Extracting content from ${documents.length} documents...`);

      const storagePaths = documents.map((d) => d.storage_path).filter(Boolean) as string[];
      const extractionResults = await extractMultipleDocuments(storagePaths, 5);

      // Queue documents that need human review
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
        console.log(`[Deep Analysis] ⚠️  ${queuedForReview} document(s) queued for human review`);
      }

      const totalChars = Array.from(extractionResults.values()).reduce(
        (sum, result) => sum + (result.text?.length || 0),
        0
      );

      console.log(`[Deep Analysis] Extracted ${totalChars.toLocaleString()} total characters`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 2,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'DeepAnalysisWorkflow');

      return { extractionResults, queuedForReview };
    }
    const { extractionResults, queuedForReview } = await extractContent();

    async function runComprehensiveAnalysis() {

      // Prepare data for analysis with REAL extracted content
      const analysisInput = {
        incidentType: caseData.description || 'Unknown',
        date: caseData.created_at,
        location: 'Unknown', // Would come from case data
        availableEvidence: evidence.map((e) => e.file_name),
        suspects: suspects.map((s) => s.name),
        witnesses: [], // Would be extracted from documents
        interviews: [], // Would be extracted from documents
        documents: documents.map((d) => {
          const extraction = extractionResults.get(d.storage_path);
          return {
            filename: d.file_name,
            content: extraction?.text || '[Could not extract content]',
          };
        }),
        evidence: evidence.map((e) => ({
          item: e.file_name,
          dateCollected: e.created_at,
          testingPerformed: e.notes || 'Unknown',
          results: 'Unknown',
        })),
      };

      console.log('[Deep Analysis] Running comprehensive analysis...');
      const analysis = await performComprehensiveAnalysis(caseId, analysisInput);

      await updateProcessingJobRecord(jobId, {
        completed_units: 3,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'DeepAnalysisWorkflow');

      return analysis;
    }
    const analysis = await runComprehensiveAnalysis();

    async function saveResults() {

      const { error: saveError } = await supabaseServer
        .from('case_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'comprehensive_cold_case',
          analysis_data: analysis as any,
          confidence_score: 0.9,
          used_prompt: 'Comprehensive cold case analysis with 8 analytical dimensions',
        });

      if (saveError) {
        console.error('[Deep Analysis] Error saving analysis:', saveError);
      } else {
        console.log('[Deep Analysis] Saved comprehensive analysis results');
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
            totalPatterns: analysis.behavioralPatterns.length,
            criticalGaps: analysis.evidenceGaps.filter((g) => g.priority === 'critical').length,
            hiddenConnections: analysis.relationshipNetwork.hiddenConnections.length,
            overlookedDetails: analysis.overlookedDetails.length,
            topPriorities: analysis.topPriorities.length,
            likelyBreakthroughs: analysis.likelyBreakthroughs.length,
            documentsReviewed: queuedForReview,
          },
        },
      }, 'DeepAnalysisWorkflow');
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
        error: error?.message || 'Deep analysis failed',
      },
    }, 'DeepAnalysisWorkflow');

    console.error('[DeepAnalysisWorkflow] Failed to process deep analysis:', error);
    throw error;
  }
}
