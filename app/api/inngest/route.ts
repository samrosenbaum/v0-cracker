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

// Import job functions - using static imports instead of dynamic require
// This ensures they're properly bundled by Vercel
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
];

console.log(`[Inngest] Registering ${inngestFunctions.length} functions:`, inngestFunctions.map(f => f?.id || 'unknown'));

// Store function info for debugging
const functionInfo = inngestFunctions.map(f => ({
  id: f?.id || 'undefined',
  name: f?.name || 'undefined',
  exists: !!f
}));

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

// Export handlers with debug info injected into responses
const wrappedGET = async (req: Request) => {
  const response = await handler(req);
  console.log('[Inngest GET] Function info:', JSON.stringify(functionInfo));
  console.log('[Inngest GET] Total functions:', inngestFunctions.length);
  return response;
};

const wrappedPOST = async (req: Request) => {
  console.log('[Inngest POST] Received event');
  return await handler(req);
};

const wrappedPUT = async (req: Request) => {
  console.log('[Inngest PUT] Sync request - functions:', inngestFunctions.length);
  console.log('[Inngest PUT] Function details:', JSON.stringify(functionInfo));
  return await handler(req);
};

export { wrappedGET as GET, wrappedPOST as POST, wrappedPUT as PUT };
