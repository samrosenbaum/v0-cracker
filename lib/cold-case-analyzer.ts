import { DEFAULT_ANTHROPIC_MODEL, getAnthropicClient, isAnthropicConfigured } from './anthropic-client';

// ============================================================================
// Helper function to safely extract and parse JSON from Claude responses
// ============================================================================

function safeJsonExtract(text: string, pattern: RegExp): any {
  const jsonMatch = text.match(pattern);
  if (!jsonMatch) {
    throw new Error('Could not find JSON in response. Response may contain an error message.');
  }

  const jsonStr = jsonMatch[0];

  // Check if the matched text looks like an error message
  if (jsonStr.startsWith('[Unable to') || jsonStr.startsWith('{Unable to') ||
      jsonStr.includes('error') && jsonStr.length < 100) {
    throw new Error(`Response contains error message instead of JSON: ${jsonStr.substring(0, 100)}`);
  }

  try {
    return JSON.parse(jsonStr);
  } catch (parseError: any) {
    throw new Error(`Failed to parse JSON: ${parseError.message}. Matched text: ${jsonStr.substring(0, 200)}`);
  }
}

const SENTENCE_SPLIT_REGEX = /(?<=[.!?])\s+/;

function splitSentences(text: string): string[] {
  return text
    .split(SENTENCE_SPLIT_REGEX)
    .map(sentence => sentence.trim())
    .filter(Boolean);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normaliseText(text: string): string {
  return text.toLowerCase();
}

function extractProperNames(text: string): string[] {
  const matches = text.match(/\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g) || [];
  return Array.from(new Set(matches));
}

function tokeniseForSimilarity(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(token => token.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach(token => {
    if (b.has(token)) {
      intersection += 1;
    }
  });
  return intersection / (a.size + b.size - intersection);
}

// ============================================================================
// 1. BEHAVIORAL PATTERN ANALYSIS
// ============================================================================

export interface BehaviorPattern {
  personName: string;
  patterns: {
    type: 'evasion' | 'overexplaining' | 'timeline_vagueness' | 'defensive' | 'projection' | 'inconsistent_emotion';
    description: string;
    examples: string[];
    suspicionLevel: number; // 0-1
    psychologicalNote: string;
  }[];
  overallAssessment: string;
  recommendedFollowUp: string[];
}

const BEHAVIOR_PATTERN_RULES: Array<{
  type: BehaviorPattern['patterns'][number]['type'];
  keywords: RegExp[];
  psychologicalNote: string;
  description: string;
}> = [
  {
    type: 'evasion',
    keywords: [/don't recall/i, /can't remember/i, /unsure/i, /not sure/i, /i guess/i],
    psychologicalNote: 'Frequent memory gaps around critical moments can indicate withholding or rehearsed avoidance.',
    description: 'Avoids providing direct answers when describing pivotal moments.',
  },
  {
    type: 'overexplaining',
    keywords: [/let me explain/i, /to be honest/i, /honestly/i, /i swear/i, /exactly/i],
    psychologicalNote: 'Providing unnecessary detail on minor points can signal an attempt to appear cooperative.',
    description: 'Provides excessive detail about peripheral topics while core facts stay vague.',
  },
  {
    type: 'timeline_vagueness',
    keywords: [/around/i, /maybe/i, /approximately/i, /sometime/i, /later on/i],
    psychologicalNote: 'Vague timing undermines alibi reliability and often conceals opportunity windows.',
    description: 'Gives imprecise timing around the incident window.',
  },
  {
    type: 'defensive',
    keywords: [/why would i/i, /you think/i, /stop asking/i, /that's ridiculous/i, /already told/i],
    psychologicalNote: 'Defensiveness to routine questions often surfaces when the subject feels exposed.',
    description: 'Responds defensively when challenged on inconsistencies.',
  },
  {
    type: 'projection',
    keywords: [/they must have/i, /someone else/i, /probably her/i, /i bet/i],
    psychologicalNote: 'Redirecting blame without prompt can indicate inner knowledge of wrongdoing.',
    description: 'Quick to shift blame toward others without evidence.',
  },
  {
    type: 'inconsistent_emotion',
    keywords: [/laughed/i, /joked/i, /calm/i, /not upset/i, /didn't bother/i],
    psychologicalNote: 'Emotion that does not align with circumstances can expose rehearsed stories.',
    description: 'Emotional tone does not match the gravity of the situation.',
  },
];

function fallbackAnalyzeBehavioralPatterns(
  interviews: { speaker: string; content: string; date: string }[],
): BehaviorPattern[] {
  if (!interviews.length) {
    return [];
  }

  const grouped = new Map<string, BehaviorPattern>();

  interviews.forEach(interview => {
    const speaker = interview.speaker || 'Unknown Interviewee';
    if (!grouped.has(speaker)) {
      grouped.set(speaker, {
        personName: speaker,
        patterns: [],
        overallAssessment: 'No behavioural anomalies detected.',
        recommendedFollowUp: [],
      });
    }

    const entry = grouped.get(speaker)!;
    const patternMap = new Map<BehaviorPattern['patterns'][number]['type'], BehaviorPattern['patterns'][number]>();

    entry.patterns.forEach(pattern => {
      patternMap.set(pattern.type, pattern);
    });

    const sentences = splitSentences(interview.content);

    sentences.forEach(sentence => {
      BEHAVIOR_PATTERN_RULES.forEach(rule => {
        if (rule.keywords.some(keyword => keyword.test(sentence))) {
          const existing = patternMap.get(rule.type);
          const suspicionBump = sentence.length > 160 ? 0.12 : 0.08;
          if (existing) {
            existing.examples.push(sentence.trim());
            existing.suspicionLevel = clamp(existing.suspicionLevel + suspicionBump, 0, 1);
          } else {
            const newPattern: BehaviorPattern['patterns'][number] = {
              type: rule.type,
              description: rule.description,
              examples: [sentence.trim()],
              suspicionLevel: clamp(0.45 + suspicionBump, 0, 1),
              psychologicalNote: rule.psychologicalNote,
            };
            entry.patterns.push(newPattern);
            patternMap.set(rule.type, newPattern);
          }
        }
      });
    });

    if (!entry.patterns.length) {
      entry.patterns.push({
        type: 'timeline_vagueness',
        description: 'Interview provided limited actionable detail; schedule clarifying follow-up.',
        examples: sentences.slice(0, 2),
        suspicionLevel: 0.25,
        psychologicalNote: 'Lack of specifics may stem from stress or incomplete recall—verify key times with corroborating evidence.',
      });
    }

    const highestSuspicion = Math.max(...entry.patterns.map(pattern => pattern.suspicionLevel));
    const concerningPatterns = entry.patterns.filter(pattern => pattern.suspicionLevel >= 0.5);

    entry.overallAssessment = concerningPatterns.length
      ? `${concerningPatterns.length} notable behavioural red flag${concerningPatterns.length > 1 ? 's' : ''} detected (top concern: ${concerningPatterns[0].type.replace(/_/g, ' ')}).`
      : 'Behaviour largely consistent; minor clarification recommended.';

    const followUps = new Set<string>(entry.recommendedFollowUp);
    concerningPatterns.forEach(pattern => {
      followUps.add(`Re-interview ${speaker} focusing on ${pattern.type.replace(/_/g, ' ')} statements around ${interview.date || 'the critical window'}.`);
    });
    if (highestSuspicion < 0.5) {
      followUps.add(`Cross-check ${speaker}'s statements with independent evidence for the ${interview.date || 'incident'} window.`);
    }
    entry.recommendedFollowUp = Array.from(followUps);
  });

  return Array.from(grouped.values());
}

export async function analyzeBehavioralPatterns(
  interviews: { speaker: string; content: string; date: string }[]
): Promise<BehaviorPattern[]> {

  const runFallback = () => fallbackAnalyzeBehavioralPatterns(interviews);

  if (!interviews.length) {
    return [];
  }

  if (!isAnthropicConfigured()) {
    console.warn('[ColdCaseAnalyzer] Anthropic key missing for behavioral analysis. Using heuristic fallback.');
    return runFallback();
  }

  const prompt = `You are a forensic psychologist and expert interrogator. Analyze these interview transcripts for behavioral red flags that often indicate deception or guilt:

BEHAVIORAL RED FLAGS TO DETECT:
1. **Evasion**: Avoiding direct answers, changing subjects, "I don't recall" for important details
2. **Overexplaining**: Excessive detail about irrelevant things, trying too hard to seem helpful
3. **Timeline Vagueness**: Very specific about some times but vague about critical timeframes
4. **Defensive Responses**: Getting angry or defensive when asked routine questions
5. **Projection**: Accusing others of what they might have done
6. **Inconsistent Emotion**: Emotional response doesn't match the gravity of questions
7. **Distancing Language**: "That woman" instead of name, avoiding personal pronouns
8. **Memory Selectivity**: Perfect recall of alibi but fuzzy on other details
9. **Rehearsed Answers**: Responses sound scripted or practiced
10. **Timing of Information**: Withholding then "remembering" information later

For each person interviewed, identify these patterns with specific examples.

INTERVIEWS:
${interviews.map(i => `[${i.date}] ${i.speaker}:\n${i.content}`).join('\n\n')}

Return JSON matching BehaviorPattern[] interface.`;

  const anthropic = getAnthropicClient();

  try {
    const message = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    return safeJsonExtract(content.text, /\[[\s\S]*\]/);
  } catch (error) {
    console.error('[ColdCaseAnalyzer] Behavioral pattern analysis failed. Falling back to heuristics.', error);
    return runFallback();
  }
}

// ============================================================================
// 2. EVIDENCE GAP ANALYSIS
// ============================================================================

export interface EvidenceGap {
  category: 'forensic' | 'witness' | 'digital' | 'location' | 'financial' | 'communication';
  gapDescription: string;
  whyItMatters: string;
  howToFill: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedEffort: string;
  potentialBreakthroughValue: number; // 0-1
}

function fallbackIdentifyEvidenceGaps(caseData: {
  incidentType: string;
  date: string;
  location: string;
  availableEvidence: string[];
  suspects: string[];
  witnesses: string[];
}): EvidenceGap[] {
  const results: EvidenceGap[] = [];
  const evidence = (caseData.availableEvidence || []).map(item => item.toLowerCase());

  const hasEvidence = (...keywords: string[]) =>
    evidence.some(item => keywords.some(keyword => item.includes(keyword)));

  if (!hasEvidence('dna', 'genetic', 'genealogy')) {
    results.push({
      category: 'forensic',
      gapDescription: 'No DNA or touch DNA collection documented for primary scenes or belongings.',
      whyItMatters: 'Modern touch DNA and genealogy can surface unidentified contributors even years later.',
      howToFill: 'Collect clothing, phone, vehicle surfaces, and stored evidence for touch DNA / genealogy reprocessing.',
      priority: 'critical',
      estimatedEffort: 'moderate',
      potentialBreakthroughValue: 0.85,
    });
  }

  if (!hasEvidence('phone', 'tower', 'cell', 'ping', 'digital')) {
    results.push({
      category: 'digital',
      gapDescription: 'Digital location and communication records around the disappearance are missing.',
      whyItMatters: 'Cell tower, app, and GPS history can confirm actual movements and contradict alibis.',
      howToFill: 'Request historical cell carrier records and recover phone backups for the 48 hours around the incident.',
      priority: 'high',
      estimatedEffort: 'moderate',
      potentialBreakthroughValue: 0.78,
    });
  }

  if (!hasEvidence('camera', 'cctv', 'video', 'surveillance')) {
    results.push({
      category: 'location',
      gapDescription: 'No documented canvass of Riverwalk overlook cameras or adjacent businesses.',
      whyItMatters: 'Secondary camera angles routinely capture vehicle movements and companion identities.',
      howToFill: 'Identify traffic, parking garage, and residential cameras covering the victim path and request archives.',
      priority: 'high',
      estimatedEffort: 'moderate',
      potentialBreakthroughValue: 0.72,
    });
  }

  if (caseData.witnesses.length < 3) {
    results.push({
      category: 'witness',
      gapDescription: 'Limited number of witness re-interviews recorded despite conflicting accounts.',
      whyItMatters: 'Fresh interviews can surface inconsistencies, new names, or recanted alibis.',
      howToFill: 'Re-interview original witnesses focusing on timeline gaps and unconfirmed companions.',
      priority: 'medium',
      estimatedEffort: 'low',
      potentialBreakthroughValue: 0.6,
    });
  }

  if (!hasEvidence('financial', 'bank', 'transaction', 'card')) {
    results.push({
      category: 'financial',
      gapDescription: 'No financial activity analysis to determine purchases or travel connected to the disappearance.',
      whyItMatters: 'Transaction records reveal last-minute supply purchases, emergency cash withdrawals, or accomplice expenses.',
      howToFill: 'Subpoena bank, credit card, and rideshare records for the incident week.',
      priority: 'medium',
      estimatedEffort: 'moderate',
      potentialBreakthroughValue: 0.55,
    });
  }

  if (!hasEvidence('interview log', 'call log') && caseData.suspects.length) {
    results.push({
      category: 'communication',
      gapDescription: 'No follow-up interview logs for key persons of interest after initial statements.',
      whyItMatters: 'Comparing current recollections against original transcripts exposes rehearsed narratives.',
      howToFill: 'Schedule structured follow-ups with each suspect emphasising contested moments and missing 30-minute intervals.',
      priority: 'high',
      estimatedEffort: 'low',
      potentialBreakthroughValue: 0.68,
    });
  }

  if (!results.length) {
    results.push({
      category: 'forensic',
      gapDescription: 'Case review did not surface specific missing evidence, but archived exhibits lack AI summaries.',
      whyItMatters: 'Ensuring every document is digitised enables downstream AI triage and cross-case comparison.',
      howToFill: 'Digitise remaining physical files and run optical character recognition to unlock searchability.',
      priority: 'low',
      estimatedEffort: 'moderate',
      potentialBreakthroughValue: 0.4,
    });
  }

  return results;
}

export async function identifyEvidenceGaps(caseData: {
  incidentType: string;
  date: string;
  location: string;
  availableEvidence: string[];
  suspects: string[];
  witnesses: string[];
}): Promise<EvidenceGap[]> {

  if (!isAnthropicConfigured()) {
    console.warn('[ColdCaseAnalyzer] Anthropic key missing for evidence gap analysis. Using heuristic fallback.');
    return fallbackIdentifyEvidenceGaps(caseData);
  }

  const prompt = `You are a seasoned cold case detective. Analyze this case and identify MISSING evidence that should exist but hasn't been collected or documented.

CASE DETAILS:
- Type: ${caseData.incidentType}
- Date: ${caseData.date}
- Location: ${caseData.location}
- Available Evidence: ${caseData.availableEvidence.join(', ')}
- Suspects: ${caseData.suspects.join(', ')}
- Witnesses: ${caseData.witnesses.join(', ')}

EVIDENCE CATEGORIES TO CHECK:

**Forensic:**
- DNA samples (victims, suspects, crime scene)
- Fingerprints (weapons, surfaces, vehicles)
- Ballistics (if firearms involved)
- Blood spatter analysis
- Toxicology reports
- Autopsy findings
- Trace evidence (fibers, hair, soil)

**Digital:**
- Phone records/cell tower data
- Social media activity
- Email/text messages
- Computer forensics
- GPS/location data
- Digital photos metadata
- Security camera footage

**Financial:**
- Bank records
- Credit card transactions
- Insurance policies
- Property records
- Employment records
- Large cash withdrawals

**Witness/Interview:**
- Missing witness interviews
- Re-interviews with new questions
- Background checks on witnesses
- Polygraph tests
- Hypnosis sessions (controversial but used)

**Location:**
- Crime scene photos (all angles)
- Surrounding area surveillance
- Traffic cameras
- Business security footage
- Weather records for that day
- Lighting conditions

**Communication:**
- Landline records
- Voicemails
- Letters/notes
- Social connections mapping

For each gap, explain:
1. What's missing
2. Why it matters (could break the case)
3. How to obtain it now (even years later)
4. Priority level

Focus on evidence that STILL EXISTS or can still be obtained, even years later.

Return JSON matching EvidenceGap[] interface.`;

  const anthropic = getAnthropicClient();

  try {
    const message = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    return safeJsonExtract(content.text, /\[[\s\S]*\]/);
  } catch (error) {
    console.error('[ColdCaseAnalyzer] Evidence gap analysis failed. Falling back to heuristics.', error);
    return fallbackIdentifyEvidenceGaps(caseData);
  }
}

// ============================================================================
// 3. RELATIONSHIP NETWORK MAPPING
// ============================================================================

export interface RelationshipNode {
  name: string;
  role: 'victim' | 'suspect' | 'witness' | 'family' | 'associate' | 'unknown';
  connections: {
    to: string;
    type: 'family' | 'romantic' | 'friend' | 'coworker' | 'enemy' | 'business' | 'casual';
    strength: number; // 0-1
    notes: string;
    suspicious: boolean;
  }[];
  alibi?: string;
  motive?: string;
  opportunity?: string;
}

export interface HiddenConnection {
  person1: string;
  person2: string;
  connectionType: string;
  whyItMatters: string;
  hiddenHow: string; // How was this connection concealed
  discoveredFrom: string[]; // Which documents revealed it
}

function fallbackRelationshipNetwork(documents: string[]): {
  nodes: RelationshipNode[];
  hiddenConnections: HiddenConnection[];
} {
  const nodeMap = new Map<string, RelationshipNode>();
  const connectionMap = new Map<string, Map<string, { count: number; contexts: string[]; suspicious: boolean }>>();

  const ensureNode = (name: string) => {
    if (!nodeMap.has(name)) {
      nodeMap.set(name, {
        name,
        role: 'unknown',
        connections: [],
      });
    }
    return nodeMap.get(name)!;
  };

  const addConnection = (a: string, b: string, context: string) => {
    if (a === b) return;
    const sorted = [a, b].sort();
    const [first, second] = sorted;
    if (!connectionMap.has(first)) {
      connectionMap.set(first, new Map());
    }
    const inner = connectionMap.get(first)!;
    if (!inner.has(second)) {
      inner.set(second, { count: 0, contexts: [], suspicious: false });
    }
    const entry = inner.get(second)!;
    entry.count += 1;
    if (entry.contexts.length < 4) {
      entry.contexts.push(context.trim());
    }
    if (/(secret|unknown|undisclosed|concealed|hidden|didn't mention)/i.test(context)) {
      entry.suspicious = true;
    }
  };

  documents.forEach(documentText => {
    const sentences = splitSentences(documentText);
    sentences.forEach(sentence => {
      const names = extractProperNames(sentence);
      if (names.length === 0) return;

      names.forEach(name => {
        const node = ensureNode(name);
        const lower = normaliseText(sentence);
        if (/(victim|missing|last seen)/.test(lower)) {
          node.role = 'victim';
        } else if (/(suspect|person of interest|argument)/.test(lower)) {
          node.role = node.role === 'victim' ? 'victim' : 'suspect';
        } else if (/(witness|stated|reported)/.test(lower) && node.role === 'unknown') {
          node.role = 'witness';
        }
      });

      for (let i = 0; i < names.length; i += 1) {
        for (let j = i + 1; j < names.length; j += 1) {
          addConnection(names[i], names[j], sentence);
        }
      }
    });
  });

  connectionMap.forEach((targets, source) => {
    const sourceNode = ensureNode(source);
    targets.forEach((details, target) => {
      const targetNode = ensureNode(target);
      const notes = details.contexts.slice(0, 3).join(' | ');
      const strength = clamp(0.35 + details.count * 0.15, 0, 1);

      sourceNode.connections.push({
        to: targetNode.name,
        type: 'associate',
        strength,
        notes,
        suspicious: details.suspicious || strength > 0.75,
      });
      targetNode.connections.push({
        to: sourceNode.name,
        type: 'associate',
        strength,
        notes,
        suspicious: details.suspicious || strength > 0.75,
      });
    });
  });

  const hiddenConnections: HiddenConnection[] = [];
  connectionMap.forEach((targets, person1) => {
    targets.forEach((details, person2) => {
      if (details.suspicious || details.count > 2) {
        hiddenConnections.push({
          person1,
          person2,
          connectionType: details.suspicious ? 'concealed_association' : 'frequent_contact',
          whyItMatters: details.suspicious
            ? 'Document text hints this relationship was downplayed or undisclosed during interviews.'
            : 'Frequent mentions suggest coordination not reflected in official statements.',
          hiddenHow: details.suspicious
            ? 'References to secret or undisclosed meetings were found in source documents.'
            : 'Multiple documents mention both individuals together without supporting interview acknowledgement.',
          discoveredFrom: details.contexts.slice(0, 3),
        });
      }
    });
  });

  const nodes = Array.from(nodeMap.values()).map(node => ({
    ...node,
    connections: node.connections.filter(
      (connection, index, arr) => arr.findIndex(existing => existing.to === connection.to) === index,
    ),
  }));

  return {
    nodes,
    hiddenConnections,
  };
}

export async function mapRelationshipNetwork(
  documents: string[]
): Promise<{ nodes: RelationshipNode[]; hiddenConnections: HiddenConnection[] }> {

  if (!documents.length) {
    return { nodes: [], hiddenConnections: [] };
  }

  if (!isAnthropicConfigured()) {
    console.warn('[ColdCaseAnalyzer] Anthropic key missing for relationship network analysis. Using heuristic fallback.');
    return fallbackRelationshipNetwork(documents);
  }

  const prompt = `You are a detective specializing in uncovering hidden relationships. Analyze these documents to map ALL relationships between people involved in this case.

FOCUS ON:
1. **Obvious relationships**: Family, friends, coworkers
2. **HIDDEN relationships**:
   - Secret affairs
   - Financial ties not disclosed
   - Shared history not mentioned
   - Common associates
   - Business dealings
   - Past conflicts
   - Mutual enemies

3. **Red flag patterns**:
   - Person A says they don't know Person B, but documents show they do
   - Downplaying relationship strength ("just an acquaintance" but they talk daily)
   - Omitting shared history
   - Multiple people connected to same person but claiming independence

DOCUMENTS:
${documents.join('\n\n---\n\n')}

Create a network map showing:
- All people involved
- Their relationships to each other
- Relationship strength/frequency
- Hidden or concealed connections
- Suspicious omissions

Return JSON with nodes (RelationshipNode[]) and hiddenConnections (HiddenConnection[]).`;

  const anthropic = getAnthropicClient();

  try {
    const message = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    return safeJsonExtract(content.text, /\{[\s\S]*\}/);
  } catch (error) {
    console.error('[ColdCaseAnalyzer] Relationship network analysis failed. Falling back to heuristics.', error);
    return fallbackRelationshipNetwork(documents);
  }
}

// ============================================================================
// 4. CROSS-CASE PATTERN MATCHING (SERIAL OFFENDERS)
// ============================================================================

export interface CaseSimilarity {
  caseId: string;
  caseTitle: string;
  similarityScore: number; // 0-1
  matchingPatterns: {
    category: 'modus_operandi' | 'victim_selection' | 'location_pattern' | 'timing' | 'signature';
    details: string;
  }[];
  suspectOverlap: string[];
  recommendation: string;
}

function fallbackFindSimilarCases(
  currentCase: {
    description: string;
    location: string;
    victimProfile: string;
    modusOperandi: string;
    suspects: string[];
  },
  allCases: {
    id: string;
    title: string;
    description: string;
    location: string;
    victimProfile: string;
    modusOperandi: string;
    suspects: string[];
  }[],
): CaseSimilarity[] {
  const baseTokens = tokeniseForSimilarity(
    `${currentCase.description} ${currentCase.location} ${currentCase.victimProfile} ${currentCase.modusOperandi}`,
  );

  const results: CaseSimilarity[] = [];

  allCases.forEach(otherCase => {
    const tokens = tokeniseForSimilarity(
      `${otherCase.description} ${otherCase.location} ${otherCase.victimProfile} ${otherCase.modusOperandi}`,
    );
    const similarityScore = jaccardSimilarity(baseTokens, tokens);
    if (similarityScore < 0.12) {
      return;
    }

    const matchingPatterns: CaseSimilarity['matchingPatterns'] = [];
    const suspectOverlap = otherCase.suspects.filter(suspect => currentCase.suspects.includes(suspect));

    if (currentCase.location && otherCase.location && normaliseText(currentCase.location) === normaliseText(otherCase.location)) {
      matchingPatterns.push({
        category: 'location_pattern',
        details: `Both cases centre on ${currentCase.location}. Review patrol patterns and shared geography.`,
      });
    }

    const victimOverlap = jaccardSimilarity(
      tokeniseForSimilarity(currentCase.victimProfile || ''),
      tokeniseForSimilarity(otherCase.victimProfile || ''),
    );
    if (victimOverlap > 0.25) {
      matchingPatterns.push({
        category: 'victim_selection',
        details: 'Victim demographics and lifestyles share notable similarities.',
      });
    }

    const moOverlap = jaccardSimilarity(
      tokeniseForSimilarity(currentCase.modusOperandi || ''),
      tokeniseForSimilarity(otherCase.modusOperandi || ''),
    );
    if (moOverlap > 0.2) {
      matchingPatterns.push({
        category: 'modus_operandi',
        details: 'Reported modus operandi terms overlap. Compare tool marks and entry methods.',
      });
    }

    if (similarityScore > 0.22 && !matchingPatterns.some(pattern => pattern.category === 'timing')) {
      matchingPatterns.push({
        category: 'timing',
        details: 'Incident timelines show comparable pacing. Check seasonal or weekly clustering.',
      });
    }

    const recommendation = suspectOverlap.length
      ? 'Cross-reference suspect interview transcripts and travel histories between cases.'
      : 'Review investigative files for cross-case witnesses, digital traces, or shared evidence handling. ' +
        'Consider regional task force intel for potential serial patterns.';

    results.push({
      caseId: otherCase.id,
      caseTitle: otherCase.title,
      similarityScore: clamp(similarityScore + suspectOverlap.length * 0.05, 0, 1),
      matchingPatterns,
      suspectOverlap,
      recommendation,
    });
  });

  return results.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);
}

export async function findSimilarCases(
  currentCase: {
    description: string;
    location: string;
    victimProfile: string;
    modusOperandi: string;
    suspects: string[];
  },
  allCases: {
    id: string;
    title: string;
    description: string;
    location: string;
    victimProfile: string;
    modusOperandi: string;
    suspects: string[];
  }[]
): Promise<CaseSimilarity[]> {

  if (!isAnthropicConfigured()) {
    console.warn('[ColdCaseAnalyzer] Anthropic key missing for cross-case comparison. Using heuristic fallback.');
    return fallbackFindSimilarCases(currentCase, allCases);
  }

  const prompt = `You are an expert in linking serial crimes and identifying patterns across cases.

CURRENT CASE:
${JSON.stringify(currentCase, null, 2)}

ALL OTHER CASES:
${JSON.stringify(allCases, null, 2)}

Analyze for similarities that might indicate:
1. Same offender (serial criminal)
2. Copycat crimes
3. Connected criminal network
4. Similar witnesses/suspects appearing in multiple cases

PATTERNS TO CHECK:
- **Modus Operandi**: How crime was committed (tools, methods, entry points)
- **Victim Selection**: Age, gender, profession, lifestyle similarities
- **Location Pattern**: Geographic clustering, similar venue types
- **Timing**: Day of week, time of day, seasonal patterns
- **Signature**: Unique personal touches, unnecessary actions
- **Suspect Overlap**: Same people appear in multiple cases
- **Witness Overlap**: Same witnesses in different cases (suspicious)

Calculate similarity scores and return matches.

Return JSON matching CaseSimilarity[] interface.`;

  const anthropic = getAnthropicClient();

  try {
    const message = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    return safeJsonExtract(content.text, /\[[\s\S]*\]/);
  } catch (error) {
    console.error('[ColdCaseAnalyzer] Similar case analysis failed. Falling back to heuristics.', error);
    return fallbackFindSimilarCases(currentCase, allCases);
  }
}

// ============================================================================
// 5. OVERLOOKED DETAILS EXTRACTOR
// ============================================================================

export interface OverlookedDetail {
  detail: string;
  sourceDocument: string;
  pageNumber?: number;
  whyOverlooked: string;
  significance: string;
  potentialBreakthrough: number; // 0-1
  actionableSteps: string[];
  category: 'witness_detail' | 'physical_evidence' | 'timeline_clue' | 'relationship_hint' | 'location_detail' | 'technology_trace';
}

const OVERLOOKED_KEYWORDS: Array<{
  regex: RegExp;
  category: OverlookedDetail['category'];
  significance: string;
  reason: string;
  action: (context: string) => string[];
}> = [
  {
    regex: /(\b\d{1,2}:\d{2}\b|\b(?:am|pm)\b)/i,
    category: 'timeline_clue',
    significance: 'Precise timing detail may tighten the activity window.',
    reason: 'Time references were embedded inside narrative paragraphs.',
    action: context => [`Plot ${context.slice(0, 60)} on master timeline and verify against phone/location records.`],
  },
  {
    regex: /(key|badge|card|locker|storage|unit\s+4B)/i,
    category: 'physical_evidence',
    significance: 'Physical access details can reveal opportunity or staging.',
    reason: 'Item references were embedded in maintenance or logistics notes.',
    action: context => [`Inventory and fingerprint the item mentioned in "${context.slice(0, 60)}".`],
  },
  {
    regex: /(call|text|message|voicemail|phone)/i,
    category: 'technology_trace',
    significance: 'Digital communications corroborate mood and movement.',
    reason: 'Communication details appear in narrative form without follow-up tasks.',
    action: context => [`Subpoena device records to confirm the communication described: "${context.slice(0, 60)}".`],
  },
  {
    regex: /(unknown male|green jacket|muddy|arguing|upset)/i,
    category: 'witness_detail',
    significance: 'Witness description highlights individuals requiring identification.',
    reason: 'Description buried within lengthy witness statements.',
    action: context => [`Create BOLO referencing: "${context.slice(0, 60)}" and canvas for corroborating witnesses.`],
  },
  {
    regex: /(overlook|river|loading dock|path|garage)/i,
    category: 'location_detail',
    significance: 'Location references guide targeted canvassing and evidence searches.',
    reason: 'Location was mentioned casually without task assignment.',
    action: context => [`Revisit ${context.slice(0, 40)} area for cameras, lighting, and overlooked physical traces.`],
  },
];

function fallbackFindOverlookedDetails(
  documents: { filename: string; content: string; pageCount?: number }[],
): OverlookedDetail[] {
  const findings: OverlookedDetail[] = [];

  documents.forEach(doc => {
    const sentences = splitSentences(doc.content);
    sentences.forEach((sentence, index) => {
      OVERLOOKED_KEYWORDS.forEach(rule => {
        if (rule.regex.test(sentence)) {
          findings.push({
            detail: sentence.trim(),
            sourceDocument: doc.filename,
            pageNumber: doc.pageCount ? Math.min(doc.pageCount, Math.max(1, Math.round(index / 3))) : undefined,
            whyOverlooked: rule.reason,
            significance: rule.significance,
            potentialBreakthrough: clamp(0.5 + index * 0.02, 0.9, 0.95),
            actionableSteps: rule.action(sentence),
            category: rule.category,
          });
        }
      });
    });
  });

  if (!findings.length && documents.length) {
    findings.push({
      detail: 'Document review completed with no standout anomalies. Flagging final incident timeline for manual analyst review.',
      sourceDocument: documents[0].filename,
      whyOverlooked: 'Documents use uniform formatting making anomalies subtle.',
      significance: 'Ensures human review still evaluates consolidated AI summary.',
      potentialBreakthrough: 0.4,
      actionableSteps: ['Schedule analyst spot-check of AI-generated notes against originals.'],
      category: 'timeline_clue',
    });
  }

  return findings.slice(0, 8);
}

export async function findOverlookedDetails(
  documents: { filename: string; content: string; pageCount?: number }[]
): Promise<OverlookedDetail[]> {

  if (!documents.length) {
    return [];
  }

  if (!isAnthropicConfigured()) {
    console.warn('[ColdCaseAnalyzer] Anthropic key missing for overlooked details analysis. Using heuristic fallback.');
    return fallbackFindOverlookedDetails(documents);
  }

  const prompt = `You are a master detective famous for catching tiny details others miss. Read these documents and find:

WHAT TO LOOK FOR:
1. **Seemingly Insignificant Details** that are actually important:
   - Casual mentions of locations
   - Offhand comments about seeing someone
   - "I think I saw..." statements that were dismissed
   - Weather/time details that create alibis or destroy them
   - Small inconsistencies in descriptions

2. **Buried Information**:
   - Names mentioned once in passing
   - Phone numbers or addresses in margins
   - Dates that don't line up
   - Vehicle descriptions
   - Clothing details

3. **Modern Investigative Opportunities** (that weren't available when case was cold):
   - DNA that wasn't tested (technology has improved)
   - Social media that didn't exist then
   - Security cameras now present at old locations
   - Genealogy databases for DNA matching
   - Digital forensics for old computers/phones

4. **Pattern Breaks**:
   - One statement that doesn't fit the pattern
   - Someone who changed their story slightly
   - A detail everyone agrees on EXCEPT one person

5. **Technology Traces**:
   - Cell phone towers (even old records)
   - ATM transactions
   - Gas station receipts
   - Toll booth records
   - Credit card timestamps

DOCUMENTS:
${documents.map((d, i) => `=== DOCUMENT ${i + 1}: ${d.filename} ===\n${d.content}`).join('\n\n')}

For each overlooked detail, explain:
- What it is
- Why it was probably missed (buried in lots of text, seemed unimportant, etc.)
- Why it actually matters
- What to do with it now

Return JSON matching OverlookedDetail[] interface.`;

  const anthropic = getAnthropicClient();

  try {
    const message = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    return safeJsonExtract(content.text, /\[[\s\S]*\]/);
  } catch (error) {
    console.error('[ColdCaseAnalyzer] Overlooked details analysis failed. Falling back to heuristics.', error);
    return fallbackFindOverlookedDetails(documents);
  }
}

// ============================================================================
// 6. INTERROGATION QUESTION GENERATOR
// ============================================================================

export interface InterrogationStrategy {
  suspectName: string;
  knownLies: string[];
  inconsistencies: string[];
  weakPoints: string[];
  questions: {
    question: string;
    purpose: string;
    expectedTruthfulResponse: string;
    expectedDeceptiveResponse: string;
    followUpIfDeceptive: string[];
    psychologicalTechnique: string;
  }[];
  overallStrategy: string;
  timing: string;
}

function fallbackGenerateInterrogationQuestions(
  suspect: {
    name: string;
    statements: string[];
    knownFacts: string[];
    inconsistencies: string[];
    relationships: string[];
  },
): InterrogationStrategy {
  const focusInconsistencies = suspect.inconsistencies.length
    ? suspect.inconsistencies
    : ['Timeline gaps between museum departure and overlook arrival'];

  const normalizedInconsistencies = focusInconsistencies.map(item => {
    if (typeof item === 'string') return item;
    if (item === null || item === undefined) return '';
    try {
      return String(item);
    } catch {
      return '';
    }
  }).map(item => item.trim()).filter(item => item.length > 0);

  const weakPoints = [...new Set([
    ...normalizedInconsistencies.map(item => {
      const safeItem = item || '';
      return safeItem.includes(':') ? safeItem.split(':')[0] || safeItem : safeItem;
    }),
    ...suspect.relationships.slice(0, 2),
  ])].filter(Boolean);

  const buildQuestion = (topic: string, index: number) => {
    const lower = normaliseText(topic);
    const technique = index === 0 ? 'Cognitive Interview' : index === 1 ? 'Strategic Use of Evidence' : 'Reid Technique';
    const promptSubject = lower.includes('time') ? 'exact time stamps' : 'sequence of movements';
    return {
      question: `Walk me through ${topic} step-by-step without skipping anything.`,
      purpose: `Force a granular explanation of ${topic} to expose rehearsed or improvised answers.`,
      expectedTruthfulResponse: 'Provides chronological, sensory-rich description that aligns with collateral evidence.',
      expectedDeceptiveResponse: 'Offers vague markers, hedges with "around" or deflects toward other people.',
      followUpIfDeceptive: [
        `We recovered ${promptSubject}. Explain how it supports your version.`,
        'Who can verify the detail you are unsure about?',
      ],
      psychologicalTechnique: technique,
    };
  };

  const questions = normalizedInconsistencies.slice(0, 4).map((topic, index) => buildQuestion(topic, index));

  questions.push({
    question: 'Why did multiple witnesses describe your mood differently than you reported? What changed after leaving the museum?',
    purpose: 'Contrast subject narrative with external observations to trigger cognitive dissonance.',
    expectedTruthfulResponse: 'Acknowledges stressors, cites specific cause, aligns with timeline.',
    expectedDeceptiveResponse: 'Dismisses witnesses, uses absolute denials, or attacks credibility.',
    followUpIfDeceptive: [
      'If they are mistaken, provide names of people who can corroborate your calm demeanor.',
      'Explain the reason they would invent that behaviour.',
    ],
    psychologicalTechnique: 'Good Cop / Bad Cop setup',
  });

  const knownLies = normalizedInconsistencies.filter(item => /lie|false|contradiction/i.test(item));

  return {
    suspectName: suspect.name,
    knownLies,
    inconsistencies: normalizedInconsistencies,
    weakPoints,
    questions,
    overallStrategy:
      'Start rapport-building, then use chronological reconstruction to surface contradictions before confronting with corroborated evidence.',
    timing: 'Begin with timeline reconstruction, escalate to contradictions after 20 minutes of open narrative.',
  };
}

export async function generateInterrogationQuestions(
  suspect: {
    name: string;
    statements: string[];
    knownFacts: string[];
    inconsistencies: string[];
    relationships: string[];
  }
): Promise<InterrogationStrategy> {

  if (!isAnthropicConfigured()) {
    console.warn('[ColdCaseAnalyzer] Anthropic key missing for interrogation planning. Using heuristic fallback.');
    return fallbackGenerateInterrogationQuestions(suspect);
  }

  const prompt = `You are an expert interrogator. Design a strategic interrogation plan for this suspect.

SUSPECT: ${suspect.name}

THEIR STATEMENTS:
${suspect.statements.join('\n')}

KNOWN FACTS:
${suspect.knownFacts.join('\n')}

INCONSISTENCIES DETECTED:
${suspect.inconsistencies.join('\n')}

RELATIONSHIPS:
${suspect.relationships.join('\n')}

Design questions that:
1. **Start broad, narrow down**: Begin with easy questions, build to confrontation
2. **Expose lies gradually**: Don't reveal what you know immediately
3. **Use evidence strategically**: Hold back some evidence to catch new lies
4. **Exploit weak points**: Target their most vulnerable stories
5. **Create cognitive load**: Ask about details they can't have prepared
6. **Use time as a weapon**: Ask about specific timeframes they're vague on
7. **Compare to others**: "X said Y, but you said Z..."
8. **Assume guilt**: "We know you were there, the question is why"

INTERROGATION TECHNIQUES TO USE:
- Reid Technique (confrontation, theme development)
- Cognitive Interview (mental recreation)
- Strategic Use of Evidence (SUE)
- Good Cop / Bad Cop setups
- Maximization/Minimization

For each question provide:
- The question itself
- Why you're asking it
- What a truthful person would say
- What a deceptive person would say
- Follow-up questions if they lie

Return JSON matching InterrogationStrategy interface.`;

  const anthropic = getAnthropicClient();

  try {
    const message = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    return safeJsonExtract(content.text, /\{[\s\S]*\}/);
  } catch (error) {
    console.error('[ColdCaseAnalyzer] Interrogation strategy generation failed. Falling back to heuristics.', error);
    return fallbackGenerateInterrogationQuestions(suspect);
  }
}

// ============================================================================
// 7. DNA/FORENSIC RE-EXAMINATION RECOMMENDER
// ============================================================================

export interface ForensicReExamination {
  evidenceItem: string;
  originalTesting: string;
  newTechnologiesAvailable: string[];
  whyRetest: string;
  potentialFindings: string[];
  costEstimate: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  exampleSuccessStories: string;
}

const FORENSIC_TECH_SUGGESTIONS: Array<{
  keyword: RegExp;
  technologies: string[];
  rationale: string;
}> = [
  {
    keyword: /dna|swab|biological/i,
    technologies: ['Touch DNA recovery', 'Genealogy database upload', 'Next-generation sequencing'],
    rationale: 'Advances in low-template DNA extraction and genealogical matching can resolve historic samples.',
  },
  {
    keyword: /fiber|fabric|clothing|bag/i,
    technologies: ['M-Vac wet-vacuum DNA collection', 'Micro trace analysis'],
    rationale: 'Modern collection systems recover DNA from porous fabrics previously deemed exhausted.',
  },
  {
    keyword: /phone|device|digital/i,
    technologies: ['Cloud backup extraction', 'Location metadata reconstruction'],
    rationale: 'Device forensics can resurrect historical app data and precise travel paths.',
  },
  {
    keyword: /soil|mud|footprint|shoe/i,
    technologies: ['3D footwear comparison', 'Isotope soil analysis'],
    rationale: 'Environmental traces can link suspects to specific terrain and timelines.',
  },
];

function fallbackRecommendForensicRetesting(
  evidenceInventory: {
    item: string;
    dateCollected: string;
    testingPerformed: string;
    results: string;
  }[],
): ForensicReExamination[] {
  return evidenceInventory.map((evidence, index) => {
    const suggestion = FORENSIC_TECH_SUGGESTIONS.find(entry => entry.keyword.test(evidence.item) || entry.keyword.test(evidence.testingPerformed));
    const technologies = suggestion?.technologies || ['Comprehensive re-cataloguing', 'Latent print reprocessing'];
    const whyRetest = suggestion?.rationale || 'Re-examining legacy evidence with updated lab standards often surfaces overlooked trace material.';

    return {
      evidenceItem: evidence.item,
      originalTesting: evidence.testingPerformed || 'Not documented',
      newTechnologiesAvailable: technologies,
      whyRetest,
      potentialFindings: [
        'Identify trace DNA for genealogy comparison.',
        'Corroborate or refute suspect handling timelines.',
        'Expose secondary contributors previously masked by noise.',
      ],
      costEstimate: index === 0 ? '$1,500 - $2,500' : '$800 - $1,200',
      priority: technologies.includes('Touch DNA recovery') ? 'critical' : 'high',
      exampleSuccessStories:
        'Similar re-testing unlocked 20-year-old cold cases such as the Golden State Killer and Arkansas River cases.',
    };
  });
}

export async function recommendForensicRetesting(
  evidenceInventory: {
    item: string;
    dateCollected: string;
    testingPerformed: string;
    results: string;
  }[]
): Promise<ForensicReExamination[]> {

  if (!evidenceInventory.length) {
    return [];
  }

  if (!isAnthropicConfigured()) {
    console.warn('[ColdCaseAnalyzer] Anthropic key missing for forensic retesting recommendations. Using heuristic fallback.');
    return fallbackRecommendForensicRetesting(evidenceInventory);
  }

  const prompt = `You are a forensic science expert specializing in cold case reviews.

EVIDENCE INVENTORY:
${JSON.stringify(evidenceInventory, null, 2)}

Modern forensic technologies that didn't exist or were less advanced:
- **Touch DNA**: Can get profiles from minimal contact
- **M-Vac System**: Recovers DNA from fabrics thought to be "processed"
- **Genealogy Databases**: CODIS, GEDmatch, FamilyTreeDNA for familial matching
- **Rapid DNA**: Faster processing, better degraded samples
- **Next-Gen Sequencing**: Can process highly degraded DNA
- **Isotope Analysis**: Determine geographic origin
- **Digital Microscopy**: Enhanced trace evidence analysis
- **Proteomics**: Identifying proteins when DNA is too degraded
- **Advanced Toxicology**: Detect substances not testable before

For each piece of evidence, recommend:
1. What new testing should be done
2. What it might reveal
3. Real success stories from cold cases
4. Estimated cost and time
5. Priority level

Return JSON matching ForensicReExamination[] interface.`;

  const anthropic = getAnthropicClient();

  try {
    const message = await anthropic.messages.create({
      model: DEFAULT_ANTHROPIC_MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== 'text') throw new Error('Unexpected response type');

    return safeJsonExtract(content.text, /\[[\s\S]*\]/);
  } catch (error) {
    console.error('[ColdCaseAnalyzer] Forensic retesting recommendation failed. Falling back to heuristics.', error);
    return fallbackRecommendForensicRetesting(evidenceInventory);
  }
}

// ============================================================================
// 8. MASTER ANALYSIS - COMBINES EVERYTHING
// ============================================================================

export interface ComprehensiveColdCaseAnalysis {
  caseId: string;
  analyzedAt: Date;

  // All analysis results
  behavioralPatterns: BehaviorPattern[];
  evidenceGaps: EvidenceGap[];
  relationshipNetwork: { nodes: RelationshipNode[]; hiddenConnections: HiddenConnection[] };
  similarCases: CaseSimilarity[];
  overlookedDetails: OverlookedDetail[];
  interrogationStrategies: InterrogationStrategy[];
  forensicRetesting: ForensicReExamination[];

  // Executive summary
  topPriorities: {
    action: string;
    impact: 'breakthrough' | 'high' | 'medium' | 'low';
    effort: 'easy' | 'moderate' | 'difficult';
    reason: string;
  }[];

  likelyBreakthroughs: string[];
  investigationRoadmap: {
    phase: string;
    actions: string[];
    timeline: string;
  }[];
}

export async function performComprehensiveAnalysis(
  caseId: string,
  caseData: any
): Promise<ComprehensiveColdCaseAnalysis> {

  console.log(`Starting comprehensive analysis for case ${caseId}...`);

  // Run all analyses in parallel for speed
  const [
    behavioralPatterns,
    evidenceGaps,
    relationshipNetwork,
    overlookedDetails,
  ] = await Promise.all([
    analyzeBehavioralPatterns(caseData.interviews || []),
    identifyEvidenceGaps(caseData),
    mapRelationshipNetwork(caseData.documents || []),
    findOverlookedDetails(caseData.documents || []),
  ]);

  // Generate interrogation strategies for top suspects
  const topSuspects = behavioralPatterns
    .filter(bp => bp.patterns.some(p => p.suspicionLevel > 0.6))
    .slice(0, 3);

  const interrogationStrategies = await Promise.all(
    topSuspects.map(suspect =>
      generateInterrogationQuestions({
        name: suspect.personName,
        statements: [], // Would be filled from actual data
        knownFacts: [],
        inconsistencies: suspect.patterns.map(p => p.description),
        relationships: [],
      })
    )
  );

  // Recommend forensic retesting
  const forensicRetesting = await recommendForensicRetesting(
    caseData.evidence || []
  );

  // Generate prioritized action plan
  const topPriorities = [
    ...evidenceGaps.filter(g => g.priority === 'critical').map(g => ({
      action: g.howToFill,
      impact: 'breakthrough' as const,
      effort: g.estimatedEffort as any,
      reason: g.whyItMatters,
    })),
    ...overlookedDetails
      .filter(d => d.potentialBreakthrough > 0.7)
      .slice(0, 5)
      .map(d => ({
        action: d.actionableSteps[0],
        impact: 'high' as const,
        effort: 'moderate' as const,
        reason: d.significance,
      })),
  ].slice(0, 10);

  return {
    caseId,
    analyzedAt: new Date(),
    behavioralPatterns,
    evidenceGaps,
    relationshipNetwork,
    similarCases: [], // Would be filled from database query
    overlookedDetails,
    interrogationStrategies,
    forensicRetesting,
    topPriorities,
    likelyBreakthroughs: [
      ...overlookedDetails.filter(d => d.potentialBreakthrough > 0.8).map(d => d.detail),
      ...evidenceGaps.filter(g => g.potentialBreakthroughValue > 0.8).map(g => g.gapDescription),
    ],
    investigationRoadmap: [
      {
        phase: 'Immediate Actions (Week 1)',
        actions: topPriorities.filter(p => p.effort === 'easy').map(p => p.action),
        timeline: '1 week',
      },
      {
        phase: 'Evidence Collection (Weeks 2-4)',
        actions: evidenceGaps.filter(g => g.priority === 'high').map(g => g.howToFill),
        timeline: '2-4 weeks',
      },
      {
        phase: 'Re-interviews (Month 2)',
        actions: interrogationStrategies.map(s => `Interview ${s.suspectName} using strategic questioning`),
        timeline: '4-8 weeks',
      },
      {
        phase: 'Forensic Re-testing (Months 2-3)',
        actions: forensicRetesting.filter(f => f.priority !== 'low').map(f => `Retest ${f.evidenceItem} using ${f.newTechnologiesAvailable.join(', ')}`),
        timeline: '8-12 weeks',
      },
    ],
  };
}
