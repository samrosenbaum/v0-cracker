/**
 * RAG (Retrieval-Augmented Generation) Pipeline
 *
 * Enables the AI to query the knowledge base for relevant context
 * when analyzing cases. This is how we handle 40,000+ pages without
 * the AI "forgetting" - it queries what it needs when it needs it.
 *
 * Key capabilities:
 * - Semantic search across all documents
 * - Fact-based retrieval for specific queries
 * - Person-centric context assembly
 * - Topic-focused evidence gathering
 * - Contradiction-aware context building
 */

import { supabaseServer } from './supabase-server';
import { getAnthropicClient, DEFAULT_ANTHROPIC_MODEL, isAnthropicConfigured } from './anthropic-client';
import OpenAI from 'openai';
import type { AtomicFact } from './atomic-facts';
import type { PersonProfile } from './person-profiles';
import type { Contradiction } from './contradiction-engine';
import { getFactsForCase, queryFacts, getSuspiciousFacts, getContradictedFacts } from './atomic-facts';
import { getAllPersonProfiles, getPersonClaims, getPersonAlibis, getGuiltyKnowledgeIndicators } from './person-profiles';
import { getContradictionsForCase, getCriticalContradictions } from './contradiction-engine';

// ============================================================================
// Types
// ============================================================================

export interface RAGContext {
  // Core case information
  caseSummary: CaseSummary;

  // Retrieved facts relevant to the query
  relevantFacts: AtomicFact[];

  // Person profiles if relevant
  relevantPersons: PersonProfile[];

  // Contradictions to highlight
  relevantContradictions: Contradiction[];

  // Suspicious findings
  suspiciousFindings: AtomicFact[];

  // Source documents referenced
  sourceDocuments: string[];

  // Metadata
  retrievalMetadata: {
    query: string;
    totalFactsSearched: number;
    factsRetrieved: number;
    searchStrategy: string;
    retrievalTimeMs: number;
  };
}

export interface CaseSummary {
  caseId: string;
  caseName: string;
  victimName?: string;
  crimeDate?: string;
  crimeLocation?: string;
  crimeType?: string;
  totalDocuments: number;
  totalFacts: number;
  totalPersons: number;
  totalContradictions: number;
  topSuspects: { name: string; score: number }[];
  keyUnresolvedQuestions: string[];
}

export interface AnalysisQuery {
  caseId: string;
  queryType: 'general' | 'suspect_analysis' | 'timeline' | 'evidence' |
             'contradictions' | 'person_focused' | 'topic_focused';
  query: string;
  focusPerson?: string;
  focusTopic?: string;
  timeRange?: { start: string; end: string };
  maxFacts?: number;
}

export interface RAGAnalysisResult {
  analysis: string;
  context: RAGContext;
  suggestedFollowups: string[];
  confidence: number;
}

// ============================================================================
// OpenAI Embeddings
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
});

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('OpenAI API key not configured');
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    return null;
  }
}

// ============================================================================
// Context Retrieval
// ============================================================================

export async function retrieveContext(query: AnalysisQuery): Promise<RAGContext> {
  const startTime = Date.now();

  // Get case summary
  const caseSummary = await buildCaseSummary(query.caseId);

  // Retrieve relevant facts based on query type
  let relevantFacts: AtomicFact[] = [];
  let searchStrategy = '';

  switch (query.queryType) {
    case 'suspect_analysis':
      searchStrategy = 'suspect-focused retrieval';
      relevantFacts = await retrieveSuspectFacts(query);
      break;

    case 'timeline':
      searchStrategy = 'timeline-focused retrieval';
      relevantFacts = await retrieveTimelineFacts(query);
      break;

    case 'evidence':
      searchStrategy = 'evidence-focused retrieval';
      relevantFacts = await retrieveEvidenceFacts(query);
      break;

    case 'contradictions':
      searchStrategy = 'contradiction-focused retrieval';
      relevantFacts = await retrieveContradictionFacts(query);
      break;

    case 'person_focused':
      searchStrategy = 'person-focused retrieval';
      relevantFacts = await retrievePersonFacts(query);
      break;

    case 'topic_focused':
      searchStrategy = 'topic-focused retrieval';
      relevantFacts = await retrieveTopicFacts(query);
      break;

    default:
      searchStrategy = 'semantic search';
      relevantFacts = await semanticFactSearch(query);
  }

  // Get relevant persons
  const relevantPersons = await getRelevantPersons(query.caseId, relevantFacts, query.focusPerson);

  // Get relevant contradictions
  const relevantContradictions = await getRelevantContradictions(query.caseId, relevantFacts);

  // Get suspicious findings
  const suspiciousFindings = await getSuspiciousFacts(query.caseId);

  // Extract source documents
  const sourceDocuments = extractSourceDocuments(relevantFacts);

  // Calculate total facts
  const { data: factCount } = await supabaseServer
    .from('atomic_facts')
    .select('id', { count: 'exact' })
    .eq('case_id', query.caseId);

  return {
    caseSummary,
    relevantFacts,
    relevantPersons,
    relevantContradictions,
    suspiciousFindings: suspiciousFindings.slice(0, 20),
    sourceDocuments,
    retrievalMetadata: {
      query: query.query,
      totalFactsSearched: factCount?.length || 0,
      factsRetrieved: relevantFacts.length,
      searchStrategy,
      retrievalTimeMs: Date.now() - startTime
    }
  };
}

// ============================================================================
// Query-Type Specific Retrieval
// ============================================================================

async function retrieveSuspectFacts(query: AnalysisQuery): Promise<AtomicFact[]> {
  const facts: AtomicFact[] = [];

  // Get top suspects
  const profiles = await getAllPersonProfiles(query.caseId);
  const topSuspects = profiles
    .filter(p => p.suspicionScore >= 30)
    .sort((a, b) => b.suspicionScore - a.suspicionScore)
    .slice(0, 5);

  for (const suspect of topSuspects) {
    const suspectFacts = await queryFacts({
      caseId: query.caseId,
      personMentioned: suspect.canonicalName,
      limit: 20
    });
    facts.push(...suspectFacts);
  }

  // Also get contradicted facts (highly relevant for suspect analysis)
  const contradictedFacts = await getContradictedFacts(query.caseId);
  facts.push(...contradictedFacts);

  // Deduplicate
  return deduplicateFacts(facts).slice(0, query.maxFacts || 100);
}

async function retrieveTimelineFacts(query: AnalysisQuery): Promise<AtomicFact[]> {
  const timelineFactTypes: AtomicFact['factType'][] = [
    'location_claim',
    'timeline_claim',
    'alibi',
    'action_claim',
    'observation'
  ];

  const facts = await queryFacts({
    caseId: query.caseId,
    factTypes: timelineFactTypes,
    limit: query.maxFacts || 100
  });

  // Sort by time if possible
  facts.sort((a, b) => {
    const timeA = a.timeReference?.earliest ? new Date(a.timeReference.earliest).getTime() : 0;
    const timeB = b.timeReference?.earliest ? new Date(b.timeReference.earliest).getTime() : 0;
    return timeA - timeB;
  });

  return facts;
}

async function retrieveEvidenceFacts(query: AnalysisQuery): Promise<AtomicFact[]> {
  const evidenceFactTypes: AtomicFact['factType'][] = [
    'physical_evidence',
    'forensic_finding'
  ];

  return queryFacts({
    caseId: query.caseId,
    factTypes: evidenceFactTypes,
    limit: query.maxFacts || 100
  });
}

async function retrieveContradictionFacts(query: AnalysisQuery): Promise<AtomicFact[]> {
  // Get all facts involved in contradictions
  const contradictions = await getContradictionsForCase(query.caseId);

  const factIds = new Set<string>();
  contradictions.forEach(c => {
    factIds.add(c.fact1Id);
    factIds.add(c.fact2Id);
  });

  const facts = await getFactsForCase(query.caseId);
  return facts.filter(f => factIds.has(f.id));
}

async function retrievePersonFacts(query: AnalysisQuery): Promise<AtomicFact[]> {
  if (!query.focusPerson) {
    return [];
  }

  return queryFacts({
    caseId: query.caseId,
    personMentioned: query.focusPerson,
    limit: query.maxFacts || 100
  });
}

async function retrieveTopicFacts(query: AnalysisQuery): Promise<AtomicFact[]> {
  if (!query.focusTopic) {
    return semanticFactSearch(query);
  }

  // First try semantic search with the topic
  return semanticFactSearch({
    ...query,
    query: query.focusTopic
  });
}

async function semanticFactSearch(query: AnalysisQuery): Promise<AtomicFact[]> {
  const embedding = await generateEmbedding(query.query);

  if (!embedding) {
    // Fallback to keyword search
    return keywordFactSearch(query);
  }

  const { data, error } = await supabaseServer
    .rpc('search_atomic_facts', {
      p_case_id: query.caseId,
      query_embedding: embedding,
      match_threshold: 0.6,
      match_count: query.maxFacts || 50
    });

  if (error) {
    console.error('Semantic search failed:', error);
    return keywordFactSearch(query);
  }

  // Transform results to AtomicFact
  return (data || []).map(transformSearchResultToFact);
}

async function keywordFactSearch(query: AnalysisQuery): Promise<AtomicFact[]> {
  // Extract keywords from query
  const keywords = query.query.toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 3);

  const allFacts = await getFactsForCase(query.caseId);

  // Score facts by keyword matches
  const scoredFacts = allFacts.map(fact => {
    const text = `${fact.subject} ${fact.predicate} ${fact.source.originalQuote}`.toLowerCase();
    const score = keywords.filter(k => text.includes(k)).length;
    return { fact, score };
  });

  // Return top scoring facts
  return scoredFacts
    .filter(sf => sf.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, query.maxFacts || 50)
    .map(sf => sf.fact);
}

function transformSearchResultToFact(row: Record<string, unknown>): AtomicFact {
  return {
    id: row.id as string,
    caseId: '', // Not returned by search
    factType: row.fact_type as AtomicFact['factType'],
    subject: row.subject as string,
    predicate: row.predicate as string,
    source: row.source as AtomicFact['source'],
    mentionedPersons: row.mentioned_persons as string[] || [],
    mentionedLocations: [],
    mentionedEvidence: [],
    mentionedVehicles: [],
    corroboratingFactIds: [],
    contradictingFactIds: [],
    relatedFactIds: [],
    verificationStatus: row.verification_status as AtomicFact['verificationStatus'],
    confidenceScore: 0.8,
    isSuspicious: row.is_suspicious as boolean,
    extractedAt: '',
    lastUpdated: ''
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

async function buildCaseSummary(caseId: string): Promise<CaseSummary> {
  // Get case info
  const { data: caseData } = await supabaseServer
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single();

  // Get counts
  const [
    { count: docCount },
    { count: factCount },
    { count: personCount },
    { count: contradictionCount }
  ] = await Promise.all([
    supabaseServer.from('case_documents').select('*', { count: 'exact', head: true }).eq('case_id', caseId),
    supabaseServer.from('atomic_facts').select('*', { count: 'exact', head: true }).eq('case_id', caseId),
    supabaseServer.from('person_profiles').select('*', { count: 'exact', head: true }).eq('case_id', caseId),
    supabaseServer.from('fact_contradictions').select('*', { count: 'exact', head: true }).eq('case_id', caseId)
  ]);

  // Get top suspects
  const profiles = await getAllPersonProfiles(caseId);
  const topSuspects = profiles
    .filter(p => p.suspicionScore > 0)
    .sort((a, b) => b.suspicionScore - a.suspicionScore)
    .slice(0, 5)
    .map(p => ({ name: p.canonicalName, score: p.suspicionScore }));

  return {
    caseId,
    caseName: caseData?.name || caseData?.title || 'Unknown Case',
    victimName: caseData?.description?.match(/victim[:\s]+(\w+\s+\w+)/i)?.[1],
    crimeDate: caseData?.description?.match(/(\d{4}-\d{2}-\d{2})/)?.[1],
    crimeLocation: caseData?.description?.match(/location[:\s]+([^.]+)/i)?.[1],
    crimeType: caseData?.description?.match(/type[:\s]+(\w+)/i)?.[1],
    totalDocuments: docCount || 0,
    totalFacts: factCount || 0,
    totalPersons: personCount || 0,
    totalContradictions: contradictionCount || 0,
    topSuspects,
    keyUnresolvedQuestions: []
  };
}

async function getRelevantPersons(
  caseId: string,
  facts: AtomicFact[],
  focusPerson?: string
): Promise<PersonProfile[]> {
  const personNames = new Set<string>();

  // Extract person names from facts
  facts.forEach(f => {
    personNames.add(f.source.speakerName);
    f.mentionedPersons.forEach(p => personNames.add(p));
  });

  if (focusPerson) {
    personNames.add(focusPerson);
  }

  const profiles = await getAllPersonProfiles(caseId);
  return profiles.filter(p =>
    personNames.has(p.canonicalName) ||
    p.aliases.some(a => personNames.has(a))
  );
}

async function getRelevantContradictions(
  caseId: string,
  facts: AtomicFact[]
): Promise<Contradiction[]> {
  const factIds = new Set(facts.map(f => f.id));

  const allContradictions = await getContradictionsForCase(caseId);
  return allContradictions.filter(c =>
    factIds.has(c.fact1Id) || factIds.has(c.fact2Id)
  );
}

function extractSourceDocuments(facts: AtomicFact[]): string[] {
  const docs = new Set<string>();
  facts.forEach(f => {
    if (f.source.documentName) {
      docs.add(f.source.documentName);
    }
  });
  return Array.from(docs);
}

function deduplicateFacts(facts: AtomicFact[]): AtomicFact[] {
  const seen = new Set<string>();
  return facts.filter(f => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
}

// ============================================================================
// RAG-Powered Analysis
// ============================================================================

export async function analyzeWithRAG(query: AnalysisQuery): Promise<RAGAnalysisResult> {
  if (!isAnthropicConfigured()) {
    throw new Error('Anthropic API not configured');
  }

  // Step 1: Retrieve relevant context
  const context = await retrieveContext(query);

  // Step 2: Build the prompt with retrieved context
  const prompt = buildAnalysisPrompt(query, context);

  // Step 3: Generate analysis
  const client = getAnthropicClient();

  const response = await client.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  });

  const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';

  // Step 4: Extract suggested followups
  const suggestedFollowups = extractFollowups(analysisText);

  return {
    analysis: analysisText,
    context,
    suggestedFollowups,
    confidence: calculateAnalysisConfidence(context)
  };
}

function buildAnalysisPrompt(query: AnalysisQuery, context: RAGContext): string {
  const factsText = context.relevantFacts
    .slice(0, 50)
    .map(f => `- [${f.source.speakerName}]: "${f.predicate}" (${f.factType})`)
    .join('\n');

  const personsText = context.relevantPersons
    .map(p => `- ${p.canonicalName} (${p.role}): Suspicion score ${p.suspicionScore}/100`)
    .join('\n');

  const contradictionsText = context.relevantContradictions
    .slice(0, 10)
    .map(c => `- [${c.severity.toUpperCase()}] ${c.description}`)
    .join('\n');

  const suspiciousText = context.suspiciousFindings
    .slice(0, 10)
    .map(f => `- ${f.source.speakerName}: "${f.predicate}" - ${f.suspicionReason}`)
    .join('\n');

  return `You are an expert cold case analyst with access to a comprehensive case database.

CASE SUMMARY:
- Case: ${context.caseSummary.caseName}
- Total Documents: ${context.caseSummary.totalDocuments}
- Total Facts Extracted: ${context.caseSummary.totalFacts}
- Persons of Interest: ${context.caseSummary.totalPersons}
- Contradictions Detected: ${context.caseSummary.totalContradictions}

TOP SUSPECTS:
${context.caseSummary.topSuspects.map(s => `- ${s.name}: ${s.score}/100`).join('\n') || 'None identified yet'}

RELEVANT FACTS (${context.relevantFacts.length} retrieved):
${factsText || 'No facts retrieved'}

PERSONS INVOLVED:
${personsText || 'No persons identified'}

CONTRADICTIONS DETECTED:
${contradictionsText || 'No contradictions found'}

SUSPICIOUS FINDINGS:
${suspiciousText || 'No suspicious findings'}

SOURCE DOCUMENTS: ${context.sourceDocuments.join(', ') || 'Various'}

---

USER QUERY: ${query.query}

Based on the above case information, provide a comprehensive analysis addressing the query.
Include:
1. Direct answer to the query
2. Key evidence supporting your analysis
3. Contradictions or issues that affect your conclusions
4. Recommended next steps for investigation
5. Confidence assessment

Be specific and cite the facts you're referencing.`;
}

function extractFollowups(analysisText: string): string[] {
  const followups: string[] = [];

  // Look for numbered recommendations
  const numberedPattern = /\d+\.\s+([^.]+\.)/g;
  let match;
  while ((match = numberedPattern.exec(analysisText)) !== null) {
    if (match[1].toLowerCase().includes('recommend') ||
        match[1].toLowerCase().includes('should') ||
        match[1].toLowerCase().includes('investigate') ||
        match[1].toLowerCase().includes('interview')) {
      followups.push(match[1].trim());
    }
  }

  // Look for bullet points
  const bulletPattern = /[-•]\s+([^.]+\.)/g;
  while ((match = bulletPattern.exec(analysisText)) !== null) {
    if (match[1].toLowerCase().includes('recommend') ||
        match[1].toLowerCase().includes('should') ||
        match[1].toLowerCase().includes('investigate')) {
      followups.push(match[1].trim());
    }
  }

  return followups.slice(0, 5);
}

function calculateAnalysisConfidence(context: RAGContext): number {
  let confidence = 0.5;

  // More facts = higher confidence
  if (context.relevantFacts.length >= 50) confidence += 0.2;
  else if (context.relevantFacts.length >= 20) confidence += 0.1;

  // Persons identified increases confidence
  if (context.relevantPersons.length >= 3) confidence += 0.1;

  // Contradictions found shows thorough analysis
  if (context.relevantContradictions.length > 0) confidence += 0.1;

  // Suspicious findings show depth
  if (context.suspiciousFindings.length > 0) confidence += 0.1;

  return Math.min(0.95, confidence);
}

// ============================================================================
// Specialized Analysis Functions
// ============================================================================

export async function analyzePersonOfInterest(
  caseId: string,
  personName: string
): Promise<RAGAnalysisResult> {
  return analyzeWithRAG({
    caseId,
    queryType: 'person_focused',
    query: `Provide a comprehensive analysis of ${personName} as a person of interest. Include all statements they've made, any contradictions, their alibi status, behavioral observations, and an assessment of their likelihood of involvement.`,
    focusPerson: personName,
    maxFacts: 100
  });
}

export async function analyzeTimeline(
  caseId: string,
  timeRange?: { start: string; end: string }
): Promise<RAGAnalysisResult> {
  const rangeText = timeRange
    ? `between ${timeRange.start} and ${timeRange.end}`
    : 'during the critical time period';

  return analyzeWithRAG({
    caseId,
    queryType: 'timeline',
    query: `Reconstruct the timeline of events ${rangeText}. Identify who was where and when, any timeline gaps or conflicts, and opportunities for the crime to have occurred.`,
    timeRange,
    maxFacts: 150
  });
}

export async function analyzeContradictions(caseId: string): Promise<RAGAnalysisResult> {
  return analyzeWithRAG({
    caseId,
    queryType: 'contradictions',
    query: 'Analyze all detected contradictions in this case. Which are most significant? What do they tell us about potential deception? Who is involved in the most contradictions?',
    maxFacts: 100
  });
}

export async function identifyTopSuspects(caseId: string): Promise<RAGAnalysisResult> {
  return analyzeWithRAG({
    caseId,
    queryType: 'suspect_analysis',
    query: 'Based on all available evidence, who are the most likely suspects? Rank them by likelihood of involvement and explain the evidence supporting each ranking.',
    maxFacts: 150
  });
}

export async function findInvestigativeLeads(caseId: string): Promise<RAGAnalysisResult> {
  return analyzeWithRAG({
    caseId,
    queryType: 'general',
    query: 'Identify the most promising investigative leads that have not been fully explored. What evidence should be retested? Who should be re-interviewed? What questions remain unanswered?',
    maxFacts: 100
  });
}

// ============================================================================
// Natural Language Query Interface
// ============================================================================

export async function askAboutCase(
  caseId: string,
  question: string
): Promise<RAGAnalysisResult> {
  // Determine query type from question
  const queryType = inferQueryType(question);

  return analyzeWithRAG({
    caseId,
    queryType,
    query: question,
    maxFacts: 75
  });
}

function inferQueryType(question: string): AnalysisQuery['queryType'] {
  const q = question.toLowerCase();

  if (q.includes('timeline') || q.includes('when') || q.includes('time')) {
    return 'timeline';
  }
  if (q.includes('evidence') || q.includes('dna') || q.includes('forensic')) {
    return 'evidence';
  }
  if (q.includes('contradict') || q.includes('lie') || q.includes('conflict')) {
    return 'contradictions';
  }
  if (q.includes('suspect') || q.includes('who did') || q.includes('guilty')) {
    return 'suspect_analysis';
  }
  if (q.includes('about') && (q.includes('tell me') || q.includes('what do we know'))) {
    return 'person_focused';
  }

  return 'general';
}
