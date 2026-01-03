import { NextRequest, NextResponse } from 'next/server';
import { performCrossDocumentAnalysis, findRelatedDocuments } from '@/lib/cross-document-analysis';

type RouteParams = { params: Promise<{ caseId: string }> };

/**
 * POST /api/cases/[caseId]/cross-document-analysis
 * Trigger a comprehensive cross-document analysis for a case
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { caseId } = await params;

    if (!caseId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      );
    }

    console.log(`[API] Starting cross-document analysis for case: ${caseId}`);

    const analysis = await performCrossDocumentAnalysis(caseId);

    return NextResponse.json({
      success: true,
      analysis,
      message: `Analyzed ${analysis.documentCount} documents`,
    });

  } catch (error: any) {
    console.error('[API] Cross-document analysis failed:', error);
    return NextResponse.json(
      { error: error.message || 'Analysis failed' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/cases/[caseId]/cross-document-analysis?entity=John+Smith
 * Find documents related to a specific entity
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { caseId } = await params;
    const { searchParams } = new URL(request.url);
    const entity = searchParams.get('entity');

    if (!caseId) {
      return NextResponse.json(
        { error: 'Case ID is required' },
        { status: 400 }
      );
    }

    if (entity) {
      // Find documents related to a specific entity
      const relatedDocs = await findRelatedDocuments(caseId, entity);
      return NextResponse.json({
        entity,
        documents: relatedDocs,
        count: relatedDocs.length,
      });
    }

    // If no entity specified, return error
    return NextResponse.json(
      { error: 'Entity parameter required for lookup, or use POST for full analysis' },
      { status: 400 }
    );

  } catch (error: any) {
    console.error('[API] Related documents lookup failed:', error);
    return NextResponse.json(
      { error: error.message || 'Lookup failed' },
      { status: 500 }
    );
  }
}
