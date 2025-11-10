/**
 * API Route: Alibi Entries
 *
 * GET    /api/cases/[caseId]/alibis - List alibi entries
 * POST   /api/cases/[caseId]/alibis - Create alibi entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } },
) {
  try {
    const params = await Promise.resolve(context.params);
    const { caseId } = params;
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get('subject_id');

    let query = supabaseServer
      .from('alibi_entries')
      .select('*')
      .eq('case_id', caseId);

    if (subjectId) {
      query = query.eq('subject_entity_id', subjectId);
    }

    const { data, error } = await query.order('version_number', {
      ascending: true,
    });

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, alibis: data || [] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } },
) {
  try {
    const params = await Promise.resolve(context.params);
    const { caseId } = params;
    const body = await request.json();

    const { data, error } = await supabaseServer
      .from('alibi_entries')
      .insert({ case_id: caseId, ...body })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ success: true, alibi: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
