/**
 * Atomic Facts API
 *
 * GET - Retrieve facts for a case
 * POST - Extract facts from documents
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getFactsForCase,
  getFactsForPerson,
  getFactsByType,
  getSuspiciousFacts,
  getContradictedFacts,
  getFactStatistics,
  extractFactsFromDocument,
  saveFactsToDatabase,
  queryFacts,
  type FactType
} from '@/lib/atomic-facts';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const searchParams = request.nextUrl.searchParams;

    const person = searchParams.get('person');
    const factType = searchParams.get('type') as FactType | null;
    const suspicious = searchParams.get('suspicious') === 'true';
    const contradicted = searchParams.get('contradicted') === 'true';
    const stats = searchParams.get('stats') === 'true';

    // Return statistics if requested
    if (stats) {
      const statistics = await getFactStatistics(caseId);
      return NextResponse.json({ success: true, statistics });
    }

    // Filter by various criteria
    let facts;

    if (person) {
      facts = await getFactsForPerson(caseId, person);
    } else if (factType) {
      facts = await getFactsByType(caseId, factType);
    } else if (suspicious) {
      facts = await getSuspiciousFacts(caseId);
    } else if (contradicted) {
      facts = await getContradictedFacts(caseId);
    } else {
      facts = await getFactsForCase(caseId);
    }

    return NextResponse.json({
      success: true,
      facts,
      count: facts.length
    });

  } catch (error) {
    console.error('Failed to get facts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve facts' },
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
      documentId,
      documentName,
      documentType,
      content,
      pageNumber,
      saveToDb = true
    } = body;

    if (!documentId || !documentName || !content) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: documentId, documentName, content' },
        { status: 400 }
      );
    }

    // Extract facts from the document
    const result = await extractFactsFromDocument(
      caseId,
      documentId,
      documentName,
      documentType || 'other',
      content,
      pageNumber
    );

    // Save to database if requested
    if (saveToDb && result.facts.length > 0) {
      const saveResult = await saveFactsToDatabase(result.facts);
      return NextResponse.json({
        success: true,
        ...result,
        saved: saveResult.saved,
        saveErrors: saveResult.errors
      });
    }

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Failed to extract facts:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to extract facts' },
      { status: 500 }
    );
  }
}
