/**
 * Inngest Job: Deep/Comprehensive Cold Case Analysis
 *
 * Performs comprehensive 8-dimension cold case analysis asynchronously.
 * This job runs in the background to avoid API timeouts.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { performComprehensiveAnalysis } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments, queueDocumentForReview } from '@/lib/document-parser';

interface DeepAnalysisEventData {
  jobId: string;
  caseId: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('[DeepAnalysisJob] Failed to update job', jobId, error);
  }
}

export const processDeepAnalysisJob = inngest.createFunction(
  {
    id: 'deep-analysis',
    name: 'Deep Analysis - Comprehensive Cold Case Investigation',
    retries: 2,
    concurrency: {
      limit: 2, // Limit deep analysis to 2 concurrent jobs (resource intensive)
    },
  },
  { event: 'analysis/deep-analysis' },
  async ({ event, step }) => {
    const { jobId, caseId } = event.data as DeepAnalysisEventData;

    const totalUnits = 4; // Fetch, Extract, Analyze, Save
    const initialMetadata = {
      analysisType: 'comprehensive_cold_case',
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
      const { caseData, documents, suspects, evidence } = await step.run('fetch-case-data', async () => {
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
          supabaseServer.from('suspects').select('*').eq('case_id', caseId),
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

        await updateProcessingJob(jobId, {
          completed_units: 1,
        });

        return { caseData, documents: documents || [], suspects: suspects || [], evidence: evidence || [] };
      });

      // Step 3: Extract document content
      const { extractionResults, queuedForReview } = await step.run('extract-content', async () => {
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

        await updateProcessingJob(jobId, {
          completed_units: 2,
        });

        return { extractionResults, queuedForReview };
      });

      // Step 4: Run comprehensive analysis
      const analysis = await step.run('run-comprehensive-analysis', async () => {
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

        await updateProcessingJob(jobId, {
          completed_units: 3,
        });

        return analysis;
      });

      // Step 5: Save analysis results
      await step.run('save-results', async () => {
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
        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
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
        });
      });

      return {
        success: true,
        jobId,
      };
    } catch (error: any) {
      await updateProcessingJob(jobId, {
        status: 'failed',
        failed_units: 1,
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          error: error?.message || 'Deep analysis failed',
        },
      });

      console.error('[DeepAnalysisJob] Failed to process deep analysis:', error);
      throw error;
    }
  }
);
