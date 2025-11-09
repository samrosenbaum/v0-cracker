/**
 * Test endpoint to verify Inngest connection
 * Visit: /api/test-inngest to check if events can be sent
 */

import { inngest } from '@/lib/inngest-client';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if Inngest keys are configured
    const hasEventKey = !!process.env.INNGEST_EVENT_KEY;
    const hasSigningKey = !!process.env.INNGEST_SIGNING_KEY;

    if (!hasEventKey && !hasSigningKey) {
      return NextResponse.json({
        success: false,
        error: 'No Inngest keys configured',
        keys: {
          INNGEST_EVENT_KEY: hasEventKey,
          INNGEST_SIGNING_KEY: hasSigningKey,
        },
      }, { status: 500 });
    }

    // Try to send a test event
    await inngest.send({
      name: 'test/ping',
      data: {
        message: 'Test event from Vercel',
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Inngest test event sent successfully!',
      keys: {
        INNGEST_EVENT_KEY: hasEventKey,
        INNGEST_SIGNING_KEY: hasSigningKey,
      },
      instructions: 'Check Inngest dashboard Events tab for "test/ping" event',
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      details: error.toString(),
      keys: {
        INNGEST_EVENT_KEY: !!process.env.INNGEST_EVENT_KEY,
        INNGEST_SIGNING_KEY: !!process.env.INNGEST_SIGNING_KEY,
      },
    }, { status: 500 });
  }
}
