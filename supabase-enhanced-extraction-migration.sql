-- Migration for Enhanced Document Extraction and Caching System
-- This migration adds columns for caching extracted content and structured data
-- Run this after the base schema migrations

-- ============================================
-- UPDATE: case_files table (for legacy extraction support)
-- Add columns for caching extracted text
-- ============================================
DO $$
BEGIN
    -- Add ai_extracted_text column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_files' AND column_name = 'ai_extracted_text'
    ) THEN
        ALTER TABLE public.case_files ADD COLUMN ai_extracted_text TEXT;
    END IF;

    -- Add ai_transcription column for audio files
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_files' AND column_name = 'ai_transcription'
    ) THEN
        ALTER TABLE public.case_files ADD COLUMN ai_transcription TEXT;
    END IF;

    -- Add ai_analyzed flag
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_files' AND column_name = 'ai_analyzed'
    ) THEN
        ALTER TABLE public.case_files ADD COLUMN ai_analyzed BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add ai_analysis_confidence
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_files' AND column_name = 'ai_analysis_confidence'
    ) THEN
        ALTER TABLE public.case_files ADD COLUMN ai_analysis_confidence DECIMAL(5,2);
    END IF;
END $$;

-- ============================================
-- UPDATE: case_documents table
-- Add columns for structured data extraction
-- ============================================
DO $$
BEGIN
    -- Add extracted_text column for caching
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_documents' AND column_name = 'extracted_text'
    ) THEN
        ALTER TABLE public.case_documents ADD COLUMN extracted_text TEXT;
    END IF;

    -- Add extraction_method
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_documents' AND column_name = 'extraction_method'
    ) THEN
        ALTER TABLE public.case_documents ADD COLUMN extraction_method TEXT;
    END IF;

    -- Add extraction_confidence
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_documents' AND column_name = 'extraction_confidence'
    ) THEN
        ALTER TABLE public.case_documents ADD COLUMN extraction_confidence DECIMAL(5,2);
    END IF;

    -- Add structured_data JSONB for entities, dates, phone numbers, etc.
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_documents' AND column_name = 'structured_data'
    ) THEN
        ALTER TABLE public.case_documents ADD COLUMN structured_data JSONB DEFAULT '{}'::JSONB;
    END IF;

    -- Add extraction_status
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_documents' AND column_name = 'extraction_status'
    ) THEN
        ALTER TABLE public.case_documents ADD COLUMN extraction_status TEXT DEFAULT 'pending'
            CHECK (extraction_status IN ('pending', 'processing', 'completed', 'failed', 'needs_review'));
    END IF;

    -- Add page_count for multi-page documents
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_documents' AND column_name = 'page_count'
    ) THEN
        ALTER TABLE public.case_documents ADD COLUMN page_count INTEGER DEFAULT 1;
    END IF;

    -- Add word_count for text statistics
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_documents' AND column_name = 'word_count'
    ) THEN
        ALTER TABLE public.case_documents ADD COLUMN word_count INTEGER;
    END IF;

    -- Add extracted_at timestamp
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'case_documents' AND column_name = 'extracted_at'
    ) THEN
        ALTER TABLE public.case_documents ADD COLUMN extracted_at TIMESTAMPTZ;
    END IF;
END $$;

-- ============================================
-- NEW TABLE: extracted_entities
-- Stores entities (people, locations, vehicles) extracted from documents
-- ============================================
CREATE TABLE IF NOT EXISTS public.extracted_entities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.case_documents(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'organization', 'location', 'vehicle', 'weapon', 'phone', 'email', 'date', 'time', 'money', 'evidence', 'unknown')),
    value TEXT NOT NULL,
    normalized_value TEXT, -- Standardized version (e.g., phone number formatting)
    context TEXT, -- Surrounding text for context
    confidence DECIMAL(5,2) DEFAULT 0.8,
    mention_count INTEGER DEFAULT 1,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB, -- Additional entity-specific data
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for entity type lookups
CREATE INDEX IF NOT EXISTS idx_extracted_entities_case ON public.extracted_entities(case_id);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_type ON public.extracted_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_value ON public.extracted_entities(value);
CREATE INDEX IF NOT EXISTS idx_extracted_entities_document ON public.extracted_entities(document_id);

-- Full-text search index on entity values
CREATE INDEX IF NOT EXISTS idx_extracted_entities_fts ON public.extracted_entities
    USING gin(to_tsvector('english', value || ' ' || COALESCE(context, '')));

-- ============================================
-- NEW TABLE: cross_references
-- Tracks connections between entities across documents
-- ============================================
CREATE TABLE IF NOT EXISTS public.cross_references (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    entity_1_id UUID REFERENCES public.extracted_entities(id) ON DELETE CASCADE NOT NULL,
    entity_2_id UUID REFERENCES public.extracted_entities(id) ON DELETE CASCADE NOT NULL,
    relationship_type TEXT NOT NULL DEFAULT 'co-occurrence',
    strength DECIMAL(5,2) DEFAULT 0.5 CHECK (strength >= 0 AND strength <= 1),
    document_count INTEGER DEFAULT 1, -- Number of documents where both appear
    evidence TEXT, -- Description of the connection
    is_verified BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Prevent duplicate connections
    UNIQUE(entity_1_id, entity_2_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_cross_references_case ON public.cross_references(case_id);
CREATE INDEX IF NOT EXISTS idx_cross_references_entity1 ON public.cross_references(entity_1_id);
CREATE INDEX IF NOT EXISTS idx_cross_references_entity2 ON public.cross_references(entity_2_id);

-- ============================================
-- NEW TABLE: document_timeline_events
-- Stores extracted timeline events from documents
-- ============================================
CREATE TABLE IF NOT EXISTS public.document_timeline_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES public.case_documents(id) ON DELETE CASCADE,
    event_date DATE,
    event_time TIME,
    event_datetime TIMESTAMPTZ,
    date_precision TEXT DEFAULT 'day' CHECK (date_precision IN ('year', 'month', 'day', 'hour', 'minute', 'exact')),
    description TEXT NOT NULL,
    location TEXT,
    involved_entities UUID[] DEFAULT '{}', -- References to extracted_entities
    source_text TEXT, -- Original text from document
    confidence DECIMAL(5,2) DEFAULT 0.8,
    is_verified BOOLEAN DEFAULT FALSE,
    event_type TEXT CHECK (event_type IN ('incident', 'witness_account', 'suspect_activity', 'victim_activity', 'evidence_collection', 'investigation', 'other')),
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_document_timeline_case ON public.document_timeline_events(case_id);
CREATE INDEX IF NOT EXISTS idx_document_timeline_date ON public.document_timeline_events(event_date);
CREATE INDEX IF NOT EXISTS idx_document_timeline_datetime ON public.document_timeline_events(event_datetime);
CREATE INDEX IF NOT EXISTS idx_document_timeline_document ON public.document_timeline_events(document_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.extracted_entities
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.cross_references
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.document_timeline_events
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.extracted_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cross_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_timeline_events ENABLE ROW LEVEL SECURITY;

-- Extracted entities policies
CREATE POLICY "Users can view entities from their agency cases"
ON public.extracted_entities FOR SELECT
USING (
    case_id IN (
        SELECT id FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can manage entities for their agency cases"
ON public.extracted_entities FOR ALL
USING (
    case_id IN (
        SELECT id FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

-- Cross references policies
CREATE POLICY "Users can view cross-references from their agency cases"
ON public.cross_references FOR SELECT
USING (
    case_id IN (
        SELECT id FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can manage cross-references for their agency cases"
ON public.cross_references FOR ALL
USING (
    case_id IN (
        SELECT id FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

-- Document timeline events policies
CREATE POLICY "Users can view timeline events from their agency cases"
ON public.document_timeline_events FOR SELECT
USING (
    case_id IN (
        SELECT id FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can manage timeline events for their agency cases"
ON public.document_timeline_events FOR ALL
USING (
    case_id IN (
        SELECT id FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

-- ============================================
-- FUNCTIONS for entity extraction analysis
-- ============================================

-- Function to find entities that appear across multiple documents
CREATE OR REPLACE FUNCTION find_recurring_entities(
    case_id_param UUID,
    min_occurrences INT DEFAULT 2
)
RETURNS TABLE (
    entity_id UUID,
    entity_type TEXT,
    value TEXT,
    total_mentions INTEGER,
    document_count INTEGER,
    documents UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS entity_id,
        e.entity_type,
        e.value,
        SUM(e.mention_count)::INTEGER AS total_mentions,
        COUNT(DISTINCT e.document_id)::INTEGER AS document_count,
        ARRAY_AGG(DISTINCT e.document_id) AS documents
    FROM public.extracted_entities e
    WHERE e.case_id = case_id_param
    GROUP BY e.id, e.entity_type, e.value
    HAVING COUNT(DISTINCT e.document_id) >= min_occurrences
    ORDER BY document_count DESC, total_mentions DESC;
END;
$$;

-- Function to get entity network for a case
CREATE OR REPLACE FUNCTION get_entity_network(case_id_param UUID)
RETURNS TABLE (
    source_entity TEXT,
    source_type TEXT,
    target_entity TEXT,
    target_type TEXT,
    relationship_type TEXT,
    strength DECIMAL,
    document_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e1.value AS source_entity,
        e1.entity_type AS source_type,
        e2.value AS target_entity,
        e2.entity_type AS target_type,
        cr.relationship_type,
        cr.strength,
        cr.document_count
    FROM public.cross_references cr
    JOIN public.extracted_entities e1 ON cr.entity_1_id = e1.id
    JOIN public.extracted_entities e2 ON cr.entity_2_id = e2.id
    WHERE cr.case_id = case_id_param
    ORDER BY cr.strength DESC, cr.document_count DESC;
END;
$$;

-- Function to get case extraction statistics
CREATE OR REPLACE FUNCTION get_case_extraction_stats(case_id_param UUID)
RETURNS TABLE (
    total_documents INTEGER,
    extracted_documents INTEGER,
    pending_documents INTEGER,
    failed_documents INTEGER,
    total_entities INTEGER,
    unique_people INTEGER,
    unique_locations INTEGER,
    unique_dates INTEGER,
    total_timeline_events INTEGER,
    total_cross_references INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*)::INTEGER FROM public.case_documents WHERE case_id = case_id_param) AS total_documents,
        (SELECT COUNT(*)::INTEGER FROM public.case_documents WHERE case_id = case_id_param AND extraction_status = 'completed') AS extracted_documents,
        (SELECT COUNT(*)::INTEGER FROM public.case_documents WHERE case_id = case_id_param AND extraction_status = 'pending') AS pending_documents,
        (SELECT COUNT(*)::INTEGER FROM public.case_documents WHERE case_id = case_id_param AND extraction_status = 'failed') AS failed_documents,
        (SELECT COUNT(*)::INTEGER FROM public.extracted_entities WHERE case_id = case_id_param) AS total_entities,
        (SELECT COUNT(DISTINCT value)::INTEGER FROM public.extracted_entities WHERE case_id = case_id_param AND entity_type = 'person') AS unique_people,
        (SELECT COUNT(DISTINCT value)::INTEGER FROM public.extracted_entities WHERE case_id = case_id_param AND entity_type = 'location') AS unique_locations,
        (SELECT COUNT(DISTINCT value)::INTEGER FROM public.extracted_entities WHERE case_id = case_id_param AND entity_type = 'date') AS unique_dates,
        (SELECT COUNT(*)::INTEGER FROM public.document_timeline_events WHERE case_id = case_id_param) AS total_timeline_events,
        (SELECT COUNT(*)::INTEGER FROM public.cross_references WHERE case_id = case_id_param) AS total_cross_references;
END;
$$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.extracted_entities IS 'Stores entities (people, locations, vehicles, etc.) extracted from case documents';
COMMENT ON TABLE public.cross_references IS 'Tracks relationships between entities across documents';
COMMENT ON TABLE public.document_timeline_events IS 'Timeline events extracted from case documents';
COMMENT ON FUNCTION find_recurring_entities IS 'Finds entities that appear across multiple documents in a case';
COMMENT ON FUNCTION get_entity_network IS 'Returns the network of entity relationships for a case';
COMMENT ON FUNCTION get_case_extraction_stats IS 'Returns extraction statistics for a case';
