-- ============================================================================
-- COMPREHENSIVE COLD CASE ANALYSIS SYSTEM - DATABASE MIGRATION
-- ============================================================================
-- This migration adds:
-- 1. Batch processing with checkpointing (handle 1000s of documents)
-- 2. Entity resolution (name variations, canonical entities)
-- 3. Statement parsing and claim extraction
-- 4. Inconsistency detection and tracking
-- 5. Enhanced person timelines
-- 6. DNA evidence tracking
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- SECTION 1: BATCH PROCESSING WITH CHECKPOINTING
-- ============================================================================

-- Batch processing sessions (for handling 1000s of documents)
CREATE TABLE IF NOT EXISTS public.batch_processing_sessions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    session_name TEXT,
    status TEXT CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',

    -- Progress tracking
    total_documents INTEGER DEFAULT 0,
    processed_documents INTEGER DEFAULT 0,
    failed_documents INTEGER DEFAULT 0,
    skipped_documents INTEGER DEFAULT 0,

    -- Batch management
    current_batch_number INTEGER DEFAULT 0,
    total_batches INTEGER DEFAULT 0,
    batch_size INTEGER DEFAULT 10,
    concurrency_limit INTEGER DEFAULT 5,

    -- Performance tracking
    memory_usage_mb DECIMAL(10,2),
    estimated_completion TIMESTAMPTZ,
    avg_processing_time_ms INTEGER,

    -- Checkpoint for resume capability
    checkpoint_data JSONB DEFAULT '{}'::JSONB,
    last_checkpoint_at TIMESTAMPTZ,

    -- Error tracking
    error_log JSONB DEFAULT '[]'::JSONB,

    -- Timestamps
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual document status within batch
CREATE TABLE IF NOT EXISTS public.batch_document_status (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    batch_session_id UUID REFERENCES public.batch_processing_sessions(id) ON DELETE CASCADE,
    case_file_id UUID REFERENCES public.case_files(id) ON DELETE CASCADE,
    document_path TEXT NOT NULL,

    -- Processing status
    status TEXT CHECK (status IN ('pending', 'queued', 'processing', 'completed', 'failed', 'skipped')) DEFAULT 'pending',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,

    -- Document info
    file_size_bytes BIGINT,
    page_count INTEGER,

    -- Extraction results
    processing_time_ms INTEGER,
    extraction_method TEXT,
    extraction_confidence DECIMAL(5,2),
    entities_extracted INTEGER DEFAULT 0,
    claims_extracted INTEGER DEFAULT 0,

    -- Error handling
    error_message TEXT,
    error_stack TEXT,

    -- Checkpoint for partial extraction resume
    checkpoint_data JSONB,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_doc_status_session ON public.batch_document_status(batch_session_id);
CREATE INDEX IF NOT EXISTS idx_batch_doc_status_status ON public.batch_document_status(status);

-- ============================================================================
-- SECTION 2: ENTITY RESOLUTION SYSTEM
-- ============================================================================

-- Canonical entities (resolved/merged entities)
CREATE TABLE IF NOT EXISTS public.canonical_entities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,

    -- Entity identification
    entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'location', 'vehicle', 'phone', 'email', 'weapon', 'evidence')),
    canonical_name TEXT NOT NULL,
    display_name TEXT,
    description TEXT,

    -- Role in case
    role TEXT CHECK (role IN ('victim', 'suspect', 'witness', 'person_of_interest', 'family', 'associate', 'investigator', 'expert', 'other', 'unknown')),
    suspicion_score DECIMAL(5,2) DEFAULT 0,

    -- Verification
    confidence_score DECIMAL(5,2) DEFAULT 0.8,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_by UUID,
    verified_at TIMESTAMPTZ,

    -- Person-specific fields
    date_of_birth DATE,
    gender TEXT,
    physical_description TEXT,
    occupation TEXT,
    known_addresses TEXT[],
    known_phone_numbers TEXT[],
    known_email_addresses TEXT[],

    -- Relationship tracking
    known_associates UUID[],

    -- Statistics
    mention_count INTEGER DEFAULT 0,
    document_count INTEGER DEFAULT 0,
    statement_count INTEGER DEFAULT 0,

    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entity aliases (name variations mapping to canonical entities)
CREATE TABLE IF NOT EXISTS public.entity_aliases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    canonical_entity_id UUID REFERENCES public.canonical_entities(id) ON DELETE CASCADE NOT NULL,

    alias_value TEXT NOT NULL,
    alias_type TEXT CHECK (alias_type IN ('full_name', 'nickname', 'maiden_name', 'misspelling', 'abbreviation', 'title_variation', 'partial_name', 'phonetic_match')),

    -- Source tracking
    source_document_id UUID,

    -- Confidence
    confidence DECIMAL(5,2) DEFAULT 0.8,
    is_confirmed BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(canonical_entity_id, alias_value)
);

-- Entity mentions (where entities appear in documents)
CREATE TABLE IF NOT EXISTS public.entity_mentions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    canonical_entity_id UUID REFERENCES public.canonical_entities(id) ON DELETE CASCADE NOT NULL,
    document_id UUID NOT NULL,

    -- Mention details
    mention_text TEXT NOT NULL,
    context_before TEXT,
    context_after TEXT,
    full_sentence TEXT,

    -- Position in document
    character_offset INTEGER,
    page_number INTEGER,

    -- Classification
    mention_type TEXT CHECK (mention_type IN ('subject', 'object', 'possessive', 'reference', 'quote')),
    sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'suspicious')),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast entity lookups
CREATE INDEX IF NOT EXISTS idx_canonical_entities_case ON public.canonical_entities(case_id);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_type ON public.canonical_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_canonical_entities_role ON public.canonical_entities(role);
CREATE INDEX IF NOT EXISTS idx_entity_aliases_trgm ON public.entity_aliases USING gin(alias_value gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_canonical_name_trgm ON public.canonical_entities USING gin(canonical_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_entity ON public.entity_mentions(canonical_entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_document ON public.entity_mentions(document_id);

-- ============================================================================
-- SECTION 3: STATEMENT PARSING AND CLAIM EXTRACTION
-- ============================================================================

-- Statements/Interviews
CREATE TABLE IF NOT EXISTS public.statements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    document_id UUID,

    -- Who gave the statement
    speaker_entity_id UUID REFERENCES public.canonical_entities(id),
    speaker_name TEXT NOT NULL,
    speaker_role TEXT CHECK (speaker_role IN ('witness', 'suspect', 'victim', 'victim_family', 'investigator', 'expert', 'informant', 'other')),

    -- Statement context
    statement_type TEXT CHECK (statement_type IN ('interview', 'written_statement', 'deposition', 'testimony', 'informal', 'tip', '911_call', 'other')),
    statement_date DATE,
    statement_time TIME,
    interviewer TEXT,
    location TEXT,
    duration_minutes INTEGER,

    -- Version tracking (for multiple interviews)
    version_number INTEGER DEFAULT 1,
    previous_statement_id UUID REFERENCES public.statements(id),

    -- Content
    full_text TEXT,
    summary TEXT,

    -- Processing status
    claim_extraction_status TEXT DEFAULT 'pending' CHECK (claim_extraction_status IN ('pending', 'processing', 'completed', 'failed')),
    claims_extracted_count INTEGER DEFAULT 0,
    claims_extracted_at TIMESTAMPTZ,

    -- Analysis
    credibility_score DECIMAL(5,2),
    consistency_score DECIMAL(5,2),

    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual claims extracted from statements
CREATE TABLE IF NOT EXISTS public.statement_claims (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    statement_id UUID REFERENCES public.statements(id) ON DELETE CASCADE NOT NULL,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,

    -- Claim classification
    claim_type TEXT NOT NULL CHECK (claim_type IN (
        'location_at_time',
        'action_performed',
        'observation',
        'relationship',
        'possession',
        'communication',
        'alibi',
        'accusation',
        'denial',
        'time_reference',
        'physical_description',
        'emotional_state',
        'other'
    )),

    -- Claim content
    claim_text TEXT NOT NULL,
    original_text TEXT NOT NULL,

    -- Structured claim data
    subject_entity_id UUID REFERENCES public.canonical_entities(id),
    subject_text TEXT,
    predicate TEXT,
    object_entity_id UUID REFERENCES public.canonical_entities(id),
    object_text TEXT,

    -- Time component
    claimed_date DATE,
    claimed_time TIME,
    claimed_datetime TIMESTAMPTZ,
    time_precision TEXT CHECK (time_precision IN ('exact', 'approximate', 'range', 'relative', 'vague')),
    time_range_start TIMESTAMPTZ,
    time_range_end TIMESTAMPTZ,
    time_original_text TEXT,

    -- Location component
    claimed_location TEXT,
    location_entity_id UUID REFERENCES public.canonical_entities(id),
    location_precision TEXT CHECK (location_precision IN ('exact_address', 'place_name', 'area', 'city', 'vague')),

    -- Confidence and verification
    extraction_confidence DECIMAL(5,2) DEFAULT 0.8,
    verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'unverified', 'contradicted', 'partially_verified', 'false')),
    verified_by_evidence TEXT,

    -- Position in document
    character_offset INTEGER,
    page_number INTEGER,

    -- Flags
    is_alibi_claim BOOLEAN DEFAULT FALSE,
    is_accusatory BOOLEAN DEFAULT FALSE,
    involves_victim BOOLEAN DEFAULT FALSE,

    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_statements_case ON public.statements(case_id);
CREATE INDEX IF NOT EXISTS idx_statements_speaker ON public.statements(speaker_entity_id);
CREATE INDEX IF NOT EXISTS idx_claims_case ON public.statement_claims(case_id);
CREATE INDEX IF NOT EXISTS idx_claims_statement ON public.statement_claims(statement_id);
CREATE INDEX IF NOT EXISTS idx_claims_type ON public.statement_claims(claim_type);
CREATE INDEX IF NOT EXISTS idx_claims_subject ON public.statement_claims(subject_entity_id);
CREATE INDEX IF NOT EXISTS idx_claims_datetime ON public.statement_claims(claimed_datetime);
CREATE INDEX IF NOT EXISTS idx_claims_location ON public.statement_claims(claimed_location);

-- ============================================================================
-- SECTION 4: INCONSISTENCY DETECTION
-- ============================================================================

-- Detected inconsistencies between claims
CREATE TABLE IF NOT EXISTS public.claim_inconsistencies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,

    -- Conflicting claims
    claim_1_id UUID REFERENCES public.statement_claims(id) ON DELETE CASCADE NOT NULL,
    claim_2_id UUID REFERENCES public.statement_claims(id) ON DELETE CASCADE NOT NULL,

    -- Inconsistency details
    inconsistency_type TEXT NOT NULL CHECK (inconsistency_type IN (
        'time_contradiction',
        'location_contradiction',
        'action_contradiction',
        'witness_contradiction',
        'self_contradiction',
        'alibi_contradiction',
        'detail_change',
        'omission',
        'addition',
        'time_drift',
        'story_evolution',
        'other'
    )),

    severity TEXT NOT NULL CHECK (severity IN ('minor', 'moderate', 'significant', 'critical')),

    -- Analysis
    description TEXT NOT NULL,
    analysis TEXT,
    investigative_significance TEXT,
    suggested_action TEXT,

    -- Context
    time_between_statements INTERVAL,

    -- People involved
    involved_entity_ids UUID[],
    primary_speaker_id UUID REFERENCES public.canonical_entities(id),

    -- Time frame of inconsistency
    time_period_start TIMESTAMPTZ,
    time_period_end TIMESTAMPTZ,

    -- Review status
    review_status TEXT DEFAULT 'pending' CHECK (review_status IN ('pending', 'reviewed', 'resolved', 'flagged', 'dismissed')),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    reviewer_notes TEXT,

    -- Detection metadata
    detection_method TEXT CHECK (detection_method IN ('automated', 'ai_assisted', 'manual')),
    detection_confidence DECIMAL(5,2),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Statement comparison results
CREATE TABLE IF NOT EXISTS public.statement_comparisons (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    statement_1_id UUID REFERENCES public.statements(id) NOT NULL,
    statement_2_id UUID REFERENCES public.statements(id) NOT NULL,
    speaker_entity_id UUID REFERENCES public.canonical_entities(id),

    -- Comparison results
    total_claims_compared INTEGER,
    matching_claims INTEGER,
    contradicting_claims INTEGER,
    new_claims INTEGER,
    omitted_claims INTEGER,
    modified_claims INTEGER,

    -- Assessment
    consistency_score DECIMAL(5,2),
    credibility_impact TEXT CHECK (credibility_impact IN ('positive', 'negative', 'neutral')),
    summary TEXT,
    key_differences TEXT[],

    compared_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inconsistencies_case ON public.claim_inconsistencies(case_id);
CREATE INDEX IF NOT EXISTS idx_inconsistencies_type ON public.claim_inconsistencies(inconsistency_type);
CREATE INDEX IF NOT EXISTS idx_inconsistencies_severity ON public.claim_inconsistencies(severity);
CREATE INDEX IF NOT EXISTS idx_inconsistencies_status ON public.claim_inconsistencies(review_status);
CREATE INDEX IF NOT EXISTS idx_inconsistencies_speaker ON public.claim_inconsistencies(primary_speaker_id);

-- ============================================================================
-- SECTION 5: ENHANCED PERSON TIMELINES
-- ============================================================================

-- Person timeline events (extends existing timeline_events)
CREATE TABLE IF NOT EXISTS public.person_timeline_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    entity_id UUID REFERENCES public.canonical_entities(id) ON DELETE CASCADE NOT NULL,

    -- Event details
    event_time TIMESTAMPTZ,
    event_date DATE,
    time_precision TEXT CHECK (time_precision IN ('exact', 'approximate', 'estimated', 'range', 'unknown')),
    time_range_start TIMESTAMPTZ,
    time_range_end TIMESTAMPTZ,

    -- Event content
    event_type TEXT NOT NULL CHECK (event_type IN (
        'location_sighting',
        'phone_activity',
        'social_media_activity',
        'financial_transaction',
        'vehicle_movement',
        'witness_observation',
        'camera_footage',
        'interview_statement',
        'physical_evidence',
        'digital_footprint',
        'interaction_with_victim',
        'interaction_with_suspect',
        'alibi_claim',
        'work_activity',
        'other'
    )),

    title TEXT NOT NULL,
    description TEXT,

    -- Location
    location TEXT,
    location_coordinates JSONB,

    -- Source
    source_type TEXT CHECK (source_type IN ('statement', 'document', 'phone_record', 'camera', 'witness', 'financial_record', 'digital', 'physical_evidence', 'other')),
    source_document_id UUID,
    source_claim_id UUID REFERENCES public.statement_claims(id),
    reported_by TEXT,

    -- Verification
    verification_status TEXT DEFAULT 'unverified' CHECK (verification_status IN ('verified', 'unverified', 'contradicted', 'partial')),
    confidence_score DECIMAL(5,2) DEFAULT 0.7,

    -- Relationships
    related_entity_ids UUID[],
    is_interaction_with_victim BOOLEAN DEFAULT FALSE,
    is_suspicious BOOLEAN DEFAULT FALSE,

    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Timeline gaps (unaccounted time periods)
CREATE TABLE IF NOT EXISTS public.timeline_gaps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    entity_id UUID REFERENCES public.canonical_entities(id) ON DELETE CASCADE NOT NULL,

    -- Gap details
    gap_start TIMESTAMPTZ NOT NULL,
    gap_end TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL,

    -- Context
    last_known_location TEXT,
    last_known_activity TEXT,
    next_known_location TEXT,
    next_known_activity TEXT,

    -- Assessment
    significance TEXT CHECK (significance IN ('low', 'medium', 'high', 'critical')),
    covers_incident_time BOOLEAN DEFAULT FALSE,
    explanation_provided BOOLEAN DEFAULT FALSE,
    explanation TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_person_timeline_entity ON public.person_timeline_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_person_timeline_case ON public.person_timeline_events(case_id);
CREATE INDEX IF NOT EXISTS idx_person_timeline_time ON public.person_timeline_events(event_time);
CREATE INDEX IF NOT EXISTS idx_person_timeline_type ON public.person_timeline_events(event_type);
CREATE INDEX IF NOT EXISTS idx_timeline_gaps_entity ON public.timeline_gaps(entity_id);

-- ============================================================================
-- SECTION 6: DNA EVIDENCE TRACKING
-- ============================================================================

-- DNA samples
CREATE TABLE IF NOT EXISTS public.dna_samples (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    evidence_item_id UUID,

    -- Sample identification
    sample_number TEXT NOT NULL,
    sample_type TEXT NOT NULL CHECK (sample_type IN (
        'blood', 'saliva', 'hair', 'skin_cells', 'semen', 'tissue',
        'touch_dna', 'fingernail_scrapings', 'swab', 'bone', 'teeth', 'other'
    )),
    collection_method TEXT,

    -- Collection details
    collected_at TIMESTAMPTZ NOT NULL,
    collected_by TEXT NOT NULL,
    collection_location TEXT NOT NULL,
    collection_notes TEXT,

    -- Sample status
    status TEXT NOT NULL DEFAULT 'collected' CHECK (status IN (
        'collected', 'stored', 'queued_for_testing', 'in_testing',
        'tested', 'inconclusive', 'degraded', 'consumed', 'retained'
    )),

    -- Storage
    storage_location TEXT,
    storage_conditions TEXT,
    quantity_remaining TEXT,

    -- Priority
    testing_priority TEXT DEFAULT 'normal' CHECK (testing_priority IN ('critical', 'high', 'normal', 'low')),
    priority_reason TEXT,

    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DNA tests
CREATE TABLE IF NOT EXISTS public.dna_tests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    sample_id UUID REFERENCES public.dna_samples(id) NOT NULL,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,

    -- Test details
    test_type TEXT NOT NULL CHECK (test_type IN (
        'str_analysis', 'y_str', 'mitochondrial', 'snp_analysis',
        'rapid_dna', 'phenotyping', 'familial_search', 'touch_dna', 'other'
    )),

    -- Lab info
    lab_name TEXT NOT NULL,
    lab_case_number TEXT,
    analyst_name TEXT,

    -- Status
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
        'requested', 'sample_received', 'in_progress', 'analysis_complete',
        'report_pending', 'completed', 'failed', 'cancelled'
    )),

    -- Timeline
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    received_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    estimated_completion TIMESTAMPTZ,

    -- Results
    profile_obtained BOOLEAN,
    profile_quality TEXT CHECK (profile_quality IN ('full', 'partial', 'degraded', 'mixture', 'none')),
    loci_count INTEGER,

    -- Report
    report_document_id UUID,
    summary TEXT,
    detailed_results JSONB,

    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DNA profiles
CREATE TABLE IF NOT EXISTS public.dna_profiles (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    test_id UUID REFERENCES public.dna_tests(id),
    sample_id UUID REFERENCES public.dna_samples(id),

    -- Profile identification
    profile_number TEXT NOT NULL,
    profile_type TEXT NOT NULL CHECK (profile_type IN (
        'known_reference', 'unknown_crime_scene', 'unknown_evidence',
        'victim', 'suspect', 'elimination', 'familial'
    )),

    -- Associated person
    person_entity_id UUID REFERENCES public.canonical_entities(id),
    person_name TEXT,
    relationship_to_case TEXT,

    -- Profile quality
    quality TEXT CHECK (quality IN ('full', 'partial', 'degraded', 'mixture')),
    loci_count INTEGER,
    is_mixture BOOLEAN DEFAULT FALSE,
    contributor_count INTEGER,

    -- Profile data
    str_profile JSONB,
    y_str_profile JSONB,
    mt_dna_profile JSONB,

    -- CODIS status
    uploaded_to_codis BOOLEAN DEFAULT FALSE,
    codis_upload_date TIMESTAMPTZ,
    codis_hit BOOLEAN DEFAULT FALSE,

    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- DNA matches
CREATE TABLE IF NOT EXISTS public.dna_matches (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,

    -- Profiles
    profile_1_id UUID REFERENCES public.dna_profiles(id) NOT NULL,
    profile_2_id UUID REFERENCES public.dna_profiles(id) NOT NULL,

    -- Match details
    match_type TEXT NOT NULL CHECK (match_type IN (
        'identity', 'familial_parent', 'familial_sibling',
        'familial_distant', 'exclusion', 'inconclusive'
    )),

    -- Statistics
    match_probability DECIMAL(30,20),
    likelihood_ratio DECIMAL(30,10),
    loci_compared INTEGER,
    loci_matched INTEGER,

    -- Verification
    verified BOOLEAN DEFAULT FALSE,
    verified_by TEXT,
    verified_at TIMESTAMPTZ,

    -- Significance
    investigative_value TEXT CHECK (investigative_value IN ('critical', 'high', 'medium', 'low')),
    notes TEXT,

    -- CODIS
    is_codis_hit BOOLEAN DEFAULT FALSE,
    codis_hit_details JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dna_samples_case ON public.dna_samples(case_id);
CREATE INDEX IF NOT EXISTS idx_dna_samples_status ON public.dna_samples(status);
CREATE INDEX IF NOT EXISTS idx_dna_tests_case ON public.dna_tests(case_id);
CREATE INDEX IF NOT EXISTS idx_dna_tests_status ON public.dna_tests(status);
CREATE INDEX IF NOT EXISTS idx_dna_profiles_case ON public.dna_profiles(case_id);
CREATE INDEX IF NOT EXISTS idx_dna_profiles_person ON public.dna_profiles(person_entity_id);
CREATE INDEX IF NOT EXISTS idx_dna_matches_case ON public.dna_matches(case_id);

-- ============================================================================
-- SECTION 7: HELPER FUNCTIONS
-- ============================================================================

-- Function to find potential entity matches using fuzzy matching
CREATE OR REPLACE FUNCTION find_entity_matches(
    p_case_id UUID,
    p_name TEXT,
    p_threshold DECIMAL DEFAULT 0.6
)
RETURNS TABLE (
    entity_id UUID,
    canonical_name TEXT,
    matched_alias TEXT,
    similarity_score DECIMAL
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT ON (ce.id)
        ce.id as entity_id,
        ce.canonical_name,
        ea.alias_value as matched_alias,
        similarity(ea.alias_value, p_name)::DECIMAL as similarity_score
    FROM canonical_entities ce
    JOIN entity_aliases ea ON ce.id = ea.canonical_entity_id
    WHERE ce.case_id = p_case_id
      AND similarity(ea.alias_value, p_name) >= p_threshold
    ORDER BY ce.id, similarity(ea.alias_value, p_name) DESC;
END;
$$;

-- Function to get person timeline
CREATE OR REPLACE FUNCTION get_person_timeline(
    p_case_id UUID,
    p_entity_id UUID,
    p_start_time TIMESTAMPTZ DEFAULT NULL,
    p_end_time TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    event_id UUID,
    event_time TIMESTAMPTZ,
    event_type TEXT,
    title TEXT,
    description TEXT,
    location TEXT,
    source_type TEXT,
    verification_status TEXT,
    confidence_score DECIMAL,
    is_suspicious BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        pte.id as event_id,
        COALESCE(pte.event_time, pte.event_date::TIMESTAMPTZ) as event_time,
        pte.event_type,
        pte.title,
        pte.description,
        pte.location,
        pte.source_type,
        pte.verification_status,
        pte.confidence_score,
        pte.is_suspicious
    FROM person_timeline_events pte
    WHERE pte.case_id = p_case_id
      AND pte.entity_id = p_entity_id
      AND (p_start_time IS NULL OR COALESCE(pte.event_time, pte.event_date::TIMESTAMPTZ) >= p_start_time)
      AND (p_end_time IS NULL OR COALESCE(pte.event_time, pte.event_date::TIMESTAMPTZ) <= p_end_time)
    ORDER BY COALESCE(pte.event_time, pte.event_date::TIMESTAMPTZ);
END;
$$;

-- Function to detect time-based inconsistencies for a person
CREATE OR REPLACE FUNCTION find_time_inconsistencies(
    p_case_id UUID,
    p_entity_id UUID,
    p_time_tolerance_minutes INTEGER DEFAULT 30
)
RETURNS TABLE (
    claim_1_id UUID,
    claim_1_time TIMESTAMPTZ,
    claim_1_location TEXT,
    claim_1_statement_date DATE,
    claim_2_id UUID,
    claim_2_time TIMESTAMPTZ,
    claim_2_location TEXT,
    claim_2_statement_date DATE,
    time_difference_minutes INTEGER,
    potential_conflict BOOLEAN
)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        c1.id as claim_1_id,
        c1.claimed_datetime as claim_1_time,
        c1.claimed_location as claim_1_location,
        s1.statement_date as claim_1_statement_date,
        c2.id as claim_2_id,
        c2.claimed_datetime as claim_2_time,
        c2.claimed_location as claim_2_location,
        s2.statement_date as claim_2_statement_date,
        EXTRACT(EPOCH FROM (c2.claimed_datetime - c1.claimed_datetime) / 60)::INTEGER as time_difference_minutes,
        (c1.claimed_location IS DISTINCT FROM c2.claimed_location AND
         ABS(EXTRACT(EPOCH FROM (c2.claimed_datetime - c1.claimed_datetime) / 60)) <= p_time_tolerance_minutes) as potential_conflict
    FROM statement_claims c1
    JOIN statements s1 ON c1.statement_id = s1.id
    JOIN statement_claims c2 ON c1.case_id = c2.case_id
    JOIN statements s2 ON c2.statement_id = s2.id
    WHERE c1.case_id = p_case_id
      AND c1.subject_entity_id = p_entity_id
      AND c2.subject_entity_id = p_entity_id
      AND c1.claimed_datetime IS NOT NULL
      AND c2.claimed_datetime IS NOT NULL
      AND c1.id < c2.id
      AND s1.speaker_entity_id = p_entity_id
      AND s2.speaker_entity_id = p_entity_id
      AND s1.statement_date < s2.statement_date
    ORDER BY c1.claimed_datetime;
END;
$$;

-- ============================================================================
-- SECTION 8: VIEWS
-- ============================================================================

-- DNA testing queue view
CREATE OR REPLACE VIEW dna_testing_queue AS
SELECT
    ds.id as sample_id,
    ds.sample_number,
    ds.sample_type,
    ds.status,
    ds.testing_priority,
    ds.priority_reason,
    ds.collected_at,
    ds.collection_location,
    ds.case_id,
    dt.id as test_id,
    dt.status as test_status,
    dt.lab_name,
    dt.estimated_completion
FROM dna_samples ds
LEFT JOIN dna_tests dt ON dt.sample_id = ds.id
    AND dt.status NOT IN ('completed', 'cancelled', 'failed')
WHERE ds.status IN ('collected', 'stored', 'queued_for_testing')
ORDER BY
    CASE ds.testing_priority
        WHEN 'critical' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
    END,
    ds.collected_at;

-- Inconsistency summary view
CREATE OR REPLACE VIEW inconsistency_summary AS
SELECT
    ci.case_id,
    ce.canonical_name as person_name,
    ce.role as person_role,
    ci.inconsistency_type,
    ci.severity,
    ci.description,
    ci.review_status,
    s1.statement_date as first_statement_date,
    s2.statement_date as second_statement_date,
    ci.time_between_statements,
    ci.created_at
FROM claim_inconsistencies ci
JOIN canonical_entities ce ON ci.primary_speaker_id = ce.id
JOIN statement_claims sc1 ON ci.claim_1_id = sc1.id
JOIN statements s1 ON sc1.statement_id = s1.id
JOIN statement_claims sc2 ON ci.claim_2_id = sc2.id
JOIN statements s2 ON sc2.statement_id = s2.id
ORDER BY
    CASE ci.severity
        WHEN 'critical' THEN 1
        WHEN 'significant' THEN 2
        WHEN 'moderate' THEN 3
        WHEN 'minor' THEN 4
    END,
    ci.created_at DESC;

-- Enable RLS on new tables
ALTER TABLE public.batch_processing_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batch_document_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canonical_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_inconsistencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statement_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dna_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dna_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dna_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dna_matches ENABLE ROW LEVEL SECURITY;
