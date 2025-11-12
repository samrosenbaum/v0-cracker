/**
 * API Route: Investigation Board Data
 *
 * GET /api/cases/[caseId]/board - Get all board data (entities, connections, timeline, alibis)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { populateInvestigationBoardFromDocuments } from '@/lib/jobs/populate-investigation-board';
import { Database } from '@/app/types/database';

interface BoardResponseData {
  entities: Database['public']['Tables']['case_entities']['Row'][];
  connections: Database['public']['Tables']['case_connections']['Row'][];
  timeline_events: Database['public']['Tables']['timeline_events']['Row'][];
  alibis: Database['public']['Tables']['alibi_entries']['Row'][];
  summary: any;
}

async function fetchBoardRecords(caseId: string): Promise<BoardResponseData> {
  const [entitiesResult, connectionsResult, timelineResult, alibisResult, summaryResult] = await Promise.all([
    supabaseServer.from('case_entities').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
    supabaseServer.from('case_connections').select('*').eq('case_id', caseId).order('created_at', { ascending: false }),
    supabaseServer.from('timeline_events').select('*').eq('case_id', caseId).order('event_time', { ascending: true }),
    supabaseServer.from('alibi_entries').select('*').eq('case_id', caseId).order('statement_date', { ascending: false }),
    supabaseServer.rpc('get_case_board_summary', { p_case_id: caseId }),
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

  const summaryData = summaryResult.error ? {} : summaryResult.data || {};

  return {
    entities: entitiesResult.data || [],
    connections: connectionsResult.data || [],
    timeline_events: timelineResult.data || [],
    alibis: alibisResult.data || [],
    summary: summaryData,
  };
}

function isBoardDataEmpty(data: BoardResponseData) {
  return (
    data.entities.length === 0 &&
    data.connections.length === 0 &&
    data.timeline_events.length === 0 &&
    data.alibis.length === 0
  );
}

async function hasCaseContent(caseId: string) {
  const [{ data: caseFiles, error: caseFileError }, { data: caseDocuments, error: caseDocumentError }] = await Promise.all([
    supabaseServer
      .from('case_files')
      .select('id')
      .eq('case_id', caseId)
      .limit(1),
    supabaseServer
      .from('case_documents')
      .select('id')
      .eq('case_id', caseId)
      .limit(1),
  ]);

  if (caseFileError) {
    console.warn('[Board API] Unable to verify case files presence:', caseFileError);
  }
  if (caseDocumentError) {
    console.warn('[Board API] Unable to verify case documents presence:', caseDocumentError);
  }

  return Boolean((caseFiles && caseFiles.length > 0) || (caseDocuments && caseDocuments.length > 0));
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const { caseId } = params;

    const initialData = await fetchBoardRecords(caseId);

    if (isBoardDataEmpty(initialData) && (await hasCaseContent(caseId))) {
      console.log(`[Board API] No existing board data found for case ${caseId}. Attempting auto population.`);

      try {
        const populateResult = await populateInvestigationBoardFromDocuments({ caseId });
        const totalInserted =
          (populateResult?.entities || 0) +
          (populateResult?.events || 0) +
          (populateResult?.connections || 0) +
          (populateResult?.alibis || 0);

        if (totalInserted > 0) {
          const refreshedData = await fetchBoardRecords(caseId);
          return NextResponse.json({
            success: true,
            data: refreshedData,
            autoPopulated: true,
          });
        }
      } catch (populationError) {
        console.error('[Board API] Auto population failed:', populationError);
      }
    }

    return NextResponse.json({
      success: true,
      data: initialData,
      autoPopulated: false,
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
