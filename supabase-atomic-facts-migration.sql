-- ============================================================================
-- Atomic Facts & Person Profiles Migration
--
-- This migration creates the core tables for comprehensive cold case analysis:
-- 1. atomic_facts - Every extracted fact from every document
-- 2. person_profiles - Aggregated profile for each person of interest
-- 3. person_claims - Every claim made by each person
-- 4. person_alibis - Timeline of where each person claims to have been
-- 5. fact_contradictions - Detected contradictions between facts
-- ============================================================================

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 1. ATOMIC FACTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS atomic_facts (
    id TEXT PRIMARY KEY,
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

    -- The fact itself
    fact_type TEXT NOT NULL CHECK (fact_type IN (
        'location_claim', 'timeline_claim', 'action_claim', 'observation',
        'relationship', 'physical_evidence', 'alibi', 'accusation', 'denial',
        'admission', 'behavioral_observation', 'forensic_finding', 'communication',
        'possession', 'knowledge_claim', 'state_of_mind', 'prior_incident',
        'physical_description', 'vehicle_sighting', 'other'
    )),
    subject TEXT NOT NULL,
    predicate TEXT NOT NULL,
    object TEXT,
    location TEXT,

    -- Time reference (JSONB for flexibility)
    time_reference JSONB,
    -- Structure: { earliest, latest, certainty, originalText, relativeAnchor }

    -- Source attribution (JSONB)
    source JSONB NOT NULL,
    -- Structure: { speakerId, speakerName, documentId, documentName, documentType, pageNumber, recordedBy, dateRecorded, originalQuote }

    -- Entities mentioned
    mentioned_persons TEXT[] DEFAULT '{}',
    mentioned_locations TEXT[] DEFAULT '{}',
    mentioned_evidence TEXT[] DEFAULT '{}',
    mentioned_vehicles TEXT[] DEFAULT '{}',

    -- Cross-referencing
    corroborating_fact_ids TEXT[] DEFAULT '{}',
    contradicting_fact_ids TEXT[] DEFAULT '{}',
    related_fact_ids TEXT[] DEFAULT '{}',

    -- Verification
    verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_status IN (
        'unverified', 'corroborated', 'partially_verified', 'contradicted', 'impossible', 'confirmed'
    )),
    confidence_score DECIMAL(3,2) DEFAULT 0.80,

    -- Suspicion indicators
    is_suspicious BOOLEAN DEFAULT FALSE,
    suspicion_reason TEXT,

    -- Embeddings for semantic search
    embedding vector(1536),

    -- Timestamps
    extracted_at TIMESTAMPTZ DEFAULT NOW(),
    last_updated TIMESTAMPTZ DEFAULT NOW(),

    -- Indexes
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast querying
CREATE INDEX IF NOT EXISTS idx_atomic_facts_case_id ON atomic_facts(case_id);
CREATE INDEX IF NOT EXISTS idx_atomic_facts_fact_type ON atomic_facts(fact_type);
CREATE INDEX IF NOT EXISTS idx_atomic_facts_subject ON atomic_facts(subject);
CREATE INDEX IF NOT EXISTS idx_atomic_facts_verification ON atomic_facts(verification_status);
CREATE INDEX IF NOT EXISTS idx_atomic_facts_suspicious ON atomic_facts(is_suspicious) WHERE is_suspicious = TRUE;
CREATE INDEX IF NOT EXISTS idx_atomic_facts_persons ON atomic_facts USING GIN(mentioned_persons);
CREATE INDEX IF NOT EXISTS idx_atomic_facts_locations ON atomic_facts USING GIN(mentioned_locations);
CREATE INDEX IF NOT EXISTS idx_atomic_facts_embedding ON atomic_facts USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- 2. PERSON PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS person_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

    -- Identity
    canonical_name TEXT NOT NULL,
    aliases TEXT[] DEFAULT '{}',

    -- Role in case
    role TEXT NOT NULL DEFAULT 'unknown' CHECK (role IN (
        'victim', 'suspect', 'witness', 'person_of_interest', 'family',
        'associate', 'investigator', 'expert', 'other', 'unknown'
    )),

    -- Demographics (if known)
    age_at_time INTEGER,
    gender TEXT,
    occupation TEXT,
    address TEXT,

    -- Relationship to victim
    relationship_to_victim TEXT,
    relationship_strength TEXT CHECK (relationship_strength IN ('close', 'acquaintance', 'distant', 'unknown')),

    -- Suspicion scoring
    suspicion_score INTEGER DEFAULT 0 CHECK (suspicion_score >= 0 AND suspicion_score <= 100),
    suspicion_factors JSONB DEFAULT '[]',
    -- Structure: [{ factor, weight, evidence[] }]

    -- Scoring breakdown
    opportunity_score INTEGER DEFAULT 0 CHECK (opportunity_score >= 0 AND opportunity_score <= 25),
    means_score INTEGER DEFAULT 0 CHECK (means_score >= 0 AND means_score <= 25),
    motive_score INTEGER DEFAULT 0 CHECK (motive_score >= 0 AND motive_score <= 25),
    behavior_score INTEGER DEFAULT 0 CHECK (behavior_score >= 0 AND behavior_score <= 25),
    evidence_score INTEGER DEFAULT 0,

    -- Aggregated statistics
    total_claims INTEGER DEFAULT 0,
    total_contradictions INTEGER DEFAULT 0,
    total_behavioral_flags INTEGER DEFAULT 0,
    guilty_knowledge_indicators INTEGER DEFAULT 0,

    -- Interview history
    interview_count INTEGER DEFAULT 0,
    first_interview_date TIMESTAMPTZ,
    last_interview_date TIMESTAMPTZ,

    -- Alibi status
    alibi_status TEXT DEFAULT 'unknown' CHECK (alibi_status IN (
        'verified', 'partially_verified', 'unverified', 'disputed', 'impossible', 'unknown'
    )),
    alibi_summary TEXT,

    -- DNA status
    dna_submitted BOOLEAN DEFAULT FALSE,
    dna_matched BOOLEAN,
    dna_excluded BOOLEAN,

    -- Notes
    investigator_notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(case_id, canonical_name)
);

CREATE INDEX IF NOT EXISTS idx_person_profiles_case ON person_profiles(case_id);
CREATE INDEX IF NOT EXISTS idx_person_profiles_role ON person_profiles(role);
CREATE INDEX IF NOT EXISTS idx_person_profiles_suspicion ON person_profiles(suspicion_score DESC);
CREATE INDEX IF NOT EXISTS idx_person_profiles_aliases ON person_profiles USING GIN(aliases);

-- ============================================================================
-- 3. PERSON CLAIMS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS person_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    person_profile_id UUID NOT NULL REFERENCES person_profiles(id) ON DELETE CASCADE,
    atomic_fact_id TEXT REFERENCES atomic_facts(id) ON DELETE SET NULL,

    -- The claim
    topic TEXT NOT NULL,
    claim_text TEXT NOT NULL,
    claim_type TEXT CHECK (claim_type IN (
        'location', 'action', 'observation', 'relationship', 'alibi',
        'accusation', 'denial', 'admission', 'knowledge', 'other'
    )),

    -- Source
    document_id TEXT,
    document_name TEXT,
    page_number INTEGER,
    interview_date TIMESTAMPTZ,
    interviewer TEXT,

    -- Verification
    verification_status TEXT DEFAULT 'unverified',
    contradicted_by UUID[], -- References to contradicting claims
    corroborated_by UUID[], -- References to corroborating claims

    -- Flags
    is_suspicious BOOLEAN DEFAULT FALSE,
    suspicion_reason TEXT,
    has_evolved BOOLEAN DEFAULT FALSE, -- Changed from earlier version
    evolution_notes TEXT,

    -- Original quote
    original_quote TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_claims_person ON person_claims(person_profile_id);
CREATE INDEX IF NOT EXISTS idx_person_claims_topic ON person_claims(topic);
CREATE INDEX IF NOT EXISTS idx_person_claims_type ON person_claims(claim_type);
CREATE INDEX IF NOT EXISTS idx_person_claims_suspicious ON person_claims(is_suspicious) WHERE is_suspicious = TRUE;

-- ============================================================================
-- 4. PERSON ALIBIS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS person_alibis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    person_profile_id UUID NOT NULL REFERENCES person_profiles(id) ON DELETE CASCADE,

    -- Time period
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    time_certainty TEXT DEFAULT 'approximate',

    -- Location claimed
    location TEXT NOT NULL,
    location_type TEXT, -- home, work, public, private

    -- Activity claimed
    activity TEXT,

    -- Corroboration
    witnesses TEXT[] DEFAULT '{}',
    corroborating_evidence TEXT,

    -- Verification
    verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN (
        'verified', 'partially_verified', 'unverified', 'disputed', 'impossible'
    )),
    verification_notes TEXT,

    -- Source
    source_document_id TEXT,
    source_fact_id TEXT REFERENCES atomic_facts(id),

    -- Conflicts
    conflicting_alibi_ids UUID[] DEFAULT '{}',
    conflict_description TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_alibis_person ON person_alibis(person_profile_id);
CREATE INDEX IF NOT EXISTS idx_person_alibis_time ON person_alibis(start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_person_alibis_verification ON person_alibis(verification_status);

-- ============================================================================
-- 5. FACT CONTRADICTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS fact_contradictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

    -- The conflicting facts
    fact1_id TEXT NOT NULL REFERENCES atomic_facts(id) ON DELETE CASCADE,
    fact2_id TEXT NOT NULL REFERENCES atomic_facts(id) ON DELETE CASCADE,

    -- Contradiction type
    contradiction_type TEXT NOT NULL CHECK (contradiction_type IN (
        'timeline_impossible',    -- Person in two places at once
        'statement_conflict',     -- Two people say opposite things
        'self_contradiction',     -- Same person contradicts themselves
        'physical_impossible',    -- Claim defies physics
        'evidence_contradiction', -- Statement contradicts physical evidence
        'witness_conflict',       -- Multiple witnesses disagree
        'alibi_failure',          -- Alibi proven false
        'story_evolution',        -- Story changed over time
        'detail_inconsistency'    -- Minor but significant detail mismatch
    )),

    -- Severity
    severity TEXT NOT NULL DEFAULT 'significant' CHECK (severity IN (
        'minor', 'significant', 'major', 'critical'
    )),

    -- Analysis
    description TEXT NOT NULL,
    analysis TEXT,
    implications TEXT,
    suggested_followup TEXT,

    -- Persons involved
    involved_persons TEXT[] DEFAULT '{}',

    -- Resolution
    resolution_status TEXT DEFAULT 'unresolved' CHECK (resolution_status IN (
        'unresolved', 'explained', 'confirmed_lie', 'error_in_record', 'dismissed'
    )),
    resolution_notes TEXT,
    resolved_by TEXT,
    resolved_at TIMESTAMPTZ,

    -- Detection metadata
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    detection_method TEXT, -- 'automatic' or 'manual'
    confidence_score DECIMAL(3,2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contradictions_case ON fact_contradictions(case_id);
CREATE INDEX IF NOT EXISTS idx_contradictions_type ON fact_contradictions(contradiction_type);
CREATE INDEX IF NOT EXISTS idx_contradictions_severity ON fact_contradictions(severity);
CREATE INDEX IF NOT EXISTS idx_contradictions_unresolved ON fact_contradictions(resolution_status) WHERE resolution_status = 'unresolved';
CREATE INDEX IF NOT EXISTS idx_contradictions_persons ON fact_contradictions USING GIN(involved_persons);

-- ============================================================================
-- 6. GUILTY KNOWLEDGE INDICATORS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS guilty_knowledge_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    person_profile_id UUID NOT NULL REFERENCES person_profiles(id) ON DELETE CASCADE,
    source_fact_id TEXT REFERENCES atomic_facts(id),

    -- The suspicious knowledge
    knowledge_description TEXT NOT NULL,
    knowledge_type TEXT NOT NULL CHECK (knowledge_type IN (
        'crime_scene_detail',     -- Knew detail not public
        'victim_state',           -- Knew victim's condition
        'timing_knowledge',       -- Knew when something happened
        'location_knowledge',     -- Knew where something was
        'method_knowledge',       -- Knew how crime was committed
        'evidence_awareness',     -- Knew about evidence not disclosed
        'future_knowledge'        -- Knew something before it was discovered
    )),

    -- Context
    statement_context TEXT,
    document_id TEXT,
    statement_date TIMESTAMPTZ,

    -- Analysis
    how_could_they_know TEXT[], -- Innocent explanations
    why_suspicious TEXT NOT NULL,

    -- Public knowledge check
    was_publicly_known BOOLEAN DEFAULT FALSE,
    date_first_public TIMESTAMPTZ,
    date_of_statement TIMESTAMPTZ,

    -- Severity
    severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN (
        'low', 'medium', 'high', 'critical'
    )),

    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verification_notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_guilty_knowledge_person ON guilty_knowledge_indicators(person_profile_id);
CREATE INDEX IF NOT EXISTS idx_guilty_knowledge_type ON guilty_knowledge_indicators(knowledge_type);
CREATE INDEX IF NOT EXISTS idx_guilty_knowledge_severity ON guilty_knowledge_indicators(severity);

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Function to search atomic facts by semantic similarity
CREATE OR REPLACE FUNCTION search_atomic_facts(
    p_case_id UUID,
    query_embedding vector(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 20
)
RETURNS TABLE (
    id TEXT,
    fact_type TEXT,
    subject TEXT,
    predicate TEXT,
    source JSONB,
    mentioned_persons TEXT[],
    verification_status TEXT,
    is_suspicious BOOLEAN,
    similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        af.id,
        af.fact_type,
        af.subject,
        af.predicate,
        af.source,
        af.mentioned_persons,
        af.verification_status,
        af.is_suspicious,
        1 - (af.embedding <=> query_embedding) AS similarity
    FROM atomic_facts af
    WHERE af.case_id = p_case_id
        AND af.embedding IS NOT NULL
        AND 1 - (af.embedding <=> query_embedding) > match_threshold
    ORDER BY af.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Function to get person profile with full statistics
CREATE OR REPLACE FUNCTION get_person_profile_full(p_person_id UUID)
RETURNS TABLE (
    profile person_profiles,
    claim_count BIGINT,
    contradiction_count BIGINT,
    alibi_count BIGINT,
    guilty_knowledge_count BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        pp.*,
        (SELECT COUNT(*) FROM person_claims pc WHERE pc.person_profile_id = p_person_id),
        (SELECT COUNT(*) FROM fact_contradictions fc WHERE p_person_id::TEXT = ANY(fc.involved_persons)),
        (SELECT COUNT(*) FROM person_alibis pa WHERE pa.person_profile_id = p_person_id),
        (SELECT COUNT(*) FROM guilty_knowledge_indicators gk WHERE gk.person_profile_id = p_person_id)
    FROM person_profiles pp
    WHERE pp.id = p_person_id;
END;
$$;

-- Function to find timeline conflicts for a person
CREATE OR REPLACE FUNCTION find_alibi_conflicts(p_person_id UUID)
RETURNS TABLE (
    alibi1_id UUID,
    alibi2_id UUID,
    overlap_start TIMESTAMPTZ,
    overlap_end TIMESTAMPTZ,
    location1 TEXT,
    location2 TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a1.id AS alibi1_id,
        a2.id AS alibi2_id,
        GREATEST(a1.start_time, a2.start_time) AS overlap_start,
        LEAST(a1.end_time, a2.end_time) AS overlap_end,
        a1.location AS location1,
        a2.location AS location2
    FROM person_alibis a1
    JOIN person_alibis a2 ON a1.person_profile_id = a2.person_profile_id
        AND a1.id < a2.id
        AND a1.start_time < a2.end_time
        AND a1.end_time > a2.start_time
        AND a1.location != a2.location
    WHERE a1.person_profile_id = p_person_id;
END;
$$;

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE atomic_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_alibis ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_contradictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guilty_knowledge_indicators ENABLE ROW LEVEL SECURITY;

-- Policies (assuming cases table has user_id and agency_id)
-- Users can see facts for cases they have access to
CREATE POLICY atomic_facts_select ON atomic_facts FOR SELECT
    USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

CREATE POLICY atomic_facts_insert ON atomic_facts FOR INSERT
    WITH CHECK (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

CREATE POLICY atomic_facts_update ON atomic_facts FOR UPDATE
    USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

CREATE POLICY person_profiles_select ON person_profiles FOR SELECT
    USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

CREATE POLICY person_profiles_all ON person_profiles FOR ALL
    USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

CREATE POLICY person_claims_all ON person_claims FOR ALL
    USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

CREATE POLICY person_alibis_all ON person_alibis FOR ALL
    USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

CREATE POLICY fact_contradictions_all ON fact_contradictions FOR ALL
    USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

CREATE POLICY guilty_knowledge_all ON guilty_knowledge_indicators FOR ALL
    USING (case_id IN (SELECT id FROM cases WHERE user_id = auth.uid()));

-- ============================================================================
-- 9. TRIGGERS
-- ============================================================================

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER person_profiles_updated_at
    BEFORE UPDATE ON person_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER atomic_facts_updated_at
    BEFORE UPDATE ON atomic_facts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at();
