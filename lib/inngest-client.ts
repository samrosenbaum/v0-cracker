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
 */
export async function sendInngestEvent<K extends keyof Events>(
  eventName: K,
  data: Events[K]['data']
) {
  try {
    await inngest.send({
      name: eventName,
      data,
    });
    console.log(`[Inngest] Event sent: ${eventName}`, data);
  } catch (error) {
    console.error(`[Inngest] Failed to send event: ${eventName}`, error);
    throw error;
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
