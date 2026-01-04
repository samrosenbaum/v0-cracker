/**
 * Writer Profile Management API
 *
 * Manages writer profiles for calibrated handwriting recognition.
 * Each profile stores characteristic patterns for a specific writer
 * to improve recognition accuracy.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calibrateWriterProfile } from '@/lib/handwriting-recognition';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/handwriting/writer-profiles
 *
 * List all writer profiles or get a specific one
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('id');
    const caseId = searchParams.get('caseId');

    let query = supabase.from('writer_profiles').select('*');

    if (profileId) {
      query = query.eq('id', profileId);
    }
    if (caseId) {
      query = query.eq('case_id', caseId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: profileId && data?.length === 1 ? data[0] : data,
    });

  } catch (error: any) {
    console.error('[API/WriterProfiles] GET error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/handwriting/writer-profiles
 *
 * Create a new writer profile
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      caseId,
      name,
      role,
      description,
      knownQuirks,
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Missing required field: name' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('writer_profiles')
      .insert({
        case_id: caseId,
        name,
        role,
        description,
        known_quirks: knownQuirks || [],
        sample_count: 0,
        average_confidence: 0,
        characteristic_patterns: [],
        calibrated: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
      message: 'Writer profile created. Add samples to calibrate.',
    });

  } catch (error: any) {
    console.error('[API/WriterProfiles] POST error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/handwriting/writer-profiles
 *
 * Update a writer profile
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, name, role, description, knownQuirks } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing required field: id' },
        { status: 400 }
      );
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (role !== undefined) updates.role = role;
    if (description !== undefined) updates.description = description;
    if (knownQuirks !== undefined) updates.known_quirks = knownQuirks;

    const { data, error } = await supabase
      .from('writer_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error: any) {
    console.error('[API/WriterProfiles] PUT error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/handwriting/writer-profiles?id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const profileId = searchParams.get('id');

    if (!profileId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: id' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('writer_profiles')
      .delete()
      .eq('id', profileId);

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Writer profile deleted',
    });

  } catch (error: any) {
    console.error('[API/WriterProfiles] DELETE error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
