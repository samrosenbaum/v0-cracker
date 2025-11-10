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

// Import all job functions with error handling
let processVictimTimelineJob: any;
let processTimelineAnalysisJob: any;
let processDeepAnalysisJob: any;
let processBehavioralPatternsJob: any;
let processEvidenceGapsJob: any;
let processRelationshipNetworkJob: any;
let processSimilarCasesJob: any;
let processOverlookedDetailsJob: any;
let processInterrogationQuestionsJob: any;
let processForensicRetestingJob: any;

try {
  ({ processVictimTimelineJob } = require('@/lib/jobs/victim-timeline'));
  ({ processTimelineAnalysisJob } = require('@/lib/jobs/timeline-analysis'));
  ({ processDeepAnalysisJob } = require('@/lib/jobs/deep-analysis'));
  ({ processBehavioralPatternsJob } = require('@/lib/jobs/behavioral-patterns'));
  ({ processEvidenceGapsJob } = require('@/lib/jobs/evidence-gaps'));
  ({ processRelationshipNetworkJob } = require('@/lib/jobs/relationship-network'));
  ({ processSimilarCasesJob } = require('@/lib/jobs/similar-cases'));
  ({ processOverlookedDetailsJob } = require('@/lib/jobs/overlooked-details'));
  ({ processInterrogationQuestionsJob } = require('@/lib/jobs/interrogation-questions'));
  ({ processForensicRetestingJob } = require('@/lib/jobs/forensic-retesting'));

  console.log('[Inngest] Successfully loaded all job functions');
} catch (error) {
  console.error('[Inngest] Failed to load job functions:', error);
}

/**
 * Register all Inngest functions (jobs) here
 *
 * NOTE: Document processing and investigation board jobs are disabled due to canvas dependency
 * These features have fallback implementations that run synchronously
 */
const inngestFunctions = [
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
].filter(Boolean); // Remove any undefined functions

console.log(`[Inngest] Registering ${inngestFunctions.length} functions`);

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
