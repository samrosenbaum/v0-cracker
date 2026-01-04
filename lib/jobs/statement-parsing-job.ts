/**
 * Inngest Job: Statement Parsing
 *
 * Parses witness/suspect statements and extracts structured claims.
 * Identifies temporal references, locations, and key assertions.
 */

import { inngest } from '@/lib/inngest-client';
import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import {
  parseStatement,
  getStatementClaims,
} from '@/lib/statement-parser';

interface StatementParsingEventData {
  jobId: string;
  caseId: string;
  statementIds?: string[];
  options?: {
    extractClaims?: boolean;
    identifySpeaker?: boolean;
    extractTimeReferences?: boolean;
  };
}

async function updateProcessingJob(jobId: string, updates: Record<string, any>) {
  await updateProcessingJobRecord(jobId, updates, 'StatementParsingJob');
}

export const processStatementParsingJob = inngest.createFunction(
  {
    id: 'statement-parsing',
    name: 'Statement Parsing - Claim Extraction',
    retries: 2,
    concurrency: {
      limit: 3,
    },
  },
  { event: 'analysis/parse-statements' },
  async ({ event, step }) => {
    const { jobId, caseId, statementIds, options } = event.data as StatementParsingEventData;

    const totalUnits = 3; // Fetch, Parse, Summarize
    const initialMetadata = {
      analysisType: 'statement_parsing',
      requestedAt: new Date().toISOString(),
      options,
    };

    try {
      // Step 1: Initialize job
      await step.run('initialize-job', async () => {
        await updateProcessingJob(jobId, {
          status: 'running',
          total_units: totalUnits,
          started_at: new Date().toISOString(),
          metadata: initialMetadata,
        });
      });

      // Step 2: Fetch statements
      const statements = await step.run('fetch-statements', async () => {
        console.log(`[Statement Parsing] Fetching statements for case ${caseId}`);

        let query = supabaseServer
          .from('statements')
          .select('*')
          .eq('case_id', caseId);

        if (statementIds && statementIds.length > 0) {
          query = query.in('id', statementIds);
        }

        const { data, error } = await query.order('statement_date', { ascending: true });

        if (error) {
          throw new Error(`Failed to fetch statements: ${error.message}`);
        }

        console.log(`[Statement Parsing] Found ${data?.length || 0} statements`);

        await updateProcessingJob(jobId, {
          completed_units: 1,
          progress_percentage: 33,
        });

        return data || [];
      });

      // Step 3: Parse each statement
      const parsingResults = await step.run('parse-statements', async () => {
        console.log(`[Statement Parsing] Parsing ${statements.length} statements`);

        let totalClaims = 0;
        let timeReferences = 0;
        let locationReferences = 0;
        let parsedStatements = 0;

        for (const statement of statements) {
          try {
            // Parse the statement
            const parseResult = await parseStatement(statement.id);

            // Get extracted claims
            const claims = await getStatementClaims(statement.id);

            totalClaims += claims.length;

            // Count specific types
            for (const claim of claims) {
              if (claim.claimType === 'temporal') timeReferences++;
              if (claim.claimType === 'location') locationReferences++;
            }

            parsedStatements++;

            console.log(`[Statement Parsing] Parsed statement ${statement.id}: ${claims.length} claims`);

          } catch (error: any) {
            console.warn(`[Statement Parsing] Warning parsing statement ${statement.id}:`, error.message);
          }
        }

        await updateProcessingJob(jobId, {
          completed_units: 2,
          progress_percentage: 66,
        });

        return {
          statementsProcessed: parsedStatements,
          totalClaims,
          timeReferences,
          locationReferences,
        };
      });

      // Step 4: Generate summary
      await step.run('summarize-results', async () => {
        console.log(`[Statement Parsing] Generating summary`);

        // Get unique speakers
        const { data: speakers, error: speakersError } = await supabaseServer
          .from('statements')
          .select('speaker_entity_id')
          .eq('case_id', caseId)
          .not('speaker_entity_id', 'is', null);

        const uniqueSpeakers = new Set(speakers?.map(s => s.speaker_entity_id) || []).size;

        // Get claim type breakdown
        const { data: claimBreakdown, error: claimsError } = await supabaseServer
          .from('statement_claims')
          .select('claim_type')
          .eq('case_id', caseId);

        const claimTypes: Record<string, number> = {};
        for (const claim of claimBreakdown || []) {
          claimTypes[claim.claim_type] = (claimTypes[claim.claim_type] || 0) + 1;
        }

        await updateProcessingJob(jobId, {
          status: 'completed',
          completed_units: totalUnits,
          progress_percentage: 100,
          completed_at: new Date().toISOString(),
          metadata: {
            ...initialMetadata,
            results: {
              ...parsingResults,
              uniqueSpeakers,
              claimTypeBreakdown: claimTypes,
            },
          },
        });

        return { uniqueSpeakers, claimTypes };
      });

      console.log(`[Statement Parsing] Job ${jobId} completed`);

      return {
        success: true,
        jobId,
        stats: parsingResults,
      };

    } catch (error: any) {
      await updateProcessingJob(jobId, {
        status: 'failed',
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          error: error.message,
        },
      });

      console.error(`[Statement Parsing] Job ${jobId} failed:`, error);
      throw error;
    }
  }
);
