/**
 * Cross-Document Correlation Analysis
 *
 * Analyzes multiple documents to find:
 * - Entity connections across documents
 * - Timeline conflicts and correlations
 * - Statement inconsistencies
 * - Hidden relationships
 * - Evidence gaps
 */

import { supabaseServer } from './supabase-server';
import { DEFAULT_ANTHROPIC_MODEL, getAnthropicClient, isAnthropicConfigured } from './anthropic-client';
import type { ExtractedEntity, ExtractedDate, ExtractedStructuredData } from './document-parser';

// ============================================================================
// Type Definitions
// ============================================================================

export interface DocumentCorrelation {
  document1Id: string;
  document1Name: string;
  document2Id: string;
  document2Name: string;
  correlationType: 'entity_overlap' | 'timeline_conflict' | 'statement_match' | 'statement_conflict' | 'location_match' | 'person_mention';
  strength: number; // 0-1
  details: string;
  sharedEntities: string[];
  significance: 'low' | 'medium' | 'high' | 'critical';
}

export interface EntityCluster {
  primaryEntity: string;
  entityType: 'person' | 'location' | 'vehicle' | 'phone' | 'date';
  aliases: string[];
  documentIds: string[];
  mentionCount: number;
  contexts: string[];
  suspicionScore?: number;
  connections: {
    entity: string;
    relationship: string;
    strength: number;
    documents: string[];
  }[];
}

export interface TimelineConflict {
  conflictType: 'impossible_timeline' | 'alibi_conflict' | 'statement_contradiction' | 'sequence_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  involvedPersons: string[];
  documents: { id: string; name: string; relevantText: string }[];
  timeframe: {
    start?: string;
    end?: string;
  };
  recommendation: string;
}

export interface StatementInconsistency {
  topic: string;
  statements: {
    documentId: string;
    documentName: string;
    speaker?: string;
    statement: string;
    date?: string;
  }[];
  inconsistencyType: 'contradiction' | 'omission' | 'embellishment' | 'time_discrepancy' | 'detail_mismatch';
  severity: 'minor' | 'significant' | 'major';
  analysis: string;
  investigativeImplication: string;
}

export interface CrossDocumentAnalysis {
  caseId: string;
  analyzedAt: Date;
  documentCount: number;
  correlations: DocumentCorrelation[];
  entityClusters: EntityCluster[];
  timelineConflicts: TimelineConflict[];
  statementInconsistencies: StatementInconsistency[];
  keyFindings: string[];
  investigativeLeads: {
    priority: 'low' | 'medium' | 'high' | 'critical';
    lead: string;
    basis: string;
    suggestedAction: string;
  }[];
  statistics: {
    totalEntities: number;
    uniquePeople: number;
    uniqueLocations: number;
    uniquePhoneNumbers: number;
    conflictsFound: number;
    inconsistenciesFound: number;
  };
}

// ============================================================================
// Main Analysis Functions
// ============================================================================

/**
 * Perform comprehensive cross-document analysis for a case
 */
export async function performCrossDocumentAnalysis(caseId: string): Promise<CrossDocumentAnalysis> {
  console.log(`[Cross-Document Analysis] Starting analysis for case: ${caseId}`);

  // 1. Fetch all documents and their extracted data
  const documents = await fetchCaseDocuments(caseId);
  console.log(`[Cross-Document Analysis] Found ${documents.length} documents`);

  if (documents.length === 0) {
    return createEmptyAnalysis(caseId);
  }

  // 2. Extract and cluster entities
  const entityClusters = await clusterEntities(documents);
  console.log(`[Cross-Document Analysis] Found ${entityClusters.length} entity clusters`);

  // 3. Find document correlations
  const correlations = findDocumentCorrelations(documents, entityClusters);
  console.log(`[Cross-Document Analysis] Found ${correlations.length} correlations`);

  // 4. Detect timeline conflicts
  const timelineConflicts = await detectTimelineConflicts(documents, entityClusters);
  console.log(`[Cross-Document Analysis] Found ${timelineConflicts.length} timeline conflicts`);

  // 5. Find statement inconsistencies
  const statementInconsistencies = await findStatementInconsistencies(documents);
  console.log(`[Cross-Document Analysis] Found ${statementInconsistencies.length} inconsistencies`);

  // 6. Generate investigative leads
  const leads = generateInvestigativeLeads(entityClusters, timelineConflicts, statementInconsistencies, correlations);

  // 7. Calculate statistics
  const statistics = calculateStatistics(documents, entityClusters, timelineConflicts, statementInconsistencies);

  // 8. Use AI to generate key findings (if available)
  const keyFindings = await generateKeyFindings(documents, entityClusters, timelineConflicts, statementInconsistencies);

  // 9. Save analysis results
  await saveAnalysisResults(caseId, {
    correlations,
    entityClusters,
    timelineConflicts,
    statementInconsistencies,
    keyFindings,
    leads,
    statistics,
  });

  return {
    caseId,
    analyzedAt: new Date(),
    documentCount: documents.length,
    correlations,
    entityClusters,
    timelineConflicts,
    statementInconsistencies,
    keyFindings,
    investigativeLeads: leads,
    statistics,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

interface DocumentData {
  id: string;
  fileName: string;
  documentType: string;
  extractedText: string;
  structuredData?: ExtractedStructuredData;
  createdAt: string;
}

async function fetchCaseDocuments(caseId: string): Promise<DocumentData[]> {
  const { data, error } = await supabaseServer
    .from('case_documents')
    .select('id, file_name, document_type, extracted_text, structured_data, created_at')
    .eq('case_id', caseId)
    .eq('extraction_status', 'completed')
    .not('extracted_text', 'is', null);

  if (error) {
    console.error('[Cross-Document Analysis] Error fetching documents:', error);
    return [];
  }

  return (data || []).map(doc => ({
    id: doc.id,
    fileName: doc.file_name,
    documentType: doc.document_type,
    extractedText: doc.extracted_text || '',
    structuredData: doc.structured_data as ExtractedStructuredData,
    createdAt: doc.created_at,
  }));
}

async function clusterEntities(documents: DocumentData[]): Promise<EntityCluster[]> {
  const entityMap = new Map<string, EntityCluster>();

  documents.forEach(doc => {
    const entities = doc.structuredData?.entities || [];

    entities.forEach(entity => {
      const normalizedName = entity.name.toLowerCase().trim();
      const existing = entityMap.get(normalizedName);

      if (existing) {
        existing.mentionCount += entity.mentions;
        if (!existing.documentIds.includes(doc.id)) {
          existing.documentIds.push(doc.id);
        }
        existing.contexts.push(...entity.context.slice(0, 2));
      } else {
        entityMap.set(normalizedName, {
          primaryEntity: entity.name,
          entityType: entity.type as EntityCluster['entityType'],
          aliases: [],
          documentIds: [doc.id],
          mentionCount: entity.mentions,
          contexts: entity.context.slice(0, 3),
          connections: [],
        });
      }
    });

    // Also process phone numbers
    const phones = doc.structuredData?.phoneNumbers || [];
    phones.forEach(phone => {
      const normalizedPhone = phone.replace(/\D/g, '');
      const existing = entityMap.get(normalizedPhone);

      if (existing) {
        if (!existing.documentIds.includes(doc.id)) {
          existing.documentIds.push(doc.id);
        }
        existing.mentionCount++;
      } else {
        entityMap.set(normalizedPhone, {
          primaryEntity: phone,
          entityType: 'phone',
          aliases: [],
          documentIds: [doc.id],
          mentionCount: 1,
          contexts: [],
          connections: [],
        });
      }
    });
  });

  // Find entity connections (entities appearing together in documents)
  const clusters = Array.from(entityMap.values());

  clusters.forEach(cluster1 => {
    clusters.forEach(cluster2 => {
      if (cluster1.primaryEntity === cluster2.primaryEntity) return;

      const sharedDocs = cluster1.documentIds.filter(id =>
        cluster2.documentIds.includes(id)
      );

      if (sharedDocs.length > 0) {
        cluster1.connections.push({
          entity: cluster2.primaryEntity,
          relationship: 'co-occurrence',
          strength: Math.min(sharedDocs.length / Math.max(cluster1.documentIds.length, 1), 1),
          documents: sharedDocs,
        });
      }
    });
  });

  // Sort by document count (entities appearing in multiple docs are more important)
  return clusters
    .filter(c => c.documentIds.length > 0)
    .sort((a, b) => b.documentIds.length - a.documentIds.length);
}

function findDocumentCorrelations(
  documents: DocumentData[],
  entityClusters: EntityCluster[]
): DocumentCorrelation[] {
  const correlations: DocumentCorrelation[] = [];
  const processed = new Set<string>();

  for (let i = 0; i < documents.length; i++) {
    for (let j = i + 1; j < documents.length; j++) {
      const doc1 = documents[i];
      const doc2 = documents[j];
      const pairKey = `${doc1.id}-${doc2.id}`;

      if (processed.has(pairKey)) continue;
      processed.add(pairKey);

      // Find shared entities
      const sharedEntities: string[] = [];
      entityClusters.forEach(cluster => {
        if (cluster.documentIds.includes(doc1.id) && cluster.documentIds.includes(doc2.id)) {
          sharedEntities.push(cluster.primaryEntity);
        }
      });

      if (sharedEntities.length > 0) {
        const strength = Math.min(sharedEntities.length / 10, 1);
        correlations.push({
          document1Id: doc1.id,
          document1Name: doc1.fileName,
          document2Id: doc2.id,
          document2Name: doc2.fileName,
          correlationType: 'entity_overlap',
          strength,
          details: `${sharedEntities.length} shared entities found`,
          sharedEntities,
          significance: strength > 0.7 ? 'high' : strength > 0.4 ? 'medium' : 'low',
        });
      }

      // Check for person mentions
      const peopleInDoc1 = entityClusters
        .filter(c => c.entityType === 'person' && c.documentIds.includes(doc1.id))
        .map(c => c.primaryEntity.toLowerCase());
      const peopleInDoc2 = entityClusters
        .filter(c => c.entityType === 'person' && c.documentIds.includes(doc2.id))
        .map(c => c.primaryEntity.toLowerCase());

      const sharedPeople = peopleInDoc1.filter(p => peopleInDoc2.includes(p));

      if (sharedPeople.length > 0 && sharedPeople.length !== sharedEntities.length) {
        correlations.push({
          document1Id: doc1.id,
          document1Name: doc1.fileName,
          document2Id: doc2.id,
          document2Name: doc2.fileName,
          correlationType: 'person_mention',
          strength: Math.min(sharedPeople.length / 5, 1),
          details: `Same people mentioned: ${sharedPeople.join(', ')}`,
          sharedEntities: sharedPeople,
          significance: sharedPeople.length >= 3 ? 'high' : 'medium',
        });
      }
    }
  }

  return correlations.sort((a, b) => b.strength - a.strength);
}

async function detectTimelineConflicts(
  documents: DocumentData[],
  entityClusters: EntityCluster[]
): Promise<TimelineConflict[]> {
  const conflicts: TimelineConflict[] = [];

  // Extract all dates from documents
  const datesByDocument = new Map<string, ExtractedDate[]>();
  documents.forEach(doc => {
    datesByDocument.set(doc.id, doc.structuredData?.dates || []);
  });

  // Find people mentioned in multiple documents
  const peopleInMultipleDocs = entityClusters.filter(
    c => c.entityType === 'person' && c.documentIds.length >= 2
  );

  // For each person, check for timeline conflicts across documents
  for (const person of peopleInMultipleDocs) {
    const relevantDocs = documents.filter(d => person.documentIds.includes(d.id));

    // Check if dates in different documents could conflict
    for (let i = 0; i < relevantDocs.length; i++) {
      for (let j = i + 1; j < relevantDocs.length; j++) {
        const doc1 = relevantDocs[i];
        const doc2 = relevantDocs[j];
        const dates1 = datesByDocument.get(doc1.id) || [];
        const dates2 = datesByDocument.get(doc2.id) || [];

        // Check if the same date appears with different activities
        dates1.forEach(date1 => {
          dates2.forEach(date2 => {
            if (date1.original === date2.original) {
              // Same date mentioned - check context for conflicts
              const context1Lower = date1.context.toLowerCase();
              const context2Lower = date2.context.toLowerCase();

              // Look for location or activity conflicts
              const locations1 = extractLocationsFromContext(context1Lower);
              const locations2 = extractLocationsFromContext(context2Lower);

              if (locations1.length > 0 && locations2.length > 0) {
                const hasConflict = !locations1.some(l1 =>
                  locations2.some(l2 => l1.includes(l2) || l2.includes(l1))
                );

                if (hasConflict) {
                  conflicts.push({
                    conflictType: 'alibi_conflict',
                    severity: 'high',
                    description: `${person.primaryEntity} is mentioned at different locations on ${date1.original}`,
                    involvedPersons: [person.primaryEntity],
                    documents: [
                      { id: doc1.id, name: doc1.fileName, relevantText: date1.context },
                      { id: doc2.id, name: doc2.fileName, relevantText: date2.context },
                    ],
                    timeframe: { start: date1.original },
                    recommendation: `Verify ${person.primaryEntity}'s whereabouts on ${date1.original}. Cross-reference with independent evidence.`,
                  });
                }
              }
            }
          });
        });
      }
    }
  }

  return conflicts;
}

function extractLocationsFromContext(context: string): string[] {
  const locationPatterns = [
    /at (\w+(?:\s+\w+)*)/gi,
    /in (\w+(?:\s+\w+)*)/gi,
    /near (\w+(?:\s+\w+)*)/gi,
  ];

  const locations: string[] = [];
  locationPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(context)) !== null) {
      locations.push(match[1].toLowerCase());
    }
  });

  return locations;
}

async function findStatementInconsistencies(documents: DocumentData[]): Promise<StatementInconsistency[]> {
  const inconsistencies: StatementInconsistency[] = [];

  // Group documents by type (statements, interviews, reports)
  const statements = documents.filter(d =>
    d.documentType.includes('statement') || d.documentType.includes('interview')
  );

  // Compare statements pairwise
  for (let i = 0; i < statements.length; i++) {
    for (let j = i + 1; j < statements.length; j++) {
      const doc1 = statements[i];
      const doc2 = statements[j];

      // Look for key phrases that might indicate the same topic
      const topics = extractTopics(doc1.extractedText, doc2.extractedText);

      topics.forEach(topic => {
        const statement1 = extractRelevantStatement(doc1.extractedText, topic);
        const statement2 = extractRelevantStatement(doc2.extractedText, topic);

        if (statement1 && statement2 && statement1 !== statement2) {
          // Check for contradictions
          const contradiction = detectContradiction(statement1, statement2);

          if (contradiction.isContradiction) {
            inconsistencies.push({
              topic,
              statements: [
                { documentId: doc1.id, documentName: doc1.fileName, statement: statement1 },
                { documentId: doc2.id, documentName: doc2.fileName, statement: statement2 },
              ],
              inconsistencyType: contradiction.type,
              severity: contradiction.severity,
              analysis: contradiction.analysis,
              investigativeImplication: `Different accounts of "${topic}" require follow-up investigation.`,
            });
          }
        }
      });
    }
  }

  return inconsistencies;
}

function extractTopics(text1: string, text2: string): string[] {
  const topics: string[] = [];

  // Common investigative topics
  const topicPatterns = [
    /whereabouts/i,
    /alibi/i,
    /relationship/i,
    /weapon/i,
    /vehicle/i,
    /time of death/i,
    /last seen/i,
    /motive/i,
    /argument/i,
    /fight/i,
    /threat/i,
  ];

  topicPatterns.forEach(pattern => {
    if (pattern.test(text1) && pattern.test(text2)) {
      topics.push(pattern.source.replace(/\\i$/, '').replace(/\\/g, ''));
    }
  });

  return topics;
}

function extractRelevantStatement(text: string, topic: string): string | null {
  const sentences = text.split(/[.!?]+/);
  const topicLower = topic.toLowerCase();

  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(topicLower)) {
      return sentence.trim();
    }
  }

  return null;
}

function detectContradiction(statement1: string, statement2: string): {
  isContradiction: boolean;
  type: StatementInconsistency['inconsistencyType'];
  severity: StatementInconsistency['severity'];
  analysis: string;
} {
  const s1Lower = statement1.toLowerCase();
  const s2Lower = statement2.toLowerCase();

  // Check for time contradictions
  const times1 = s1Lower.match(/\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)/gi) || [];
  const times2 = s2Lower.match(/\d{1,2}:\d{2}|\d{1,2}\s*(am|pm)/gi) || [];

  if (times1.length > 0 && times2.length > 0 && times1[0] !== times2[0]) {
    return {
      isContradiction: true,
      type: 'time_discrepancy',
      severity: 'significant',
      analysis: `Time discrepancy detected: "${times1[0]}" vs "${times2[0]}"`,
    };
  }

  // Check for negation patterns
  const negationWords = ['not', 'never', "didn't", "wasn't", "couldn't", 'denied', 'no'];
  const hasNegation1 = negationWords.some(w => s1Lower.includes(w));
  const hasNegation2 = negationWords.some(w => s2Lower.includes(w));

  if (hasNegation1 !== hasNegation2) {
    return {
      isContradiction: true,
      type: 'contradiction',
      severity: 'major',
      analysis: 'One statement affirms while the other denies the same fact.',
    };
  }

  // Check for detail mismatches (different descriptions of similar things)
  const colors = ['red', 'blue', 'green', 'black', 'white', 'yellow', 'gray', 'grey', 'brown'];
  const color1 = colors.find(c => s1Lower.includes(c));
  const color2 = colors.find(c => s2Lower.includes(c));

  if (color1 && color2 && color1 !== color2) {
    return {
      isContradiction: true,
      type: 'detail_mismatch',
      severity: 'significant',
      analysis: `Different descriptions: "${color1}" vs "${color2}"`,
    };
  }

  return {
    isContradiction: false,
    type: 'contradiction',
    severity: 'minor',
    analysis: '',
  };
}

function generateInvestigativeLeads(
  entityClusters: EntityCluster[],
  timelineConflicts: TimelineConflict[],
  inconsistencies: StatementInconsistency[],
  correlations: DocumentCorrelation[]
): CrossDocumentAnalysis['investigativeLeads'] {
  const leads: CrossDocumentAnalysis['investigativeLeads'] = [];

  // Critical: People in many documents but not formally interviewed
  entityClusters
    .filter(c => c.entityType === 'person' && c.documentIds.length >= 3)
    .forEach(cluster => {
      leads.push({
        priority: 'high',
        lead: `${cluster.primaryEntity} appears in ${cluster.documentIds.length} documents`,
        basis: `Mentioned ${cluster.mentionCount} times across multiple case files`,
        suggestedAction: `Verify interview status and background check for ${cluster.primaryEntity}`,
      });
    });

  // Critical: Timeline conflicts
  timelineConflicts.forEach(conflict => {
    if (conflict.severity === 'high' || conflict.severity === 'critical') {
      leads.push({
        priority: 'critical',
        lead: conflict.description,
        basis: `Conflict detected between ${conflict.documents.map(d => d.name).join(' and ')}`,
        suggestedAction: conflict.recommendation,
      });
    }
  });

  // High: Statement inconsistencies
  inconsistencies.forEach(inconsistency => {
    if (inconsistency.severity === 'major') {
      leads.push({
        priority: 'high',
        lead: `Statement conflict regarding "${inconsistency.topic}"`,
        basis: inconsistency.analysis,
        suggestedAction: inconsistency.investigativeImplication,
      });
    }
  });

  // Medium: Phone numbers appearing in multiple documents
  entityClusters
    .filter(c => c.entityType === 'phone' && c.documentIds.length >= 2)
    .forEach(cluster => {
      leads.push({
        priority: 'medium',
        lead: `Phone number ${cluster.primaryEntity} appears across multiple documents`,
        basis: `Found in ${cluster.documentIds.length} documents`,
        suggestedAction: `Request phone records and identify owner of ${cluster.primaryEntity}`,
      });
    });

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return leads.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

function calculateStatistics(
  documents: DocumentData[],
  entityClusters: EntityCluster[],
  conflicts: TimelineConflict[],
  inconsistencies: StatementInconsistency[]
): CrossDocumentAnalysis['statistics'] {
  return {
    totalEntities: entityClusters.length,
    uniquePeople: entityClusters.filter(c => c.entityType === 'person').length,
    uniqueLocations: entityClusters.filter(c => c.entityType === 'location').length,
    uniquePhoneNumbers: entityClusters.filter(c => c.entityType === 'phone').length,
    conflictsFound: conflicts.length,
    inconsistenciesFound: inconsistencies.length,
  };
}

async function generateKeyFindings(
  documents: DocumentData[],
  entityClusters: EntityCluster[],
  conflicts: TimelineConflict[],
  inconsistencies: StatementInconsistency[]
): Promise<string[]> {
  // If AI is available, use it for sophisticated analysis
  if (isAnthropicConfigured() && documents.length > 0) {
    try {
      const anthropic = getAnthropicClient();

      const summaryData = {
        documentCount: documents.length,
        topEntities: entityClusters.slice(0, 10).map(c => ({
          name: c.primaryEntity,
          type: c.entityType,
          documentCount: c.documentIds.length,
          mentions: c.mentionCount,
        })),
        conflicts: conflicts.slice(0, 5).map(c => c.description),
        inconsistencies: inconsistencies.slice(0, 5).map(i => i.analysis),
      };

      const message = await anthropic.messages.create({
        model: DEFAULT_ANTHROPIC_MODEL,
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `You are a cold case detective analyzing cross-document evidence. Based on this summary, provide 5-7 key findings that would be most relevant for investigators:

${JSON.stringify(summaryData, null, 2)}

Return a JSON array of strings, each string being a key finding. Focus on:
1. Patterns across documents
2. People who appear suspiciously often
3. Critical conflicts or inconsistencies
4. Evidence gaps
5. Recommended next steps

Return ONLY the JSON array, no other text.`,
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
      console.warn('[Cross-Document Analysis] AI key findings generation failed:', error);
    }
  }

  // Fallback: Generate findings heuristically
  const findings: string[] = [];

  if (entityClusters.length > 0) {
    const topPerson = entityClusters.find(c => c.entityType === 'person');
    if (topPerson) {
      findings.push(`${topPerson.primaryEntity} is mentioned in ${topPerson.documentIds.length} documents - verify interview and alibi status.`);
    }
  }

  if (conflicts.length > 0) {
    findings.push(`${conflicts.length} timeline conflict${conflicts.length > 1 ? 's' : ''} detected requiring immediate attention.`);
  }

  if (inconsistencies.length > 0) {
    findings.push(`${inconsistencies.length} statement inconsistenc${inconsistencies.length > 1 ? 'ies' : 'y'} found - recommend re-interviews.`);
  }

  const multiDocPhones = entityClusters.filter(c => c.entityType === 'phone' && c.documentIds.length >= 2);
  if (multiDocPhones.length > 0) {
    findings.push(`${multiDocPhones.length} phone number${multiDocPhones.length > 1 ? 's appear' : ' appears'} across multiple documents - investigate call patterns.`);
  }

  if (findings.length === 0) {
    findings.push('Initial cross-document scan complete. Continue adding documents for deeper analysis.');
  }

  return findings;
}

async function saveAnalysisResults(caseId: string, results: any): Promise<void> {
  try {
    const { error } = await supabaseServer
      .from('case_analysis')
      .upsert({
        case_id: caseId,
        analysis_type: 'cross_document_correlation',
        analysis_data: results,
        confidence_score: 0.85,
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'case_id,analysis_type',
      });

    if (error) {
      console.warn('[Cross-Document Analysis] Failed to save results:', error);
    } else {
      console.log('[Cross-Document Analysis] Results saved successfully');
    }
  } catch (error) {
    console.error('[Cross-Document Analysis] Error saving results:', error);
  }
}

function createEmptyAnalysis(caseId: string): CrossDocumentAnalysis {
  return {
    caseId,
    analyzedAt: new Date(),
    documentCount: 0,
    correlations: [],
    entityClusters: [],
    timelineConflicts: [],
    statementInconsistencies: [],
    keyFindings: ['No documents found with extracted text. Upload and process documents to begin analysis.'],
    investigativeLeads: [],
    statistics: {
      totalEntities: 0,
      uniquePeople: 0,
      uniqueLocations: 0,
      uniquePhoneNumbers: 0,
      conflictsFound: 0,
      inconsistenciesFound: 0,
    },
  };
}

/**
 * Quick entity lookup for real-time correlation
 */
export async function findRelatedDocuments(
  caseId: string,
  entityName: string
): Promise<{ documentId: string; fileName: string; relevantText: string }[]> {
  const { data, error } = await supabaseServer
    .from('case_documents')
    .select('id, file_name, extracted_text')
    .eq('case_id', caseId)
    .ilike('extracted_text', `%${entityName}%`)
    .limit(20);

  if (error || !data) {
    return [];
  }

  return data.map(doc => {
    const text = doc.extracted_text || '';
    const index = text.toLowerCase().indexOf(entityName.toLowerCase());
    const start = Math.max(0, index - 100);
    const end = Math.min(text.length, index + entityName.length + 100);
    const relevantText = text.slice(start, end);

    return {
      documentId: doc.id,
      fileName: doc.file_name,
      relevantText: `...${relevantText}...`,
    };
  });
}
