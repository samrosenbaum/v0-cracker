import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';
import { hasSupabaseServiceConfig } from '@/lib/environment';
import { processTimelineAnalysis } from '@/lib/workflows/timeline-analysis';
import { processDeepAnalysis } from '@/lib/workflows/deep-analysis';
import { processVictimTimeline } from '@/lib/workflows/victim-timeline';

// This route should be configured as a Vercel Cron Job
// Add to vercel.json:
// {
//   "crons": [{
//     "path": "/api/cron/process-jobs",
//     "schedule": "* * * * *"  // Every minute
//   }]
// }

// Verify the request is from Vercel Cron
function isValidCronRequest(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // In development, allow requests without auth
  if (process.env.NODE_ENV === 'development') {
    return true;
  }

  // In production, verify the cron secret when configured
  if (cronSecret) {
    if (authHeader === `Bearer ${cronSecret}`) {
      return true;
    }

    return false;
  }

  // Vercel automatically adds this header for cron jobs
  if (request.headers.get('user-agent')?.includes('vercel-cron')) {
    return true;
  }

  return false;
}

export const maxDuration = 300; // 5 minutes (requires Pro plan)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    if (!isValidCronRequest(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!hasSupabaseServiceConfig()) {
      return NextResponse.json(
        { error: 'Supabase not configured' },
        { status: 500 }
      );
    }

    console.log('[Job Processor] Starting job processing cycle...');

    // Find all pending jobs older than 10 seconds (give API time to return)
    const tenSecondsAgo = new Date(Date.now() - 10000).toISOString();

    const { data: pendingJobs, error: fetchError } = await supabaseServer
      .from('processing_jobs')
      .select('*')
      .eq('status', 'pending')
      .eq('job_type', 'ai_analysis')
      .lt('created_at', tenSecondsAgo)
      .order('created_at', { ascending: true })
      .limit(5); // Process max 5 jobs per cron run

    if (fetchError) {
      console.error('[Job Processor] Error fetching pending jobs:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch jobs', details: fetchError.message },
        { status: 500 }
      );
    }

    if (!pendingJobs || pendingJobs.length === 0) {
      console.log('[Job Processor] No pending jobs to process');
      return NextResponse.json({
        success: true,
        processed: 0,
        message: 'No pending jobs',
      });
    }

    console.log(`[Job Processor] Found ${pendingJobs.length} pending jobs to process`);

    const results = [];

    for (const job of pendingJobs) {
      try {
        const analysisType = job.metadata?.analysisType;
        console.log(`[Job Processor] Processing job ${job.id} (${analysisType})...`);

        // Mark as running to prevent duplicate processing
        await supabaseServer
          .from('processing_jobs')
          .update({
            status: 'running',
            started_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        // Route to appropriate workflow based on analysis type
        switch (analysisType) {
          case 'timeline_and_conflicts':
          case 'timeline':
            await processTimelineAnalysis({
              jobId: job.id,
              caseId: job.case_id,
            });
            break;

          case 'comprehensive_cold_case':
          case 'deep-analysis':
            await processDeepAnalysis({
              jobId: job.id,
              caseId: job.case_id,
            });
            break;

          case 'victim_timeline':
            await processVictimTimeline({
              jobId: job.id,
              caseId: job.case_id,
              victimInfo: job.metadata?.victimInfo || {
                name: job.metadata?.victimName || 'Unknown',
                incidentTime: job.metadata?.incidentTime || new Date().toISOString(),
              },
              requestContext: job.metadata?.requestContext || {},
              requestedAt: job.metadata?.requestedAt || job.created_at,
            });
            break;

          default:
            console.warn(`[Job Processor] Unknown analysis type: ${analysisType}`);
            // Mark as failed
            await supabaseServer
              .from('processing_jobs')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                metadata: {
                  ...job.metadata,
                  error: `Unknown analysis type: ${analysisType}`,
                },
              })
              .eq('id', job.id);
        }

        results.push({
          jobId: job.id,
          status: 'processed',
          analysisType,
        });

        console.log(`[Job Processor] ✓ Successfully processed job ${job.id}`);
      } catch (error: any) {
        console.error(`[Job Processor] ✗ Failed to process job ${job.id}:`, error);

        // Mark job as failed
        try {
          await supabaseServer
            .from('processing_jobs')
            .update({
              status: 'failed',
              completed_at: new Date().toISOString(),
              metadata: {
                ...job.metadata,
                error: error?.message || 'Job processing failed',
                errorStack: error?.stack,
              },
            })
            .eq('id', job.id);
        } catch (updateError) {
          console.error(`[Job Processor] Failed to update job status:`, updateError);
        }

        results.push({
          jobId: job.id,
          status: 'failed',
          error: error?.message,
        });
      }
    }

    console.log(`[Job Processor] Completed processing cycle. Processed ${results.length} jobs.`);

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error: any) {
    console.error('[Job Processor] Critical error:', error);
    return NextResponse.json(
      {
        error: 'Job processing failed',
        message: error?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
