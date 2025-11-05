import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { analyzeCaseDocuments, detectTimeConflicts, identifyOverlookedSuspects, generateConflictSummary } from '@/lib/ai-analysis';

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { caseId } = params;

    // Fetch all case documents
    const { data: documents, error: docError } = await supabaseServer
      .from('case_documents')
      .select('*')
      .eq('case_id', caseId);

    if (docError) {
      return NextResponse.json({ error: docError.message }, { status: 500 });
    }

    if (!documents || documents.length === 0) {
      return NextResponse.json(
        { error: 'No documents found for this case' },
        { status: 404 }
      );
    }

    // For now, we'll simulate document content. In production, you'd fetch from storage
    const docsForAnalysis = documents.map(doc => ({
      content: `[Document content would be loaded from storage: ${doc.storage_path}]`,
      filename: doc.file_name,
      type: doc.document_type,
    }));

    // Run AI analysis
    const analysis = await analyzeCaseDocuments(docsForAnalysis);

    // Detect additional conflicts using our algorithm
    const timeConflicts = detectTimeConflicts(analysis.timeline);
    analysis.conflicts.push(...timeConflicts);

    // Identify overlooked suspects
    const { data: formalSuspects } = await supabaseServer
      .from('suspects')
      .select('name')
      .eq('case_id', caseId);

    const overlookedSuspects = identifyOverlookedSuspects(
      analysis.personMentions,
      formalSuspects?.map(s => s.name) || []
    );

    // Save timeline events to database
    const timelineInserts = analysis.timeline.map(event => ({
      case_id: caseId,
      title: event.description.substring(0, 100),
      description: event.description,
      type: event.sourceType,
      date: event.date,
      time: event.startTime || event.time,
      location: event.location,
      personnel: event.involvedPersons.join(', '),
      tags: event.involvedPersons,
      status: 'verified',
    }));

    const { error: timelineError } = await supabaseServer
      .from('evidence_events')
      .insert(timelineInserts);

    if (timelineError) {
      console.error('Error saving timeline:', timelineError);
    }

    // Save conflicts as quality flags
    const conflictInserts = analysis.conflicts.map(conflict => ({
      case_id: caseId,
      type: (conflict.type === 'time_inconsistency' ? 'inconsistency' :
            conflict.type === 'statement_contradiction' ? 'inconsistency' :
            conflict.type === 'alibi_conflict' ? 'inconsistency' : 'incomplete_analysis') as 'inconsistency' | 'incomplete_analysis',
      severity: conflict.severity as 'low' | 'medium' | 'high' | 'critical',
      title: conflict.description,
      description: conflict.details,
      recommendation: conflict.recommendation,
      affected_findings: conflict.affectedPersons,
      metadata: {
        conflictType: conflict.type,
        eventIds: conflict.events.map(e => e.id),
      } as any,
    }));

    const { error: flagError } = await supabaseServer
      .from('quality_flags')
      .insert(conflictInserts);

    if (flagError) {
      console.error('Error saving quality flags:', flagError);
    }

    // Save analysis results
    const { error: analysisError } = await supabaseServer
      .from('case_analysis')
      .insert({
        case_id: caseId,
        analysis_type: 'timeline',
        analysis_data: {
          timeline: analysis.timeline,
          conflicts: analysis.conflicts,
          personMentions: analysis.personMentions,
          unfollowedTips: analysis.unfollowedTips,
          keyInsights: analysis.keyInsights,
          suspectAnalysis: analysis.suspectAnalysis,
          overlookedSuspects,
          conflictSummary: generateConflictSummary(analysis.conflicts),
        } as any,
      });

    if (analysisError) {
      return NextResponse.json({ error: analysisError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      analysis: {
        ...analysis,
        overlookedSuspects,
        conflictSummary: generateConflictSummary(analysis.conflicts),
      },
    });

  } catch (error: any) {
    console.error('Timeline analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Timeline analysis failed' },
      { status: 500 }
    );
  }
}
