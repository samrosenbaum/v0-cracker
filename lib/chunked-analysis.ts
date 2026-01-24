/**
 * Chunked Analysis System
 *
 * Handles large cold case files (hundreds of documents) by breaking
 * the analysis into batches that each complete within 60s (Vercel Hobby limit).
 *
 * Flow:
 * 1. EXTRACT phase: Ensure all documents have cached text
 * 2. ANALYZE phase: Process documents in batches of ~25, accumulate findings
 * 3. CONSOLIDATE phase: Cross-reference all findings, find patterns
 *
 * State is persisted in the `processing_jobs` table metadata between calls.
 * The frontend drives continuation by repeatedly calling /analyze/continue.
 */

import { supabaseServer } from '@/lib/supabase-server';
import { DEFAULT_ANTHROPIC_MODEL, getAnthropicClient, isAnthropicConfigured } from './anthropic-client';
import { extractDocumentContent } from './document-parser';
import type { CaseAnalysis, TimelineEvent, PersonMention, Conflict } from './ai-analysis';
import type { DocumentInput } from './ai-fallback';

// Max documents per AI analysis batch (keeps prompt under ~150K tokens)
const DOCS_PER_ANALYSIS_BATCH = 25;
// Max documents to extract per "continue" call
const DOCS_PER_EXTRACT_BATCH = 10;

export interface ChunkedJobState {
  phase: 'extract' | 'analyze' | 'consolidate' | 'complete' | 'failed';
  // Extraction tracking
  totalDocuments: number;
  extractedCount: number;
  extractionErrors: string[];
  // Analysis tracking
  totalBatches: number;
  currentBatch: number;
  // Accumulated findings across batches
  accumulatedTimeline: TimelineEvent[];
  accumulatedPersons: PersonMention[];
  accumulatedConflicts: Conflict[];
  accumulatedInsights: string[];
  accumulatedTips: any[];
  accumulatedSuspects: any[];
  // Final result
  finalAnalysis?: CaseAnalysis;
  error?: string;
}

export interface ContinueResult {
  done: boolean;
  phase: string;
  progress: {
    current: number;
    total: number;
    percentage: number;
  };
  message: string;
  analysis?: CaseAnalysis;
  warnings?: string[];
}

/**
 * Initialize a chunked analysis job.
 * Returns the job ID and initial state.
 */
export async function initChunkedAnalysis(caseId: string, jobId: string): Promise<ContinueResult> {
  // Count total documents
  const { data: documents, error: docError } = await supabaseServer
    .from('case_documents')
    .select('id, storage_path, extracted_text')
    .eq('case_id', caseId);

  if (docError || !documents || documents.length === 0) {
    throw new Error(docError?.message || 'No documents found for this case');
  }

  const extractedCount = documents.filter(d => d.extracted_text && d.extracted_text.length > 10).length;
  const totalBatches = Math.ceil(documents.length / DOCS_PER_ANALYSIS_BATCH);

  const state: ChunkedJobState = {
    phase: extractedCount < documents.length ? 'extract' : 'analyze',
    totalDocuments: documents.length,
    extractedCount,
    extractionErrors: [],
    totalBatches,
    currentBatch: 0,
    accumulatedTimeline: [],
    accumulatedPersons: [],
    accumulatedConflicts: [],
    accumulatedInsights: [],
    accumulatedTips: [],
    accumulatedSuspects: [],
  };

  // Save state to job
  await supabaseServer
    .from('processing_jobs')
    .update({
      status: 'running',
      metadata: { chunkedState: state, caseId },
    })
    .eq('id', jobId);

  const needsExtraction = documents.length - extractedCount;
  return {
    done: false,
    phase: state.phase,
    progress: {
      current: 0,
      total: documents.length + totalBatches + 1, // extract + analyze + consolidate
      percentage: 0,
    },
    message: needsExtraction > 0
      ? `Starting extraction for ${needsExtraction} unprocessed documents...`
      : `All ${documents.length} documents ready. Starting analysis in ${totalBatches} batches...`,
  };
}

/**
 * Continue processing the next step of a chunked analysis.
 * Called repeatedly by the frontend until done=true.
 */
export async function continueChunkedAnalysis(jobId: string): Promise<ContinueResult> {
  // Load job state
  const { data: job, error: jobError } = await supabaseServer
    .from('processing_jobs')
    .select('id, case_id, metadata, status')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new Error(`Job not found: ${jobError?.message || jobId}`);
  }

  if (job.status === 'completed' || job.status === 'failed') {
    const state = (job.metadata as any)?.chunkedState as ChunkedJobState;
    return {
      done: true,
      phase: state?.phase || 'complete',
      progress: { current: 1, total: 1, percentage: 100 },
      message: job.status === 'completed' ? 'Analysis complete.' : `Analysis failed: ${state?.error || 'Unknown error'}`,
      analysis: state?.finalAnalysis,
    };
  }

  const caseId = (job.metadata as any)?.caseId;
  const state: ChunkedJobState = (job.metadata as any)?.chunkedState;

  if (!state || !caseId) {
    throw new Error('Invalid job state');
  }

  try {
    let result: ContinueResult;

    switch (state.phase) {
      case 'extract':
        result = await runExtractionBatch(caseId, jobId, state);
        break;
      case 'analyze':
        result = await runAnalysisBatch(caseId, jobId, state);
        break;
      case 'consolidate':
        result = await runConsolidation(caseId, jobId, state);
        break;
      default:
        result = {
          done: true,
          phase: state.phase,
          progress: { current: 1, total: 1, percentage: 100 },
          message: 'Analysis complete.',
          analysis: state.finalAnalysis,
        };
    }

    return result;
  } catch (error: any) {
    state.phase = 'failed';
    state.error = error.message;
    await supabaseServer
      .from('processing_jobs')
      .update({
        status: 'failed',
        metadata: { chunkedState: state, caseId },
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    throw error;
  }
}

/**
 * Extract text from the next batch of unprocessed documents.
 */
async function runExtractionBatch(caseId: string, jobId: string, state: ChunkedJobState): Promise<ContinueResult> {
  // Find documents without extracted text
  const { data: unextracted } = await supabaseServer
    .from('case_documents')
    .select('id, storage_path, file_name')
    .eq('case_id', caseId)
    .or('extracted_text.is.null,extracted_text.eq.')
    .limit(DOCS_PER_EXTRACT_BATCH);

  if (!unextracted || unextracted.length === 0) {
    // All extracted, move to analyze phase
    state.phase = 'analyze';
    state.extractedCount = state.totalDocuments;
    await saveJobState(jobId, state, caseId);

    return {
      done: false,
      phase: 'analyze',
      progress: computeProgress(state),
      message: `All ${state.totalDocuments} documents extracted. Starting AI analysis...`,
    };
  }

  // Extract this batch
  let newlyExtracted = 0;
  for (const doc of unextracted) {
    if (!doc.storage_path) continue;
    try {
      const result = await extractDocumentContent(doc.storage_path, true);
      if (result.text && result.text.length > 0) {
        newlyExtracted++;
      } else {
        state.extractionErrors.push(`${doc.file_name}: No text could be extracted`);
      }
    } catch (err: any) {
      state.extractionErrors.push(`${doc.file_name}: ${err.message}`);
    }
  }

  state.extractedCount += newlyExtracted;

  // Check if more to extract
  const remaining = state.totalDocuments - state.extractedCount - state.extractionErrors.length;
  if (remaining <= 0) {
    state.phase = 'analyze';
  }

  await saveJobState(jobId, state, caseId);

  return {
    done: false,
    phase: state.phase,
    progress: computeProgress(state),
    message: state.phase === 'analyze'
      ? `Extraction complete (${state.extractedCount} docs). Starting analysis...`
      : `Extracted ${state.extractedCount}/${state.totalDocuments} documents...`,
    warnings: state.extractionErrors.length > 0
      ? [`${state.extractionErrors.length} documents had extraction issues`]
      : undefined,
  };
}

/**
 * Run AI analysis on the next batch of documents.
 */
async function runAnalysisBatch(caseId: string, jobId: string, state: ChunkedJobState): Promise<ContinueResult> {
  if (!isAnthropicConfigured()) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Cannot run AI analysis.');
  }

  // Fetch all documents with extracted text
  const { data: allDocs } = await supabaseServer
    .from('case_documents')
    .select('id, file_name, document_type, extracted_text')
    .eq('case_id', caseId)
    .not('extracted_text', 'is', null)
    .order('created_at', { ascending: true });

  if (!allDocs || allDocs.length === 0) {
    throw new Error('No documents with extracted text available');
  }

  // Determine which batch to process
  const batchStart = state.currentBatch * DOCS_PER_ANALYSIS_BATCH;
  const batchEnd = Math.min(batchStart + DOCS_PER_ANALYSIS_BATCH, allDocs.length);
  const batchDocs = allDocs.slice(batchStart, batchEnd);

  if (batchDocs.length === 0) {
    // All batches done, move to consolidation
    state.phase = 'consolidate';
    await saveJobState(jobId, state, caseId);
    return {
      done: false,
      phase: 'consolidate',
      progress: computeProgress(state),
      message: `All ${state.totalBatches} batches analyzed. Running cross-reference consolidation...`,
    };
  }

  // Recalculate total batches based on actual docs with text
  state.totalBatches = Math.ceil(allDocs.length / DOCS_PER_ANALYSIS_BATCH);

  console.log(`[Chunked Analysis] Processing batch ${state.currentBatch + 1}/${state.totalBatches} (${batchDocs.length} docs)`);

  // Build context from previous findings for continuity
  const previousContext = state.accumulatedTimeline.length > 0
    ? buildPreviousContext(state)
    : '';

  // Run AI analysis on this batch
  const batchAnalysis = await analyzeBatch(batchDocs, state.currentBatch + 1, state.totalBatches, previousContext);

  // Accumulate findings
  if (batchAnalysis.timeline) {
    state.accumulatedTimeline.push(...batchAnalysis.timeline);
  }
  if (batchAnalysis.personMentions) {
    mergePersonMentions(state.accumulatedPersons, batchAnalysis.personMentions);
  }
  if (batchAnalysis.conflicts) {
    state.accumulatedConflicts.push(...batchAnalysis.conflicts);
  }
  if (batchAnalysis.keyInsights) {
    state.accumulatedInsights.push(...batchAnalysis.keyInsights);
  }
  if (batchAnalysis.unfollowedTips) {
    state.accumulatedTips.push(...batchAnalysis.unfollowedTips);
  }
  if (batchAnalysis.suspectAnalysis) {
    state.accumulatedSuspects.push(...batchAnalysis.suspectAnalysis);
  }

  state.currentBatch++;

  // Check if more batches
  if (state.currentBatch >= state.totalBatches) {
    state.phase = 'consolidate';
  }

  await saveJobState(jobId, state, caseId);

  return {
    done: false,
    phase: state.phase,
    progress: computeProgress(state),
    message: state.phase === 'consolidate'
      ? `All batches complete. Found ${state.accumulatedTimeline.length} events, ${state.accumulatedPersons.length} persons. Consolidating...`
      : `Batch ${state.currentBatch}/${state.totalBatches} complete. Found ${state.accumulatedTimeline.length} events so far...`,
  };
}

/**
 * Final consolidation pass - cross-references all findings.
 */
async function runConsolidation(caseId: string, jobId: string, state: ChunkedJobState): Promise<ContinueResult> {
  console.log('[Chunked Analysis] Running consolidation pass...');

  let finalAnalysis: CaseAnalysis;

  if (isAnthropicConfigured() && (state.accumulatedTimeline.length > 0 || state.accumulatedPersons.length > 0)) {
    // Run consolidation through AI to find cross-document patterns
    finalAnalysis = await consolidateWithAI(state);
  } else {
    // Use accumulated results directly
    finalAnalysis = {
      timeline: deduplicateTimeline(state.accumulatedTimeline),
      conflicts: state.accumulatedConflicts,
      personMentions: deduplicatePersons(state.accumulatedPersons),
      unfollowedTips: state.accumulatedTips,
      keyInsights: [...new Set(state.accumulatedInsights)],
      suspectAnalysis: deduplicateSuspects(state.accumulatedSuspects),
    };
  }

  state.phase = 'complete';
  state.finalAnalysis = finalAnalysis;

  // Save to case_analysis table
  await supabaseServer
    .from('case_analysis')
    .insert({
      case_id: caseId,
      analysis_type: 'timeline_and_conflicts',
      analysis_data: finalAnalysis as any,
      confidence_score: 0.85,
      used_prompt: `Chunked analysis: ${state.totalBatches} batches, ${state.totalDocuments} documents`,
    });

  // Save timeline events
  if (finalAnalysis.timeline.length > 0) {
    const timelineInserts = finalAnalysis.timeline.map(event => ({
      case_id: caseId,
      event_type: mapEventType(event.sourceType),
      title: event.description?.substring(0, 100) || 'Timeline Event',
      description: event.description || null,
      event_time: event.time || event.startTime || null,
      event_date: event.date || null,
      time_precision: event.startTime && event.endTime ? 'approximate' as const
        : event.time ? 'exact' as const : 'estimated' as const,
      time_range_start: event.startTime || null,
      time_range_end: event.endTime || null,
      location: event.location || null,
      primary_entity_id: null,
      verification_status: 'unverified' as const,
      confidence_score: event.confidence || 0.5,
      source_type: event.sourceType,
      source_notes: event.source || null,
      metadata: event.metadata || {},
    }));

    const { error: timelineError } = await supabaseServer
      .from('timeline_events')
      .insert(timelineInserts);

    if (timelineError) {
      console.error('[Chunked Analysis] Error saving timeline:', timelineError);
    }
  }

  // Mark job complete
  await supabaseServer
    .from('processing_jobs')
    .update({
      status: 'completed',
      metadata: { chunkedState: state, caseId },
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  return {
    done: true,
    phase: 'complete',
    progress: { current: 1, total: 1, percentage: 100 },
    message: `Analysis complete: ${finalAnalysis.timeline.length} events, ${finalAnalysis.personMentions.length} persons, ${finalAnalysis.conflicts.length} conflicts identified across ${state.totalDocuments} documents.`,
    analysis: finalAnalysis,
  };
}

// --- AI Calls ---

const BATCH_ANALYSIS_PROMPT = `You are an expert forensic analyst for cold case investigations. You are analyzing a BATCH of case documents (batch {batchNum} of {totalBatches}).

Extract ALL factual information from these documents. Be extremely thorough - do not skip any detail, name, date, location, or statement. Cold cases are solved by finding overlooked details.

{previousContext}

For EACH document, extract:
1. TIMELINE EVENTS: Every date, time, action, observation. Include who was where and when.
2. PERSONS: Every person mentioned - witnesses, suspects, victims, associates, officers, family.
3. CONFLICTS: Any contradictions between statements, timeline inconsistencies, alibi problems.
4. UNFOLLOWED TIPS: Leads mentioned but not pursued, evidence suggested but not collected.
5. KEY INSIGHTS: Patterns, suspicious behaviors, overlooked connections.

Return valid JSON matching this structure:
{
  "timeline": [{ "id": "evt_N", "date": "YYYY-MM-DD", "time": "HH:MM", "description": "...", "source": "document name", "sourceType": "interview|witness_statement|police_report|forensic_report|tip|other", "location": "...", "involvedPersons": ["..."], "confidence": 0.0-1.0 }],
  "conflicts": [{ "type": "time_inconsistency|location_mismatch|statement_contradiction|alibi_conflict", "severity": "low|medium|high|critical", "description": "...", "events": [], "affectedPersons": ["..."], "details": "...", "recommendation": "..." }],
  "personMentions": [{ "name": "...", "aliases": ["..."], "mentionedBy": ["source doc"], "mentionCount": N, "contexts": ["..."], "role": "suspect|witness|victim|associate|unknown", "suspicionScore": 0.0-1.0 }],
  "unfollowedTips": [{ "tipId": "tip_N", "source": "...", "description": "...", "suggestedAction": "...", "priority": "low|medium|high", "reason": "..." }],
  "keyInsights": ["..."],
  "suspectAnalysis": [{ "name": "...", "riskScore": 0.0-1.0, "reasoning": "..." }]
}

Be EXHAUSTIVE. Every name, every date, every location matters in a cold case.`;

async function analyzeBatch(
  docs: { file_name: string; document_type: string; extracted_text: string }[],
  batchNum: number,
  totalBatches: number,
  previousContext: string
): Promise<CaseAnalysis> {
  const anthropic = getAnthropicClient();

  const documentsText = docs
    .map((doc, idx) => `=== DOCUMENT ${idx + 1}: ${doc.file_name} (${doc.document_type || 'unknown'}) ===\n${doc.extracted_text}\n`)
    .join('\n\n');

  const prompt = BATCH_ANALYSIS_PROMPT
    .replace('{batchNum}', String(batchNum))
    .replace('{totalBatches}', String(totalBatches))
    .replace('{previousContext}', previousContext);

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `${prompt}\n\nDOCUMENTS:\n\n${documentsText}\n\nRespond with valid JSON only.`,
    }],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from Claude');
  }

  return parseAnalysisJSON(content.text);
}

const CONSOLIDATION_PROMPT = `You are an expert forensic analyst performing the FINAL CONSOLIDATION of a cold case analysis.

You have analyzed {totalDocs} documents in {totalBatches} batches. Below are ALL accumulated findings. Your job is to:

1. DEDUPLICATE: Merge duplicate timeline events and person mentions
2. CROSS-REFERENCE: Find connections between events/persons across different documents
3. IDENTIFY PATTERNS: Behavioral patterns, timing patterns, relationship patterns
4. FIND CONTRADICTIONS: Statements that conflict across different documents
5. HIGHLIGHT OVERLOOKED LEADS: Tips and evidence that were never followed up
6. RANK SUSPECTS: Based on the totality of evidence, who deserves more scrutiny

ACCUMULATED TIMELINE EVENTS ({eventCount}):
{timeline}

ACCUMULATED PERSONS ({personCount}):
{persons}

ACCUMULATED CONFLICTS ({conflictCount}):
{conflicts}

ACCUMULATED INSIGHTS:
{insights}

Return a CONSOLIDATED analysis as valid JSON with the same structure, but with:
- Duplicates merged
- Cross-document patterns highlighted in keyInsights
- Conflicts updated with cross-document contradictions
- suspectAnalysis updated with comprehensive risk scoring
- Unfollowed tips prioritized by investigative value`;

async function consolidateWithAI(state: ChunkedJobState): Promise<CaseAnalysis> {
  const anthropic = getAnthropicClient();

  // Summarize accumulated data for the consolidation prompt
  const timelineSummary = state.accumulatedTimeline
    .map(e => `[${e.date || 'unknown'}] ${e.description} (source: ${e.source}, persons: ${e.involvedPersons.join(', ')})`)
    .join('\n');

  const personsSummary = state.accumulatedPersons
    .map(p => `${p.name} (${p.role || 'unknown'}, mentions: ${p.mentionCount}, suspicion: ${p.suspicionScore})`)
    .join('\n');

  const conflictsSummary = state.accumulatedConflicts
    .map(c => `[${c.severity}] ${c.description}`)
    .join('\n');

  const prompt = CONSOLIDATION_PROMPT
    .replace('{totalDocs}', String(state.totalDocuments))
    .replace('{totalBatches}', String(state.totalBatches))
    .replace('{eventCount}', String(state.accumulatedTimeline.length))
    .replace('{timeline}', timelineSummary || 'None')
    .replace('{personCount}', String(state.accumulatedPersons.length))
    .replace('{persons}', personsSummary || 'None')
    .replace('{conflictCount}', String(state.accumulatedConflicts.length))
    .replace('{conflicts}', conflictsSummary || 'None')
    .replace('{insights}', state.accumulatedInsights.join('\n') || 'None');

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: `${prompt}\n\nRespond with valid JSON only.`,
    }],
  });

  const content = message.content[0];
  if (content.type !== 'text') {
    throw new Error('Unexpected response type from consolidation');
  }

  return parseAnalysisJSON(content.text);
}

// --- Helpers ---

function buildPreviousContext(state: ChunkedJobState): string {
  if (state.accumulatedTimeline.length === 0 && state.accumulatedPersons.length === 0) {
    return '';
  }

  const parts: string[] = ['CONTEXT FROM PREVIOUS BATCHES (use this to identify connections and contradictions):'];

  if (state.accumulatedPersons.length > 0) {
    parts.push(`Known persons: ${state.accumulatedPersons.map(p => `${p.name} (${p.role})`).join(', ')}`);
  }

  if (state.accumulatedTimeline.length > 0) {
    const recentEvents = state.accumulatedTimeline.slice(-10);
    parts.push(`Recent events: ${recentEvents.map(e => `[${e.date}] ${e.description}`).join('; ')}`);
  }

  if (state.accumulatedConflicts.length > 0) {
    parts.push(`Known conflicts: ${state.accumulatedConflicts.map(c => c.description).join('; ')}`);
  }

  return parts.join('\n');
}

function mergePersonMentions(existing: PersonMention[], newMentions: PersonMention[]) {
  for (const mention of newMentions) {
    const found = existing.find(p =>
      p.name.toLowerCase() === mention.name.toLowerCase() ||
      p.aliases.some(a => a.toLowerCase() === mention.name.toLowerCase()) ||
      mention.aliases.some(a => a.toLowerCase() === p.name.toLowerCase())
    );

    if (found) {
      found.mentionCount += mention.mentionCount;
      found.mentionedBy.push(...mention.mentionedBy.filter(m => !found.mentionedBy.includes(m)));
      found.contexts.push(...mention.contexts.slice(0, 3));
      found.aliases.push(...mention.aliases.filter(a => !found.aliases.includes(a)));
      found.suspicionScore = Math.max(found.suspicionScore, mention.suspicionScore);
      if (mention.role && mention.role !== 'unknown') {
        found.role = mention.role;
      }
    } else {
      existing.push({ ...mention });
    }
  }
}

function deduplicateTimeline(events: TimelineEvent[]): TimelineEvent[] {
  const seen = new Map<string, TimelineEvent>();
  for (const event of events) {
    const key = `${event.date}_${event.description?.substring(0, 50)}`;
    if (!seen.has(key)) {
      seen.set(key, event);
    }
  }
  return Array.from(seen.values()).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
}

function deduplicatePersons(persons: PersonMention[]): PersonMention[] {
  const merged: PersonMention[] = [];
  mergePersonMentions(merged, persons);
  return merged.sort((a, b) => b.suspicionScore - a.suspicionScore);
}

function deduplicateSuspects(suspects: any[]): any[] {
  const seen = new Map<string, any>();
  for (const s of suspects) {
    const key = s.name?.toLowerCase();
    if (key && !seen.has(key)) {
      seen.set(key, s);
    } else if (key && seen.has(key)) {
      const existing = seen.get(key)!;
      existing.riskScore = Math.max(existing.riskScore || 0, s.riskScore || 0);
      existing.reasoning = `${existing.reasoning}; ${s.reasoning}`;
    }
  }
  return Array.from(seen.values()).sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0));
}

function parseAnalysisJSON(text: string): CaseAnalysis {
  const responseText = text.trim();
  let parsed: CaseAnalysis | null = null;

  // Strategy 1: Clean JSON
  if (responseText.startsWith('{')) {
    try { parsed = JSON.parse(responseText); } catch { /* try next */ }
  }

  // Strategy 2: Code-fenced JSON
  if (!parsed) {
    const fencedMatch = responseText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fencedMatch) {
      try { parsed = JSON.parse(fencedMatch[1]); } catch { /* try next */ }
    }
  }

  // Strategy 3: Brace matching
  if (!parsed) {
    const first = responseText.indexOf('{');
    const last = responseText.lastIndexOf('}');
    if (first !== -1 && last > first) {
      try { parsed = JSON.parse(responseText.substring(first, last + 1)); } catch { /* fail */ }
    }
  }

  if (!parsed) {
    throw new Error('Failed to parse AI response as JSON');
  }

  // Provide defaults
  return {
    timeline: parsed.timeline || [],
    conflicts: parsed.conflicts || [],
    personMentions: parsed.personMentions || [],
    unfollowedTips: parsed.unfollowedTips || [],
    keyInsights: parsed.keyInsights || [],
    suspectAnalysis: parsed.suspectAnalysis || [],
  };
}

function computeProgress(state: ChunkedJobState): { current: number; total: number; percentage: number } {
  const extractSteps = state.totalDocuments;
  const analyzeSteps = state.totalBatches;
  const consolidateStep = 1;
  const total = extractSteps + analyzeSteps + consolidateStep;

  let current = 0;
  if (state.phase === 'extract') {
    current = state.extractedCount;
  } else if (state.phase === 'analyze') {
    current = extractSteps + state.currentBatch;
  } else if (state.phase === 'consolidate') {
    current = extractSteps + analyzeSteps;
  } else {
    current = total;
  }

  return { current, total, percentage: Math.round((current / total) * 100) };
}

function mapEventType(sourceType: string): string {
  const map: Record<string, string> = {
    interview: 'witness_account',
    witness_statement: 'witness_account',
    police_report: 'other',
    forensic_report: 'evidence_found',
    tip: 'other',
    other: 'other',
  };
  return map[sourceType] || 'other';
}

async function saveJobState(jobId: string, state: ChunkedJobState, caseId: string) {
  await supabaseServer
    .from('processing_jobs')
    .update({
      metadata: { chunkedState: state, caseId },
    })
    .eq('id', jobId);
}
