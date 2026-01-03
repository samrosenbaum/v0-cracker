/**
 * Person Timelines API
 *
 * GET - Get all person timelines for a case
 * POST - Generate/refresh timelines
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  generatePersonTimeline,
  generateAllPersonTimelines,
  getPersonTimeline,
} from '@/lib/person-timeline-generator';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const { searchParams } = new URL(request.url);

    const entityId = searchParams.get('entityId');
    const role = searchParams.get('role');
    const includeDetails = searchParams.get('includeDetails') === 'true';

    // If requesting a specific person's timeline
    if (entityId) {
      const timeline = await getPersonTimeline(caseId, entityId);

      if (!timeline) {
        return NextResponse.json(
          { error: 'Timeline not found for this entity' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        timeline,
      });
    }

    // Otherwise, get summary of all person timelines
    let query = supabaseServer
      .from('canonical_entities')
      .select(`
        id,
        canonical_name,
        role,
        suspicion_score,
        mention_count,
        person_timeline_events(count),
        timeline_gaps(count)
      `)
      .eq('case_id', caseId)
      .eq('entity_type', 'person');

    if (role) {
      query = query.eq('role', role);
    }

    const { data: entities, error } = await query.order('mention_count', { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const summaries = (entities || []).map(e => ({
      entityId: e.id,
      personName: e.canonical_name,
      role: e.role,
      suspicionScore: e.suspicion_score,
      mentionCount: e.mention_count,
      eventCount: (e.person_timeline_events as any)?.[0]?.count || 0,
      gapCount: (e.timeline_gaps as any)?.[0]?.count || 0,
    }));

    return NextResponse.json({
      success: true,
      timelines: summaries,
      count: summaries.length,
    });

  } catch (error: any) {
    console.error('[Person Timelines API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch timelines' },
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

    const {
      entityId,
      generateAll,
      startTime,
      endTime,
      detectGaps,
      minGapDurationMinutes
    } = body;

    const options = {
      startTime: startTime ? new Date(startTime) : undefined,
      endTime: endTime ? new Date(endTime) : undefined,
      detectGaps: detectGaps !== false,
      minGapDurationMinutes: minGapDurationMinutes || 60,
      includeInconsistencies: true,
    };

    // Generate timeline for a specific person
    if (entityId) {
      const timeline = await generatePersonTimeline(caseId, entityId, options);

      return NextResponse.json({
        success: true,
        timeline,
        message: `Timeline generated with ${timeline.events.length} events and ${timeline.gaps.length} gaps`,
      });
    }

    // Generate timelines for all people
    if (generateAll) {
      const timelines = await generateAllPersonTimelines(caseId, options);

      return NextResponse.json({
        success: true,
        message: `Generated timelines for ${timelines.size} people`,
        count: timelines.size,
        summaries: Array.from(timelines.entries()).map(([id, t]) => ({
          entityId: id,
          personName: t.personName,
          eventCount: t.events.length,
          gapCount: t.gaps.length,
          inconsistencyCount: t.inconsistencies.length,
          credibilityScore: t.credibilityAssessment.overallScore,
        })),
      });
    }

    return NextResponse.json(
      { error: 'Either entityId or generateAll must be specified' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[Person Timelines API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate timeline' },
      { status: 500 }
    );
  }
}
