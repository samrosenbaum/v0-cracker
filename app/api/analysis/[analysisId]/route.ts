import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hasSupabaseServiceConfig } from '@/lib/environment';
import { deleteCaseAnalysis } from '@/lib/demo-data';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
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

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ analysisId: string }> | { analysisId: string } }
) {
  const params = await Promise.resolve(context.params);
  const { analysisId } = params;
  const useSupabase = hasSupabaseServiceConfig();

  if (!useSupabase) {
    // Delete from demo data
    const success = deleteCaseAnalysis(analysisId);
    if (!success) {
      return withCors(
        NextResponse.json(
          { error: `Analysis ${analysisId} not found in local dataset.` },
          { status: 404 }
        )
      );
    }

    return withCors(
      NextResponse.json({
        success: true,
        message: 'Analysis deleted successfully',
      })
    );
  }

  try {
    // Delete from Supabase
    const { error } = await supabaseServer
      .from('case_analysis')
      .delete()
      .eq('id', analysisId);

    if (error) {
      console.error('[Delete Analysis API] Error:', error);
      return withCors(
        NextResponse.json(
          { error: `Failed to delete analysis: ${error.message}` },
          { status: 500 }
        )
      );
    }

    return withCors(
      NextResponse.json({
        success: true,
        message: 'Analysis deleted successfully',
      })
    );
  } catch (error: any) {
    console.error('[Delete Analysis API] Error:', error);
    return withCors(
      NextResponse.json(
        { error: error.message || 'Failed to delete analysis' },
        { status: 500 }
      )
    );
  }
}
