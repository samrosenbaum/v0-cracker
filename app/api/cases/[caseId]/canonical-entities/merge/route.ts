/**
 * Entity Merge API
 *
 * POST - Merge two entities into one
 * GET - Get merge suggestions
 */

import { NextRequest, NextResponse } from 'next/server';
import { mergeEntities, getEntityMergeSuggestions } from '@/lib/entity-resolution';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const body = await request.json();

    const { primaryEntityId, secondaryEntityId, confirmedBy } = body;

    if (!primaryEntityId || !secondaryEntityId) {
      return NextResponse.json(
        { error: 'primaryEntityId and secondaryEntityId are required' },
        { status: 400 }
      );
    }

    await mergeEntities(primaryEntityId, secondaryEntityId, confirmedBy);

    return NextResponse.json({
      success: true,
      message: 'Entities merged successfully',
      mergedInto: primaryEntityId,
    });

  } catch (error: any) {
    console.error('[Entity Merge API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to merge entities' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    const suggestions = await getEntityMergeSuggestions(caseId, limit);

    return NextResponse.json({
      success: true,
      suggestions,
      count: suggestions.length,
    });

  } catch (error: any) {
    console.error('[Entity Merge API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get merge suggestions' },
      { status: 500 }
    );
  }
}
