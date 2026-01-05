# Comprehensive Cold Case Analysis Architecture

## The Goal: Never Forget, Always Find

For cases like JonBenét Ramsey (40,000+ pages), Madeleine McCann, or any massive cold case, the system must:

1. **Extract every fact** from every document
2. **Track every claim** made by every person
3. **Detect every contradiction** automatically
4. **Build suspect profiles** from accumulated evidence
5. **Never lose context** regardless of document volume

---

## Phase 1: Knowledge Graph Foundation (CRITICAL)

### 1.1 Structured Fact Extraction

Every document must be decomposed into atomic facts:

```typescript
interface AtomicFact {
  id: string;
  caseId: string;
  documentId: string;
  pageNumber: number;

  // The fact itself
  factType: 'location_claim' | 'timeline_claim' | 'relationship' | 'observation' |
            'physical_evidence' | 'alibi' | 'accusation' | 'denial' | 'admission' |
            'behavioral_observation' | 'forensic_finding' | 'witness_statement';

  // Who/What/When/Where
  subject: string;           // Who made the claim or who is it about
  predicate: string;         // What happened/was said
  object?: string;           // Target of the action
  location?: string;         // Where
  timestamp?: {              // When (with uncertainty)
    earliest: Date;
    latest: Date;
    certainty: 'exact' | 'approximate' | 'estimated' | 'unknown';
  };

  // Source tracking
  source: {
    speaker: string;         // Who said this
    documentType: 'interview' | 'police_report' | 'forensic_report' | 'witness_statement' | 'tip' | 'media';
    recordedBy: string;      // Officer/interviewer
    dateRecorded: Date;
  };

  // Cross-referencing
  mentionedPersons: string[];
  mentionedLocations: string[];
  mentionedEvidence: string[];

  // Verification
  corroboratedBy: string[];  // Fact IDs that support this
  contradictedBy: string[];  // Fact IDs that conflict
  verificationStatus: 'unverified' | 'partially_verified' | 'verified' | 'contradicted';
}
```

### 1.2 Person-Centric Claim Tracking

For each person of interest, track EVERYTHING they've ever said:

```typescript
interface PersonProfile {
  id: string;
  canonicalName: string;
  aliases: string[];
  role: 'victim' | 'suspect' | 'witness' | 'family' | 'investigator' | 'other';

  // All claims this person has made
  claims: {
    claimId: string;
    topic: string;
    claim: string;
    documentId: string;
    dateOfStatement: Date;
    interviewer?: string;
  }[];

  // Timeline of where they claim to have been
  alibiTimeline: {
    start: Date;
    end: Date;
    location: string;
    activity: string;
    corroboratedBy: string[];
    contradictedBy: string[];
    verificationStatus: 'unverified' | 'verified' | 'disputed' | 'impossible';
  }[];

  // Relationships
  relationships: {
    personId: string;
    relationshipType: 'family' | 'romantic' | 'friend' | 'colleague' | 'acquaintance' | 'adversary';
    nature: string;
    sourceFacts: string[];
  }[];

  // Behavioral observations across all interviews
  behavioralObservations: {
    observation: string;
    documentId: string;
    observer: string;
    significance: string;
  }[];

  // Statement evolution - how their story has changed
  statementEvolution: {
    topic: string;
    versions: {
      documentId: string;
      date: Date;
      statement: string;
    }[];
    changeAnalysis: string;
    redFlags: string[];
  }[];

  // Guilty knowledge indicators
  guiltyKnowledge: {
    detail: string;
    documentId: string;
    whySuspicious: string;
    alternativeExplanation?: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
  }[];

  // Aggregate scoring
  suspicionScore: number;     // 0-100
  suspicionFactors: {
    factor: string;
    weight: number;
    evidence: string[];
  }[];
}
```

### 1.3 Neo4j-Style Knowledge Graph

Store relationships between ALL entities:

```
(Person: John Ramsey) -[:FATHER_OF]-> (Person: JonBenét Ramsey)
(Person: John Ramsey) -[:CLAIMED_LOCATION {time: "10:00 PM", date: "1996-12-25"}]-> (Location: Home)
(Person: John Ramsey) -[:FOUND_BODY {time: "1:00 PM", date: "1996-12-26"}]-> (Evidence: Body)
(Document: Police Report #123) -[:CONTAINS_CLAIM]-> (Claim: "Basement window was broken")
(Claim: "Basement window was broken") -[:MADE_BY]-> (Person: John Ramsey)
(Claim: "Window was intact") -[:CONTRADICTS]-> (Claim: "Basement window was broken")
```

---

## Phase 2: Retrieval-Augmented Generation (RAG) Pipeline

### 2.1 Multi-Index Search

The system needs multiple retrieval mechanisms:

```typescript
interface SearchPipeline {
  // Semantic search for conceptual queries
  semanticSearch(query: string): Promise<DocumentChunk[]>;

  // Structured queries for specific facts
  factQuery(params: {
    subject?: string;
    predicate?: string;
    timeRange?: { start: Date; end: Date };
    location?: string;
  }): Promise<AtomicFact[]>;

  // Person-specific queries
  personQuery(params: {
    personName: string;
    queryType: 'all_claims' | 'alibi_timeline' | 'contradictions' | 'relationships';
  }): Promise<PersonProfile>;

  // Contradiction finder
  findContradictions(params: {
    personName?: string;
    topic?: string;
    timeRange?: { start: Date; end: Date };
  }): Promise<Contradiction[]>;

  // Graph traversal
  findConnections(params: {
    from: string;
    to: string;
    maxHops: number;
  }): Promise<RelationshipPath[]>;
}
```

### 2.2 Context Assembly for AI Analysis

When the AI needs to analyze, it assembles relevant context:

```typescript
async function assembleAnalysisContext(
  caseId: string,
  analysisType: 'suspect_ranking' | 'alibi_verification' | 'contradiction_analysis',
  focusEntity?: string
): Promise<AnalysisContext> {

  const context: AnalysisContext = {
    // Always include case summary
    caseSummary: await getCaseSummary(caseId),

    // Get relevant facts based on analysis type
    relevantFacts: await getRelevantFacts(caseId, analysisType, focusEntity),

    // Get all known contradictions
    contradictions: await getAllContradictions(caseId, focusEntity),

    // Get behavioral red flags
    behavioralFlags: await getBehavioralFlags(caseId, focusEntity),

    // Get timeline conflicts
    timelineConflicts: await getTimelineConflicts(caseId, focusEntity),

    // Get guilty knowledge indicators
    guiltyKnowledge: await getGuiltyKnowledge(caseId, focusEntity),
  };

  return context;
}
```

---

## Phase 3: Suspect Scoring Engine

### 3.1 Multi-Factor Suspicion Scoring

```typescript
interface SuspectScoringCriteria {
  // Opportunity (0-25 points)
  opportunity: {
    proximityToVictim: number;      // 0-10: How close were they to victim
    accessToLocation: number;        // 0-10: Could they access crime scene
    unverifiedAlibi: number;         // 0-5: Alibi gaps
  };

  // Means (0-25 points)
  means: {
    physicalCapability: number;      // 0-10: Could they physically commit crime
    weaponAccess: number;            // 0-10: Access to murder weapon/method
    knowledgeToExecute: number;      // 0-5: Technical knowledge needed
  };

  // Motive (0-25 points)
  motive: {
    financialBenefit: number;        // 0-10: Insurance, inheritance, etc.
    relationshipConflict: number;    // 0-10: History of conflict with victim
    eliminationOfWitness: number;    // 0-5: Did victim know something
  };

  // Behavioral Indicators (0-25 points)
  behavior: {
    statementContradictions: number; // 0-10: How many lies detected
    storyEvolution: number;          // 0-5: Has story changed significantly
    guiltyKnowledge: number;         // 0-5: Knew things only killer would know
    behavioralRedFlags: number;      // 0-5: Evasion, rehearsed answers, etc.
  };

  // Evidence Connections (Bonus/Penalty)
  evidence: {
    dnaMatch: number;                // +50 if match, 0 otherwise
    physicalEvidence: number;        // 0-20: Other physical evidence
    witnessIdentification: number;   // 0-20: Eyewitness testimony
  };
}
```

### 3.2 Automated Scoring Pipeline

```typescript
async function scoreSuspect(
  caseId: string,
  personId: string
): Promise<SuspectScore> {

  const profile = await getPersonProfile(personId);
  const facts = await getFactsAboutPerson(caseId, personId);
  const contradictions = await getPersonContradictions(caseId, personId);
  const timeline = await getPersonTimeline(caseId, personId);
  const evidence = await getEvidenceConnections(caseId, personId);

  // Score each dimension
  const opportunityScore = calculateOpportunityScore(timeline, facts);
  const meansScore = calculateMeansScore(facts, evidence);
  const motiveScore = calculateMotiveScore(facts, profile);
  const behaviorScore = calculateBehaviorScore(contradictions, profile);
  const evidenceScore = calculateEvidenceScore(evidence);

  return {
    totalScore: opportunityScore + meansScore + motiveScore + behaviorScore + evidenceScore,
    breakdown: { opportunityScore, meansScore, motiveScore, behaviorScore, evidenceScore },
    keyFactors: extractKeyFactors(profile, contradictions),
    recommendation: generateRecommendation(totalScore, keyFactors)
  };
}
```

---

## Phase 4: Comprehensive Document Ingestion

### 4.1 Document Processing Pipeline

For 40,000+ page cases:

```typescript
interface DocumentIngestionPipeline {
  // Step 1: Raw extraction
  async extractText(file: File): Promise<RawDocument>;

  // Step 2: Structural parsing (identify interviews, reports, etc.)
  async parseStructure(raw: RawDocument): Promise<StructuredDocument>;

  // Step 3: Entity extraction (people, places, dates, evidence)
  async extractEntities(doc: StructuredDocument): Promise<ExtractedEntities>;

  // Step 4: Fact extraction (atomic claims)
  async extractFacts(doc: StructuredDocument): Promise<AtomicFact[]>;

  // Step 5: Entity resolution (merge "John Ramsey" with "Mr. Ramsey")
  async resolveEntities(entities: ExtractedEntities): Promise<ResolvedEntities>;

  // Step 6: Cross-reference with existing facts
  async crossReference(facts: AtomicFact[]): Promise<CrossReferencedFacts>;

  // Step 7: Update knowledge graph
  async updateGraph(facts: CrossReferencedFacts): Promise<void>;

  // Step 8: Generate embeddings for semantic search
  async generateEmbeddings(doc: StructuredDocument): Promise<void>;

  // Step 9: Trigger contradiction detection
  async detectContradictions(facts: AtomicFact[]): Promise<Contradiction[]>;

  // Step 10: Update suspect scores
  async updateSuspectScores(affectedPersons: string[]): Promise<void>;
}
```

### 4.2 Batch Processing for Large Cases

```typescript
// Process 40,000 pages in manageable batches
async function ingestLargeCase(caseId: string, files: File[]): Promise<void> {
  const BATCH_SIZE = 50; // Process 50 documents at a time

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);

    // Process batch in parallel
    await Promise.all(batch.map(file => processDocument(caseId, file)));

    // Checkpoint progress
    await saveProgress(caseId, i + BATCH_SIZE);

    // Run cross-document analysis after each batch
    await runIncrementalAnalysis(caseId);
  }

  // Final comprehensive analysis
  await runFullAnalysis(caseId);
}
```

---

## Phase 5: The "Detective's Notebook" - Persistent Case State

### 5.1 Case Summary that Evolves

```typescript
interface CaseSummary {
  // Core facts (never changes)
  victimName: string;
  dateOfCrime: Date;
  location: string;
  causeOfDeath: string;

  // Evolving analysis
  currentTheories: {
    theory: string;
    supportingFacts: string[];
    contradictingFacts: string[];
    probability: number;
  }[];

  // Ranked suspects (updates as new info comes in)
  suspectRankings: {
    personId: string;
    name: string;
    score: number;
    keyFactors: string[];
    lastUpdated: Date;
  }[];

  // Key unresolved questions
  unresolvedQuestions: {
    question: string;
    relevantFacts: string[];
    potentialSources: string[];
  }[];

  // Evidence status
  untestedEvidence: {
    evidenceId: string;
    description: string;
    testingRecommendation: string;
    potentialImpact: 'low' | 'medium' | 'high' | 'case_breaking';
  }[];

  // Timeline gaps
  timelineGaps: {
    start: Date;
    end: Date;
    relevantPersons: string[];
    significance: string;
  }[];
}
```

### 5.2 Query Interface for Investigation

```typescript
// Natural language queries against the case knowledge base
async function queryCase(caseId: string, query: string): Promise<QueryResult> {
  // Examples:
  // "What did John Ramsey say about the basement window?"
  // "Who was at the house between 10 PM and 6 AM?"
  // "What contradictions exist in Patsy's statements?"
  // "What evidence has not been DNA tested?"
  // "Show me all mentions of the ransom note"

  // The AI uses the knowledge graph to find answers
  // It NEVER needs to read all 40,000 pages
  // It queries the structured data
}
```

---

## Phase 6: Contradiction Detection Engine

### 6.1 Automatic Contradiction Types

```typescript
type ContradictionType =
  | 'timeline_impossible'      // Person in two places at once
  | 'statement_conflict'       // Two people say opposite things
  | 'self_contradiction'       // Same person contradicts themselves
  | 'physical_impossible'      // Claim defies physics
  | 'evidence_contradiction'   // Statement contradicts physical evidence
  | 'witness_conflict'         // Multiple witnesses disagree
  | 'alibi_failure'            // Alibi proven false
  | 'story_evolution'          // Story changed over time
  | 'detail_inconsistency';    // Minor but significant detail mismatch

interface Contradiction {
  id: string;
  type: ContradictionType;
  severity: 'minor' | 'significant' | 'major' | 'critical';

  // The conflicting claims
  claim1: {
    factId: string;
    personId: string;
    statement: string;
    documentId: string;
    date: Date;
  };
  claim2: {
    factId: string;
    personId: string;
    statement: string;
    documentId: string;
    date: Date;
  };

  // Analysis
  analysis: string;
  implications: string;
  suggestedFollowUp: string;

  // Resolution status
  status: 'unresolved' | 'explained' | 'confirmed_lie' | 'error_in_record';
  resolution?: string;
}
```

### 6.2 Proactive Contradiction Detection

```typescript
// Run after every new document is ingested
async function detectNewContradictions(
  caseId: string,
  newFacts: AtomicFact[]
): Promise<Contradiction[]> {

  const contradictions: Contradiction[] = [];

  for (const fact of newFacts) {
    // Check against all existing facts
    const potentialConflicts = await findPotentialConflicts(caseId, fact);

    for (const conflict of potentialConflicts) {
      // Use AI to determine if this is a real contradiction
      const isContradiction = await analyzeContradiction(fact, conflict);

      if (isContradiction.isConflict) {
        contradictions.push({
          type: isContradiction.type,
          severity: isContradiction.severity,
          claim1: factToClaim(fact),
          claim2: factToClaim(conflict),
          analysis: isContradiction.analysis,
          implications: isContradiction.implications,
          suggestedFollowUp: isContradiction.followUp
        });
      }
    }
  }

  return contradictions;
}
```

---

## Phase 7: Guilty Knowledge Detection

### 7.1 What Only the Killer Would Know

```typescript
interface GuiltyKnowledgeIndicator {
  id: string;
  personId: string;

  // The suspicious knowledge
  knowledge: string;
  documentId: string;
  context: string;

  // Why it's suspicious
  knowledgeType:
    | 'crime_scene_detail'      // Knew detail not public
    | 'victim_state'            // Knew victim's condition
    | 'timing_knowledge'        // Knew when something happened
    | 'location_knowledge'      // Knew where something was
    | 'method_knowledge'        // Knew how crime was committed
    | 'evidence_awareness'      // Knew about evidence not disclosed
    | 'future_knowledge';       // Knew something before it was discovered

  // Analysis
  howCouldTheyKnow: string[];   // Innocent explanations
  whySuspicious: string;         // Why this raises flags

  // Verification
  wasPubliclyKnown: boolean;
  dateFirstPublic?: Date;
  dateOfStatement: Date;

  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

---

## Phase 8: Famous Case Considerations

### For JonBenét Ramsey specifically:

Key data points to track:
1. **The Ransom Note** - Every linguistic analysis, writing sample comparison
2. **911 Call** - Every enhancement attempt, disputed background sounds
3. **Timeline of December 25-26** - Every person's claimed location
4. **Grand Jury Evidence** - What convinced them to indict
5. **DNA Evidence** - Every sample, every test, every profile
6. **Intruder Theory Evidence** - Window, footprints, stun gun marks
7. **Family Theory Evidence** - Behavioral analysis, prior incidents
8. **Burke Interview** - Every statement, behavioral observations

### For Madeleine McCann:

1. **Last Sighting Timeline** - Every guest at tapas restaurant
2. **Checking Schedule** - Who checked when, discrepancies
3. **Cadaver Dog Alerts** - Every alert location, significance
4. **Cell Phone Data** - Movement patterns of all persons
5. **Statement Evolution** - How accounts changed over time
6. **Previous Incidents** - Any relevant history
7. **Suspect Timelines** - Known predators in area

---

## Technical Stack Additions Needed

### Database
- **PostgreSQL** (existing) - Core relational data
- **pgvector** (existing) - Vector embeddings
- **Apache Age** or **Supabase Graph** - Graph queries for relationships

### Processing
- **Apache Kafka** or **Redis Streams** - For large document ingestion queues
- **Inngest** (existing) - Background job processing
- **Temporal.io** - For complex long-running workflows

### AI/ML
- **Claude** (existing) - Primary analysis engine
- **OpenAI Embeddings** (existing) - Semantic search
- **Fine-tuned extraction models** - For consistent fact extraction

### Storage
- **Supabase Storage** (existing) - Raw documents
- **S3** - Long-term archival for massive cases

---

## Implementation Priority

### Phase 1 (Foundation) - 2-3 weeks
1. Atomic fact extraction from documents
2. Knowledge graph schema
3. Enhanced entity resolution

### Phase 2 (Retrieval) - 2 weeks
1. RAG pipeline integration
2. Multi-index search
3. Context assembly for analysis

### Phase 3 (Analysis) - 2-3 weeks
1. Automated contradiction detection
2. Suspect scoring engine
3. Guilty knowledge detection

### Phase 4 (Scale) - 2 weeks
1. Batch processing pipeline
2. Incremental analysis
3. Progress tracking for large cases

### Phase 5 (Polish) - 1-2 weeks
1. Detective's notebook interface
2. Natural language case queries
3. Report generation

---

## The Key Insight

**The system doesn't need to "remember" 40,000 pages.**

It needs to:
1. **Extract** every fact into structured data
2. **Index** everything for instant retrieval
3. **Track** contradictions automatically
4. **Score** suspects based on accumulated evidence
5. **Query** the knowledge base when analyzing

The AI becomes a **detective with perfect recall** - not because it holds everything in memory, but because it can instantly access any relevant fact when needed.

This is how you build a system that can genuinely help solve JonBenét Ramsey, Madeleine McCann, or any cold case with massive documentation.
