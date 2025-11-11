import { NextRequest, NextResponse, unstable_after } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hasSupabaseServiceConfig } from '@/lib/environment';
import { processTimelineAnalysis } from '@/lib/workflows/timeline-analysis';
import { runBackgroundTask } from '@/lib/background-tasks';
import {
  listCaseDocuments,
  getStorageObject,
  addCaseAnalysis,
  getCaseById,
  addProcessingJob,
  updateProcessingJob,
  getProcessingJob as getDemoProcessingJob,
} from '@/lib/demo-data';
import {
  analyzeCaseDocuments,
  detectTimeConflicts,
  identifyOverlookedSuspects,
  generateConflictSummary,
} from '@/lib/ai-analysis';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function withCors(response: NextResponse) {
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

export async function GET() {
  return withCors(
    NextResponse.json(
      {
        message: 'Analysis endpoint is ready. Use POST method to run analysis.',
        endpoint: '/api/cases/[caseId]/analyze',
        method: 'POST',
        description: 'Analyzes case documents and extracts timeline events and conflicts (async job)',
      },
      { status: 200 }
    )
  );
}

async function resolveDocumentContent(
  storagePath?: string | null,
  metadata?: Record<string, any>
): Promise<string> {
  if (metadata) {
    const textLikeFields = ['extracted_text', 'text', 'content', 'body', 'summary'];
    for (const field of textLikeFields) {
      const value = metadata[field];
      if (typeof value === 'string' && value.trim().length > 0) {
        return value;
      }
    }
  }

  if (!storagePath) {
    return '';
  }

  try {
    const { data, error } = await supabaseServer.storage
      .from('case-files')
      .download(storagePath);

    if (!error && data) {
      const buffer = Buffer.from(await data.arrayBuffer());
      const text = buffer.toString('utf-8');
      if (text.trim().length > 0) {
        return text;
      }
    }
  } catch (storageError) {
    console.warn('[Timeline Analysis API] Failed to download from storage:', storageError);
  }

  const fallbackObject = getStorageObject('case-files', storagePath);
  if (fallbackObject?.content) {
    return fallbackObject.content;
  }

  return '';
}

async function gatherDocumentsForAnalysis(caseId: string, preferSupabase: boolean) {
  if (preferSupabase) {
    try {
      const { data: supabaseDocs, error: docError } = await supabaseServer
        .from('case_documents')
        .select('file_name, document_type, storage_path, metadata')
        .eq('case_id', caseId);

      if (!docError && supabaseDocs && supabaseDocs.length > 0) {
        const documents: { content: string; filename: string; type: string }[] = [];
        for (const doc of supabaseDocs) {
          const content = await resolveDocumentContent(doc.storage_path, doc.metadata);
          documents.push({
            content: content || `[No extracted text available for ${doc.file_name}]`,
            filename: doc.file_name,
            type: doc.document_type || 'other',
          });
        }
        if (documents.length > 0) {
          return documents;
        }
      }
    } catch (error) {
      console.error('[Timeline Analysis API] Failed to gather documents from Supabase:', error);
    }
  }

  const demoDocs = listCaseDocuments(caseId);
  return demoDocs.map((doc) => {
    const storage = doc.storage_path
      ? getStorageObject('case-files', doc.storage_path)
      : null;
    const content =
      (typeof doc.metadata?.extracted_text === 'string' && doc.metadata.extracted_text) ||
      storage?.content ||
      '';

    return {
      content: content || `Summary unavailable for ${doc.file_name}.`,
      filename: doc.file_name,
      type: doc.document_type || 'other',
    };
  });
}

async function runFallbackAnalysis(
  caseId: string,
  options: {
    reason?: string;
    useSupabase: boolean;
    existingJobId?: string | null;
  }
) {
  const { reason = 'fallback', useSupabase, existingJobId } = options;
  console.log('[Timeline Analysis API] Running fallback timeline analysis:', {
    caseId,
    reason,
    existingJobId,
    mode: useSupabase ? 'supabase' : 'demo',
  });

  const caseRecord = useSupabase ? null : getCaseById(caseId);

  if (!useSupabase && !caseRecord) {
    return withCors(
      NextResponse.json(
        { error: `Case ${caseId} not found in local dataset.` },
        { status: 404 }
      )
    );
  }

  const documents = await gatherDocumentsForAnalysis(caseId, useSupabase);

  if (!documents.length) {
    return withCors(
      NextResponse.json(
        {
          error: 'No documents available for analysis. Upload files or configure Supabase connection.',
        },
        { status: 400 }
      )
    );
  }

  const analysis = await analyzeCaseDocuments(documents, caseId);
  const timeConflicts = detectTimeConflicts(analysis.timeline);

  const combinedConflicts = [...analysis.conflicts];
  for (const conflict of timeConflicts) {
    const exists = combinedConflicts.some(
      (existing) =>
        existing.type === conflict.type &&
        existing.description === conflict.description &&
        existing.details === conflict.details
    );
    if (!exists) {
      combinedConflicts.push(conflict);
    }
  }

  let formalSuspects: string[] = [];
  if (useSupabase) {
    try {
      const { data: suspects, error: suspectError } = await supabaseServer
        .from('suspects')
        .select('name')
        .eq('case_id', caseId);
      if (!suspectError && suspects) {
        formalSuspects = suspects
          .map((suspect) => suspect?.name)
          .filter((name): name is string => Boolean(name));
      }
    } catch (error) {
      console.warn('[Timeline Analysis API] Unable to fetch suspects for fallback:', error);
    }
  }

  const overlookedSuspects = identifyOverlookedSuspects(
    analysis.personMentions,
    formalSuspects
  );

  const finalAnalysis = {
    ...analysis,
    conflicts: combinedConflicts,
    overlookedSuspects,
    conflictSummary: generateConflictSummary(combinedConflicts),
  };

  const totalUnits = 5;
  const now = new Date().toISOString();
  const summary = {
    totalEvents: finalAnalysis.timeline.length,
    totalConflicts: finalAnalysis.conflicts.length,
    criticalConflicts: finalAnalysis.conflicts.filter((c) => c.severity === 'critical').length,
    overlookedSuspects: overlookedSuspects.length,
  };

  let jobId: string | null = existingJobId || null;
  let analysisRecordId: string | null = null;

  if (useSupabase) {
    let existingJobMetadata: Record<string, any> = {};
    let existingStartedAt: string | null = null;

    if (existingJobId) {
      const { data: jobRecord } = await supabaseServer
        .from('processing_jobs')
        .select('metadata, started_at, total_units')
        .eq('id', existingJobId)
        .maybeSingle();

      existingJobMetadata = (jobRecord?.metadata as Record<string, any>) || {};
      existingStartedAt = jobRecord?.started_at || null;
    }

    if (jobId) {
      const { error: jobUpdateError } = await supabaseServer
        .from('processing_jobs')
        .update({
          status: 'completed',
          total_units: totalUnits,
          completed_units: totalUnits,
          failed_units: 0,
          started_at: existingStartedAt || now,
          completed_at: now,
          metadata: {
            ...existingJobMetadata,
            analysisType: 'timeline_and_conflicts',
            fallbackReason: reason,
            completedBy: 'timeline-fallback-engine',
            summary,
          },
        })
        .eq('id', jobId);

      if (jobUpdateError) {
        console.error('[Timeline Analysis API] Failed to update fallback job:', jobUpdateError);
      }
    } else {
      const { data: jobInsert, error: jobInsertError } = await supabaseServer
        .from('processing_jobs')
        .insert({
          case_id: caseId,
          job_type: 'ai_analysis',
          status: 'completed',
          total_units: totalUnits,
          completed_units: totalUnits,
          failed_units: 0,
          started_at: now,
          completed_at: now,
          metadata: {
            analysisType: 'timeline_and_conflicts',
            fallbackReason: reason,
            completedBy: 'timeline-fallback-engine',
            summary,
          },
        })
        .select('id')
        .single();

      if (jobInsertError) {
        console.error('[Timeline Analysis API] Failed to insert fallback job:', jobInsertError);
      } else {
        jobId = jobInsert?.id || null;
      }
    }

    const { data: analysisInsert, error: analysisError } = await supabaseServer
      .from('case_analysis')
      .insert({
        case_id: caseId,
        analysis_type: 'timeline_and_conflicts',
        analysis_data: finalAnalysis as any,
        confidence_score: 0.72,
        used_prompt: 'Timeline analysis fallback',
        created_at: now,
        updated_at: now,
      })
      .select('id')
      .single();

    if (analysisError) {
      console.error('[Timeline Analysis API] Failed to save fallback analysis:', analysisError);
    } else {
      analysisRecordId = analysisInsert?.id || null;
    }
  } else {
    if (jobId) {
      const demoJob = getDemoProcessingJob(jobId);
      updateProcessingJob(jobId, {
        status: 'completed',
        total_units: totalUnits,
        completed_units: totalUnits,
        failed_units: 0,
        progress_percentage: 100,
        started_at: demoJob?.started_at || now,
        completed_at: now,
        metadata: {
          ...(demoJob?.metadata || {}),
          analysisType: 'timeline_and_conflicts',
          fallbackReason: reason,
          completedBy: 'timeline-fallback-engine',
          summary,
        },
      });
    } else {
      const job = addProcessingJob({
        case_id: caseId,
        job_type: 'ai_analysis',
        status: 'completed',
        total_units: totalUnits,
        completed_units: totalUnits,
        failed_units: 0,
        progress_percentage: 100,
        started_at: now,
        completed_at: now,
        metadata: {
          analysisType: 'timeline_and_conflicts',
          fallbackReason: reason,
          completedBy: 'timeline-fallback-engine',
          summary,
        },
      });
      jobId = job?.id || null;
    }

    const [analysisRecord] = addCaseAnalysis({
      case_id: caseId,
      analysis_type: 'timeline_and_conflicts',
      analysis_data: finalAnalysis,
      confidence_score: 0.68,
      created_at: now,
      updated_at: now,
      used_prompt: 'Fallback timeline analysis',
    });
    analysisRecordId = analysisRecord?.id || null;
  }

  return withCors(
    NextResponse.json(
      {
        success: true,
        mode: 'instant',
        jobId,
        analysis: finalAnalysis,
        analysisId: analysisRecordId,
        message: 'Generated using local timeline analysis engine.',
      },
      { status: 200 }
    )
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  const useSupabase = hasSupabaseServiceConfig();
  let resolvedCaseId = '';
  let createdJobId: string | null = null;

  try {
    const params = await Promise.resolve(context.params);
    const { caseId } = params;

    if (!caseId) {
      return withCors(
        NextResponse.json(
          { error: 'Case ID is required' },
          { status: 400 }
        )
      );
    }

    resolvedCaseId = caseId;
    console.log('[Timeline Analysis API] Starting analysis for case:', caseId);

    if (!useSupabase) {
      return await runFallbackAnalysis(caseId, {
        reason: 'supabase-not-configured',
        useSupabase,
      });
    }

    const anthropicKey =
      process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;

    if (!anthropicKey) {
      console.warn('[Timeline Analysis API] Missing Anthropic API key - using fallback analysis.');
      return await runFallbackAnalysis(caseId, {
        reason: 'missing-anthropic-key',
        useSupabase,
      });
    }

    console.log('[Timeline Analysis API] Checking if case exists:', caseId);
    const { data: existingCase, error: caseCheckError } = await supabaseServer
      .from('cases')
      .select('id, title')
      .eq('id', caseId)
      .maybeSingle();

    if (caseCheckError) {
      console.error('[Timeline Analysis API] Error checking case:', caseCheckError);
      return await runFallbackAnalysis(caseId, {
        reason: 'case-lookup-failed',
        useSupabase,
      });
    }

    if (!existingCase) {
      console.error('[Timeline Analysis API] Case not found:', caseId);
      return withCors(
        NextResponse.json(
          {
            error: 'Case not found',
            details: `No case exists with ID: ${caseId}`,
            caseId,
          },
          { status: 404 }
        )
      );
    }

    console.log('[Timeline Analysis API] Case found:', existingCase.title);

    const now = new Date().toISOString();
    const initialMetadata = {
      analysisType: 'timeline_and_conflicts',
      requestedAt: now,
    };

    console.log('[Timeline Analysis API] Creating processing job...');
    const { data: job, error: jobError } = await supabaseServer
      .from('processing_jobs')
      .insert({
        case_id: caseId,
        job_type: 'ai_analysis',
        status: 'pending',
        total_units: 5,
        completed_units: 0,
        failed_units: 0,
        metadata: initialMetadata,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('[Timeline Analysis API] Failed to create processing job:', jobError);
      return await runFallbackAnalysis(caseId, {
        reason: 'job-create-failed',
        useSupabase,
      });
    }

    createdJobId = job.id;

    // Trigger workflow in background after response completes
    // With Workflow DevKit installed, this will use durable execution
    // Cron job acts as backup for any jobs that don't start
    runBackgroundTask(
      async () => {
        await processTimelineAnalysis({
          jobId: job.id,
          caseId,
        });
      },
      {
        label: 'Timeline Analysis API',
        scheduler: unstable_after,
        onError: (error) => {
          console.error('[Timeline Analysis API] Workflow failed:', error);
          // Workflow will update job status to 'failed' internally
        },
      }
    );

    return withCors(
      NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: 'pending',
          message: 'Timeline analysis workflow has been triggered. Check processing job status for progress.',
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('[Timeline Analysis API] Error:', error);
    if (resolvedCaseId) {
      try {
        return await runFallbackAnalysis(resolvedCaseId, {
          reason: 'exception',
          useSupabase,
          existingJobId: createdJobId,
        });
      } catch (fallbackError) {
        console.error('[Timeline Analysis API] Fallback also failed:', fallbackError);
      }
    }
    return withCors(
      NextResponse.json(
        { error: error?.message || 'Analysis failed' },
        { status: 500 }
      )
    );
  }
}
