/**
 * Contradiction Detection API
 *
 * GET - Get detected contradictions
 * POST - Run contradiction detection
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  detectAllContradictions,
  getContradictionsForCase,
  getContradictionsForPerson,
  getUnresolvedContradictions,
  getCriticalContradictions
} from '@/lib/contradiction-engine';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const person = searchParams.get('person');
    const unresolved = searchParams.get('unresolved') === 'true';
    const critical = searchParams.get('critical') === 'true';

    let contradictions;

    if (person) {
      contradictions = await getContradictionsForPerson(caseId, person);
    } else if (unresolved) {
      contradictions = await getUnresolvedContradictions(caseId);
    } else if (critical) {
      contradictions = await getCriticalContradictions(caseId);
    } else {
      contradictions = await getContradictionsForCase(caseId);
    }

    // Calculate summary statistics
    const bySeverity = {
      critical: contradictions.filter(c => c.severity === 'critical').length,
      major: contradictions.filter(c => c.severity === 'major').length,
      significant: contradictions.filter(c => c.severity === 'significant').length,
      minor: contradictions.filter(c => c.severity === 'minor').length
    };

    const byType: Record<string, number> = {};
    contradictions.forEach(c => {
      byType[c.contradictionType] = (byType[c.contradictionType] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      contradictions,
      count: contradictions.length,
      bySeverity,
      byType
    });

  } catch (error) {
    console.error('Failed to get contradictions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve contradictions' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await request.json();

    const { action, contradictionId, resolution, notes, resolvedBy } = body;

    switch (action) {
      case 'detect':
        // Run full contradiction detection
        const result = await detectAllContradictions(caseId);
        return NextResponse.json({
          success: true,
          ...result
        });

      case 'resolve':
        // Resolve a specific contradiction
        if (!contradictionId || !resolution) {
          return NextResponse.json(
            { success: false, error: 'contradictionId and resolution required' },
            { status: 400 }
          );
        }

        const validResolutions = ['explained', 'confirmed_lie', 'error_in_record', 'dismissed'];
        if (!validResolutions.includes(resolution)) {
          return NextResponse.json(
            { success: false, error: `Invalid resolution. Use: ${validResolutions.join(', ')}` },
            { status: 400 }
          );
        }

        const { error: updateError } = await supabaseServer
          .from('fact_contradictions')
          .update({
            resolution_status: resolution,
            resolution_notes: notes,
            resolved_by: resolvedBy,
            resolved_at: new Date().toISOString()
          })
          .eq('id', contradictionId);

        if (updateError) {
          return NextResponse.json(
            { success: false, error: 'Failed to update contradiction' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Contradiction resolved'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: detect, resolve' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Failed to process contradiction action:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process request' },
      { status: 500 }
    );
  }
}
