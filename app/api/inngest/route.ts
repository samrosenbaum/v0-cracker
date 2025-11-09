/**
 * Inngest API Route
 *
 * This endpoint serves the Inngest webhook handler.
 * Inngest will send job execution requests to this endpoint.
 *
 * URL: /api/inngest
 *
 * In development, this connects to Inngest Dev Server
 * In production, this connects to Inngest Cloud
 */

import { serve } from 'inngest/next';
import { inngest } from '@/lib/inngest-client';

// Import all job functions
import {
  chunkDocumentJob,
  processChunkJob,
  aggregateDocumentJob,
  generateEmbeddingsJob,
} from '@/lib/jobs/process-document-chunks';

import { populateInvestigationBoardJob } from '@/lib/jobs/populate-investigation-board';
import { processVictimTimelineJob } from '@/lib/jobs/victim-timeline';

/**
 * Register all Inngest functions (jobs) here
 */
const inngestFunctions = [
  chunkDocumentJob,
  processChunkJob,
  aggregateDocumentJob,
  generateEmbeddingsJob,
  populateInvestigationBoardJob,
  processVictimTimelineJob,
];

/**
 * Create the Inngest handler
 * This handles both GET (for Inngest dashboard) and POST (for job execution)
 */
const handler = serve({
  client: inngest,
  functions: inngestFunctions,

  // Serve the Inngest UI in development
  streaming: 'allow',
});

export { handler as GET, handler as POST, handler as PUT };
