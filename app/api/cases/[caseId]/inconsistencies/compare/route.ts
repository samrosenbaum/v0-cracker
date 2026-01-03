/**
 * Statement Comparison API
 *
 * POST - Compare two statements from the same person
 */

import { NextRequest, NextResponse } from 'next/server';
import { compareStatements, trackClaimEvolution } from '@/lib/inconsistency-detector';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const body = await request.json();

    const { statement1Id, statement2Id, trackTopic, entityId } = body;

    // If tracking a specific topic's evolution
    if (trackTopic && entityId) {
      const evolution = await trackClaimEvolution(caseId, entityId, trackTopic);

      return NextResponse.json({
        success: true,
        evolution,
        hasContradictions: evolution.hasContradictions,
        driftScore: evolution.driftScore,
        versionCount: evolution.versions.length,
      });
    }

    // Otherwise, compare two specific statements
    if (!statement1Id || !statement2Id) {
      return NextResponse.json(
        { error: 'statement1Id and statement2Id are required for comparison' },
        { status: 400 }
      );
    }

    const result = await compareStatements(statement1Id, statement2Id);

    return NextResponse.json({
      success: true,
      comparison: result,
      summary: {
        consistencyScore: result.consistencyScore,
        credibilityImpact: result.credibilityImpact,
        contradictions: result.contradictingClaims,
        newDetails: result.newClaims,
        omittedDetails: result.omittedClaims,
      },
      keyDifferences: result.keyDifferences,
      inconsistencies: result.inconsistencies,
    });

  } catch (error: any) {
    console.error('[Statement Comparison API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compare statements' },
      { status: 500 }
    );
  }
}
