import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { analyzeCaseDocuments, detectTimeConflicts, identifyOverlookedSuspects, generateConflictSummary } from '@/lib/ai-analysis';
import { extractMultipleDocuments, queueDocumentForReview } from '@/lib/document-parser';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  try {
    // Handle both sync and async params for Next.js 14/15 compatibility
    const params = await Promise.resolve(context.params);
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

    console.log(`[Analyze API] Found ${documents.length} documents to analyze`);

    // REAL DOCUMENT EXTRACTION - Extract text from all uploaded files
    const storagePaths = documents.map(doc => doc.storage_path).filter(Boolean) as string[];

    console.log(`[Analyze API] Extracting content from ${storagePaths.length} files...`);
    const extractionResults = await extractMultipleDocuments(storagePaths, 5); // Process 5 at a time

    // Queue documents that need human review (low confidence OCR)
    console.log(`[Analyze API] Checking for documents that need human review...`);
    let queuedForReview = 0;
    for (const doc of documents) {
      const extractionResult = extractionResults.get(doc.storage_path);
      if (extractionResult && extractionResult.needsReview) {
        const queued = await queueDocumentForReview(doc.id, caseId, extractionResult);
        if (queued) {
          queuedForReview++;
        }
      }
    }
    if (queuedForReview > 0) {
      console.log(`[Analyze API] ⚠️  ${queuedForReview} document(s) queued for human review`);
    }

    // Build documents for AI analysis with REAL extracted content
    const docsForAnalysis = documents.map(doc => {
      const extractionResult = extractionResults.get(doc.storage_path);

      return {
        content: extractionResult?.text || `[Could not extract text from ${doc.file_name}]`,
        filename: doc.file_name,
        type: doc.document_type,
        confidence: extractionResult?.confidence || 0,
        extractionMethod: extractionResult?.method || 'unknown',
      };
    });

    // Log extraction results
    const totalChars = docsForAnalysis.reduce((sum, doc) => sum + doc.content.length, 0);
    const successfulExtractions = docsForAnalysis.filter(doc => doc.confidence > 0.5).length;

    console.log(`[Analyze API] Extraction complete:`);
    console.log(`  - ${successfulExtractions}/${documents.length} documents extracted successfully`);
    console.log(`  - Total characters extracted: ${totalChars.toLocaleString()}`);

    // Run AI analysis on REAL document content
    console.log(`[Analyze API] Running AI analysis...`);
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
    // Map AI analysis timeline events to the timeline_events table schema
    const timelineInserts = analysis.timeline.map(event => {
      // Map sourceType to event_type enum
      const eventTypeMap: Record<string, string> = {
        'interview': 'witness_account',
        'witness_statement': 'witness_account',
        'police_report': 'other',
        'forensic_report': 'evidence_found',
        'tip': 'other',
        'other': 'other'
      };

      return {
        case_id: caseId,
        event_type: eventTypeMap[event.sourceType] || 'other',
        title: event.description?.substring(0, 100) || 'Timeline Event',
        description: event.description || null,
        event_time: event.time || event.startTime || null,
        event_date: event.date || null,
        time_precision: event.startTime && event.endTime ? 'approximate' as const :
                       event.time ? 'exact' as const : 'estimated' as const,
        time_range_start: event.startTime || null,
        time_range_end: event.endTime || null,
        location: event.location || null,
        primary_entity_id: null, // Will be linked later if entities are created
        verification_status: 'unverified' as const,
        confidence_score: event.confidence || 0.5,
        source_type: event.sourceType,
        source_notes: event.source || null,
        metadata: event.metadata || {},
      };
    });

    const { error: timelineError } = await supabaseServer
      .from('timeline_events')
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
        analysis_type: 'timeline_and_conflicts',
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
        confidence_score: 0.85,
        used_prompt: 'Timeline and conflict analysis',
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
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
