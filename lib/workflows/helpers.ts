/**
 * Workflow Helper Functions
 *
 * Common step functions used across multiple workflows.
 * These are defined at module level to comply with Workflow DevKit requirements.
 */

import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';

interface FailureJobInput {
  jobId: string;
  totalUnits: number;
  initialMetadata: Record<string, any>;
  error: any;
  workflowName: string;
}

/**
 * Common step function for handling workflow failures
 *
 * This function is invoked as a step from catch handlers in all workflows.
 * It updates the processing job with failure status and logs the error.
 */
export async function handleWorkflowFailure(
  input: FailureJobInput,
): Promise<void> {
  'use step';

  const { jobId, totalUnits, initialMetadata, error, workflowName } = input;

  await updateProcessingJobRecord(
    jobId,
    {
      status: 'failed',
      completed_units: totalUnits,
      failed_units: 1,
      completed_at: new Date().toISOString(),
      metadata: {
        ...initialMetadata,
        error: error?.message || `${workflowName} analysis failed`,
      },
    },
    workflowName,
  );

  console.error(`[${workflowName}] Failed to process workflow:`, error);
}
