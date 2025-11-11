import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hasSupabaseServiceConfig, hasPartialSupabaseConfig } from '@/lib/environment';
import { getCaseById, listCaseDocuments, listCaseAnalyses } from '@/lib/demo-data';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  const params = await Promise.resolve(context.params);
  const { caseId } = params;
  const useSupabase = hasSupabaseServiceConfig();

  if (hasPartialSupabaseConfig()) {
    return withCors(
      NextResponse.json(
        {
          error: 'Supabase service role key missing. Server-side analysis data cannot be fetched.',
        },
        { status: 500 }
      )
    );
  }

  if (!useSupabase) {
    const caseRecord = getCaseById(caseId);
    if (!caseRecord) {
      return withCors(
        NextResponse.json(
          { error: `Case ${caseId} not found in local dataset.` },
          { status: 404 }
        )
      );
    }

    const documents = listCaseDocuments(caseId);
    const analyses = listCaseAnalyses(caseId);

    return withCors(
      NextResponse.json({
        source: 'demo',
        case: caseRecord,
        documentCount: documents.length,
        analyses,
      })
    );
  }

  try {
    const [
      { data: caseRecord, error: caseError },
      { data: documents, error: docError },
      { data: analyses, error: analysisError },
    ] = await Promise.all([
      supabaseServer.from('cases').select('*').eq('id', caseId).maybeSingle(),
      supabaseServer.from('case_documents').select('id').eq('case_id', caseId),
      supabaseServer
        .from('case_analysis')
        .select('*')
        .eq('case_id', caseId)
        .order('created_at', { ascending: false }),
    ]);

    if (caseError) {
      throw new Error(caseError.message);
    }

    if (!caseRecord) {
      return withCors(
        NextResponse.json({ error: `Case ${caseId} not found.` }, { status: 404 })
      );
    }

    if (docError) {
      throw new Error(docError.message);
    }

    if (analysisError) {
      throw new Error(analysisError.message);
    }

    return withCors(
      NextResponse.json({
        source: 'supabase',
        case: caseRecord,
        documentCount: documents?.length || 0,
        analyses: analyses || [],
      })
    );
  } catch (error: any) {
    console.error('[Analysis Overview API] Falling back to demo dataset due to error:', error);
    const caseRecord = getCaseById(caseId);
    if (!caseRecord) {
      return withCors(
        NextResponse.json(
          { error: `Case ${caseId} not found in local dataset.` },
          { status: 404 }
        )
      );
    }
    const documents = listCaseDocuments(caseId);
    const analyses = listCaseAnalyses(caseId);
    return withCors(
      NextResponse.json({
        source: 'demo-fallback',
        case: caseRecord,
        documentCount: documents.length,
        analyses,
      })
    );
  }
}
