import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hasSupabaseServiceConfig, hasAnthropicConfig } from '@/lib/environment';
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

  const configStatus = {
    supabaseServiceKey: useSupabase,
    anthropicKey: hasAnthropicConfig(),
    openaiKey: Boolean(process.env.OPENAI_API_KEY),
  };

  const configWarnings: string[] = [];
  if (!useSupabase) {
    configWarnings.push('SUPABASE_SERVICE_ROLE_KEY is not set. The server cannot access uploaded documents for analysis.');
  }
  if (!configStatus.anthropicKey) {
    configWarnings.push('ANTHROPIC_API_KEY is not set. AI-powered analysis is unavailable; only rule-based heuristics will be used.');
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
        configStatus,
        configWarnings: configWarnings.length > 0 ? configWarnings : undefined,
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
        configStatus,
        configWarnings: configWarnings.length > 0 ? configWarnings : undefined,
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
        configStatus,
        configWarnings: [...configWarnings, 'Database query failed, showing cached/demo data.'],
      })
    );
  }
}
