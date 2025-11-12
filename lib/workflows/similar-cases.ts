/**
 * Workflow: Similar Cases Finder
 *
 * Finds patterns across similar unsolved cases in the database.
 * This workflow runs in the background with automatic retries and durability.
 *
 * Migrated from Inngest to Workflow DevKit
 */

import type { PostgrestError } from '@supabase/supabase-js';

import { supabaseServer } from '@/lib/supabase-server';
import { updateProcessingJob as updateProcessingJobRecord } from '@/lib/update-processing-job';
import { findSimilarCases } from '@/lib/cold-case-analyzer';
import type { CaseSimilarity } from '@/lib/cold-case-analyzer';

interface SimilarCasesParams {
  jobId: string;
  caseId: string;
}

type CaseRecord = {
  id: string;
  description?: string | null;
  location?: string | null;
  victim_name?: string | null;
  title?: string | null;
  name?: string | null;
} & Record<string, any>;

interface CaseContext {
  description: string;
  location: string;
  victimProfile: string;
  modusOperandi: string;
  suspects: string[];
}

type CaseEntityRow = {
  case_id: string;
  name?: string | null;
  role?: string | null;
  description?: string | null;
  metadata?: Record<string, any> | null;
};

type SuspectRow = {
  case_id: string;
  name?: string | null;
  alias?: string | null;
  description?: string | null;
  metadata?: Record<string, any> | null;
};

type CaseDocumentRow = {
  case_id: string;
  file_name?: string | null;
  document_type?: string | null;
  metadata?: Record<string, any> | null;
  notes?: string | null;
};

type EvidenceEventRow = {
  case_id: string;
  type?: string | null;
  description?: string | null;
  location?: string | null;
  date?: string | null;
  tags?: string[] | null;
};

type CaseAnalysisRow = {
  case_id: string;
  analysis_type: string;
  analysis_data: any;
};

const MODUS_DOCUMENT_KEYWORDS = ['modus', 'crime', 'scene', 'attack', 'weapon', 'pattern', 'entry', 'approach'];
const MODUS_EVENT_KEYWORDS = ['attack', 'entry', 'evidence', 'incident', 'crime', 'weapon'];
const MODUS_ANALYSIS_TYPES = new Set([
  'behavioral-patterns',
  'forensic-retesting',
  'evidence-gaps',
  'timeline_and_conflicts',
  'comprehensive_cold_case',
]);

function isMissingTableError(error: PostgrestError | null): boolean {
  if (!error) return false;
  return error.code === '42P01' || /does not exist/i.test(error.message);
}

function stringFromMetadata(metadata: Record<string, any> | null | undefined): string {
  if (!metadata || typeof metadata !== 'object') return '';
  const entries: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    const valueText = stringifyValue(value);
    if (valueText) {
      entries.push(`${key}: ${valueText}`);
    }
  }
  return entries.join('; ');
}

function stringifyValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map((item) => stringifyValue(item)).filter(Boolean).join(', ');
  }
  if (typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}: ${stringifyValue(val)}`)
      .join('; ');
  }
  return '';
}

function normaliseLocation(location: string | null | undefined): string {
  if (!location) return 'Unknown';
  return String(location).trim() || 'Unknown';
}

function buildVictimProfile(caseRecord: CaseRecord, entities: CaseEntityRow[]): string {
  const parts: string[] = [];
  if (caseRecord.victim_name) {
    parts.push(`Primary victim: ${caseRecord.victim_name}`);
  }

  entities
    .filter((entity) => (entity.role || '').toLowerCase().includes('victim'))
    .forEach((entity) => {
      const name = entity.name || 'Unnamed individual';
      const role = entity.role ? entity.role.replace(/_/g, ' ') : 'victim';
      const description = entity.description ? `: ${entity.description}` : '';
      const metadataText = stringFromMetadata(entity.metadata);
      const metadataSuffix = metadataText ? ` (${metadataText})` : '';
      parts.push(`${name} (${role})${description}${metadataSuffix}`.trim());
    });

  return parts.join('\n');
}

function buildSuspectList(entities: CaseEntityRow[], suspects: SuspectRow[]): string[] {
  const suspectNames = new Set<string>();

  suspects.forEach((suspect) => {
    const segments = [suspect.name, suspect.alias ? `alias: ${suspect.alias}` : '', suspect.description]
      .map((segment) => (segment ? segment.trim() : ''))
      .filter(Boolean);
    const text = segments.join(' — ');
    if (text) {
      suspectNames.add(text);
    }
  });

  entities
    .filter((entity) => (entity.role || '').toLowerCase().includes('suspect'))
    .forEach((entity) => {
      const details = [entity.name, entity.description, stringFromMetadata(entity.metadata)]
        .map((segment) => (segment ? segment.trim() : ''))
        .filter(Boolean)
        .join(' — ');
      if (details) {
        suspectNames.add(details);
      }
    });

  return Array.from(suspectNames);
}

function matchesModusDocument(document: CaseDocumentRow): boolean {
  const type = document.document_type?.toLowerCase() || '';
  if (MODUS_DOCUMENT_KEYWORDS.some((keyword) => type.includes(keyword))) {
    return true;
  }
  const metadataText = stringFromMetadata(document.metadata);
  return metadataText ? MODUS_DOCUMENT_KEYWORDS.some((keyword) => metadataText.toLowerCase().includes(keyword)) : false;
}

function isModusRelatedEvent(event: EvidenceEventRow): boolean {
  const type = event.type?.toLowerCase() || '';
  if (MODUS_EVENT_KEYWORDS.some((keyword) => type.includes(keyword))) {
    return true;
  }
  const description = event.description?.toLowerCase() || '';
  return MODUS_EVENT_KEYWORDS.some((keyword) => description.includes(keyword));
}

function extractAnalysisSummary(analysis: CaseAnalysisRow): string {
  if (!analysis || typeof analysis !== 'object') return '';
  const data = analysis.analysis_data;
  if (!data) return '';

  const prioritized = [
    data.modusOperandi,
    data.modus_operandi,
    data.signatureBehaviors,
    data.patternSummary,
    data.summary?.modusOperandi,
    data.summary?.patterns,
    data.summary,
  ];

  for (const candidate of prioritized) {
    const text = stringifyValue(candidate);
    if (text) return text;
  }

  if (Array.isArray(data.patterns)) {
    const patternText = data.patterns
      .map((pattern: any) => stringifyValue(pattern))
      .filter(Boolean)
      .join(' | ');
    if (patternText) return patternText;
  }

  if (typeof data === 'string') {
    return data;
  }

  return '';
}

function buildModusOperandi(
  caseRecord: CaseRecord,
  documents: CaseDocumentRow[],
  evidenceEvents: EvidenceEventRow[],
  analyses: CaseAnalysisRow[],
): string {
  const parts: string[] = [];

  documents.filter(matchesModusDocument).forEach((document) => {
    const metadataText = stringFromMetadata(document.metadata);
    const label = document.file_name || document.document_type || 'Document';
    const detail = [label, metadataText, document.notes].filter(Boolean).join(' — ');
    parts.push(detail);
  });

  evidenceEvents.filter(isModusRelatedEvent).forEach((event) => {
    const location = event.location ? ` @ ${event.location}` : '';
    const description = event.description || '';
    const detail = `${event.type || 'event'}${location}${description ? `: ${description}` : ''}`.trim();
    if (detail) {
      parts.push(detail);
    }
  });

  analyses
    .filter((analysis) => MODUS_ANALYSIS_TYPES.has(analysis.analysis_type))
    .forEach((analysis) => {
      const summary = extractAnalysisSummary(analysis);
      if (summary) {
        parts.push(`${analysis.analysis_type}: ${summary}`);
      }
    });

  const combined = parts.filter(Boolean).join('\n');
  if (combined) {
    return combined;
  }

  return caseRecord.description || '';
}

function buildCaseContext(
  caseRecord: CaseRecord,
  entities: CaseEntityRow[],
  suspects: SuspectRow[],
  documents: CaseDocumentRow[],
  evidenceEvents: EvidenceEventRow[],
  analyses: CaseAnalysisRow[],
): CaseContext {
  return {
    description: caseRecord.description || '',
    location: normaliseLocation(caseRecord.location),
    victimProfile: buildVictimProfile(caseRecord, entities),
    modusOperandi: buildModusOperandi(caseRecord, documents, evidenceEvents, analyses),
    suspects: buildSuspectList(entities, suspects),
  };
}

async function buildCaseContexts(caseRecords: CaseRecord[]): Promise<Map<string, CaseContext>> {
  const contexts = new Map<string, CaseContext>();
  if (caseRecords.length === 0) {
    return contexts;
  }

  const caseIds = caseRecords.map((record) => record.id);

  const [entitiesResult, suspectsResult, documentsResult, evidenceResult, analysisResult] = await Promise.all([
    supabaseServer
      .from('case_entities')
      .select('case_id, name, role, description, metadata')
      .in('case_id', caseIds)
      .then(({ data, error }) => {
        if (isMissingTableError(error)) {
          console.warn('[Similar Cases] case_entities table missing. Victim/suspect context will be limited.');
          return [] as CaseEntityRow[];
        }
        if (error) {
          throw new Error(`Failed to fetch case entities: ${error.message}`);
        }
        return (data as CaseEntityRow[]) || [];
      })
      .catch((error) => {
        console.warn('[Similar Cases] Error fetching case entities:', error);
        return [] as CaseEntityRow[];
      }),
    supabaseServer
      .from('suspects')
      .select('case_id, name, alias, description, metadata')
      .in('case_id', caseIds)
      .then(({ data, error }) => {
        if (isMissingTableError(error)) {
          console.warn('[Similar Cases] suspects table missing.');
          return [] as SuspectRow[];
        }
        if (error) {
          throw new Error(`Failed to fetch suspects: ${error.message}`);
        }
        return (data as SuspectRow[]) || [];
      })
      .catch((error) => {
        console.warn('[Similar Cases] Error fetching suspects:', error);
        return [] as SuspectRow[];
      }),
    supabaseServer
      .from('case_documents')
      .select('case_id, file_name, document_type, metadata, notes')
      .in('case_id', caseIds)
      .then(({ data, error }) => {
        if (isMissingTableError(error)) {
          console.warn('[Similar Cases] case_documents table missing.');
          return [] as CaseDocumentRow[];
        }
        if (error) {
          throw new Error(`Failed to fetch case documents: ${error.message}`);
        }
        return (data as CaseDocumentRow[]) || [];
      })
      .catch((error) => {
        console.warn('[Similar Cases] Error fetching case documents:', error);
        return [] as CaseDocumentRow[];
      }),
    supabaseServer
      .from('evidence_events')
      .select('case_id, type, description, location, date, tags')
      .in('case_id', caseIds)
      .then(({ data, error }) => {
        if (isMissingTableError(error)) {
          console.warn('[Similar Cases] evidence_events table missing.');
          return [] as EvidenceEventRow[];
        }
        if (error) {
          throw new Error(`Failed to fetch evidence events: ${error.message}`);
        }
        return (data as EvidenceEventRow[]) || [];
      })
      .catch((error) => {
        console.warn('[Similar Cases] Error fetching evidence events:', error);
        return [] as EvidenceEventRow[];
      }),
    supabaseServer
      .from('case_analysis')
      .select('case_id, analysis_type, analysis_data')
      .in('case_id', caseIds)
      .then(({ data, error }) => {
        if (isMissingTableError(error)) {
          console.warn('[Similar Cases] case_analysis table missing.');
          return [] as CaseAnalysisRow[];
        }
        if (error) {
          throw new Error(`Failed to fetch case analysis records: ${error.message}`);
        }
        return (data as CaseAnalysisRow[]) || [];
      })
      .catch((error) => {
        console.warn('[Similar Cases] Error fetching case analysis records:', error);
        return [] as CaseAnalysisRow[];
      }),
  ]);

  const entitiesByCase = groupByCase(entitiesResult);
  const suspectsByCase = groupByCase(suspectsResult);
  const documentsByCase = groupByCase(documentsResult);
  const evidenceByCase = groupByCase(evidenceResult);
  const analysisByCase = groupByCase(analysisResult);

  caseRecords.forEach((record) => {
    const entities = entitiesByCase.get(record.id) || [];
    const suspects = suspectsByCase.get(record.id) || [];
    const documents = documentsByCase.get(record.id) || [];
    const evidence = evidenceByCase.get(record.id) || [];
    const analyses = analysisByCase.get(record.id) || [];

    contexts.set(
      record.id,
      buildCaseContext(record, entities, suspects, documents, evidence, analyses),
    );
  });

  return contexts;
}

function groupByCase<T extends { case_id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  rows.forEach((row) => {
    const current = map.get(row.case_id) || [];
    current.push(row);
    map.set(row.case_id, current);
  });
  return map;
}

function buildFallbackCaseContext(caseRecord: CaseRecord): CaseContext {
  return {
    description: caseRecord.description || '',
    location: normaliseLocation(caseRecord.location),
    victimProfile: caseRecord.victim_name ? `Primary victim: ${caseRecord.victim_name}` : '',
    modusOperandi: caseRecord.description || '',
    suspects: [],
  };
}

type SimilarCaseCandidate = Partial<CaseSimilarity> & {
  caseId: string;
  caseTitle: string;
  similarityScore: number;
  commonPatterns?: CaseSimilarity['matchingPatterns'];
};

function isValidPattern(value: any): value is CaseSimilarity['matchingPatterns'][number] {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.category === 'string' &&
    typeof value.details === 'string'
  );
}

function normalizeSuspectOverlap(value: any): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

export function normalizeSimilarCaseResults(results: SimilarCaseCandidate[]): CaseSimilarity[] {
  return results.map((result) => {
    const matchingPatternsSource = Array.isArray(result.matchingPatterns)
      ? result.matchingPatterns
      : Array.isArray(result.commonPatterns)
        ? result.commonPatterns
        : [];

    const matchingPatterns = matchingPatternsSource.filter(isValidPattern);

    return {
      caseId: result.caseId,
      caseTitle: result.caseTitle,
      similarityScore: typeof result.similarityScore === 'number' ? result.similarityScore : 0,
      matchingPatterns,
      suspectOverlap: normalizeSuspectOverlap(result.suspectOverlap),
      recommendation: typeof result.recommendation === 'string' ? result.recommendation : '',
    };
  });
}

export function calculateSimilarCaseSummary(similarCases: CaseSimilarity[]) {
  return {
    totalSimilarCases: similarCases.length,
    highSimilarity: similarCases.filter((c) => c.similarityScore > 0.7).length,
    matchingPatternCount: similarCases.reduce((sum, c) => sum + c.matchingPatterns.length, 0),
  };
}

/**
 * Similar Cases Finder Workflow
 *
 * Converts from:
 *   inngest.createFunction() → async function with 'use workflow'
 *   step.run() → 'use step' directive
 *   event.data → direct function parameters
 */
export async function processSimilarCases(params: SimilarCasesParams) {
  'use workflow';

  const { jobId, caseId } = params;

  const totalUnits = 4; // Fetch Current, Fetch Others, Analyze, Save
  const initialMetadata = {
    analysisType: 'similar_cases',
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
      }, 'SimilarCasesWorkflow');
    }
    await initializeJob();

    // Step 2: Fetch current case data
    async function fetchCurrentCase() {
      console.log('[Similar Cases] Fetching current case data for:', caseId);

      const { data: currentCase, error: caseError } = await supabaseServer
        .from('cases')
        .select('*')
        .eq('id', caseId)
        .single();

      if (caseError) throw new Error(`Failed to fetch case: ${caseError.message}`);

      console.log(`[Similar Cases] Current case: ${currentCase.title || currentCase.name}`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 1,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'SimilarCasesWorkflow');

      return { currentCase };
    }
    const { currentCase } = await fetchCurrentCase();

    // Step 3: Fetch other cases
    async function fetchOtherCases() {
      console.log('[Similar Cases] Fetching other cases for comparison...');

      const { data: otherCases, error: casesError } = await supabaseServer
        .from('cases')
        .select('*')
        .neq('id', caseId)
        .limit(50); // Limit to avoid processing too many cases

      if (casesError) throw new Error(`Failed to fetch other cases: ${casesError.message}`);

      console.log(`[Similar Cases] Found ${otherCases?.length || 0} other cases to compare`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 2,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'SimilarCasesWorkflow');

      return { otherCases: otherCases || [] };
    }
    const { otherCases } = await fetchOtherCases();

    // Step 4: Run similar cases analysis
    async function analyzeSimilarCases() {
      console.log('[Similar Cases] Finding similar cases...');

      const caseRecords = [currentCase, ...otherCases];
      const caseContexts = await buildCaseContexts(caseRecords);

      const currentCaseContext =
        caseContexts.get(currentCase.id) ||
        buildFallbackCaseContext(currentCase);

      const databaseCases = otherCases.map((c) => {
        const context = caseContexts.get(c.id) || buildFallbackCaseContext(c);
        return {
          id: c.id,
          title: c.title || c.name || 'Unnamed Case',
          description: context.description,
          location: context.location,
          victimProfile: context.victimProfile,
          modusOperandi: context.modusOperandi,
          suspects: context.suspects,
        };
      });

      const rawSimilarCases = await findSimilarCases(currentCaseContext, databaseCases);
      const similarCases = normalizeSimilarCaseResults(rawSimilarCases);

      console.log(`[Similar Cases] Found ${similarCases.length} similar cases`);

      await updateProcessingJobRecord(jobId, {
        completed_units: 3,
        // progress_percentage auto-calculates from completed_units/total_units
      }, 'SimilarCasesWorkflow');

      return similarCases;
    }
    const similarCases = await analyzeSimilarCases();

    // Step 5: Save analysis results
    async function saveResults() {
      const { error: saveError } = await supabaseServer
        .from('case_analysis')
        .insert({
          case_id: caseId,
          analysis_type: 'similar-cases',
          analysis_data: { similarCases } as any,
          confidence_score: 0.82,
          used_prompt: 'Similar cases finder to identify patterns across unsolved cases',
        });

      if (saveError) {
        console.error('[Similar Cases] Error saving analysis:', saveError);
      } else {
        console.log('[Similar Cases] Saved similar cases analysis results');
      }

      // Mark job as completed
      await updateProcessingJobRecord(jobId, {
        status: 'completed',
        completed_units: totalUnits,
        // progress_percentage auto-calculates from completed_units/total_units
        completed_at: new Date().toISOString(),
        metadata: {
          ...initialMetadata,
          summary: calculateSimilarCaseSummary(similarCases),
        },
      }, 'SimilarCasesWorkflow');
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
        error: error?.message || 'Similar cases analysis failed',
      },
    }, 'SimilarCasesWorkflow');

    console.error('[SimilarCasesWorkflow] Failed to process similar cases:', error);
    throw error;
  }
}
