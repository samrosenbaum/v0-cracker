/**
 * API Route: Individual Connection Operations
 *
 * PUT    /api/cases/[caseId]/connections/[connectionId] - Update connection
 * DELETE /api/cases/[caseId]/connections/[connectionId] - Delete connection
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function PUT(
  request: NextRequest,
  { params }: { params: { caseId: string; connectionId: string } }
) {
  try {
    const { connectionId } = params;
    const body = await request.json();

    const updates = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    delete updates.id;
    delete updates.case_id;
    delete updates.created_at;
    delete updates.created_by;

    const { data, error } = await supabaseServer
      .from('case_connections')
      .update(updates)
      .eq('id', connectionId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, connection: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { caseId: string; connectionId: string } }
) {
  try {
    const { connectionId } = params;

    const { error } = await supabaseServer
      .from('case_connections')
      .delete()
      .eq('id', connectionId);

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
