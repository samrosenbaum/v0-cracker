/**
 * Comprehensive Case Summary Generator
 *
 * Generates detailed investigative summaries from analyzed case documents.
 * Produces court-ready reports with all extracted evidence, timelines,
 * persons of interest, and investigative leads.
 */

import { supabaseServer } from './supabase-server';
import { DEFAULT_ANTHROPIC_MODEL, getAnthropicClient, isAnthropicConfigured } from './anthropic-client';
import { performCrossDocumentAnalysis, type CrossDocumentAnalysis } from './cross-document-analysis';
import { getCaseEvidence, type EvidenceItem } from './evidence-chain-of-custody';

// ============================================================================
// Type Definitions
// ============================================================================

export interface CaseSummary {
  caseId: string;
  caseNumber: string;
  caseTitle: string;
  generatedAt: Date;
  generatedBy: string;

  // Overview
  overview: {
    incidentDate: string;
    incidentLocation: string;
    caseStatus: string;
    priority: string;
    assignedInvestigators: string[];
    summary: string;
  };

  // Victim Information
  victims: VictimProfile[];

  // Persons of Interest
  personsOfInterest: PersonOfInterest[];

  // Evidence Summary
  evidenceSummary: {
    totalItems: number;
    byCategory: { category: string; count: number; items: string[] }[];
    criticalEvidence: string[];
    pendingAnalysis: string[];
  };

  // Timeline
  timeline: TimelineEntry[];
  timelineGaps: string[];

  // Document Analysis
  documentAnalysis: {
    totalDocuments: number;
    extractedCharacters: number;
    keyFindings: string[];
    conflicts: ConflictEntry[];
    inconsistencies: InconsistencyEntry[];
  };

  // Investigative Leads
  investigativeLeads: {
    priority: 'critical' | 'high' | 'medium' | 'low';
    lead: string;
    basis: string;
    status: 'open' | 'in_progress' | 'closed';
    assignedTo?: string;
  }[];

  // Missing Information
  gaps: {
    category: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    suggestedAction: string;
  }[];

  // Recommendations
  recommendations: {
    priority: number;
    action: string;
    rationale: string;
    resources: string;
  }[];

  // Statistics
  statistics: {
    documentsAnalyzed: number;
    entitiesExtracted: number;
    timelineEvents: number;
    leadsGenerated: number;
    conflictsIdentified: number;
  };
}

export interface VictimProfile {
  name: string;
  dateOfBirth?: string;
  age?: number;
  lastKnownLocation: string;
  lastSeenDate: string;
  relationship_to_suspect?: string;
  background: string;
  timeline: string[];
}

export interface PersonOfInterest {
  name: string;
  role: 'suspect' | 'witness' | 'associate' | 'unknown';
  mentionCount: number;
  documentsAppearingIn: number;
  suspicionScore: number;
  knownAliases: string[];
  relationship: string;
  lastKnownAddress?: string;
  phoneNumbers: string[];
  alibiStatus: 'verified' | 'unverified' | 'conflicting' | 'none_provided';
  interviewStatus: 'interviewed' | 'pending' | 'declined' | 'unavailable' | 'unknown';
  notes: string[];
  flags: string[];
}

export interface TimelineEntry {
  datetime: string;
  precision: 'exact' | 'approximate' | 'estimated';
  event: string;
  location?: string;
  source: string;
  involvedPersons: string[];
  significance: 'critical' | 'important' | 'minor';
  verified: boolean;
}

export interface ConflictEntry {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedParties: string[];
  resolution?: string;
}

export interface InconsistencyEntry {
  topic: string;
  statements: { source: string; content: string }[];
  analysis: string;
  investigativeAction: string;
}

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generate a comprehensive case summary
 */
export async function generateCaseSummary(
  caseId: string,
  options: {
    includeFullTimeline?: boolean;
    includeAllPersons?: boolean;
    generateAIInsights?: boolean;
  } = {}
): Promise<CaseSummary> {
  console.log(`[Case Summary] Starting generation for case: ${caseId}`);

  // 1. Fetch case details
  const caseData = await fetchCaseDetails(caseId);

  // 2. Fetch all analyzed documents
  const documents = await fetchAnalyzedDocuments(caseId);

  // 3. Perform cross-document analysis (or fetch cached)
  const crossDocAnalysis = await performCrossDocumentAnalysis(caseId);

  // 4. Fetch evidence items
  const evidence = await getCaseEvidence(caseId);

  // 5. Build persons of interest list
  const personsOfInterest = buildPersonsOfInterest(crossDocAnalysis, documents);

  // 6. Build timeline
  const { timeline, gaps } = buildTimeline(documents, crossDocAnalysis);

  // 7. Build evidence summary
  const evidenceSummary = buildEvidenceSummary(evidence, documents);

  // 8. Generate investigative leads
  const leads = generateLeads(crossDocAnalysis, personsOfInterest, gaps);

  // 9. Identify missing information
  const informationGaps = identifyGaps(caseData, documents, evidence, personsOfInterest);

  // 10. Generate AI-powered recommendations (if available)
  const recommendations = options.generateAIInsights
    ? await generateAIRecommendations(caseData, crossDocAnalysis, personsOfInterest, informationGaps)
    : generateHeuristicRecommendations(informationGaps, leads);

  // 11. Compile the summary
  const summary: CaseSummary = {
    caseId,
    caseNumber: caseData.caseNumber,
    caseTitle: caseData.title,
    generatedAt: new Date(),
    generatedBy: 'FreshEyes AI Analysis System',

    overview: {
      incidentDate: caseData.incidentDate || 'Unknown',
      incidentLocation: caseData.location || 'Unknown',
      caseStatus: caseData.status,
      priority: caseData.priority,
      assignedInvestigators: caseData.investigators || [],
      summary: await generateOverviewSummary(caseData, documents, crossDocAnalysis),
    },

    victims: caseData.victims || [],
    personsOfInterest,
    evidenceSummary,
    timeline: options.includeFullTimeline ? timeline : timeline.filter(e => e.significance !== 'minor'),
    timelineGaps: gaps,

    documentAnalysis: {
      totalDocuments: documents.length,
      extractedCharacters: documents.reduce((sum, d) => sum + (d.characterCount || 0), 0),
      keyFindings: crossDocAnalysis.keyFindings,
      conflicts: crossDocAnalysis.timelineConflicts.map(c => ({
        type: c.conflictType,
        severity: c.severity as ConflictEntry['severity'],
        description: c.description,
        affectedParties: c.involvedPersons,
        resolution: undefined,
      })),
      inconsistencies: crossDocAnalysis.statementInconsistencies.map(i => ({
        topic: i.topic,
        statements: i.statements.map(s => ({
          source: s.documentName,
          content: s.statement,
        })),
        analysis: i.analysis,
        investigativeAction: i.investigativeImplication,
      })),
    },

    investigativeLeads: leads,
    gaps: informationGaps,
    recommendations,

    statistics: {
      documentsAnalyzed: documents.length,
      entitiesExtracted: crossDocAnalysis.statistics.totalEntities,
      timelineEvents: timeline.length,
      leadsGenerated: leads.length,
      conflictsIdentified: crossDocAnalysis.timelineConflicts.length,
    },
  };

  // Save the summary to database
  await saveSummary(caseId, summary);

  console.log(`[Case Summary] Generation complete: ${documents.length} docs, ${leads.length} leads`);
  return summary;
}

// ============================================================================
// Helper Functions
// ============================================================================

interface CaseDetails {
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  incidentDate: string;
  location: string;
  status: string;
  priority: string;
  investigators: string[];
  victims: VictimProfile[];
}

interface AnalyzedDocument {
  id: string;
  fileName: string;
  documentType: string;
  extractedText: string;
  characterCount: number;
  structuredData: any;
  createdAt: string;
}

async function fetchCaseDetails(caseId: string): Promise<CaseDetails> {
  const { data, error } = await supabaseServer
    .from('cases')
    .select('*')
    .eq('id', caseId)
    .single();

  if (error || !data) {
    throw new Error(`Case not found: ${caseId}`);
  }

  return {
    id: data.id,
    caseNumber: data.case_number || data.id.slice(0, 8).toUpperCase(),
    title: data.title || data.name || 'Untitled Case',
    description: data.description || '',
    incidentDate: data.incident_date || '',
    location: data.location || '',
    status: data.status || 'open',
    priority: data.priority || 'medium',
    investigators: [],
    victims: [],
  };
}

async function fetchAnalyzedDocuments(caseId: string): Promise<AnalyzedDocument[]> {
  const { data, error } = await supabaseServer
    .from('case_documents')
    .select('id, file_name, document_type, extracted_text, word_count, structured_data, created_at')
    .eq('case_id', caseId)
    .eq('extraction_status', 'completed');

  if (error) {
    console.error('[Case Summary] Failed to fetch documents:', error);
    return [];
  }

  return (data || []).map(d => ({
    id: d.id,
    fileName: d.file_name,
    documentType: d.document_type,
    extractedText: d.extracted_text || '',
    characterCount: d.extracted_text?.length || 0,
    structuredData: d.structured_data,
    createdAt: d.created_at,
  }));
}

function buildPersonsOfInterest(
  analysis: CrossDocumentAnalysis,
  documents: AnalyzedDocument[]
): PersonOfInterest[] {
  const persons: PersonOfInterest[] = [];

  // Get person entities from cross-document analysis
  const personClusters = analysis.entityClusters.filter(c => c.entityType === 'person');

  personClusters.forEach(cluster => {
    // Calculate suspicion score based on various factors
    let suspicionScore = 0;

    // More documents = more relevant
    suspicionScore += Math.min(cluster.documentIds.length * 10, 30);

    // More mentions = more relevant
    suspicionScore += Math.min(cluster.mentionCount * 2, 20);

    // Check for negative context words
    const negativeWords = ['suspect', 'accused', 'threat', 'alibi', 'weapon', 'motive', 'argument', 'fight'];
    cluster.contexts.forEach(ctx => {
      negativeWords.forEach(word => {
        if (ctx.toLowerCase().includes(word)) {
          suspicionScore += 10;
        }
      });
    });

    // Cap at 100
    suspicionScore = Math.min(suspicionScore, 100);

    // Determine role based on context
    let role: PersonOfInterest['role'] = 'unknown';
    const contextLower = cluster.contexts.join(' ').toLowerCase();
    if (contextLower.includes('suspect') || contextLower.includes('accused')) role = 'suspect';
    else if (contextLower.includes('witness') || contextLower.includes('saw')) role = 'witness';
    else if (contextLower.includes('associate') || contextLower.includes('friend') || contextLower.includes('family')) role = 'associate';

    // Extract phone numbers associated with this person
    const phoneNumbers: string[] = [];
    analysis.entityClusters
      .filter(c => c.entityType === 'phone')
      .forEach(phone => {
        const sharedDocs = phone.documentIds.filter(id => cluster.documentIds.includes(id));
        if (sharedDocs.length > 0) {
          phoneNumbers.push(phone.primaryEntity);
        }
      });

    persons.push({
      name: cluster.primaryEntity,
      role,
      mentionCount: cluster.mentionCount,
      documentsAppearingIn: cluster.documentIds.length,
      suspicionScore,
      knownAliases: cluster.aliases,
      relationship: 'Under investigation',
      phoneNumbers,
      alibiStatus: 'unverified',
      interviewStatus: 'unknown',
      notes: cluster.contexts.slice(0, 3),
      flags: suspicionScore > 50 ? ['High suspicion score'] : [],
    });
  });

  // Sort by suspicion score
  return persons.sort((a, b) => b.suspicionScore - a.suspicionScore);
}

function buildTimeline(
  documents: AnalyzedDocument[],
  analysis: CrossDocumentAnalysis
): { timeline: TimelineEntry[]; gaps: string[] } {
  const timeline: TimelineEntry[] = [];
  const gaps: string[] = [];

  // Extract dates from all documents
  documents.forEach(doc => {
    const dates = doc.structuredData?.dates || [];

    dates.forEach((date: any) => {
      timeline.push({
        datetime: date.original,
        precision: 'approximate',
        event: date.context,
        source: doc.fileName,
        involvedPersons: [],
        significance: 'minor',
        verified: false,
      });
    });
  });

  // Add conflict events as critical timeline entries
  analysis.timelineConflicts.forEach(conflict => {
    timeline.push({
      datetime: conflict.timeframe.start || 'Unknown',
      precision: 'approximate',
      event: `CONFLICT: ${conflict.description}`,
      source: conflict.documents.map(d => d.name).join(', '),
      involvedPersons: conflict.involvedPersons,
      significance: 'critical',
      verified: false,
    });
  });

  // Sort by date (simple string sort for now)
  timeline.sort((a, b) => a.datetime.localeCompare(b.datetime));

  // Identify gaps (simplified)
  if (timeline.length > 0) {
    gaps.push('Timeline reconstruction is based on extracted dates - verify key events with witnesses');
  }

  return { timeline, gaps };
}

function buildEvidenceSummary(
  evidence: EvidenceItem[],
  documents: AnalyzedDocument[]
): CaseSummary['evidenceSummary'] {
  const byCategory = new Map<string, { count: number; items: string[] }>();

  evidence.forEach(item => {
    const category = item.type;
    if (!byCategory.has(category)) {
      byCategory.set(category, { count: 0, items: [] });
    }
    const cat = byCategory.get(category)!;
    cat.count++;
    cat.items.push(item.description);
  });

  // Also count documents as evidence
  documents.forEach(doc => {
    const category = 'documentary';
    if (!byCategory.has(category)) {
      byCategory.set(category, { count: 0, items: [] });
    }
    const cat = byCategory.get(category)!;
    cat.count++;
    cat.items.push(doc.fileName);
  });

  return {
    totalItems: evidence.length + documents.length,
    byCategory: Array.from(byCategory.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      items: data.items.slice(0, 5),
    })),
    criticalEvidence: evidence
      .filter(e => e.status === 'in_analysis' || e.type === 'biological' || e.type === 'weapon')
      .map(e => e.description),
    pendingAnalysis: evidence
      .filter(e => e.status === 'in_analysis')
      .map(e => `${e.evidenceNumber}: ${e.description}`),
  };
}

function generateLeads(
  analysis: CrossDocumentAnalysis,
  persons: PersonOfInterest[],
  gaps: string[]
): CaseSummary['investigativeLeads'] {
  const leads: CaseSummary['investigativeLeads'] = [];

  // Add leads from cross-document analysis
  analysis.investigativeLeads.forEach(lead => {
    leads.push({
      priority: lead.priority,
      lead: lead.lead,
      basis: lead.basis,
      status: 'open',
    });
  });

  // Add leads from high-suspicion persons
  persons
    .filter(p => p.suspicionScore > 60 && p.interviewStatus !== 'interviewed')
    .forEach(p => {
      leads.push({
        priority: 'high',
        lead: `Interview ${p.name} - ${p.role}`,
        basis: `Appears in ${p.documentsAppearingIn} documents with suspicion score of ${p.suspicionScore}`,
        status: 'open',
      });
    });

  // Add leads from unverified alibis
  persons
    .filter(p => p.alibiStatus === 'conflicting')
    .forEach(p => {
      leads.push({
        priority: 'critical',
        lead: `Verify conflicting alibi for ${p.name}`,
        basis: 'Timeline conflicts detected in statements',
        status: 'open',
      });
    });

  return leads;
}

function identifyGaps(
  caseData: CaseDetails,
  documents: AnalyzedDocument[],
  evidence: EvidenceItem[],
  persons: PersonOfInterest[]
): CaseSummary['gaps'] {
  const gaps: CaseSummary['gaps'] = [];

  // Check for missing case information
  if (!caseData.incidentDate) {
    gaps.push({
      category: 'Case Information',
      description: 'Incident date not specified',
      impact: 'high',
      suggestedAction: 'Establish incident date from available evidence and witness accounts',
    });
  }

  if (!caseData.location) {
    gaps.push({
      category: 'Case Information',
      description: 'Incident location not specified',
      impact: 'high',
      suggestedAction: 'Determine incident location from reports and evidence',
    });
  }

  // Check for missing interview transcripts
  const hasInterviews = documents.some(d =>
    d.documentType.includes('interview') || d.documentType.includes('statement')
  );
  if (!hasInterviews) {
    gaps.push({
      category: 'Documentation',
      description: 'No interview transcripts or witness statements found',
      impact: 'high',
      suggestedAction: 'Upload all available interview recordings and transcripts',
    });
  }

  // Check for missing forensic reports
  const hasForensics = documents.some(d =>
    d.documentType.includes('forensic') || d.documentType.includes('lab')
  );
  if (!hasForensics) {
    gaps.push({
      category: 'Documentation',
      description: 'No forensic or lab reports found',
      impact: 'medium',
      suggestedAction: 'Obtain and upload all forensic analysis reports',
    });
  }

  // Check for persons without interviews
  const uninterviewedPersons = persons.filter(p =>
    p.interviewStatus === 'unknown' && p.documentsAppearingIn >= 2
  );
  if (uninterviewedPersons.length > 0) {
    gaps.push({
      category: 'Investigation',
      description: `${uninterviewedPersons.length} persons mentioned in multiple documents have unknown interview status`,
      impact: 'medium',
      suggestedAction: `Verify interview status for: ${uninterviewedPersons.slice(0, 3).map(p => p.name).join(', ')}`,
    });
  }

  // Check for evidence without analysis
  const unanalyzedEvidence = evidence.filter(e => e.status === 'in_storage');
  if (unanalyzedEvidence.length > 0) {
    gaps.push({
      category: 'Evidence',
      description: `${unanalyzedEvidence.length} evidence items have not been analyzed`,
      impact: 'medium',
      suggestedAction: 'Prioritize analysis of stored evidence items',
    });
  }

  return gaps;
}

async function generateAIRecommendations(
  caseData: CaseDetails,
  analysis: CrossDocumentAnalysis,
  persons: PersonOfInterest[],
  gaps: CaseSummary['gaps']
): Promise<CaseSummary['recommendations']> {
  if (!isAnthropicConfigured()) {
    return generateHeuristicRecommendations(gaps, []);
  }

  try {
    const anthropic = getAnthropicClient();

    const contextData = {
      caseTitle: caseData.title,
      keyFindings: analysis.keyFindings,
      topPersons: persons.slice(0, 5).map(p => ({
        name: p.name,
        role: p.role,
        suspicionScore: p.suspicionScore,
        interviewStatus: p.interviewStatus,
      })),
      conflicts: analysis.timelineConflicts.slice(0, 3).map(c => c.description),
      gaps: gaps.map(g => g.description),
      statistics: analysis.statistics,
    };

    const message = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `You are an experienced cold case detective providing investigative recommendations.
Based on this case analysis, provide 5-7 specific, actionable recommendations:

${JSON.stringify(contextData, null, 2)}

Return a JSON array of recommendations, each with:
- priority (1-10, 1 being highest)
- action (specific action to take)
- rationale (why this matters)
- resources (what resources are needed)

Focus on:
1. Quick wins that could break the case
2. Critical interviews or re-interviews
3. Modern forensic techniques to apply
4. Evidence that needs re-examination
5. Leads that appear to have been dropped

Return ONLY the JSON array.`,
      }],
    });

    const content = message.content[0];
    if (content.type === 'text') {
      const jsonMatch = content.text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    }
  } catch (error) {
    console.warn('[Case Summary] AI recommendations failed:', error);
  }

  return generateHeuristicRecommendations(gaps, []);
}

function generateHeuristicRecommendations(
  gaps: CaseSummary['gaps'],
  leads: CaseSummary['investigativeLeads']
): CaseSummary['recommendations'] {
  const recommendations: CaseSummary['recommendations'] = [];
  let priority = 1;

  // Convert high-impact gaps to recommendations
  gaps
    .filter(g => g.impact === 'high')
    .forEach(gap => {
      recommendations.push({
        priority: priority++,
        action: gap.suggestedAction,
        rationale: gap.description,
        resources: 'Investigation team',
      });
    });

  // Add standard cold case recommendations
  recommendations.push({
    priority: priority++,
    action: 'Review all evidence with modern forensic techniques (touch DNA, advanced ballistics, digital forensics)',
    rationale: 'Technology has advanced significantly since original investigation',
    resources: 'Forensic lab partnership',
  });

  recommendations.push({
    priority: priority++,
    action: 'Re-interview key witnesses and persons of interest',
    rationale: 'People may be willing to share new information after time has passed',
    resources: 'Experienced investigator',
  });

  recommendations.push({
    priority: priority++,
    action: 'Submit DNA evidence to CODIS and familial DNA databases',
    rationale: 'Database matches have solved many cold cases',
    resources: 'State crime lab',
  });

  return recommendations.slice(0, 7);
}

async function generateOverviewSummary(
  caseData: CaseDetails,
  documents: AnalyzedDocument[],
  analysis: CrossDocumentAnalysis
): Promise<string> {
  if (isAnthropicConfigured() && documents.length > 0) {
    try {
      const anthropic = getAnthropicClient();

      const message = await anthropic.messages.create({
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Write a 2-3 paragraph professional case summary for investigators based on:

Case: ${caseData.title}
Description: ${caseData.description}
Documents analyzed: ${documents.length}
Key findings: ${analysis.keyFindings.slice(0, 3).join('; ')}
Conflicts detected: ${analysis.timelineConflicts.length}
Persons of interest: ${analysis.entityClusters.filter(c => c.entityType === 'person').length}

Write a factual, objective summary suitable for a case file. Do not speculate.`,
        }],
      });

      const content = message.content[0];
      if (content.type === 'text') {
        return content.text;
      }
    } catch (error) {
      console.warn('[Case Summary] AI summary generation failed:', error);
    }
  }

  // Fallback summary
  return `This case file contains ${documents.length} analyzed documents. Cross-document analysis identified ${analysis.entityClusters.filter(c => c.entityType === 'person').length} persons of interest and ${analysis.timelineConflicts.length} timeline conflicts requiring investigation. ${analysis.keyFindings[0] || 'Further analysis is recommended.'}`;
}

async function saveSummary(caseId: string, summary: CaseSummary): Promise<void> {
  try {
    const { error } = await supabaseServer
      .from('case_analysis')
      .upsert({
        case_id: caseId,
        analysis_type: 'comprehensive_summary',
        analysis_data: summary,
        confidence_score: 0.9,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'case_id,analysis_type',
      });

    if (error) {
      console.warn('[Case Summary] Failed to save summary:', error);
    }
  } catch (error) {
    console.error('[Case Summary] Error saving summary:', error);
  }
}

/**
 * Export summary to markdown format for reports
 */
export function exportSummaryToMarkdown(summary: CaseSummary): string {
  const lines: string[] = [];

  lines.push(`# Case Summary: ${summary.caseTitle}`);
  lines.push(`**Case Number:** ${summary.caseNumber}`);
  lines.push(`**Generated:** ${summary.generatedAt.toISOString()}`);
  lines.push('');

  lines.push('## Overview');
  lines.push(`- **Incident Date:** ${summary.overview.incidentDate}`);
  lines.push(`- **Location:** ${summary.overview.incidentLocation}`);
  lines.push(`- **Status:** ${summary.overview.caseStatus}`);
  lines.push(`- **Priority:** ${summary.overview.priority}`);
  lines.push('');
  lines.push(summary.overview.summary);
  lines.push('');

  lines.push('## Persons of Interest');
  summary.personsOfInterest.slice(0, 10).forEach((person, index) => {
    lines.push(`### ${index + 1}. ${person.name}`);
    lines.push(`- **Role:** ${person.role}`);
    lines.push(`- **Suspicion Score:** ${person.suspicionScore}/100`);
    lines.push(`- **Documents Appearing In:** ${person.documentsAppearingIn}`);
    lines.push(`- **Interview Status:** ${person.interviewStatus}`);
    if (person.flags.length > 0) {
      lines.push(`- **Flags:** ${person.flags.join(', ')}`);
    }
    lines.push('');
  });

  lines.push('## Key Findings');
  summary.documentAnalysis.keyFindings.forEach(finding => {
    lines.push(`- ${finding}`);
  });
  lines.push('');

  if (summary.documentAnalysis.conflicts.length > 0) {
    lines.push('## Conflicts Detected');
    summary.documentAnalysis.conflicts.forEach(conflict => {
      lines.push(`- **[${conflict.severity.toUpperCase()}]** ${conflict.description}`);
    });
    lines.push('');
  }

  lines.push('## Investigative Leads');
  summary.investigativeLeads.forEach((lead, index) => {
    lines.push(`${index + 1}. **[${lead.priority.toUpperCase()}]** ${lead.lead}`);
    lines.push(`   - Basis: ${lead.basis}`);
  });
  lines.push('');

  lines.push('## Recommendations');
  summary.recommendations.forEach((rec, index) => {
    lines.push(`${index + 1}. ${rec.action}`);
    lines.push(`   - Rationale: ${rec.rationale}`);
    lines.push(`   - Resources: ${rec.resources}`);
  });
  lines.push('');

  lines.push('## Statistics');
  lines.push(`- Documents Analyzed: ${summary.statistics.documentsAnalyzed}`);
  lines.push(`- Entities Extracted: ${summary.statistics.entitiesExtracted}`);
  lines.push(`- Timeline Events: ${summary.statistics.timelineEvents}`);
  lines.push(`- Leads Generated: ${summary.statistics.leadsGenerated}`);
  lines.push(`- Conflicts Identified: ${summary.statistics.conflictsIdentified}`);

  return lines.join('\n');
}
