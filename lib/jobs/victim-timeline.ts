import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { generateComprehensiveVictimTimeline } from '@/lib/victim-timeline';
import { extractMultipleDocuments, queueDocumentForReview } from '@/lib/document-parser';

type ExtractionResult = Awaited<ReturnType<typeof extractMultipleDocuments>> extends Map<string, infer R>
  ? R
  : never;

function hasMeaningfulExtraction(extraction?: ExtractionResult | null): extraction is ExtractionResult {
  if (!extraction?.text) {
    return false;
  }

  const normalized = extraction.text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return false;
  }

  return !/^\[(?:no extracted|no extractable|could not extract)/i.test(normalized);
}

interface VictimTimelineEventData {
  jobId: string;
  caseId: string;
  victimInfo: {
    name: string;
    incidentTime: string;
    incidentLocation?: string | null;
    typicalRoutine?: string | null;
    knownHabits?: string | null;
    regularContacts?: string[] | null;
  };
  requestContext?: {
    digitalRecords?: any;
  };
  requestedAt: string;
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'VictimTimelineJob');
}

export const processVictimTimelineJob = inngest.createFunction(
  {
    id: 'victim-timeline-generate',
    name: 'Generate Victim Timeline Reconstruction',
    retries: 2,
    concurrency: {
      limit: 2,
    },
  },
  { event: 'analysis/victim-timeline' },
  async ({ event, step }) => {
    const { jobId, caseId, victimInfo, requestContext, requestedAt } =
      event.data as VictimTimelineEventData;

    const totalUnits = 4;
    const initialMetadata = {
      analysisType: 'victim_timeline',
      victimName: victimInfo.name,
      incidentTime: victimInfo.incidentTime,
      incidentLocation: victimInfo.incidentLocation,
      requestedAt,
    };

    try {
      await step.run('initialize-job', async () => {
        await updateProcessingJob(jobId, {
          status: 'running',
          total_units: totalUnits,
          started_at: new Date().toISOString(),
          metadata: initialMetadata,
        });
      });

      const { documents, files } = await step.run('fetch-case-data', async () => {
        const { data: documents, error: docError } = await supabaseServer
          .from('case_documents')
          .select('*')
          .eq('case_id', caseId);

        if (docError) {
          throw new Error(`Failed to fetch case documents: ${docError.message}`);
        }

        const { data: files, error: fileError } = await supabaseServer
          .from('case_files')
          .select('*')
          .eq('case_id', caseId);

        if (fileError) {
          throw new Error(`Failed to fetch case files: ${fileError.message}`);
        }

        await updateProcessingJob(jobId, {
          completed_units: 1,
          progress_percentage: Math.round((1 / totalUnits) * 100),
        });

        return { documents: documents || [], files: files || [] };
      });

      const { extractionResults } = await step.run('extract-documents', async () => {
        const storagePaths = documents
          .map((doc) => doc.storage_path)
          .filter((path): path is string => typeof path === 'string' && path.length > 0);

        if (storagePaths.length === 0) {
          await updateProcessingJob(jobId, {
            completed_units: 2,
            progress_percentage: Math.round((2 / totalUnits) * 100),
          });

          return { extractionResults: new Map<string, ExtractionResult>(), queuedForReview: 0 };
        }

        console.log(
          `[VictimTimelineJob] Extracting content from ${storagePaths.length} document(s) before analysis...`
        );

        const extractionResults = await extractMultipleDocuments(storagePaths, 5);

        let queuedForReview = 0;
        for (const doc of documents) {
          if (!doc.storage_path) continue;
          const extraction = extractionResults.get(doc.storage_path);
          if (extraction?.needsReview && doc.id) {
            try {
              const queued = await queueDocumentForReview(doc.id, caseId, extraction);
              if (queued) {
                queuedForReview++;
              }
            } catch (queueError) {
              console.error('[VictimTimelineJob] Failed to queue document for review:', queueError);
            }
          }
        }

        if (queuedForReview > 0) {
          console.log(`[VictimTimelineJob] Queued ${queuedForReview} document(s) for human review`);
        }

        await updateProcessingJob(jobId, {
          completed_units: 2,
          progress_percentage: Math.round((2 / totalUnits) * 100),
        });

        return { extractionResults, queuedForReview };
      });

      const docsForAnalysis = documents.map((doc) => {
        const extraction = doc.storage_path ? extractionResults.get(doc.storage_path) : undefined;

        let content = '';
        if (hasMeaningfulExtraction(extraction)) {
          content = extraction.text;
        }

        const metadataValue: Record<string, any> =
          doc.metadata && typeof doc.metadata === 'object' && !Array.isArray(doc.metadata)
            ? { ...(doc.metadata as Record<string, any>) }
            : {};

        if (!content) {
          const candidateKeys = ['extracted_text', 'extractedText', 'text', 'content', 'transcript', 'body', 'notes', 'summary'];
          for (const key of candidateKeys) {
            const value = metadataValue[key];
            if (typeof value === 'string' && value.trim().length > 0) {
              content = value;
              break;
            }
          }
        }

        if (!content) {
          content = `[Could not extract text from ${doc.file_name}]`;
        }

        const metadata: Record<string, any> = { ...metadataValue };

        if (doc.storage_path) {
          metadata.storagePath = doc.storage_path;
        }

        if (extraction) {
          const extractionMetadata: Record<string, any> = {
            method: extraction.method,
            confidence: extraction.confidence ?? null,
            needsReview: extraction.needsReview ?? false,
            error: extraction.error || null,
          };

          if (extraction.uncertainSegments?.length) {
            extractionMetadata.uncertainSegments = extraction.uncertainSegments;
          }

          metadata.extraction = extractionMetadata;
        }

        return {
          filename: doc.file_name,
          content,
          type: doc.document_type || 'other',
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
        };
      });

      const totalExtractedCharacters = docsForAnalysis.reduce(
        (sum, doc) => sum + (doc.content?.length || 0),
        0
      );

      console.log(
        `[VictimTimelineJob] Prepared ${docsForAnalysis.length} document(s) (${totalExtractedCharacters.toLocaleString()} characters)`
      );

      const caseData = {
        documents: docsForAnalysis,
        witnesses: [],
        digitalRecords: requestContext?.digitalRecords || undefined,
        physicalEvidence: files.map(file => file.file_name),
      };

      const analysisResult = await step.run('generate-timeline', async () => {
        const result = await generateComprehensiveVictimTimeline(
          {
            name: victimInfo.name,
            incidentTime: victimInfo.incidentTime,
            incidentLocation: victimInfo.incidentLocation || undefined,
            typicalRoutine: victimInfo.typicalRoutine || undefined,
            knownHabits: victimInfo.knownHabits || undefined,
            regularContacts: victimInfo.regularContacts || undefined,
          },
          caseData
        );

        await updateProcessingJob(jobId, {
          completed_units: 3,
          progress_percentage: Math.round((3 / totalUnits) * 100),
        });

        return result;
      });

      await step.run('persist-results', async () => {
        const timelineInserts = analysisResult.timeline.movements.map(movement => ({
          case_id: caseId,
          title: movement.activity.substring(0, 100),
          description: movement.activity,
          type: 'victim_movement',
          date: movement.timestamp.split('T')[0],
          time: new Date(movement.timestamp).toLocaleTimeString(),
          location: movement.location,
          personnel: [...movement.witnessedBy, ...movement.accompaniedBy].join(', '),
          tags: [...movement.witnessedBy, ...movement.accompaniedBy],
          status: movement.significance,
          priority: movement.significance,
        }));

        if (timelineInserts.length > 0) {
          const { error: timelineError } = await supabaseServer
            .from('evidence_events')
            .insert(timelineInserts);

          if (timelineError) {
            console.error('[VictimTimelineJob] Error saving timeline:', timelineError);
          }
        }

        const gapFlags = analysisResult.timeline.timelineGaps
          .filter(gap => gap.significance === 'critical' || gap.significance === 'high')
          .map(gap => ({
            case_id: caseId,
            type: 'missing_data' as const,
            severity: gap.significance as 'low' | 'medium' | 'high' | 'critical',
            title: `Timeline gap: ${gap.durationMinutes} minutes unaccounted`,
            description: `Victim's whereabouts unknown between ${gap.lastKnownLocation} and ${gap.nextKnownLocation}`,
            recommendation: gap.questionsToAnswer.join('; '),
            metadata: {
              startTime: gap.startTime,
              endTime: gap.endTime,
              durationMinutes: gap.durationMinutes,
              potentialEvidence: gap.potentialEvidence,
            } as any,
          }));

        if (gapFlags.length > 0) {
          const { error: flagError } = await supabaseServer
            .from('quality_flags')
            .insert(gapFlags);

          if (flagError) {
            console.error('[VictimTimelineJob] Error saving gap flags:', flagError);
          }
        }

        const { error: analysisError } = await supabaseServer
          .from('case_analysis')
          .insert({
            case_id: caseId,
            analysis_type: 'victim_timeline',
            analysis_data: analysisResult as any,
            confidence_score: 0.85,
            used_prompt: 'Victim last movements reconstruction with gap analysis',
          });

        if (analysisError) {
          console.error('[VictimTimelineJob] Error saving analysis:', analysisError);
        }

        await updateProcessingJob(jobId, {
          completed_units: 4,
          progress_percentage: Math.round((4 / totalUnits) * 100),
        });
      });

      await step.run('finalize-job', async () => {
        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            timelineSummary: {
              totalMovements: analysisResult.timeline.movements.length,
              criticalGaps: analysisResult.timeline.timelineGaps.filter(
                gap => gap.significance === 'critical'
              ).length,
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
        progress_percentage: 100,
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          error: error?.message || 'Victim timeline analysis failed',
        },
      });

      console.error('[VictimTimelineJob] Failed to process victim timeline:', error);
      throw error;
    }
  }
);
