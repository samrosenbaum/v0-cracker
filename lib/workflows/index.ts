/**
 * Workflow DevKit - Background Analysis Jobs
 *
 * All workflows use Vercel's Workflow DevKit for durable execution.
 * These replace the previous Inngest-based job system.
 *
 * Usage:
 *   import { processTimelineAnalysis } from '@/lib/workflows';
 *   await processTimelineAnalysis({ jobId, caseId });
 */

// Timeline and Events
export { processTimelineAnalysis } from './timeline-analysis';
export { processVictimTimeline } from './victim-timeline';

// Comprehensive Analysis
export { processDeepAnalysis } from './deep-analysis';

// Behavioral & Patterns
export { processBehavioralPatterns } from './behavioral-patterns';
export { processRelationshipNetwork } from './relationship-network';
export { processSimilarCases } from './similar-cases';

// Evidence & Details
export { processEvidenceGaps } from './evidence-gaps';
export { processOverlookedDetails } from './overlooked-details';

// Investigation Tools
export { processInterrogationQuestions } from './interrogation-questions';
export { processForensicRetesting } from './forensic-retesting';

/**
 * Workflow Summary:
 *
 * 1. processTimelineAnalysis - Extract timeline events and detect time conflicts
 * 2. processVictimTimeline - Reconstruct victim's last known movements
 * 3. processDeepAnalysis - Comprehensive 8-dimension cold case analysis
 * 4. processBehavioralPatterns - Analyze interview transcripts for deception indicators
 * 5. processRelationshipNetwork - Map hidden connections between persons of interest
 * 6. processSimilarCases - Find patterns across similar unsolved cases
 * 7. processEvidenceGaps - Identify missing evidence that should exist
 * 8. processOverlookedDetails - Detect small but potentially significant details
 * 9. processInterrogationQuestions - Generate targeted re-interview questions
 * 10. processForensicRetesting - Recommend evidence for modern forensic techniques
 *
 * All workflows:
 * - Use 'use workflow' directive for automatic durability
 * - Use 'use step' for individual durable steps
 * - Accept parameters directly (no event-based triggering)
 * - Support automatic retries and resume after crashes
 * - Update processing_jobs table with progress
 * - Save results to case_analysis table
 */
