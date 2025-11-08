/**
 * API Route: Individual Entity Operations
 *
 * GET    /api/cases/[caseId]/entities/[entityId] - Get entity details
 * PUT    /api/cases/[caseId]/entities/[entityId] - Update entity
 * DELETE /api/cases/[caseId]/entities/[entityId] - Delete entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ caseId: string; entityId: string }> }
) {
  try {
    const { entityId } = await context.params;

    const { data: entity, error } = await supabaseServer
      .from('case_entities')
      .select('*')
      .eq('id', entityId)
      .single();

    if (error) {
      throw new Error(`Failed to fetch entity: ${error.message}`);
    }

    return NextResponse.json({ success: true, entity });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ caseId: string; entityId: string }> }
) {
  try {
    const { entityId } = await context.params;
    const body = await request.json();

    const updates = {
      ...body,
      updated_at: new Date().toISOString(),
    };

    // Remove fields that shouldn't be updated
    delete updates.id;
    delete updates.case_id;
    delete updates.created_at;
    delete updates.created_by;

    const { data: entity, error } = await supabaseServer
      .from('case_entities')
      .update(updates)
      .eq('id', entityId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update entity: ${error.message}`);
    }

    return NextResponse.json({ success: true, entity });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ caseId: string; entityId: string }> }
) {
  try {
    const { entityId } = await context.params;

    const { error } = await supabaseServer
      .from('case_entities')
      .delete()
      .eq('id', entityId);

    if (error) {
      throw new Error(`Failed to delete entity: ${error.message}`);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
