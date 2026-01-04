/**
 * Entity Resolution Engine
 *
 * Resolves entity mentions to canonical entities using:
 * - Exact matching
 * - Fuzzy string matching (Levenshtein, trigram similarity)
 * - Phonetic matching (Soundex)
 * - Context-based disambiguation
 * - AI-powered resolution for ambiguous cases
 */

import { supabaseServer } from './supabase-server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export interface CanonicalEntity {
  id: string;
  caseId: string;
  entityType: EntityType;
  canonicalName: string;
  displayName?: string;
  description?: string;
  role?: EntityRole;
  suspicionScore: number;
  confidenceScore: number;
  isVerified: boolean;
  mentionCount: number;
  documentCount: number;
  aliases: EntityAlias[];
  metadata?: Record<string, any>;
}

export type EntityType = 'person' | 'organization' | 'location' | 'vehicle' | 'phone' | 'email' | 'weapon' | 'evidence';
export type EntityRole = 'victim' | 'suspect' | 'witness' | 'person_of_interest' | 'family' | 'associate' | 'investigator' | 'expert' | 'other' | 'unknown';

export interface EntityAlias {
  id: string;
  aliasValue: string;
  aliasType: AliasType;
  confidence: number;
  isConfirmed: boolean;
}

export type AliasType = 'full_name' | 'nickname' | 'maiden_name' | 'misspelling' | 'abbreviation' | 'title_variation' | 'partial_name' | 'phonetic_match';

export interface EntityMatch {
  canonicalEntityId: string;
  canonicalName: string;
  confidence: number;
  matchType: 'exact' | 'fuzzy' | 'phonetic' | 'context' | 'ai';
  matchedOn: string;
}

export interface UnresolvedEntity {
  mentionText: string;
  documentId: string;
  context: string;
  potentialMatches: EntityMatch[];
  needsHumanReview: boolean;
  suggestedCanonicalName?: string;
  suggestedRole?: EntityRole;
}

export interface EntityMention {
  id: string;
  canonicalEntityId: string;
  documentId: string;
  mentionText: string;
  contextBefore: string;
  contextAfter: string;
  fullSentence: string;
  pageNumber?: number;
  characterOffset?: number;
  mentionType?: 'subject' | 'object' | 'possessive' | 'reference' | 'quote';
  sentiment?: 'positive' | 'negative' | 'neutral' | 'suspicious';
}

export interface EntityResolutionConfig {
  fuzzyThreshold: number;        // 0-1, default 0.75
  phoneticMatching: boolean;     // Use soundex matching
  contextWeight: number;         // Weight for context similarity
  aiResolutionThreshold: number; // Below this confidence, use AI
  autoMergeThreshold: number;    // Above this, auto-merge entities
}

const DEFAULT_CONFIG: EntityResolutionConfig = {
  fuzzyThreshold: 0.75,
  phoneticMatching: true,
  contextWeight: 0.3,
  aiResolutionThreshold: 0.5,
  autoMergeThreshold: 0.95,
};

/**
 * Resolve an entity mention to a canonical entity
 */
export async function resolveEntity(
  caseId: string,
  mentionText: string,
  context: string,
  documentId: string,
  config: Partial<EntityResolutionConfig> = {}
): Promise<EntityMatch | UnresolvedEntity> {
  const fullConfig = { ...DEFAULT_CONFIG, ...config };

  // Clean the mention text
  const cleanedMention = cleanEntityName(mentionText);

  // Step 1: Try exact match
  const exactMatch = await findExactMatch(caseId, cleanedMention);
  if (exactMatch) {
    await recordMention(exactMatch.canonicalEntityId, documentId, mentionText, context);
    return exactMatch;
  }

  // Step 2: Try fuzzy matching
  const fuzzyMatches = await findFuzzyMatches(caseId, cleanedMention, fullConfig.fuzzyThreshold);

  // Step 3: Try phonetic matching if enabled
  let phoneticMatches: EntityMatch[] = [];
  if (fullConfig.phoneticMatching) {
    phoneticMatches = await findPhoneticMatches(caseId, cleanedMention);
  }

  // Combine and deduplicate matches
  const allMatches = [...fuzzyMatches, ...phoneticMatches];
  const uniqueMatches = deduplicateMatches(allMatches);

  // If we have a high-confidence match, use it
  const bestMatch = uniqueMatches[0];
  if (bestMatch && bestMatch.confidence >= fullConfig.autoMergeThreshold) {
    await recordMention(bestMatch.canonicalEntityId, documentId, mentionText, context);
    return bestMatch;
  }

  // Step 4: If matches are ambiguous, try AI resolution
  if (uniqueMatches.length > 0 && bestMatch && bestMatch.confidence < fullConfig.aiResolutionThreshold) {
    const aiMatch = await resolveWithAI(caseId, mentionText, context, uniqueMatches);
    if (aiMatch && aiMatch.confidence > bestMatch.confidence) {
      await recordMention(aiMatch.canonicalEntityId, documentId, mentionText, context);
      return aiMatch;
    }
  }

  // Return as unresolved with potential matches
  return {
    mentionText,
    documentId,
    context,
    potentialMatches: uniqueMatches,
    needsHumanReview: uniqueMatches.length > 1 || (bestMatch && bestMatch.confidence < 0.6),
    suggestedCanonicalName: cleanedMention,
    suggestedRole: inferRole(context),
  };
}

/**
 * Create a new canonical entity
 */
export async function createCanonicalEntity(
  caseId: string,
  data: {
    entityType: EntityType;
    canonicalName: string;
    displayName?: string;
    role?: EntityRole;
    aliases?: string[];
    description?: string;
    metadata?: Record<string, any>;
  }
): Promise<CanonicalEntity> {
  const { data: entity, error } = await supabaseServer
    .from('canonical_entities')
    .insert({
      case_id: caseId,
      entity_type: data.entityType,
      canonical_name: data.canonicalName,
      display_name: data.displayName || data.canonicalName,
      role: data.role || 'unknown',
      description: data.description,
      metadata: data.metadata || {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create canonical entity: ${error.message}`);
  }

  // Create aliases including the canonical name itself
  const aliases = [data.canonicalName, ...(data.aliases || [])];
  const uniqueAliases = [...new Set(aliases.map(a => a.toLowerCase()))];

  for (const alias of uniqueAliases) {
    await supabaseServer
      .from('entity_aliases')
      .insert({
        canonical_entity_id: entity.id,
        alias_value: alias,
        alias_type: alias === data.canonicalName.toLowerCase() ? 'full_name' : 'nickname',
        confidence: 1.0,
        is_confirmed: true,
      })
      .onConflict(['canonical_entity_id', 'alias_value'])
      .ignore();
  }

  return {
    id: entity.id,
    caseId: entity.case_id,
    entityType: entity.entity_type,
    canonicalName: entity.canonical_name,
    displayName: entity.display_name,
    description: entity.description,
    role: entity.role,
    suspicionScore: entity.suspicion_score || 0,
    confidenceScore: entity.confidence_score || 0.8,
    isVerified: entity.is_verified || false,
    mentionCount: 0,
    documentCount: 0,
    aliases: [],
    metadata: entity.metadata,
  };
}

/**
 * Merge two entities into one
 */
export async function mergeEntities(
  primaryEntityId: string,
  secondaryEntityId: string,
  confirmedBy?: string
): Promise<void> {
  // Get both entities
  const { data: primary } = await supabaseServer
    .from('canonical_entities')
    .select('*')
    .eq('id', primaryEntityId)
    .single();

  const { data: secondary } = await supabaseServer
    .from('canonical_entities')
    .select('*')
    .eq('id', secondaryEntityId)
    .single();

  if (!primary || !secondary) {
    throw new Error('One or both entities not found');
  }

  // Move all aliases from secondary to primary
  await supabaseServer
    .from('entity_aliases')
    .update({ canonical_entity_id: primaryEntityId })
    .eq('canonical_entity_id', secondaryEntityId);

  // Add secondary's canonical name as an alias
  await supabaseServer
    .from('entity_aliases')
    .insert({
      canonical_entity_id: primaryEntityId,
      alias_value: secondary.canonical_name.toLowerCase(),
      alias_type: 'full_name',
      confidence: 1.0,
      is_confirmed: true,
    })
    .onConflict(['canonical_entity_id', 'alias_value'])
    .ignore();

  // Move all mentions from secondary to primary
  await supabaseServer
    .from('entity_mentions')
    .update({ canonical_entity_id: primaryEntityId })
    .eq('canonical_entity_id', secondaryEntityId);

  // Update mention counts
  await supabaseServer
    .from('canonical_entities')
    .update({
      mention_count: primary.mention_count + secondary.mention_count,
      document_count: primary.document_count + secondary.document_count,
      is_verified: true,
      verified_by: confirmedBy,
      verified_at: new Date().toISOString(),
    })
    .eq('id', primaryEntityId);

  // Delete the secondary entity
  await supabaseServer
    .from('canonical_entities')
    .delete()
    .eq('id', secondaryEntityId);
}

/**
 * Get entity merge suggestions
 */
export async function getEntityMergeSuggestions(
  caseId: string,
  limit: number = 20
): Promise<{ entity1: CanonicalEntity; entity2: CanonicalEntity; confidence: number; reason: string }[]> {
  const { data: entities } = await supabaseServer
    .from('canonical_entities')
    .select('*, entity_aliases(*)')
    .eq('case_id', caseId)
    .eq('entity_type', 'person');

  if (!entities || entities.length < 2) {
    return [];
  }

  const suggestions: { entity1: CanonicalEntity; entity2: CanonicalEntity; confidence: number; reason: string }[] = [];

  // Compare all pairs
  for (let i = 0; i < entities.length; i++) {
    for (let j = i + 1; j < entities.length; j++) {
      const e1 = entities[i];
      const e2 = entities[j];

      // Calculate similarity
      const nameSimilarity = calculateSimilarity(
        e1.canonical_name.toLowerCase(),
        e2.canonical_name.toLowerCase()
      );

      // Check alias overlaps
      const e1Aliases = new Set(e1.entity_aliases?.map((a: any) => a.alias_value.toLowerCase()) || []);
      const e2Aliases = new Set(e2.entity_aliases?.map((a: any) => a.alias_value.toLowerCase()) || []);
      const aliasOverlap = [...e1Aliases].some(a => e2Aliases.has(a));

      // Check phonetic similarity
      const phoneticMatch = soundex(e1.canonical_name) === soundex(e2.canonical_name);

      let confidence = nameSimilarity;
      let reason = 'Name similarity';

      if (aliasOverlap) {
        confidence = Math.max(confidence, 0.9);
        reason = 'Shared alias';
      }

      if (phoneticMatch && confidence > 0.5) {
        confidence = Math.min(confidence + 0.15, 1.0);
        reason = 'Phonetic match';
      }

      if (confidence >= 0.7) {
        suggestions.push({
          entity1: mapToCanonicalEntity(e1),
          entity2: mapToCanonicalEntity(e2),
          confidence,
          reason,
        });
      }
    }
  }

  // Sort by confidence and limit
  return suggestions
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, limit);
}

/**
 * Extract entities from text
 */
export async function extractEntitiesFromText(
  caseId: string,
  documentId: string,
  text: string
): Promise<{ resolved: EntityMatch[]; unresolved: UnresolvedEntity[] }> {
  const resolved: EntityMatch[] = [];
  const unresolved: UnresolvedEntity[] = [];

  // Extract potential person names using pattern matching
  const namePatterns = [
    /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/g, // Standard names
    /\bMr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g, // Mr. Smith
    /\bMs\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g, // Ms. Smith
    /\bMrs\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g, // Mrs. Smith
    /\bDr\.?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g, // Dr. Smith
    /\bOfficer\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g, // Officer Smith
    /\bDetective\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/g, // Detective Smith
  ];

  const foundNames = new Map<string, { context: string; count: number }>();

  for (const pattern of namePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1] || match[0];
      const cleanName = cleanEntityName(name);

      // Skip common non-name patterns
      if (isCommonNonName(cleanName)) continue;

      // Get context
      const start = Math.max(0, match.index - 100);
      const end = Math.min(text.length, match.index + match[0].length + 100);
      const context = text.slice(start, end);

      const existing = foundNames.get(cleanName.toLowerCase());
      if (existing) {
        existing.count++;
      } else {
        foundNames.set(cleanName.toLowerCase(), { context, count: 1 });
      }
    }
  }

  // Resolve each unique name
  for (const [name, data] of foundNames) {
    const result = await resolveEntity(caseId, name, data.context, documentId);

    if ('canonicalEntityId' in result) {
      resolved.push(result);
    } else {
      unresolved.push(result);
    }
  }

  return { resolved, unresolved };
}

/**
 * Get all entities for a case
 */
export async function getCaseEntities(
  caseId: string,
  options: { entityType?: EntityType; role?: EntityRole; minMentions?: number } = {}
): Promise<CanonicalEntity[]> {
  let query = supabaseServer
    .from('canonical_entities')
    .select('*, entity_aliases(*)')
    .eq('case_id', caseId);

  if (options.entityType) {
    query = query.eq('entity_type', options.entityType);
  }

  if (options.role) {
    query = query.eq('role', options.role);
  }

  if (options.minMentions) {
    query = query.gte('mention_count', options.minMentions);
  }

  const { data: entities, error } = await query.order('mention_count', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch entities: ${error.message}`);
  }

  return (entities || []).map(mapToCanonicalEntity);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function findExactMatch(caseId: string, name: string): Promise<EntityMatch | null> {
  const { data: alias } = await supabaseServer
    .from('entity_aliases')
    .select('canonical_entity_id, canonical_entities(canonical_name)')
    .eq('alias_value', name.toLowerCase())
    .single();

  if (alias) {
    return {
      canonicalEntityId: alias.canonical_entity_id,
      canonicalName: (alias.canonical_entities as any)?.canonical_name || name,
      confidence: 1.0,
      matchType: 'exact',
      matchedOn: name,
    };
  }

  return null;
}

async function findFuzzyMatches(caseId: string, name: string, threshold: number): Promise<EntityMatch[]> {
  // Use PostgreSQL trigram similarity
  const { data: matches } = await supabaseServer
    .rpc('find_entity_matches', {
      p_case_id: caseId,
      p_name: name.toLowerCase(),
      p_threshold: threshold,
    });

  return (matches || []).map((m: any) => ({
    canonicalEntityId: m.entity_id,
    canonicalName: m.canonical_name,
    confidence: m.similarity_score,
    matchType: 'fuzzy' as const,
    matchedOn: m.matched_alias,
  }));
}

async function findPhoneticMatches(caseId: string, name: string): Promise<EntityMatch[]> {
  const nameSoundex = soundex(name);

  const { data: entities } = await supabaseServer
    .from('canonical_entities')
    .select('id, canonical_name')
    .eq('case_id', caseId)
    .eq('entity_type', 'person');

  return (entities || [])
    .filter(e => soundex(e.canonical_name) === nameSoundex)
    .map(e => ({
      canonicalEntityId: e.id,
      canonicalName: e.canonical_name,
      confidence: 0.7, // Phonetic matches are less certain
      matchType: 'phonetic' as const,
      matchedOn: name,
    }));
}

async function resolveWithAI(
  caseId: string,
  mentionText: string,
  context: string,
  potentialMatches: EntityMatch[]
): Promise<EntityMatch | null> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }

  try {
    const matchDescriptions = potentialMatches
      .map((m, i) => `${i + 1}. "${m.canonicalName}" (confidence: ${(m.confidence * 100).toFixed(0)}%)`)
      .join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are helping resolve entity mentions in a criminal investigation case file.

The mention text is: "${mentionText}"

Context from the document:
"${context}"

Potential matches:
${matchDescriptions}

Based on the context, which person does this mention most likely refer to? Respond with ONLY the number of the best match, or 0 if none of them match. Do not explain.`,
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    const matchIndex = parseInt(text, 10) - 1;

    if (matchIndex >= 0 && matchIndex < potentialMatches.length) {
      return {
        ...potentialMatches[matchIndex],
        matchType: 'ai',
        confidence: Math.min(potentialMatches[matchIndex].confidence + 0.15, 0.95),
      };
    }
  } catch (error) {
    console.error('[Entity Resolution] AI resolution failed:', error);
  }

  return null;
}

async function recordMention(
  entityId: string,
  documentId: string,
  mentionText: string,
  context: string
): Promise<void> {
  // Extract context before/after
  const mentionIndex = context.indexOf(mentionText);
  const contextBefore = mentionIndex > 0 ? context.slice(0, mentionIndex).trim() : '';
  const contextAfter = mentionIndex >= 0 ? context.slice(mentionIndex + mentionText.length).trim() : '';

  await supabaseServer
    .from('entity_mentions')
    .insert({
      canonical_entity_id: entityId,
      document_id: documentId,
      mention_text: mentionText,
      context_before: contextBefore.slice(-100),
      context_after: contextAfter.slice(0, 100),
      full_sentence: context.slice(0, 500),
    });

  // Update mention count
  await supabaseServer.rpc('increment_entity_mention_count', { entity_id: entityId });
}

function cleanEntityName(name: string): string {
  return name
    .replace(/^(Mr\.?|Mrs\.?|Ms\.?|Dr\.?|Officer|Detective|Sgt\.?|Lt\.?|Capt\.?)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isCommonNonName(name: string): boolean {
  const nonNames = new Set([
    'the', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
    'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august',
    'september', 'october', 'november', 'december', 'police', 'department',
    'street', 'avenue', 'road', 'court', 'hospital', 'station', 'office',
    'evidence', 'report', 'case', 'file', 'document', 'witness', 'victim',
    'suspect', 'interview', 'statement', 'unknown', 'male', 'female',
  ]);

  return nonNames.has(name.toLowerCase()) || name.length < 3;
}

function deduplicateMatches(matches: EntityMatch[]): EntityMatch[] {
  const seen = new Map<string, EntityMatch>();

  for (const match of matches) {
    const existing = seen.get(match.canonicalEntityId);
    if (!existing || match.confidence > existing.confidence) {
      seen.set(match.canonicalEntityId, match);
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => b.confidence - a.confidence);
}

function inferRole(context: string): EntityRole {
  const lowerContext = context.toLowerCase();

  if (/victim|deceased|murdered|killed/.test(lowerContext)) return 'victim';
  if (/suspect|accused|arrested|charged/.test(lowerContext)) return 'suspect';
  if (/witness|saw|observed|stated|testified/.test(lowerContext)) return 'witness';
  if (/family|mother|father|brother|sister|wife|husband|son|daughter/.test(lowerContext)) return 'family';
  if (/officer|detective|investigator|sergeant/.test(lowerContext)) return 'investigator';

  return 'unknown';
}

function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  // Levenshtein distance
  const matrix: number[][] = [];

  for (let i = 0; i <= str1.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str1.length; i++) {
    for (let j = 1; j <= str2.length; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[str1.length][str2.length];
  const maxLength = Math.max(str1.length, str2.length);

  return 1 - distance / maxLength;
}

function soundex(str: string): string {
  const s = str.toUpperCase().replace(/[^A-Z]/g, '');
  if (s.length === 0) return '';

  const codes: Record<string, string> = {
    B: '1', F: '1', P: '1', V: '1',
    C: '2', G: '2', J: '2', K: '2', Q: '2', S: '2', X: '2', Z: '2',
    D: '3', T: '3',
    L: '4',
    M: '5', N: '5',
    R: '6',
  };

  let result = s[0];
  let prevCode = codes[s[0]] || '';

  for (let i = 1; i < s.length && result.length < 4; i++) {
    const code = codes[s[i]] || '';
    if (code && code !== prevCode) {
      result += code;
    }
    prevCode = code || prevCode;
  }

  return result.padEnd(4, '0');
}

function mapToCanonicalEntity(data: any): CanonicalEntity {
  return {
    id: data.id,
    caseId: data.case_id,
    entityType: data.entity_type,
    canonicalName: data.canonical_name,
    displayName: data.display_name,
    description: data.description,
    role: data.role,
    suspicionScore: data.suspicion_score || 0,
    confidenceScore: data.confidence_score || 0.8,
    isVerified: data.is_verified || false,
    mentionCount: data.mention_count || 0,
    documentCount: data.document_count || 0,
    aliases: (data.entity_aliases || []).map((a: any) => ({
      id: a.id,
      aliasValue: a.alias_value,
      aliasType: a.alias_type,
      confidence: a.confidence,
      isConfirmed: a.is_confirmed,
    })),
    metadata: data.metadata,
  };
}
