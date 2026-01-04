/**
 * Inngest Job: Full Analysis Pipeline
 *
 * Orchestrates the complete case analysis pipeline:
 * 1. Document processing
 * 2. Entity resolution
 * 3. Statement parsing
 * 4. Inconsistency detection
 * 5. Timeline generation
 * 6. DNA processing
 *
 * Each phase can be run independently or as part of the full pipeline.
 */

import { inngest, sendInngestEvent } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { v4 as uuidv4 } from 'uuid';

interface FullPipelineEventData {
  jobId: string;
  caseId: string;
  phases?: ('documents' | 'entities' | 'statements' | 'inconsistencies' | 'timelines' | 'dna')[];
}

const ALL_PHASES = ['documents', 'entities', 'statements', 'inconsistencies', 'timelines', 'dna'] as const;

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'FullPipelineJob');
}

export const processFullPipelineJob = inngest.createFunction(
  {
    id: 'full-analysis-pipeline',
    name: 'Full Analysis Pipeline - Comprehensive Case Processing',
    retries: 1, // Single retry since sub-jobs have their own retries
    concurrency: {
      limit: 1, // Only one full pipeline per case at a time
    },
  },
  { event: 'analysis/full-pipeline' },
  async ({ event, step }) => {
    const { jobId, caseId, phases } = event.data as FullPipelineEventData;

    const selectedPhases = phases || ALL_PHASES;
    const totalPhases = selectedPhases.length;

    const initialMetadata = {
      analysisType: 'full_pipeline',
      requestedAt: new Date().toISOString(),
      phases: selectedPhases,
    };

    const phaseResults: Record<string, any> = {};

    try {
      // Initialize job
      await step.run('initialize-pipeline', async () => {
        console.log(`[Full Pipeline] Starting comprehensive analysis for case ${caseId}`);
        console.log(`[Full Pipeline] Phases: ${selectedPhases.join(', ')}`);

        await updateProcessingJob(jobId, {
          status: 'running',
          total_units: totalPhases,
          started_at: new Date().toISOString(),
          metadata: initialMetadata,
        });
      });

      let completedPhases = 0;

      // Phase 1: Document Processing
      if (selectedPhases.includes('documents')) {
        phaseResults.documents = await step.run('phase-documents', async () => {
          console.log(`[Full Pipeline] Phase 1: Document Processing`);

          // Get all documents that need processing
          const { data: docs, error } = await supabaseServer
            .from('case_files')
            .select('id')
            .eq('case_id', caseId)
            .or('processing_status.is.null,processing_status.eq.pending');

          if (error) {
            throw new Error(`Failed to get documents: ${error.message}`);
          }

          const documentIds = docs?.map(d => d.id) || [];

          if (documentIds.length === 0) {
            console.log(`[Full Pipeline] No documents need processing`);
            return { skipped: true, reason: 'No pending documents' };
          }

          // Create batch session
          const sessionId = uuidv4();
          await supabaseServer.from('batch_processing_sessions').insert({
            id: sessionId,
            case_id: caseId,
            total_documents: documentIds.length,
            status: 'pending',
          });

          // Trigger batch processing job
          await sendInngestEvent('batch/process-documents', {
            sessionId,
            caseId,
            documentIds,
            options: {
              extractEntities: true,
              parseStatements: false, // Done in separate phase
            },
          });

          console.log(`[Full Pipeline] Started batch processing for ${documentIds.length} documents`);

          return {
            sessionId,
            documentCount: documentIds.length,
            status: 'triggered',
          };
        });

        completedPhases++;
        await updateProcessingJob(jobId, {
          completed_units: completedPhases,
          progress_percentage: Math.round((completedPhases / totalPhases) * 100),
        });

        // Wait for documents to be processed (with timeout)
        if (!phaseResults.documents.skipped) {
          await step.sleep('wait-for-documents', '5m'); // Wait up to 5 minutes
        }
      }

      // Phase 2: Entity Resolution
      if (selectedPhases.includes('entities')) {
        phaseResults.entities = await step.run('phase-entities', async () => {
          console.log(`[Full Pipeline] Phase 2: Entity Resolution`);

          const entityJobId = uuidv4();

          // Create processing job record
          await supabaseServer.from('processing_jobs').insert({
            id: entityJobId,
            case_id: caseId,
            job_type: 'entity_resolution',
            status: 'pending',
          });

          // Trigger entity resolution
          await sendInngestEvent('analysis/entity-resolution', {
            jobId: entityJobId,
            caseId,
            options: {
              fuzzyThreshold: 0.8,
              usePhonemicMatching: true,
              useAIDisambiguation: true,
            },
          });

          return { jobId: entityJobId, status: 'triggered' };
        });

        completedPhases++;
        await updateProcessingJob(jobId, {
          completed_units: completedPhases,
          progress_percentage: Math.round((completedPhases / totalPhases) * 100),
        });

        await step.sleep('wait-for-entities', '2m');
      }

      // Phase 3: Statement Parsing
      if (selectedPhases.includes('statements')) {
        phaseResults.statements = await step.run('phase-statements', async () => {
          console.log(`[Full Pipeline] Phase 3: Statement Parsing`);

          const statementJobId = uuidv4();

          await supabaseServer.from('processing_jobs').insert({
            id: statementJobId,
            case_id: caseId,
            job_type: 'statement_parsing',
            status: 'pending',
          });

          await sendInngestEvent('analysis/parse-statements', {
            jobId: statementJobId,
            caseId,
            options: {
              extractClaims: true,
              identifySpeaker: true,
              extractTimeReferences: true,
            },
          });

          return { jobId: statementJobId, status: 'triggered' };
        });

        completedPhases++;
        await updateProcessingJob(jobId, {
          completed_units: completedPhases,
          progress_percentage: Math.round((completedPhases / totalPhases) * 100),
        });

        await step.sleep('wait-for-statements', '3m');
      }

      // Phase 4: Inconsistency Detection
      if (selectedPhases.includes('inconsistencies')) {
        phaseResults.inconsistencies = await step.run('phase-inconsistencies', async () => {
          console.log(`[Full Pipeline] Phase 4: Inconsistency Detection`);

          const inconsistencyJobId = uuidv4();

          await supabaseServer.from('processing_jobs').insert({
            id: inconsistencyJobId,
            case_id: caseId,
            job_type: 'inconsistency_detection',
            status: 'pending',
          });

          await sendInngestEvent('analysis/detect-inconsistencies', {
            jobId: inconsistencyJobId,
            caseId,
            options: {
              detectSelfContradictions: true,
              detectCrossWitness: true,
              detectAlibiIssues: true,
              trackClaimEvolution: true,
            },
          });

          return { jobId: inconsistencyJobId, status: 'triggered' };
        });

        completedPhases++;
        await updateProcessingJob(jobId, {
          completed_units: completedPhases,
          progress_percentage: Math.round((completedPhases / totalPhases) * 100),
        });

        await step.sleep('wait-for-inconsistencies', '3m');
      }

      // Phase 5: Timeline Generation
      if (selectedPhases.includes('timelines')) {
        phaseResults.timelines = await step.run('phase-timelines', async () => {
          console.log(`[Full Pipeline] Phase 5: Timeline Generation`);

          const timelineJobId = uuidv4();

          await supabaseServer.from('processing_jobs').insert({
            id: timelineJobId,
            case_id: caseId,
            job_type: 'timeline_generation',
            status: 'pending',
          });

          await sendInngestEvent('analysis/generate-timelines', {
            jobId: timelineJobId,
            caseId,
            options: {
              detectGaps: true,
              minGapDurationMinutes: 30,
              includeInconsistencies: true,
              assessCredibility: true,
            },
          });

          return { jobId: timelineJobId, status: 'triggered' };
        });

        completedPhases++;
        await updateProcessingJob(jobId, {
          completed_units: completedPhases,
          progress_percentage: Math.round((completedPhases / totalPhases) * 100),
        });

        await step.sleep('wait-for-timelines', '3m');
      }

      // Phase 6: DNA Processing
      if (selectedPhases.includes('dna')) {
        phaseResults.dna = await step.run('phase-dna', async () => {
          console.log(`[Full Pipeline] Phase 6: DNA Processing`);

          const dnaJobId = uuidv4();

          await supabaseServer.from('processing_jobs').insert({
            id: dnaJobId,
            case_id: caseId,
            job_type: 'dna_processing',
            status: 'pending',
          });

          await sendInngestEvent('analysis/process-dna', {
            jobId: dnaJobId,
            caseId,
            options: {
              compareProfiles: true,
              findMatches: true,
              generateReport: true,
            },
          });

          return { jobId: dnaJobId, status: 'triggered' };
        });

        completedPhases++;
        await updateProcessingJob(jobId, {
          completed_units: completedPhases,
          progress_percentage: Math.round((completedPhases / totalPhases) * 100),
        });
      }

      // Finalize
      await step.run('finalize-pipeline', async () => {
        console.log(`[Full Pipeline] Finalizing pipeline`);

        // Wait a bit for sub-jobs to complete
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Get summary statistics
        const { data: entities } = await supabaseServer
          .from('canonical_entities')
          .select('id')
          .eq('case_id', caseId);

        const { data: inconsistencies } = await supabaseServer
          .from('claim_inconsistencies')
          .select('id')
          .eq('case_id', caseId);

        const { data: timelineEvents } = await supabaseServer
          .from('person_timeline_events')
          .select('id')
          .eq('case_id', caseId);

        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalPhases,
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            phaseResults,
            summary: {
              entitiesResolved: entities?.length || 0,
              inconsistenciesDetected: inconsistencies?.length || 0,
              timelineEventsCreated: timelineEvents?.length || 0,
            },
          },
        });
      });

      console.log(`[Full Pipeline] Job ${jobId} completed successfully`);

      return {
        success: true,
        jobId,
        phases: phaseResults,
      };

    } catch (error: any) {
      await updateProcessingJob(jobId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          phaseResults,
          error: error.message,
        },
      });

      console.error(`[Full Pipeline] Job ${jobId} failed:`, error);
      throw error;
    }
  }
);
