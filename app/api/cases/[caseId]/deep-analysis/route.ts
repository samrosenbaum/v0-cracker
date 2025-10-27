import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';
import { performComprehensiveAnalysis } from '@/lib/cold-case-analyzer';

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { caseId } = params;

    // Fetch all case data
    const [
      { data: caseData },
      { data: documents },
      { data: suspects },
      { data: evidence },
    ] = await Promise.all([
      supabase.from('cases').select('*').eq('id', caseId).single(),
      supabase.from('case_documents').select('*').eq('case_id', caseId),
      supabase.from('suspects').select('*').eq('case_id', caseId),
      supabase.from('case_files').select('*').eq('case_id', caseId),
    ]);

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Prepare data for analysis
    const analysisInput = {
      incidentType: caseData.description || 'Unknown',
      date: caseData.created_at,
      location: 'Unknown', // Would come from case data
      availableEvidence: evidence?.map(e => e.file_name) || [],
      suspects: suspects?.map(s => s.name) || [],
      witnesses: [], // Would be extracted from documents
      interviews: [], // Would be extracted from documents
      documents: documents?.map(d => ({
        filename: d.file_name,
        content: '[Content would be loaded from storage]',
      })) || [],
      evidence: evidence?.map(e => ({
        item: e.file_name,
        dateCollected: e.created_at,
        testingPerformed: e.notes || 'Unknown',
        results: 'Unknown',
      })) || [],
    };

    // Run comprehensive analysis
    const analysis = await performComprehensiveAnalysis(caseId, analysisInput);

    // Save analysis to database
    const { error: saveError } = await supabase
      .from('case_analysis')
      .insert({
        case_id: caseId,
        analysis_type: 'comprehensive_cold_case',
        analysis_data: analysis as any,
        confidence_score: 0.9,
        used_prompt: 'Comprehensive cold case analysis with 8 analytical dimensions',
      });

    if (saveError) {
      console.error('Error saving analysis:', saveError);
    }

    return NextResponse.json({
      success: true,
      analysis,
      summary: {
        totalPatterns: analysis.behavioralPatterns.length,
        criticalGaps: analysis.evidenceGaps.filter(g => g.priority === 'critical').length,
        hiddenConnections: analysis.relationshipNetwork.hiddenConnections.length,
        overlookedDetails: analysis.overlookedDetails.length,
        topPriorities: analysis.topPriorities.length,
        likelyBreakthroughs: analysis.likelyBreakthroughs.length,
      },
    });

  } catch (error: any) {
    console.error('Deep analysis error:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}
