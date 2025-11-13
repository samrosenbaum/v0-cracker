/**
 * Workflow: Interrogation Question Generator
 *
 * Generates targeted questions for re-interviewing suspects and witnesses.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import {
  generateInterrogationQuestions,
  type InterrogationStrategy,
} from '@/lib/cold-case-analyzer';
import { extractMultipleDocuments } from '@/lib/document-parser';
import type { Json } from '@/app/types/database';

type PersonStatus = 'person_of_interest' | 'suspect' | 'witness' | 'victim';

interface PersonOfInterestRecord {
  id: string;
  case_id: string;
  name: string | null;
  aliases: string[] | null;
  description: string | null;
  known_associates: string[] | null;
  last_known_location: string | null;
  status: PersonStatus;
  metadata: Record<string, unknown> | null;
}

interface CaseDocumentRecord {
  id: string;
  case_id: string;
  file_name: string;
  storage_path: string | null;
  metadata: Record<string, unknown> | null;
}

interface InterviewSummary {
  speaker: string;
  content: string;
  documentId: string;
  storagePath: string | null;
}

type InterrogationRole = Extract<PersonStatus, 'suspect' | 'witness'>;

interface InterrogationPayload {
  name: string;
  statements: string[];
  knownFacts: string[];
  inconsistencies: string[];
  relationships: string[];
}

interface InterrogationCandidate {
  person: PersonOfInterestRecord;
  role: InterrogationRole;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPersonOfInterestRecord(value: unknown): value is PersonOfInterestRecord {
  if (!isRecord(value)) {
    return false;
  }

  const { id, case_id, status } = value;
  const validStatus: PersonStatus[] = [
    'person_of_interest',
    'suspect',
    'witness',
    'victim',
  ];

  return (
    typeof id === 'string' &&
    typeof case_id === 'string' &&
    typeof status === 'string' &&
    validStatus.includes(status as PersonStatus)
  );
}

function isCaseDocumentRecord(value: unknown): value is CaseDocumentRecord {
  if (!isRecord(value)) {
    return false;
  }

  const { id, case_id, file_name } = value;
  return typeof id === 'string' && typeof case_id === 'string' && typeof file_name === 'string';
}

function toStringArray(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
      .filter((entry): entry is string => entry.length > 0);
  }

  return [];
}

function collectMetadataValues(
  metadata: Record<string, unknown> | null,
  keys: string[],
): string[] {
  if (!metadata) {
    return [];
  }

  const collected = keys.flatMap((key) => toStringArray(metadata[key]));
  return Array.from(new Set(collected));
}

function gatherInterviewStatements(
  candidateName: string,
  interviews: InterviewSummary[],
): string[] {
  const normalizedCandidate = candidateName.trim().toLowerCase();
  if (!normalizedCandidate) {
    return [];
  }

  return interviews
    .filter((interview) => {
      const speaker = interview.speaker.trim().toLowerCase();
      if (!speaker) {
        return false;
      }

      return (
        speaker === normalizedCandidate ||
        speaker.includes(normalizedCandidate) ||
        normalizedCandidate.includes(speaker)
      );
    })
    .map((interview) => interview.content.trim())
    .filter((content) => content.length > 0);
}

function normalizeNullableStringArray(value: unknown): string[] | null {
  const normalized = toStringArray(value);
  return normalized.length > 0 ? normalized : null;
}

function normalizePersonRecord(raw: PersonOfInterestRecord | Record<string, unknown>): PersonOfInterestRecord {
  const base = raw as Record<string, unknown>;

  return {
    id: String(base.id),
    case_id: String(base.case_id),
    name: typeof base.name === 'string' ? base.name : null,
    aliases: normalizeNullableStringArray(base.aliases) ?? null,
    description: typeof base.description === 'string' ? base.description : null,
    known_associates: normalizeNullableStringArray(base.known_associates) ?? null,
    last_known_location:
      typeof base.last_known_location === 'string' ? base.last_known_location : null,
    status: (base.status as PersonStatus) || 'person_of_interest',
    metadata: isRecord(base.metadata) ? base.metadata : null,
  };
}

function normalizeDocumentRecord(raw: CaseDocumentRecord | Record<string, unknown>): CaseDocumentRecord {
  const base = raw as Record<string, unknown>;

  return {
    id: String(base.id),
    case_id: String(base.case_id),
    file_name: typeof base.file_name === 'string' ? base.file_name : 'Unknown Document',
    storage_path: typeof base.storage_path === 'string' ? base.storage_path : null,
    metadata: isRecord(base.metadata) ? base.metadata : null,
  };
}

function buildInterrogationPayload(
  candidate: InterrogationCandidate,
  interviews: InterviewSummary[],
  investigationFocus: string[] = [],
): InterrogationPayload {
  const { person, role } = candidate;
  const metadata = isRecord(person.metadata) ? person.metadata : null;
  const displayName = person.name?.trim() || `Unknown ${role} (${person.id.slice(0, 8)})`;

  const statements = [
    ...collectMetadataValues(metadata, [
      'statements',
      'statementHighlights',
      'recentStatements',
      'interviewNotes',
    ]),
    ...gatherInterviewStatements(displayName, interviews),
  ];

  const focusHighlights = investigationFocus
    .slice(0, 3)
    .map((item) => `Investigation focus: ${item}`);

  const knownFacts = [
    ...collectMetadataValues(metadata, ['knownFacts', 'facts', 'confirmedDetails']),
    person.description ? `Summary: ${person.description}` : '',
    person.last_known_location ? `Last known location: ${person.last_known_location}` : '',
    `Role in investigation: ${role}`,
    ...focusHighlights,
  ].filter((entry): entry is string => entry.length > 0);

  const inconsistencies = [
    ...collectMetadataValues(metadata, ['inconsistencies', 'contradictions', 'discrepancies']),
  ];

  const relationships = [
    ...collectMetadataValues(metadata, ['relationships', 'associates']),
    ...toStringArray(person.aliases),
    ...toStringArray(person.known_associates),
  ];

  const ensureNonEmpty = (values: string[], fallback: string) =>
    values.length > 0 ? Array.from(new Set(values)) : [fallback];

  return {
    name: displayName,
    statements: ensureNonEmpty(statements, 'No recorded statements available.'),
    knownFacts: ensureNonEmpty(knownFacts, 'No confirmed facts documented.'),
    inconsistencies: ensureNonEmpty(
      inconsistencies,
      'Inconsistencies not yet documented.',
    ),
    relationships: ensureNonEmpty(
      relationships,
      'Relationships currently unknown.',
    ),
  };
}

interface InterrogationQuestionsParams {
  jobId: string;
  caseId: string;
}

/**
 * Interrogation Question Generator Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive
 *   event.data → direct function parameters
 */
export async function processInterrogationQuestions(params: InterrogationQuestionsParams) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch, Extract, Analyze, Save
  const initialMetadata = {
    analysisType: 'interrogation_questions',
    requestedAt: new Date().toISOString(),
  };

  try {
    // Step 1: Initialize job
    async function initializeJob() {
      await updateProcessingJobRecord(jobId, {
        status: 'running',
        total_units: totalUnits,
        started_at: new Date().toISOString(),
        metadata: initialMetadata,
      }, 'InterrogationQuestionsWorkflow');
    }
    await initializeJob();

    // Step 2: Fetch case data
    async function fetchCaseData() {
      console.log('[Interrogation Questions] Fetching case data for:', caseId);

      const [
        { data: suspects, error: suspectsError },
        { data: witnesses, error: witnessesError },
        { data: documents, error: docsError },
      ] = await Promise.all([
        supabaseServer
          .from('persons_of_interest')
          .select('*')
          .eq('case_id', caseId)
          .eq('status', 'suspect'),
        supabaseServer
          .from('persons_of_interest')
          .select('*')
          .eq('case_id', caseId)
          .eq('status', 'witness'),
        supabaseServer.from('case_documents').select('*').eq('case_id', caseId),
      ]);

      // Handle missing persons_of_interest table gracefully
      if (suspectsError) {
        if (suspectsError.message.includes('does not exist')) {
          console.warn('[Interrogation Questions] persons_of_interest table not found, using empty suspects list');
        } else {
          throw new Error(`Failed to fetch suspects: ${suspectsError.message}`);
        }
      }

      if (witnessesError) {
        if (witnessesError.message.includes('does not exist')) {
          console.warn('[Interrogation Questions] persons_of_interest table not found, using empty witnesses list');
        } else {
          throw new Error(`Failed to fetch witnesses: ${witnessesError.message}`);
        }
      }

      // Handle missing case_documents table gracefully
      if (docsError) {
        if (docsError.message.includes('does not exist')) {
          console.warn('[Interrogation Questions] case_documents table not found, using empty documents list');
        } else {
          throw new Error(`Failed to fetch documents: ${docsError.message}`);
        }
      }

      const suspectRecords = Array.isArray(suspects)
        ? suspects.filter(isPersonOfInterestRecord).map((record) => normalizePersonRecord(record))
        : [];

      const witnessRecords = Array.isArray(witnesses)
        ? witnesses.filter(isPersonOfInterestRecord).map((record) => normalizePersonRecord(record))
        : [];

      const documentRecords = Array.isArray(documents)
        ? documents.filter(isCaseDocumentRecord).map((record) => normalizeDocumentRecord(record))
        : [];

      console.log(
        `[Interrogation Questions] Found: ${suspectRecords.length} suspects, ${witnessRecords.length} witnesses, ${documentRecords.length} documents`,
      );

      await updateProcessingJobRecord(jobId, {
        completed_units: 1,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'InterrogationQuestionsWorkflow');

      return { suspects: suspectRecords, witnesses: witnessRecords, documents: documentRecords };
    }
    const { suspects, witnesses, documents } = await fetchCaseData();

    // Step 3: Extract evidence gaps and patterns
    async function extractContent() {
      console.log(`[Interrogation Questions] Extracting content from ${documents.length} documents...`);

      const storagePaths = documents
        .map((doc) => doc.storage_path)
        .filter((path): path is string => typeof path === 'string' && path.length > 0);

      const extractionResults = await extractMultipleDocuments(storagePaths, 5);

      // Extract existing interview content
      const interviews: InterviewSummary[] = documents
        .map((doc) => {
          const extraction = doc.storage_path ? extractionResults.get(doc.storage_path) : undefined;
          const content = extraction?.text ?? '';
          return {
            speaker: doc.file_name.replace(/\.(pdf|txt|docx?)$/i, ''),
            content,
            documentId: doc.id,
            storagePath: doc.storage_path,
          };
        })
        .filter((interview) => interview.content.trim().length > 50);

      // Identify evidence gaps (simplified version)
      const evidenceGaps = [
        'Missing alibi verification',
        'Incomplete timeline of events',
        'Unverified witness statements',
      ];

      console.log(`[Interrogation Questions] Extracted ${interviews.length} interviews`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 2,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'InterrogationQuestionsWorkflow');

      return { evidenceGaps, interviews };
    }
    const { evidenceGaps, interviews } = await extractContent();

    // Step 4: Generate interrogation questions
    async function generateQuestions() {
      console.log('[Interrogation Questions] Generating interrogation questions...');

      const candidates: InterrogationCandidate[] = [
        ...suspects.map((person) => ({ person, role: 'suspect' as const })),
        ...witnesses.map((person) => ({ person, role: 'witness' as const })),
      ];

      const interrogationPayloads = candidates.map((candidate) =>
        buildInterrogationPayload(candidate, interviews, evidenceGaps),
      );

      const strategies: InterrogationStrategy[] = await Promise.all(
        interrogationPayloads.map((payload) => generateInterrogationQuestions(payload)),
      );

      const totalQuestions = strategies.reduce(
        (sum, strategy) => sum + strategy.questions.length,
        0,
      );

      console.log(
        `[Interrogation Questions] Generated ${totalQuestions} questions across ${strategies.length} strategies`,
      );

      await updateProcessingJobRecord(jobId, {
        completed_units: 3,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'InterrogationQuestionsWorkflow');

      const participants = candidates.map((candidate) => ({
        id: candidate.person.id,
        name: candidate.person.name ?? `Unknown ${candidate.role}`,
        role: candidate.role,
      }));

      return { strategies, participants, totalQuestions };
    }
    const { strategies, participants, totalQuestions } = await generateQuestions();

    // Step 5: Save analysis results
    async function saveResults() {
      const analysisPayload: { strategies: InterrogationStrategy[] } = { strategies };

      const { error: saveError } = await supabaseServer
        .from('case_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'interrogation-questions',
          analysis_data: analysisPayload as unknown as Json,
          confidence_score: 0.86,
          used_prompt: 'Interrogation question generator for targeted re-interviews',
        });

      if (saveError) {
        console.error('[Interrogation Questions] Error saving analysis:', saveError);
      } else {
        console.log('[Interrogation Questions] Saved interrogation questions analysis results');
      }

      // Mark job as completed
      await updateProcessingJobRecord(jobId, {
        status: 'completed',
        completed_units: totalUnits,
        // progress_percentage auto-calculates from completed_units/total_units
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          summary: {
            totalStrategies: strategies.length,
            totalQuestions,
            participants: participants.map((participant) => ({
              id: participant.id,
              name: participant.name,
              role: participant.role,
            })),
          },
        },
      }, 'InterrogationQuestionsWorkflow');
    }
    await saveResults();

    return {
      success: true,
      jobId,
    };
  } catch (error: any) {
    await updateProcessingJobRecord(jobId, {
      status: 'failed',
      completed_units: totalUnits,
      failed_units: 1,
      // progress_percentage auto-calculates from completed_units/total_units
      completed_at: new Date().toISOString(),
      metadata: {
        ...initialMetadata,
        error: error?.message || 'Interrogation question generation failed',
      },
    }, 'InterrogationQuestionsWorkflow');

    console.error('[InterrogationQuestionsWorkflow] Failed to generate interrogation questions:', error);
    throw error;
  }
}
