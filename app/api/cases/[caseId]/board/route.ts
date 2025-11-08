/**
 * API Route: Investigation Board Data
 *
 * GET /api/cases/[caseId]/board - Get all board data (entities, connections, timeline, alibis)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const { caseId } = params;

    // Fetch all board data in parallel
    const [entitiesResult, connectionsResult, timelineResult, alibisResult, summaryResult] = await Promise.all([
      supabaseServer.from('case_entities').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
      supabaseServer.from('case_connections').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
      supabaseServer.from('timeline_events').select('*').eq('case_id', caseId).order('event_time', { ascending: true }),
      supabaseServer.from('alibi_entries').select('*').eq('case_id', caseId).order('statement_date', { ascending: false }),
      supabaseServer.rpc('get_case_board_summary', { p_case_id: caseId })
    ]);

    if (entitiesResult.error) {
      throw new Error(`Failed to fetch entities: ${entitiesResult.error.message}`);
    }

    if (connectionsResult.error) {
      throw new Error(`Failed to fetch connections: ${connectionsResult.error.message}`);
    }

    if (timelineResult.error) {
      throw new Error(`Failed to fetch timeline: ${timelineResult.error.message}`);
    }

    if (alibisResult.error) {
      throw new Error(`Failed to fetch alibis: ${alibisResult.error.message}`);
    }

    return NextResponse.json({
      success: true,
      data: {
        entities: entitiesResult.data || [],
        connections: connectionsResult.data || [],
        timeline_events: timelineResult.data || [],
        alibis: alibisResult.data || [],
        summary: summaryResult.data || {},
      },
    });
  } catch (error: any) {
    console.error('[Board API] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch board data',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
