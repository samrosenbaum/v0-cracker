/**
 * Statement Parse API
 *
 * POST - Parse a statement and extract claims
 */

import { NextRequest, NextResponse } from 'next/server';
import { parseStatement, getStatementClaims } from '@/lib/statement-parser';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; statementId: string }> }
) {
  try {
    const { statementId } = await params;
    const body = await request.json();

    const { resolveEntities, referenceDate } = body;

    const result = await parseStatement(statementId, {
      resolveEntities: resolveEntities !== false, // Default true
      referenceDate: referenceDate ? new Date(referenceDate) : undefined,
    });

    return NextResponse.json({
      success: true,
      statement: result.statement,
      claims: result.claims,
      claimsCount: result.claims.length,
      unresolvedEntities: result.unresolvedEntities,
      timeline: result.timeline,
      summary: result.summary,
      confidence: result.confidence,
    });

  } catch (error: any) {
    console.error('[Statement Parse API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to parse statement' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string; statementId: string }> }
) {
  try {
    const { statementId } = await params;

    const claims = await getStatementClaims(statementId);

    return NextResponse.json({
      success: true,
      claims,
      count: claims.length,
    });

  } catch (error: any) {
    console.error('[Statement Parse API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch claims' },
      { status: 500 }
    );
  }
}
