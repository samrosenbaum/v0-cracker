import { NextRequest, NextResponse, unstable_after } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hasSupabaseServiceConfig, hasPartialSupabaseConfig } from '@/lib/environment';
import { processDeepAnalysis } from '@/lib/workflows/deep-analysis';
import { listCaseDocuments, getStorageObject, addCaseAnalysis, getCaseById } from '@/lib/demo-data';
import { analyzeCaseDocuments } from '@/lib/ai-analysis';
import { fallbackDeepCaseAnalysis } from '@/lib/ai-fallback';
import { runBackgroundTask } from '@/lib/background-tasks';

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
        message: 'Deep Analysis endpoint is ready. Use POST method to run analysis.',
        endpoint: '/api/cases/[caseId]/deep-analysis',
        method: 'POST',
        description: 'Performs comprehensive cold case analysis with 8 analytical dimensions (async job)'
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
  const partialSupabaseConfig = hasPartialSupabaseConfig();
  if (!useSupabase && partialSupabaseConfig) {
    return withCors(
      NextResponse.json(
        {
          error:
            'Supabase service role key is missing. Deep analysis workflow cannot run without SUPABASE_SERVICE_ROLE_KEY.',
        },
        { status: 500 }
      )
    );
  }
  let resolvedCaseId = '';

  const runFallbackDeepAnalysis = async (caseId: string) => {
    const documents = listCaseDocuments(caseId).map((doc) => {
      const storage = doc.storage_path
        ? getStorageObject('case-files', doc.storage_path)
        : null;
      const content =
        storage?.content || (typeof doc.metadata?.extracted_text === 'string' ? doc.metadata.extracted_text : '');
      return {
        content: content || `Summary unavailable for ${doc.file_name}.`,
        filename: doc.file_name,
        type: doc.document_type,
      };
    });

    if (!documents.length) {
      return withCors(
        NextResponse.json(
          {
            error: 'No documents available for deep analysis. Upload files or configure Supabase connection.',
          },
          { status: 400 }
        )
      );
    }

    const baseAnalysis = await analyzeCaseDocuments(documents, caseId);
    const deepAnalysis = fallbackDeepCaseAnalysis(documents, baseAnalysis.timeline[0]?.date || new Date().toISOString());
    const now = new Date().toISOString();

    addCaseAnalysis({
      case_id: caseId,
      analysis_type: 'comprehensive_cold_case',
      analysis_data: deepAnalysis,
      confidence_score: 0.68,
      created_at: now,
      updated_at: now,
      used_prompt: 'Fallback comprehensive cold case analysis',
    });

    return withCors(
      NextResponse.json(
        {
          success: true,
          mode: 'instant',
          analysis: deepAnalysis,
          message: 'Generated using local deep analysis engine.',
        },
        { status: 200 }
      )
    );
  };

  try {
    // Handle both sync and async params for Next.js 14/15 compatibility
    const params = await Promise.resolve(context.params);
    const { caseId } = params;
    resolvedCaseId = caseId;

    console.log('[Deep Analysis API] Deep analysis requested for case:', caseId);

    if (!useSupabase) {
      const caseExists = getCaseById(caseId);
      if (!caseExists) {
        return withCors(
          NextResponse.json(
            { error: `Case ${caseId} not found in local dataset.` },
            { status: 404 }
          )
        );
      }
      return runFallbackDeepAnalysis(caseId);
    }

    // Create processing job record
    const now = new Date().toISOString();
    const initialMetadata = {
      analysisType: 'comprehensive_cold_case',
      requestedAt: now,
    };

    const { data: job, error: jobError } = await supabaseServer
      .from('processing_jobs')
      .insert({
        case_id: caseId,
        job_type: 'ai_analysis',
        status: 'pending',
        total_units: 4, // Fetch, Extract, Analyze, Save
        completed_units: 0,
        failed_units: 0,
        metadata: initialMetadata,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('[Deep Analysis API] Failed to create processing job:', jobError);
      return withCors(
        NextResponse.json(
          { error: 'Unable to schedule deep analysis job.' },
          { status: 500 }
        )
      );
    }

    // Trigger workflow in background after response flushes
    runBackgroundTask(
      async () => {
        await processDeepAnalysis({
          jobId: job.id,
          caseId,
        });
      },
      {
        label: 'Deep Analysis API',
        scheduler: unstable_after,
        onError: (error) => {
          console.error('[Deep Analysis API] Workflow failed:', error);
          // Workflow will update job status to 'failed' internally
        },
      }
    );

    // Return immediately with job ID
    return withCors(
      NextResponse.json(
        {
          success: true,
          jobId: job.id,
          status: 'pending',
          message:
            'Deep analysis workflow has been triggered. Check processing job status for progress.',
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('[Deep Analysis API] Error:', error);
    if (resolvedCaseId) {
      try {
        return await runFallbackDeepAnalysis(resolvedCaseId);
      } catch (fallbackError) {
        console.error('[Deep Analysis API] Fallback also failed:', fallbackError);
      }
    }
    return withCors(
      NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: 500 }
      )
    );
  }
}
