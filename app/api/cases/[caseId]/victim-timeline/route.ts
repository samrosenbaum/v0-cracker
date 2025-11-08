import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { generateComprehensiveVictimTimeline } from '@/lib/victim-timeline';

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { caseId } = params;
    const body = await request.json();

    // Get victim information from request
    const {
      victimName,
      incidentTime,
      incidentLocation,
      typicalRoutine,
      knownHabits,
      regularContacts,
    } = body;

    if (!victimName || !incidentTime) {
      return NextResponse.json(
        { error: 'victimName and incidentTime are required' },
        { status: 400 }
      );
    }

    // Fetch case documents
    const { data: documents, error: docError } = await supabaseServer
      .from('case_documents')
      .select('*')
      .eq('case_id', caseId);

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    // Fetch case files (for evidence)
    const { data: files } = await supabaseServer
      .from('case_files')
      .select('*')
      .eq('case_id', caseId);

    // Prepare documents for analysis
    const docsForAnalysis = documents?.map(doc => ({
      filename: doc.file_name,
      content: `[Document content would be loaded from: ${doc.storage_path}]`,
      type: doc.document_type as any,
    })) || [];

    // Prepare case data
    const caseData = {
      documents: docsForAnalysis,
      witnesses: [], // Would be extracted from documents
      digitalRecords: body.digitalRecords || undefined,
      physicalEvidence: files?.map(f => f.file_name) || [],
    };

    // Run comprehensive timeline analysis
    const result = await generateComprehensiveVictimTimeline(
      {
        name: victimName,
        incidentTime,
        incidentLocation,
        typicalRoutine,
        knownHabits,
        regularContacts,
      },
      caseData
    );

    // Save timeline to database
    const timelineInserts = result.timeline.movements.map(movement => ({
      case_id: caseId,
      title: movement.activity.substring(0, 100),
      description: movement.activity,
      type: 'victim_movement',
      date: movement.timestamp.split('T')[0],
      time: new Date(movement.timestamp).toLocaleTimeString(),
      location: movement.location,
      personnel: [...movement.witnessedBy, ...movement.accompaniedBy].join(', '),
      tags: [...movement.witnessedBy, ...movement.accompaniedBy],
      status: movement.significance,
      priority: movement.significance,
    }));

    const { error: timelineError } = await supabaseServer
      .from('evidence_events')
      .insert(timelineInserts);

    if (timelineError) {
      console.error('Error saving timeline:', timelineError);
    }

    // Save timeline gaps as quality flags
    const gapFlags = result.timeline.timelineGaps
      .filter(gap => gap.significance === 'critical' || gap.significance === 'high')
      .map(gap => ({
        case_id: caseId,
        type: 'missing_data' as 'missing_data',
        severity: gap.significance as 'low' | 'medium' | 'high' | 'critical',
        title: `Timeline gap: ${gap.durationMinutes} minutes unaccounted`,
        description: `Victim's whereabouts unknown between ${gap.lastKnownLocation} and ${gap.nextKnownLocation}`,
        recommendation: gap.questionsToAnswer.join('; '),
        metadata: {
          startTime: gap.startTime,
          endTime: gap.endTime,
          durationMinutes: gap.durationMinutes,
          potentialEvidence: gap.potentialEvidence,
        } as any,
      }));

    if (gapFlags.length > 0) {
      const { error: flagError } = await supabaseServer
        .from('quality_flags')
        .insert(gapFlags);

      if (flagError) {
        console.error('Error saving gap flags:', flagError);
      }
    }

    // Save complete analysis
    const { error: analysisError } = await supabaseServer
      .from('case_analysis')
      .insert({
        case_id: caseId,
        analysis_type: 'victim_timeline',
        analysis_data: result as any,
        confidence_score: 0.85,
        used_prompt: 'Victim last movements reconstruction with gap analysis',
      });

    if (analysisError) {
      console.error('Error saving analysis:', analysisError);
    }

    return NextResponse.json({
      success: true,
      timeline: result.timeline,
      routineDeviations: result.routineDeviations,
      digitalFootprint: result.digitalFootprint,
      witnessValidation: result.witnessValidation,
      executiveSummary: result.executiveSummary,
      stats: {
        totalMovements: result.timeline.movements.length,
        criticalGaps: result.timeline.timelineGaps.filter(g => g.significance === 'critical').length,
        lastSeenPersons: result.timeline.lastSeenPersons.length,
        criticalAreas: result.timeline.criticalAreas.length,
        routineDeviations: result.routineDeviations.length,
      },
    });

  } catch (error: any) {
    console.error('Victim timeline error:', error);
    return NextResponse.json(
      { error: error.message || 'Timeline analysis failed' },
      { status: 500 }
    );
  }
}
