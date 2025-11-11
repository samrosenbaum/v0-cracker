import { NextRequest, NextResponse, unstable_after } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hasSupabaseServiceConfig, hasPartialSupabaseConfig } from '@/lib/environment';
import { processVictimTimeline } from '@/lib/workflows/victim-timeline';
import { listCaseDocuments, getStorageObject, addCaseAnalysis, getCaseById } from '@/lib/demo-data';
import { buildVictimTimelineFallback } from '@/lib/victim-timeline-fallback';
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
        message: 'Victim Timeline endpoint is ready. Use POST method to run analysis.',
        endpoint: '/api/cases/[caseId]/victim-timeline',
        method: 'POST',
        description: 'Reconstructs victim\'s last 24-48 hours with gap detection'
      },
      { status: 200 }
    )
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  let requestBody: any = null;
  try {
    const useSupabase = hasSupabaseServiceConfig();
    const partialSupabaseConfig = hasPartialSupabaseConfig();
    if (!useSupabase && partialSupabaseConfig) {
      return withCors(
        NextResponse.json(
          {
            error:
              'Supabase service role key is missing. Victim timeline workflow cannot run without SUPABASE_SERVICE_ROLE_KEY.',
          },
          { status: 500 }
        )
      );
    }
    const params = await Promise.resolve(context.params);
    const { caseId } = params;
    const body = await request.json();
    requestBody = body;
    // Get victim information from request
    const {
      victimName,
      incidentTime,
      incidentLocation,
      typicalRoutine,
      knownHabits,
      regularContacts,
    } = body;

    if (!victimName || !incidentTime) {
      return withCors(NextResponse.json(
        { error: 'victimName and incidentTime are required' },
        { status: 400 }
      ));
    }

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

      const documents = listCaseDocuments(caseId).map((doc) => {
        const storage = doc.storage_path
          ? getStorageObject('case-files', doc.storage_path)
          : null;
        return {
          file_name: doc.file_name,
          storage_path: doc.storage_path,
          content:
            storage?.content ||
            (typeof doc.metadata?.extracted_text === 'string' ? doc.metadata.extracted_text : ''),
        };
      });

      const fallbackResult = buildVictimTimelineFallback(
        {
          name: victimName,
          incidentTime,
          incidentLocation,
          typicalRoutine,
          knownHabits,
          regularContacts,
        },
        { documents, witnesses: [], digitalRecords: body.digitalRecords || null, physicalEvidence: [] }
      );

      const now = new Date().toISOString();
      addCaseAnalysis({
        case_id: caseId,
        analysis_type: 'victim_timeline',
        analysis_data: fallbackResult,
        confidence_score: 0.66,
        created_at: now,
        updated_at: now,
        used_prompt: 'Fallback victim timeline reconstruction',
      });

      return withCors(
        NextResponse.json(
          {
            success: true,
            mode: 'instant',
            analysis: fallbackResult,
            message: 'Generated using local victim timeline engine.',
          },
          { status: 200 }
        )
      );
    }

    const now = new Date().toISOString();
    const initialMetadata = {
      analysisType: 'victim_timeline',
      victimName,
      incidentTime,
      incidentLocation,
    };

    const { data: job, error: jobError } = await supabaseServer
      .from('processing_jobs')
      .insert({
        case_id: caseId,
        job_type: 'ai_analysis',
        status: 'pending',
        total_units: 4,
        completed_units: 0,
        failed_units: 0,
        metadata: initialMetadata,
      })
      .select()
      .single();

    if (jobError || !job) {
      console.error('Failed to create processing job for victim timeline:', jobError);
      return withCors(
        NextResponse.json(
          { error: 'Unable to schedule victim timeline analysis job.' },
          { status: 500 }
        )
      );
    }

    // Trigger workflow in background after the response flushes
    runBackgroundTask(
      async () => {
        await processVictimTimeline({
          jobId: job.id,
          caseId,
          victimInfo: {
            name: victimName,
            incidentTime,
            incidentLocation,
            typicalRoutine,
            knownHabits,
            regularContacts,
          },
          requestContext: {
            digitalRecords: body.digitalRecords || null,
          },
          requestedAt: now,
        });
      },
      {
        label: 'Victim Timeline API',
        scheduler: unstable_after,
        onError: (error) => {
          console.error('[Victim Timeline API] Workflow failed:', error);
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
          message:
            'Victim timeline workflow has been triggered. Check processing job status for progress.',
        },
        { status: 202 }
      )
    );
  } catch (error: any) {
    console.error('Victim timeline error:', error);
    const params = await Promise.resolve(context.params);
    const { caseId } = params;
    try {
      const documents = listCaseDocuments(caseId).map((doc) => {
        const storage = doc.storage_path
          ? getStorageObject('case-files', doc.storage_path)
          : null;
        return {
          file_name: doc.file_name,
          storage_path: doc.storage_path,
          content:
            storage?.content ||
            (typeof doc.metadata?.extracted_text === 'string' ? doc.metadata.extracted_text : ''),
        };
      });

      const fallbackResult = buildVictimTimelineFallback(
        {
          name: requestBody?.victimName || 'Unknown Victim',
          incidentTime: requestBody?.incidentTime || new Date().toISOString(),
          incidentLocation: requestBody?.incidentLocation,
          typicalRoutine: requestBody?.typicalRoutine,
          knownHabits: requestBody?.knownHabits,
          regularContacts: requestBody?.regularContacts,
        },
        {
          documents,
          witnesses: [],
          digitalRecords: requestBody?.digitalRecords || null,
          physicalEvidence: [],
        }
      );

      const now = new Date().toISOString();
      addCaseAnalysis({
        case_id: caseId,
        analysis_type: 'victim_timeline',
        analysis_data: fallbackResult,
        confidence_score: 0.66,
        created_at: now,
        updated_at: now,
        used_prompt: 'Fallback victim timeline reconstruction',
      });

      return withCors(
        NextResponse.json(
          {
            success: true,
            mode: 'instant',
            analysis: fallbackResult,
            message: 'Generated using local victim timeline engine after primary failure.',
          },
          { status: 200 }
        )
      );
    } catch (fallbackError) {
      console.error('Fallback victim timeline generation failed:', fallbackError);
    }

    return withCors(NextResponse.json(
      { error: error.message || 'Timeline analysis failed' },
      { status: 500 }
    ));
  }
}
