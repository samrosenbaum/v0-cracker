/**
 * Batch Handwriting Extraction API
 *
 * POST /api/handwriting/batch
 *
 * Processes multiple handwritten documents in parallel.
 * Returns a job ID that can be used to track progress.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest-client';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      caseId,
      documentIds,
      documentType = 'unknown',
      eraHint,
      contextHint,
      writerProfileId,
      maxConcurrent = 5,
      priority = 5,
    } = body;

    // Validate required fields
    if (!caseId) {
      return NextResponse.json(
        { error: 'Missing required field: caseId' },
        { status: 400 }
      );
    }

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Missing or empty documentIds array' },
        { status: 400 }
      );
    }

    console.log(`[API/Handwriting/Batch] Processing ${documentIds.length} documents for case ${caseId}`);

    // Create a processing job
    const { data: job, error: jobError } = await supabase
      .from('processing_jobs')
      .insert({
        case_id: caseId,
        job_type: 'handwriting_extraction',
        status: 'pending',
        total_units: documentIds.length,
        completed_units: 0,
        failed_units: 0,
        metadata: {
          documentIds,
          options: {
            documentType,
            eraHint,
            contextHint,
            writerProfileId,
            maxConcurrent,
          },
        },
      })
      .select()
      .single();

    if (jobError) {
      console.error('[API/Handwriting/Batch] Failed to create job:', jobError);
      return NextResponse.json(
        { error: 'Failed to create processing job' },
        { status: 500 }
      );
    }

    // Trigger the batch processing job via Inngest
    await inngest.send({
      name: 'handwriting/batch.extract',
      data: {
        jobId: job.id,
        caseId,
        documentIds,
        options: {
          documentType,
          eraHint,
          contextHint,
          writerProfileId,
          maxConcurrent,
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        documentCount: documentIds.length,
        status: 'pending',
        message: `Batch extraction started for ${documentIds.length} documents`,
      },
    });

  } catch (error: any) {
    console.error('[API/Handwriting/Batch] Error:', error);
    return NextResponse.json(
      { error: `Batch extraction failed: ${error.message}` },
      { status: 500 }
    );
  }
}

/**
 * GET /api/handwriting/batch?jobId=xxx
 *
 * Get status of a batch processing job
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: jobId' },
        { status: 400 }
      );
    }

    const { data: job, error } = await supabase
      .from('processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Job not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        jobId: job.id,
        status: job.status,
        totalUnits: job.total_units,
        completedUnits: job.completed_units,
        failedUnits: job.failed_units,
        progressPercentage: job.progress_percentage,
        estimatedCompletion: job.estimated_completion,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        errorSummary: job.error_summary,
      },
    });

  } catch (error: any) {
    console.error('[API/Handwriting/Batch] Error getting status:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
