/**
 * Inconsistencies API
 *
 * GET - Get all detected inconsistencies for a case
 * POST - Run inconsistency detection
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  detectInconsistencies,
  getCaseInconsistencies,
  compareStatements,
  InconsistencyType,
  Severity,
  ReviewStatus
} from '@/lib/inconsistency-detector';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type') as InconsistencyType | null;
    const severity = searchParams.get('severity') as Severity | null;
    const status = searchParams.get('status') as ReviewStatus | null;
    const speakerId = searchParams.get('speakerId');

    const inconsistencies = await getCaseInconsistencies(caseId, {
      type: type || undefined,
      severity: severity || undefined,
      reviewStatus: status || undefined,
      speakerId: speakerId || undefined,
    });

    // Group by severity for summary
    const bySeverity = {
      critical: inconsistencies.filter(i => i.severity === 'critical').length,
      significant: inconsistencies.filter(i => i.severity === 'significant').length,
      moderate: inconsistencies.filter(i => i.severity === 'moderate').length,
      minor: inconsistencies.filter(i => i.severity === 'minor').length,
    };

    // Group by type
    const byType: Record<string, number> = {};
    inconsistencies.forEach(i => {
      byType[i.inconsistencyType] = (byType[i.inconsistencyType] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      inconsistencies,
      count: inconsistencies.length,
      summary: {
        bySeverity,
        byType,
        pendingReview: inconsistencies.filter(i => i.reviewStatus === 'pending').length,
      },
    });

  } catch (error: any) {
    console.error('[Inconsistencies API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch inconsistencies' },
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
      timeToleranceMinutes,
      detectOmissions,
      detectAdditions,
      useAIAnalysis
    } = body;

    console.log(`[Inconsistencies API] Running detection for case ${caseId}`);

    const inconsistencies = await detectInconsistencies(caseId, {
      timeToleranceMinutes: timeToleranceMinutes || 30,
      detectOmissions: detectOmissions !== false,
      detectAdditions: detectAdditions !== false,
      useAIAnalysis: useAIAnalysis !== false,
    });

    // Categorize results
    const critical = inconsistencies.filter(i => i.severity === 'critical');
    const significant = inconsistencies.filter(i => i.severity === 'significant');

    return NextResponse.json({
      success: true,
      message: `Detected ${inconsistencies.length} inconsistencies`,
      inconsistencies,
      count: inconsistencies.length,
      summary: {
        critical: critical.length,
        significant: significant.length,
        requiresImmediateAttention: critical.length > 0,
      },
      criticalFindings: critical.map(i => ({
        type: i.inconsistencyType,
        description: i.description,
        suggestedAction: i.suggestedAction,
      })),
    });

  } catch (error: any) {
    console.error('[Inconsistencies API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to run inconsistency detection' },
      { status: 500 }
    );
  }
}
