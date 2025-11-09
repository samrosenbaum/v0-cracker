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
import { processTimelineAnalysisJob } from '@/lib/jobs/timeline-analysis';
import { processDeepAnalysisJob } from '@/lib/jobs/deep-analysis';
import { processBehavioralPatternsJob } from '@/lib/jobs/behavioral-patterns';
import { processEvidenceGapsJob } from '@/lib/jobs/evidence-gaps';
import { processRelationshipNetworkJob } from '@/lib/jobs/relationship-network';
import { processSimilarCasesJob } from '@/lib/jobs/similar-cases';
import { processOverlookedDetailsJob } from '@/lib/jobs/overlooked-details';
import { processInterrogationQuestionsJob } from '@/lib/jobs/interrogation-questions';
import { processForensicRetestingJob } from '@/lib/jobs/forensic-retesting';

/**
 * Register all Inngest functions (jobs) here
 */
const inngestFunctions = [
  // Document processing
  chunkDocumentJob,
  processChunkJob,
  aggregateDocumentJob,
  generateEmbeddingsJob,

  // Investigation board
  populateInvestigationBoardJob,

  // AI Analysis jobs (async to avoid timeouts)
  processVictimTimelineJob,
  processTimelineAnalysisJob,
  processDeepAnalysisJob,
  processBehavioralPatternsJob,
  processEvidenceGapsJob,
  processRelationshipNetworkJob,
  processSimilarCasesJob,
  processOverlookedDetailsJob,
  processInterrogationQuestionsJob,
  processForensicRetestingJob,
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
