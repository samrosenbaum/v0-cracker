import { DEFAULT_ANTHROPIC_MODEL, getAnthropicClient } from './anthropic-client';

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

export async function analyzeBehavioralPatterns(
  interviews: { speaker: string; content: string; date: string }[]
): Promise<BehaviorPattern[]> {

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

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse JSON response');

  return JSON.parse(jsonMatch[0]);
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

export async function identifyEvidenceGaps(caseData: {
  incidentType: string;
  date: string;
  location: string;
  availableEvidence: string[];
  suspects: string[];
  witnesses: string[];
}): Promise<EvidenceGap[]> {

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

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse JSON response');

  return JSON.parse(jsonMatch[0]);
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

export async function mapRelationshipNetwork(
  documents: string[]
): Promise<{ nodes: RelationshipNode[]; hiddenConnections: HiddenConnection[] }> {

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

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON response');

  return JSON.parse(jsonMatch[0]);
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

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse JSON response');

  return JSON.parse(jsonMatch[0]);
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

export async function findOverlookedDetails(
  documents: { filename: string; content: string; pageCount?: number }[]
): Promise<OverlookedDetail[]> {

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

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse JSON response');

  return JSON.parse(jsonMatch[0]);
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

export async function generateInterrogationQuestions(
  suspect: {
    name: string;
    statements: string[];
    knownFacts: string[];
    inconsistencies: string[];
    relationships: string[];
  }
): Promise<InterrogationStrategy> {

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

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON response');

  return JSON.parse(jsonMatch[0]);
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

export async function recommendForensicRetesting(
  evidenceInventory: {
    item: string;
    dateCollected: string;
    testingPerformed: string;
    results: string;
  }[]
): Promise<ForensicReExamination[]> {

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

  const message = await anthropic.messages.create({
    model: DEFAULT_ANTHROPIC_MODEL,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  const jsonMatch = content.text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Could not parse JSON response');

  return JSON.parse(jsonMatch[0]);
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
