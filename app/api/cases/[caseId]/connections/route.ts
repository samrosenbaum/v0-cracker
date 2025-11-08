/**
 * API Route: Case Connections
 *
 * GET    /api/cases/[caseId]/connections - List all connections
 * POST   /api/cases/[caseId]/connections - Create a connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await context.params;

    const { data, error } = await supabaseServer
      .from('case_connections')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, connections: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await context.params;
    const body = await request.json();

    const { data, error } = await supabaseServer
      .from('case_connections')
      .insert({ case_id: caseId, ...body })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, connection: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
