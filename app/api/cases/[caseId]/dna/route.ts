/**
 * DNA Evidence API
 *
 * GET - Get DNA evidence status and summary
 * POST - Create a new DNA sample
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDNAEvidenceStatus,
  getCaseSamples,
  createDNASample,
  getCaseTests,
  getCaseMatches,
  getTestingQueue,
  DNASampleType,
  Priority
} from '@/lib/dna-tracking';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
) {
  try {
    const { caseId } = await params;
    const { searchParams } = new URL(request.url);

    const view = searchParams.get('view') || 'summary';

    switch (view) {
      case 'summary':
        const status = await getDNAEvidenceStatus(caseId);
        return NextResponse.json({
          success: true,
          status,
        });

      case 'samples':
        const sampleStatus = searchParams.get('status') as any;
        const samples = await getCaseSamples(caseId, {
          status: sampleStatus || undefined,
        });
        return NextResponse.json({
          success: true,
          samples,
          count: samples.length,
        });

      case 'tests':
        const testStatus = searchParams.get('status') as any;
        const tests = await getCaseTests(caseId, {
          status: testStatus || undefined,
        });
        return NextResponse.json({
          success: true,
          tests,
          count: tests.length,
        });

      case 'matches':
        const matchType = searchParams.get('type') as any;
        const verified = searchParams.get('verified');
        const matches = await getCaseMatches(caseId, {
          matchType: matchType || undefined,
          verified: verified ? verified === 'true' : undefined,
        });
        return NextResponse.json({
          success: true,
          matches,
          count: matches.length,
        });

      case 'queue':
        const queue = await getTestingQueue(caseId);
        return NextResponse.json({
          success: true,
          queue,
          count: queue.length,
        });

      default:
        return NextResponse.json(
          { error: 'Invalid view. Use: summary, samples, tests, matches, or queue' },
          { status: 400 }
        );
    }

  } catch (error: any) {
    console.error('[DNA API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch DNA data' },
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
      evidenceItemId,
      sampleNumber,
      sampleType,
      collectionMethod,
      collectedAt,
      collectedBy,
      collectionLocation,
      collectionNotes,
      storageLocation,
      testingPriority,
      priorityReason
    } = body;

    if (!sampleNumber || !sampleType || !collectedBy || !collectionLocation) {
      return NextResponse.json(
        { error: 'sampleNumber, sampleType, collectedBy, and collectionLocation are required' },
        { status: 400 }
      );
    }

    const sample = await createDNASample(caseId, {
      evidenceItemId,
      sampleNumber,
      sampleType: sampleType as DNASampleType,
      collectionMethod,
      collectedAt: collectedAt ? new Date(collectedAt) : new Date(),
      collectedBy,
      collectionLocation,
      collectionNotes,
      storageLocation,
      testingPriority: testingPriority as Priority,
      priorityReason,
    });

    return NextResponse.json({
      success: true,
      sample,
      message: `DNA sample ${sampleNumber} created successfully`,
    });

  } catch (error: any) {
    console.error('[DNA API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create DNA sample' },
      { status: 500 }
    );
  }
}
