/**
 * API Route: Timeline Events
 *
 * GET    /api/cases/[caseId]/timeline - List timeline events
 * POST   /api/cases/[caseId]/timeline - Create timeline event
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { caseId } = params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    let query = supabaseServer
      .from('timeline_events')
      .select('*')
      .eq('case_id', caseId);

    if (startDate && endDate) {
      query = query.gte('event_time', startDate).lte('event_time', endDate);
    }

    const { data, error } = await query.order('event_time', { ascending: true });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, events: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { caseId } = params;
    const body = await request.json();

    const { data, error } = await supabaseServer
      .from('timeline_events')
      .insert({ case_id: caseId, ...body })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, event: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
