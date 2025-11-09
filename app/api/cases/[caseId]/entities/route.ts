/**
 * API Route: Case Entities (People, Locations, Evidence, etc.)
 *
 * GET    /api/cases/[caseId]/entities - List all entities for a case
 * POST   /api/cases/[caseId]/entities - Create a new entity
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
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('type');
    const role = searchParams.get('role');

    let query = supabaseServer
      .from('case_entities')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    if (role) {
      query = query.eq('role', role);
    }

    const { data: entities, error } = await query;

    if (error) {
      console.error('[Entities API] Error fetching entities:', error);
      throw new Error(`Failed to fetch entities: ${error.message}`);
    }

    return NextResponse.json({
      success: true,
      entities: entities || [],
      count: entities?.length || 0,
    });
  } catch (error: any) {
    console.error('[Entities API] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to fetch entities',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const { caseId } = params;
    const body = await request.json();

    const {
      entity_type,
      name,
      role,
      description,
      image_url,
      color,
      icon,
      metadata,
    } = body;

    if (!entity_type || !name) {
      return NextResponse.json(
        { error: 'entity_type and name are required' },
        { status: 400 }
      );
    }

    const { data: entity, error } = await supabaseServer
      .from('case_entities')
      .insert({
        case_id: caseId,
        entity_type,
        name,
        role: role || null,
        description: description || null,
        image_url: image_url || null,
        color: color || null,
        icon: icon || null,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) {
      console.error('[Entities API] Error creating entity:', error);
      throw new Error(`Failed to create entity: ${error.message}`);
    }

    console.log(`[Entities API] Created entity: ${entity.id} (${entity.name})`);

    return NextResponse.json({
      success: true,
      entity,
    });
  } catch (error: any) {
    console.error('[Entities API] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to create entity',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
