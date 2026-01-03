/**
 * Inngest Client Configuration
 *
 * Inngest is a job queue and workflow engine that enables:
 * - Asynchronous document processing
 * - Parallel chunk extraction
 * - Automatic retries on failure
 * - Progress tracking
 * - No API timeout issues
 */

import { Inngest, EventSchemas } from 'inngest';

/**
 * Event type definitions for type-safe job triggering
 */
type Events = {
  // Triggered when a document is uploaded
  'document/uploaded': {
    data: {
      caseId: string;
      caseFileId: string;
      storagePath: string;
      fileName: string;
      fileType: string;
      fileSize: number;
    };
  };

  // Triggered to create chunks for a document
  'document/chunk': {
    data: {
      caseId: string;
      caseFileId: string;
      storagePath: string;
      processingJobId: string;
      chunkingStrategy: {
        type: 'page' | 'section' | 'sliding-window';
        pageSize?: number;
        chunkSize?: number;
        overlap?: number;
      };
    };
  };

  // Triggered to process a single chunk
  'chunk/process': {
    data: {
      chunkId: string;
      caseFileId: string;
      storagePath: string;
      pageNumber?: number;
      generateEmbedding?: boolean;
    };
  };

  // Triggered when all chunks for a document are completed
  'document/chunks-completed': {
    data: {
      caseFileId: string;
      processingJobId: string;
      totalChunks: number;
      successfulChunks: number;
      failedChunks: number;
    };
  };

  // Triggered to aggregate chunks into full document
  'document/aggregate': {
    data: {
      caseFileId: string;
      processingJobId: string;
    };
  };

  // Triggered to generate embeddings for chunks (batch)
  'embeddings/generate': {
    data: {
      chunkIds: string[];
      processingJobId: string;
    };
  };

  // Triggered to perform AI analysis on chunked documents
  'analysis/chunked': {
    data: {
      caseId: string;
      analysisType: 'timeline' | 'suspects' | 'evidence' | 'comprehensive';
      chunkIds?: string[]; // Optional: specific chunks to analyze
    };
  };

  // Triggered to run the long-form victim timeline reconstruction
  'analysis/victim-timeline': {
    data: {
      jobId: string;
      caseId: string;
      victimInfo: {
        name: string;
        incidentTime: string;
        incidentLocation?: string | null;
        typicalRoutine?: string | null;
        knownHabits?: string | null;
        regularContacts?: string[] | null;
      };
      requestContext?: {
        digitalRecords?: any;
      };
      requestedAt: string;
    };
  };

  // Triggered to populate Investigation Board from case documents
  'board/populate': {
    data: {
      caseId: string;
      caseFileId?: string; // Optional: populate from specific file, otherwise all files
    };
  };

  // ============================================================================
  // ASYNC ANALYSIS JOBS
  // These events trigger background analysis jobs that avoid API timeouts
  // ============================================================================

  // Triggered to run timeline analysis
  'analysis/timeline': {
    data: {
      jobId: string;
      caseId: string;
    };
  };

  // Triggered to run deep/comprehensive analysis
  'analysis/deep-analysis': {
    data: {
      jobId: string;
      caseId: string;
    };
  };

  // Triggered to run behavioral pattern analysis
  'analysis/behavioral-patterns': {
    data: {
      jobId: string;
      caseId: string;
    };
  };

  // Triggered to run evidence gap analysis
  'analysis/evidence-gaps': {
    data: {
      jobId: string;
      caseId: string;
    };
  };

  // Triggered to run relationship network mapping
  'analysis/relationship-network': {
    data: {
      jobId: string;
      caseId: string;
    };
  };

  // Triggered to run similar cases finder
  'analysis/similar-cases': {
    data: {
      jobId: string;
      caseId: string;
    };
  };

  // Triggered to run overlooked details detection
  'analysis/overlooked-details': {
    data: {
      jobId: string;
      caseId: string;
    };
  };

  // Triggered to run interrogation question generator
  'analysis/interrogation-questions': {
    data: {
      jobId: string;
      caseId: string;
    };
  };

  // Triggered to run forensic retesting recommendations
  'analysis/forensic-retesting': {
    data: {
      jobId: string;
      caseId: string;
    };
  };

  // ============================================================================
  // COMPREHENSIVE ANALYSIS JOBS
  // New jobs for entity resolution, inconsistency detection, and timelines
  // ============================================================================

  // Triggered to process documents in batch with checkpointing
  'batch/process-documents': {
    data: {
      sessionId: string;
      caseId: string;
      documentIds: string[];
      options?: {
        extractEntities?: boolean;
        parseStatements?: boolean;
        generateTimelines?: boolean;
        detectInconsistencies?: boolean;
      };
    };
  };

  // Triggered to resolve entities across all documents
  'analysis/entity-resolution': {
    data: {
      jobId: string;
      caseId: string;
      documentId?: string; // Optional: process single document
      options?: {
        fuzzyThreshold?: number;
        usePhonemicMatching?: boolean;
        useAIDisambiguation?: boolean;
      };
    };
  };

  // Triggered to parse statements and extract claims
  'analysis/parse-statements': {
    data: {
      jobId: string;
      caseId: string;
      statementIds?: string[]; // Optional: parse specific statements
      options?: {
        extractClaims?: boolean;
        identifySpeaker?: boolean;
        extractTimeReferences?: boolean;
      };
    };
  };

  // Triggered to detect inconsistencies across statements
  'analysis/detect-inconsistencies': {
    data: {
      jobId: string;
      caseId: string;
      entityIds?: string[]; // Optional: check specific entities
      options?: {
        detectSelfContradictions?: boolean;
        detectCrossWitness?: boolean;
        detectAlibiIssues?: boolean;
        trackClaimEvolution?: boolean;
      };
    };
  };

  // Triggered to generate person timelines
  'analysis/generate-timelines': {
    data: {
      jobId: string;
      caseId: string;
      entityId?: string; // Optional: generate for specific person
      options?: {
        detectGaps?: boolean;
        minGapDurationMinutes?: number;
        includeInconsistencies?: boolean;
        assessCredibility?: boolean;
      };
    };
  };

  // Triggered to process DNA evidence
  'analysis/process-dna': {
    data: {
      jobId: string;
      caseId: string;
      sampleIds?: string[]; // Optional: process specific samples
      options?: {
        compareProfiles?: boolean;
        findMatches?: boolean;
        generateReport?: boolean;
      };
    };
  };

  // Triggered for comprehensive case analysis pipeline
  'analysis/full-pipeline': {
    data: {
      jobId: string;
      caseId: string;
      phases?: ('documents' | 'entities' | 'statements' | 'inconsistencies' | 'timelines' | 'dna')[];
    };
  };
};

/**
 * Create Inngest client instance
 *
 * Environment variables needed:
 * - INNGEST_EVENT_KEY: For sending events (optional in dev)
 * - INNGEST_SIGNING_KEY: For webhook signature verification (optional in dev)
 */
export const inngest = new Inngest({
  id: 'v0-cracker',
  name: 'V0 Cracker - Cold Case Analysis System',
  schemas: new EventSchemas().fromRecord<Events>(),

  // Development mode configuration
  eventKey: process.env.INNGEST_EVENT_KEY,

  // Production configuration (uses webhook signing)
  ...(process.env.INNGEST_SIGNING_KEY && {
    signingKey: process.env.INNGEST_SIGNING_KEY,
  }),
});

/**
 * Helper function to send events with error handling
 *
 * In development/production without Inngest:
 * - Logs a warning instead of throwing
 * - Allows the app to work without Inngest configured
 */
export async function sendInngestEvent<K extends keyof Events>(
  eventName: K,
  data: Events[K]['data']
): Promise<boolean> {
  // Check if Inngest is configured
  const hasInngestKey = process.env.INNGEST_EVENT_KEY || process.env.INNGEST_SIGNING_KEY;

  if (!hasInngestKey) {
    console.warn(
      `[Inngest] Event not sent (Inngest not configured): ${eventName}`,
      '\nTo enable background jobs, set INNGEST_EVENT_KEY or INNGEST_SIGNING_KEY',
      '\nFor now, this job will not be processed.'
    );
    return false; // Don't throw, just return
  }

  try {
    await inngest.send({
      name: eventName,
      data,
    });
    console.log(`[Inngest] Event sent: ${eventName}`, data);
    return true;
  } catch (error) {
    console.error(`[Inngest] Failed to send event: ${eventName}`, error);
    // Only throw in production if Inngest is expected to work
    if (process.env.NODE_ENV === 'production' && hasInngestKey) {
      throw error;
    }
    // In development or if not configured, just warn
    console.warn('[Inngest] Continuing without background job processing');
    return false;
  }
}

/**
 * Helper to send multiple events at once
 */
export async function sendInngestEvents(
  events: Array<{
    name: keyof Events;
    data: any;
  }>
) {
  try {
    await inngest.send(events);
    console.log(`[Inngest] Sent ${events.length} events`);
  } catch (error) {
    console.error(`[Inngest] Failed to send batch events`, error);
    throw error;
  }
}

export type { Events };
