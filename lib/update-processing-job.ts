import { supabaseServer } from '@/lib/supabase-server';

type ProcessingJobUpdates = Record<string, any>;

export async function updateProcessingJob(
  jobId: string,
  updates: ProcessingJobUpdates,
  context: string = 'ProcessingJob'
) {
  const { progress_percentage, ...sanitizedUpdates } = updates;

  if (progress_percentage !== undefined) {
    // progress_percentage is a generated column; ignore explicit updates
  }

  if (Object.keys(sanitizedUpdates).length === 0) {
    return;
  }

  const { error } = await supabaseServer
    .from('processing_jobs')
    .update(sanitizedUpdates)
    .eq('id', jobId);

  if (error) {
    console.error(`[${context}] Failed to update job ${jobId}`, error);
  }
}
