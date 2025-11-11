/**
 * Progress Tracking Utilities
 *
 * Provides real-time progress monitoring for:
 * - Document processing jobs
 * - Chunk extraction status
 * - Case-wide document statistics
 */

import { supabaseServer } from './supabase-server';
import { hasSupabaseServiceConfig } from './environment';
import {
  listProcessingJobs as listDemoProcessingJobs,
  getProcessingJob as getDemoProcessingJob,
  updateProcessingJob as updateDemoProcessingJob,
  listCaseDocuments as listDemoCaseDocuments,
} from './demo-data';

export interface ProcessingJobStats {
  id: string;
  caseId: string;
  jobType: 'document_extraction' | 'ai_analysis' | 'embedding_generation';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  totalUnits: number;
  completedUnits: number;
  failedUnits: number;
  progressPercentage: number;
  estimatedCompletion: string | null;
  startedAt: string | null;
  completedAt: string | null;
  metadata: any;
}

export interface ChunkStats {
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  pendingChunks: number;
  processingChunks: number;
  totalCharacters: number;
  avgConfidence: number;
  progressPct: number;
}

export interface CaseDocumentStats {
  totalFiles: number;
  totalChunks: number;
  completedChunks: number;
  failedChunks: number;
  totalCharacters: number;
  avgConfidence: number;
  completionPct: number;
}

/**
 * Get processing job by ID
 */
export async function getProcessingJob(jobId: string): Promise<ProcessingJobStats | null> {
  if (!hasSupabaseServiceConfig()) {
    const job = getDemoProcessingJob(jobId);
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      caseId: job.case_id,
      jobType: job.job_type,
      status: job.status,
      totalUnits: job.total_units || 0,
      completedUnits: job.completed_units || 0,
      failedUnits: job.failed_units || 0,
      progressPercentage:
        typeof job.progress_percentage === 'number'
          ? job.progress_percentage
          : calculateProgressPercentage(job.completed_units, job.total_units),
      estimatedCompletion: job.estimated_completion || null,
      startedAt: job.started_at || null,
      completedAt: job.completed_at || null,
      metadata: job.metadata || {},
    };
  }

  try {
    const { data, error } = await supabaseServer
      .from('processing_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) {
      console.error(`Failed to get processing job:`, error);
      return null;
    }

    return {
      id: data.id,
      caseId: data.case_id,
      jobType: data.job_type,
      status: data.status,
      totalUnits: data.total_units,
      completedUnits: data.completed_units,
      failedUnits: data.failed_units,
      progressPercentage: data.progress_percentage || 0,
      estimatedCompletion: data.estimated_completion,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      metadata: data.metadata || {},
    };
  } catch (error) {
    console.error(`Error getting processing job:`, error);
    return null;
  }
}

/**
 * Get all processing jobs for a case
 */
export async function getCaseProcessingJobs(caseId: string): Promise<ProcessingJobStats[]> {
  if (!hasSupabaseServiceConfig()) {
    const jobs = listDemoProcessingJobs(caseId);
    return jobs
      .map(job => ({
        id: job.id,
        caseId: job.case_id,
        jobType: job.job_type,
        status: job.status,
        totalUnits: job.total_units || 0,
        completedUnits: job.completed_units || 0,
        failedUnits: job.failed_units || 0,
        progressPercentage:
          typeof job.progress_percentage === 'number'
            ? job.progress_percentage
            : calculateProgressPercentage(job.completed_units, job.total_units),
        estimatedCompletion: job.estimated_completion || null,
        startedAt: job.started_at || null,
        completedAt: job.completed_at || null,
        metadata: job.metadata || {},
      }))
      .sort((a, b) => {
        const aTime = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const bTime = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return bTime - aTime;
      });
  }

  try {
    const { data, error } = await supabaseServer
      .from('processing_jobs')
      .select('*')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Failed to get case processing jobs:`, error);
      return [];
    }

    return data.map(job => ({
      id: job.id,
      caseId: job.case_id,
      jobType: job.job_type,
      status: job.status,
      totalUnits: job.total_units,
      completedUnits: job.completed_units,
      failedUnits: job.failed_units,
      progressPercentage: job.progress_percentage || 0,
      estimatedCompletion: job.estimated_completion,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      metadata: job.metadata || {},
    }));
  } catch (error) {
    console.error(`Error getting case processing jobs:`, error);
    return [];
  }
}

/**
 * Get active (running) jobs for a case
 */
export async function getActiveJobs(caseId: string): Promise<ProcessingJobStats[]> {
  if (!hasSupabaseServiceConfig()) {
    return getCaseProcessingJobs(caseId).then(jobs =>
      jobs.filter(job => job.status === 'pending' || job.status === 'running')
    );
  }

  try {
    const { data, error } = await supabaseServer
      .from('processing_jobs')
      .select('*')
      .eq('case_id', caseId)
      .in('status', ['pending', 'running'])
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Failed to get active jobs:`, error);
      return [];
    }

    return data.map(job => ({
      id: job.id,
      caseId: job.case_id,
      jobType: job.job_type,
      status: job.status,
      totalUnits: job.total_units,
      completedUnits: job.completed_units,
      failedUnits: job.failed_units,
      progressPercentage: job.progress_percentage || 0,
      estimatedCompletion: job.estimated_completion,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      metadata: job.metadata || {},
    }));
  } catch (error) {
    console.error(`Error getting active jobs:`, error);
    return [];
  }
}

/**
 * Get chunk statistics for a processing job
 */
export async function getJobChunkStats(jobId: string): Promise<ChunkStats> {
  if (!hasSupabaseServiceConfig()) {
    const job = getDemoProcessingJob(jobId);
    if (!job) {
      return {
        totalChunks: 0,
        completedChunks: 0,
        failedChunks: 0,
        pendingChunks: 0,
        processingChunks: 0,
        totalCharacters: 0,
        avgConfidence: 0,
        progressPct: 0,
      };
    }

    const totalUnits = job.total_units || 0;
    const completedUnits = job.completed_units || 0;
    const failedUnits = job.failed_units || 0;
    const remainingUnits = Math.max(totalUnits - completedUnits - failedUnits, 0);
    const progressPct =
      typeof job.progress_percentage === 'number'
        ? job.progress_percentage
        : calculateProgressPercentage(completedUnits, totalUnits);

    return {
      totalChunks: totalUnits,
      completedChunks: completedUnits,
      failedChunks: failedUnits,
      pendingChunks: job.status === 'pending' ? remainingUnits : 0,
      processingChunks: job.status === 'running' ? remainingUnits : 0,
      totalCharacters: job.metadata?.totalCharacters || 0,
      avgConfidence: job.metadata?.avgConfidence || 0,
      progressPct,
    };
  }

  try {
    const { data, error } = await supabaseServer.rpc('get_processing_job_stats', {
      job_id_param: jobId,
    });

    if (error) {
      console.error(`Failed to get job chunk stats:`, error);
      return {
        totalChunks: 0,
        completedChunks: 0,
        failedChunks: 0,
        pendingChunks: 0,
        processingChunks: 0,
        totalCharacters: 0,
        avgConfidence: 0,
        progressPct: 0,
      };
    }

    const stats = data[0];
    return {
      totalChunks: stats.total_chunks || 0,
      completedChunks: stats.completed_chunks || 0,
      failedChunks: stats.failed_chunks || 0,
      pendingChunks: stats.pending_chunks || 0,
      processingChunks: stats.processing_chunks || 0,
      totalCharacters: stats.total_characters || 0,
      avgConfidence: stats.avg_confidence || 0,
      progressPct: stats.progress_pct || 0,
    };
  } catch (error) {
    console.error(`Error getting job chunk stats:`, error);
    return {
      totalChunks: 0,
      completedChunks: 0,
      failedChunks: 0,
      pendingChunks: 0,
      processingChunks: 0,
      totalCharacters: 0,
      avgConfidence: 0,
      progressPct: 0,
    };
  }
}

/**
 * Get document statistics for entire case
 */
export async function getCaseDocumentStats(caseId: string): Promise<CaseDocumentStats> {
  if (!hasSupabaseServiceConfig()) {
    const documents = listDemoCaseDocuments(caseId);
    const jobs = listDemoProcessingJobs(caseId);

    const totalChunks = jobs.reduce((sum, job) => sum + (job.total_units || 0), 0);
    const completedChunks = jobs.reduce((sum, job) => sum + (job.completed_units || 0), 0);
    const failedChunks = jobs.reduce((sum, job) => sum + (job.failed_units || 0), 0);
    const totalCharacters = documents.reduce((sum, doc) => {
      if (typeof doc.metadata?.totalCharacters === 'number') {
        return sum + doc.metadata.totalCharacters;
      }
      if (typeof doc.character_count === 'number') {
        return sum + doc.character_count;
      }
      return sum;
    }, 0);

    const completionPct = totalChunks
      ? Math.min(100, (completedChunks / totalChunks) * 100)
      : 0;

    return {
      totalFiles: documents.length,
      totalChunks,
      completedChunks,
      failedChunks,
      totalCharacters,
      avgConfidence: 0,
      completionPct,
    };
  }

  try {
    const { data, error } = await supabaseServer.rpc('get_case_chunks_summary', {
      case_id_param: caseId,
    });

    if (error) {
      console.error(`Failed to get case document stats:`, error);
      return {
        totalFiles: 0,
        totalChunks: 0,
        completedChunks: 0,
        failedChunks: 0,
        totalCharacters: 0,
        avgConfidence: 0,
        completionPct: 0,
      };
    }

    const stats = data[0];
    return {
      totalFiles: stats.total_files || 0,
      totalChunks: stats.total_chunks || 0,
      completedChunks: stats.completed_chunks || 0,
      failedChunks: stats.failed_chunks || 0,
      totalCharacters: stats.total_characters || 0,
      avgConfidence: stats.avg_confidence || 0,
      completionPct: stats.completion_pct || 0,
    };
  } catch (error) {
    console.error(`Error getting case document stats:`, error);
    return {
      totalFiles: 0,
      totalChunks: 0,
      completedChunks: 0,
      failedChunks: 0,
      totalCharacters: 0,
      avgConfidence: 0,
      completionPct: 0,
    };
  }
}

/**
 * Get chunks for a specific case file
 */
export async function getCaseFileChunks(caseFileId: string) {
  try {
    const { data, error } = await supabaseServer
      .from('document_chunks')
      .select('*')
      .eq('case_file_id', caseFileId)
      .order('chunk_index');

    if (error) {
      console.error(`Failed to get case file chunks:`, error);
      return [];
    }

    return data;
  } catch (error) {
    console.error(`Error getting case file chunks:`, error);
    return [];
  }
}

/**
 * Get failed chunks for debugging
 */
export async function getFailedChunks(jobId: string) {
  try {
    const { data, error } = await supabaseServer
      .from('document_chunks')
      .select('*')
      .eq('processing_job_id', jobId)
      .eq('processing_status', 'failed')
      .order('chunk_index');

    if (error) {
      console.error(`Failed to get failed chunks:`, error);
      return [];
    }

    return data;
  } catch (error) {
    console.error(`Error getting failed chunks:`, error);
    return [];
  }
}

/**
 * Cancel a processing job
 */
export async function cancelProcessingJob(jobId: string): Promise<boolean> {
  if (!hasSupabaseServiceConfig()) {
    const job = getDemoProcessingJob(jobId);
    if (!job) {
      return false;
    }

    updateDemoProcessingJob(jobId, {
      status: 'cancelled',
      completed_at: new Date().toISOString(),
    });
    return true;
  }

  try {
    const { error } = await supabaseServer
      .from('processing_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) {
      console.error(`Failed to cancel job:`, error);
      return false;
    }

    // Mark pending chunks as skipped
    await supabaseServer
      .from('document_chunks')
      .update({
        processing_status: 'skipped',
      })
      .eq('processing_job_id', jobId)
      .eq('processing_status', 'pending');

    return true;
  } catch (error) {
    console.error(`Error cancelling job:`, error);
    return false;
  }
}

/**
 * Retry failed chunks
 */
export async function retryFailedChunks(jobId: string): Promise<number> {
  if (!hasSupabaseServiceConfig()) {
    const job = getDemoProcessingJob(jobId);
    if (!job) {
      return 0;
    }

    const failedUnits = job.failed_units || 0;
    if (!failedUnits) {
      return 0;
    }

    updateDemoProcessingJob(jobId, {
      status: 'running',
      failed_units: 0,
      progress_percentage: calculateProgressPercentage(job.completed_units, job.total_units),
    });

    return failedUnits;
  }

  try {
    const failedChunks = await getFailedChunks(jobId);

    if (failedChunks.length === 0) {
      return 0;
    }

    // Reset failed chunks to pending
    const { error } = await supabaseServer
      .from('document_chunks')
      .update({
        processing_status: 'pending',
        error_log: null,
      })
      .eq('processing_job_id', jobId)
      .eq('processing_status', 'failed');

    if (error) {
      console.error(`Failed to retry chunks:`, error);
      return 0;
    }

    // Update job status back to running
    await supabaseServer
      .from('processing_jobs')
      .update({
        status: 'running',
        failed_units: 0,
      })
      .eq('id', jobId);

    return failedChunks.length;
  } catch (error) {
    console.error(`Error retrying failed chunks:`, error);
    return 0;
  }
}

function calculateProgressPercentage(
  completedUnits?: number | null,
  totalUnits?: number | null
): number {
  if (!totalUnits || totalUnits <= 0 || !completedUnits) {
    return 0;
  }

  return Math.min(100, (completedUnits / totalUnits) * 100);
}

/**
 * Real-time progress monitoring
 * Returns a subscription for live updates
 */
export function subscribeToJobProgress(
  jobId: string,
  onUpdate: (stats: ChunkStats) => void
) {
  // Poll every 2 seconds for updates
  const intervalId = setInterval(async () => {
    const stats = await getJobChunkStats(jobId);
    onUpdate(stats);

    // Stop polling if job is complete
    if (stats.progressPct >= 100) {
      clearInterval(intervalId);
    }
  }, 2000);

  return () => clearInterval(intervalId);
}

/**
 * Wait for job completion
 * Useful for testing or synchronous operations
 */
export async function waitForJobCompletion(
  jobId: string,
  timeoutMs: number = 300000 // 5 minutes default
): Promise<ProcessingJobStats | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const job = await getProcessingJob(jobId);

    if (!job) {
      return null;
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return job;
    }

    // Wait 2 seconds before checking again
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Timeout
  console.warn(`Job ${jobId} timed out after ${timeoutMs}ms`);
  return null;
}

/**
 * Get processing summary for display
 */
export async function getProcessingSummary(jobId: string): Promise<{
  job: ProcessingJobStats | null;
  chunks: ChunkStats;
  failedChunks: any[];
}> {
  const [job, chunks, failedChunks] = await Promise.all([
    getProcessingJob(jobId),
    getJobChunkStats(jobId),
    getFailedChunks(jobId),
  ]);

  return {
    job,
    chunks,
    failedChunks,
  };
}

/**
 * Find jobs stuck in "running" status
 * A job is considered stuck if it's been in "running" status for longer than the threshold
 */
export async function findStuckJobs(staleThresholdHours: number = 2): Promise<ProcessingJobStats[]> {
  try {
    const thresholdTime = new Date();
    thresholdTime.setHours(thresholdTime.getHours() - staleThresholdHours);

    const { data, error } = await supabaseServer
      .from('processing_jobs')
      .select('*')
      .eq('status', 'running')
      .lt('updated_at', thresholdTime.toISOString())
      .order('updated_at', { ascending: true });

    if (error) {
      console.error(`Failed to find stuck jobs:`, error);
      return [];
    }

    return data.map(job => ({
      id: job.id,
      caseId: job.case_id,
      jobType: job.job_type,
      status: job.status,
      totalUnits: job.total_units,
      completedUnits: job.completed_units,
      failedUnits: job.failed_units,
      progressPercentage: job.progress_percentage || 0,
      estimatedCompletion: job.estimated_completion,
      startedAt: job.started_at,
      completedAt: job.completed_at,
      metadata: job.metadata || {},
    }));
  } catch (error) {
    console.error(`Error finding stuck jobs:`, error);
    return [];
  }
}

/**
 * Clean up stuck jobs by marking them as failed
 * Returns the number of jobs cleaned up
 */
export async function cleanupStuckJobs(staleThresholdHours: number = 2): Promise<{
  cleanedJobCount: number;
  cleanedJobIds: string[];
}> {
  try {
    const stuckJobs = await findStuckJobs(staleThresholdHours);

    if (stuckJobs.length === 0) {
      console.log('No stuck jobs found');
      return { cleanedJobCount: 0, cleanedJobIds: [] };
    }

    console.log(`Found ${stuckJobs.length} stuck jobs. Cleaning up...`);

    const cleanedJobIds: string[] = [];

    for (const job of stuckJobs) {
      try {
        // Mark the job as failed
        const { error: jobError } = await supabaseServer
          .from('processing_jobs')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_summary: {
              error: 'Job stuck in processing',
              message: `Job was stuck in running status for more than ${staleThresholdHours} hours and was automatically cleaned up`,
              cleaned_up_at: new Date().toISOString(),
            },
          })
          .eq('id', job.id);

        if (jobError) {
          console.error(`Failed to update job ${job.id}:`, jobError);
          continue;
        }

        // Mark any pending or processing chunks as failed
        const { error: chunkError } = await supabaseServer
          .from('document_chunks')
          .update({
            processing_status: 'failed',
            error_log: 'Job was stuck and automatically cleaned up',
            processed_at: new Date().toISOString(),
          })
          .eq('processing_job_id', job.id)
          .in('processing_status', ['pending', 'processing']);

        if (chunkError) {
          console.error(`Failed to update chunks for job ${job.id}:`, chunkError);
        }

        cleanedJobIds.push(job.id);
        console.log(`Cleaned up stuck job: ${job.id} (${job.jobType})`);
      } catch (error) {
        console.error(`Error cleaning up job ${job.id}:`, error);
      }
    }

    console.log(`Successfully cleaned up ${cleanedJobIds.length} stuck jobs`);

    return {
      cleanedJobCount: cleanedJobIds.length,
      cleanedJobIds,
    };
  } catch (error) {
    console.error(`Error during cleanup:`, error);
    return { cleanedJobCount: 0, cleanedJobIds: [] };
  }
}

/**
 * Delete stuck jobs completely from the database
 * WARNING: This permanently deletes the jobs and their associated chunks
 * Returns the number of jobs deleted
 */
export async function deleteStuckJobs(staleThresholdHours: number = 2): Promise<{
  deletedJobCount: number;
  deletedJobIds: string[];
}> {
  try {
    const stuckJobs = await findStuckJobs(staleThresholdHours);

    if (stuckJobs.length === 0) {
      console.log('No stuck jobs found');
      return { deletedJobCount: 0, deletedJobIds: [] };
    }

    console.log(`Found ${stuckJobs.length} stuck jobs. Deleting...`);

    const deletedJobIds: string[] = [];

    for (const job of stuckJobs) {
      try {
        // Delete associated document chunks first
        const { error: chunkError } = await supabaseServer
          .from('document_chunks')
          .delete()
          .eq('processing_job_id', job.id);

        if (chunkError) {
          console.error(`Failed to delete chunks for job ${job.id}:`, chunkError);
          continue;
        }

        // Delete the job itself
        const { error: jobError } = await supabaseServer
          .from('processing_jobs')
          .delete()
          .eq('id', job.id);

        if (jobError) {
          console.error(`Failed to delete job ${job.id}:`, jobError);
          continue;
        }

        deletedJobIds.push(job.id);
        console.log(`Deleted stuck job: ${job.id} (${job.jobType})`);
      } catch (error) {
        console.error(`Error deleting job ${job.id}:`, error);
      }
    }

    console.log(`Successfully deleted ${deletedJobIds.length} stuck jobs`);

    return {
      deletedJobCount: deletedJobIds.length,
      deletedJobIds,
    };
  } catch (error) {
    console.error(`Error during deletion:`, error);
    return { deletedJobCount: 0, deletedJobIds: [] };
  }
}
