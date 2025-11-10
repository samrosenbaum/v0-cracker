/**
 * API Route: Trigger Investigation Board Population
 *
 * POST /api/cases/[caseId]/board/populate - Manually trigger board population from documents
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendInngestEvent } from '@/lib/inngest-client';
import { populateInvestigationBoardFromDocuments } from '@/lib/jobs/populate-investigation-board';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ caseId: string }> | { caseId: string } }
) {
  try {
    const params = await Promise.resolve(context.params);
    const { caseId } = params;

    console.log(`[Board Population API] Triggering population for case: ${caseId}`);

    // Trigger the Inngest job
    const eventTriggered = await sendInngestEvent('board/populate', {
      caseId,
      // Not specifying caseFileId means it will process ALL files in the case
    });

    if (!eventTriggered) {
      console.log('[Board Population API] Inngest not configured, running synchronously');

      const result = await populateInvestigationBoardFromDocuments({ caseId });

      return NextResponse.json({
        success: true,
        message: 'Investigation Board populated directly from documents',
        caseId,
        mode: 'sync',
        result,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Investigation Board population triggered successfully',
      caseId,
      mode: 'async',
    });
  } catch (error: any) {
    console.error('[Board Population API] Error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Failed to trigger board population',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
