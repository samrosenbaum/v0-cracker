import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { performComprehensiveAnalysis } from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments, queueDocumentForReview } from '@/lib/document-parser';
import { optionsPreflight, withCorsHeaders } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function OPTIONS(request: NextRequest) {
  return optionsPreflight(request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { caseId: string } }
) {
  try {
    const { caseId } = params;

    console.log('Deep analysis requested for case:', caseId);
    console.log('Case ID type:', typeof caseId);
    console.log('Case ID length:', caseId?.length);

    // First check if case exists without .single()
    const { data: caseCheck, error: checkError } = await supabaseServer
      .from('cases')
      .select('*')
      .eq('id', caseId);

    console.log('Case check results:', {
      found: caseCheck?.length || 0,
      error: checkError?.message,
      caseId
    });

    if (checkError) {
      console.error('Error checking case:', checkError);
      return withCorsHeaders(request, NextResponse.json({
        error: `Database error: ${checkError.message}`,
        details: checkError
      }, { status: 500 }));
    }

    if (!caseCheck || caseCheck.length === 0) {
      console.error('Case not found with ID:', caseId);
      return withCorsHeaders(request, NextResponse.json({
        error: 'Case not found',
        caseId: caseId,
        message: 'No case exists with this ID'
      }, { status: 404 }));
    }

    if (caseCheck.length > 1) {
      console.error('Multiple cases found with ID:', caseId);
      return withCorsHeaders(request, NextResponse.json({
        error: 'Multiple cases found',
        count: caseCheck.length
      }, { status: 500 }));
    }

    const caseData = caseCheck[0];

    // Fetch all case data
    const [
      { data: documents, error: docsError },
      { data: suspects, error: suspectsError },
      { data: evidence, error: evidenceError },
    ] = await Promise.all([
      supabaseServer.from('case_documents').select('*').eq('case_id', caseId),
      supabaseServer.from('suspects').select('*').eq('case_id', caseId),
      supabaseServer.from('case_files').select('*').eq('case_id', caseId),
    ]);

    console.log('Found case:', caseData.title || caseData.id);
    console.log('Documents:', documents?.length || 0);
    console.log('Suspects:', suspects?.length || 0);
    console.log('Evidence:', evidence?.length || 0);

    // EXTRACT REAL DOCUMENT CONTENT
    console.log(`[Deep Analysis] Extracting content from ${documents?.length || 0} documents...`);
    const storagePaths = documents?.map(d => d.storage_path).filter(Boolean) as string[] || [];
    const extractionResults = await extractMultipleDocuments(storagePaths, 5);

    // Queue documents that need human review (low confidence OCR)
    console.log(`[Deep Analysis] Checking for documents that need human review...`);
    let queuedForReview = 0;
    for (const doc of (documents || [])) {
      const extractionResult = extractionResults.get(doc.storage_path);
      if (extractionResult && extractionResult.needsReview) {
        const queued = await queueDocumentForReview(doc.id, caseId, extractionResult);
        if (queued) {
          queuedForReview++;
        }
      }
    }
    if (queuedForReview > 0) {
      console.log(`[Deep Analysis] ⚠️  ${queuedForReview} document(s) queued for human review`);
    }

    // Prepare data for analysis with REAL extracted content
    const analysisInput = {
      incidentType: caseData.description || 'Unknown',
      date: caseData.created_at,
      location: 'Unknown', // Would come from case data
      availableEvidence: evidence?.map(e => e.file_name) || [],
      suspects: suspects?.map(s => s.name) || [],
      witnesses: [], // Would be extracted from documents
      interviews: [], // Would be extracted from documents
      documents: documents?.map(d => {
        const extraction = extractionResults.get(d.storage_path);
        return {
          filename: d.file_name,
          content: extraction?.text || '[Could not extract content]',
        };
      }) || [],
      evidence: evidence?.map(e => ({
        item: e.file_name,
        dateCollected: e.created_at,
        testingPerformed: e.notes || 'Unknown',
        results: 'Unknown',
      })) || [],
    };

    console.log(`[Deep Analysis] Extracted ${analysisInput.documents.reduce((sum, d) => sum + d.content.length, 0)} total characters`);

    // Run comprehensive analysis
    const analysis = await performComprehensiveAnalysis(caseId, analysisInput);

    // Save analysis to database
    const { error: saveError } = await supabaseServer
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

    return withCorsHeaders(request, NextResponse.json({
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
    }));

  } catch (error: any) {
    console.error('Deep analysis error:', error);
    return withCorsHeaders(
      request,
      NextResponse.json(
        { error: error.message || 'Analysis failed' },
        { status: 500 }
      )
    );
  }
}
