-- Phase 3B: Visual Investigation Tools - Database Migration
-- Creates tables for timelines, connection graphs (murder board), and alibi tracking

-- =============================================
-- ENTITIES: People, Places, Things
-- =============================================

-- Generic entities that can be connected (suspects, witnesses, locations, evidence)
CREATE TABLE public.case_entities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,

    -- Entity details
    entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'location', 'evidence', 'vehicle', 'organization', 'other')),
    name TEXT NOT NULL,
    role TEXT, -- 'victim', 'suspect', 'witness', 'investigator', etc.
    description TEXT,

    -- Visual representation
    image_url TEXT,
    color TEXT, -- hex color for visualization
    icon TEXT, -- icon identifier

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookups
CREATE INDEX case_entities_case_id_idx ON public.case_entities(case_id);
CREATE INDEX case_entities_type_idx ON public.case_entities(entity_type);
CREATE INDEX case_entities_role_idx ON public.case_entities(role);

-- =============================================
-- CONNECTIONS: Murder Board Relationships
-- =============================================

-- Connections between entities (e.g., victim -> suspect, suspect -> weapon)
CREATE TABLE public.case_connections (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,

    -- Connection endpoints
    from_entity_id UUID REFERENCES public.case_entities(id) ON DELETE CASCADE NOT NULL,
    to_entity_id UUID REFERENCES public.case_entities(id) ON DELETE CASCADE NOT NULL,

    -- Connection details
    connection_type TEXT NOT NULL, -- 'saw', 'knows', 'owns', 'located_at', 'related_to', 'alibi_with', etc.
    label TEXT, -- Display label for the connection
    description TEXT,
    confidence TEXT CHECK (confidence IN ('confirmed', 'probable', 'possible', 'unverified')) DEFAULT 'unverified',

    -- Evidence supporting this connection
    evidence_document_ids UUID[], -- References to case_files or case_documents
    evidence_notes TEXT,

    -- Visual styling
    line_style TEXT DEFAULT 'solid' CHECK (line_style IN ('solid', 'dashed', 'dotted')),
    line_color TEXT, -- hex color
    line_weight INTEGER DEFAULT 2 CHECK (line_weight BETWEEN 1 AND 10),

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX case_connections_case_id_idx ON public.case_connections(case_id);
CREATE INDEX case_connections_from_entity_idx ON public.case_connections(from_entity_id);
CREATE INDEX case_connections_to_entity_idx ON public.case_connections(to_entity_id);
CREATE INDEX case_connections_type_idx ON public.case_connections(connection_type);

-- =============================================
-- TIMELINE EVENTS
-- =============================================

-- Timeline events for victim's last actions, suspect movements, etc.
CREATE TABLE public.timeline_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,

    -- Event details
    event_type TEXT NOT NULL CHECK (event_type IN ('victim_action', 'suspect_movement', 'witness_account', 'evidence_found', 'phone_call', 'transaction', 'sighting', 'other')),
    title TEXT NOT NULL,
    description TEXT,

    -- Time information
    event_time TIMESTAMP WITH TIME ZONE,
    event_date DATE,
    time_precision TEXT CHECK (time_precision IN ('exact', 'approximate', 'estimated', 'unknown')) DEFAULT 'exact',
    time_range_start TIMESTAMP WITH TIME ZONE,
    time_range_end TIMESTAMP WITH TIME ZONE,

    -- Location
    location TEXT,
    location_coordinates POINT, -- PostgreSQL POINT type for lat/lng

    -- Involved entities
    primary_entity_id UUID REFERENCES public.case_entities(id),
    related_entity_ids UUID[], -- Other entities involved

    -- Verification
    verification_status TEXT CHECK (verification_status IN ('verified', 'unverified', 'disputed', 'false')) DEFAULT 'unverified',
    verified_by TEXT, -- How it was verified (witness, camera, phone records, etc.)
    confidence_score INTEGER CHECK (confidence_score BETWEEN 0 AND 100) DEFAULT 50,

    -- Source
    source_type TEXT, -- 'witness_statement', 'document', 'cctv', 'phone_records', etc.
    source_document_id UUID, -- References case_files or case_documents
    source_notes TEXT,

    -- Visual styling
    color TEXT, -- hex color for timeline
    icon TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX timeline_events_case_id_idx ON public.timeline_events(case_id);
CREATE INDEX timeline_events_time_idx ON public.timeline_events(event_time);
CREATE INDEX timeline_events_date_idx ON public.timeline_events(event_date);
CREATE INDEX timeline_events_type_idx ON public.timeline_events(event_type);
CREATE INDEX timeline_events_entity_idx ON public.timeline_events(primary_entity_id);
CREATE INDEX timeline_events_verification_idx ON public.timeline_events(verification_status);

-- =============================================
-- ALIBI ENTRIES: Track suspect alibis and versions
-- =============================================

-- Alibi statements with version tracking
CREATE TABLE public.alibi_entries (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,

    -- Who gave the alibi
    subject_entity_id UUID REFERENCES public.case_entities(id) NOT NULL, -- The suspect

    -- Alibi details
    version_number INTEGER DEFAULT 1 NOT NULL, -- Track different versions of the story
    statement_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    interviewer TEXT, -- Who took the statement

    -- Time period covered by alibi
    alibi_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    alibi_end_time TIMESTAMP WITH TIME ZONE NOT NULL,

    -- The alibi story
    location_claimed TEXT NOT NULL,
    activity_claimed TEXT NOT NULL,
    full_statement TEXT,

    -- Corroboration
    corroborating_entity_ids UUID[], -- Who can verify this (alibi witnesses)
    verification_status TEXT CHECK (verification_status IN ('verified', 'partial', 'unverified', 'contradicted', 'false')) DEFAULT 'unverified',
    verification_notes TEXT,

    -- Changes from previous version
    changes_from_previous TEXT, -- What changed from last version
    inconsistencies JSONB DEFAULT '[]'::jsonb, -- Array of detected inconsistencies

    -- Source
    source_document_id UUID, -- Interview transcript, statement, etc.
    source_notes TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_by UUID REFERENCES auth.users(id),

    -- Ensure unique version numbers per subject
    UNIQUE(subject_entity_id, version_number)
);

-- Indexes
CREATE INDEX alibi_entries_case_id_idx ON public.alibi_entries(case_id);
CREATE INDEX alibi_entries_subject_idx ON public.alibi_entries(subject_entity_id);
CREATE INDEX alibi_entries_time_idx ON public.alibi_entries(alibi_start_time, alibi_end_time);
CREATE INDEX alibi_entries_verification_idx ON public.alibi_entries(verification_status);
CREATE INDEX alibi_entries_version_idx ON public.alibi_entries(subject_entity_id, version_number);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.case_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alibi_entries ENABLE ROW LEVEL SECURITY;

-- Policies for case_entities
CREATE POLICY "Users can view entities from their agency cases"
    ON public.case_entities FOR SELECT
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can insert entities to their agency cases"
    ON public.case_entities FOR INSERT
    WITH CHECK (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can update entities in their agency cases"
    ON public.case_entities FOR UPDATE
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can delete entities from their agency cases"
    ON public.case_entities FOR DELETE
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Policies for case_connections
CREATE POLICY "Users can view connections from their agency cases"
    ON public.case_connections FOR SELECT
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can insert connections to their agency cases"
    ON public.case_connections FOR INSERT
    WITH CHECK (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can update connections in their agency cases"
    ON public.case_connections FOR UPDATE
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can delete connections from their agency cases"
    ON public.case_connections FOR DELETE
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Policies for timeline_events
CREATE POLICY "Users can view timeline events from their agency cases"
    ON public.timeline_events FOR SELECT
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can insert timeline events to their agency cases"
    ON public.timeline_events FOR INSERT
    WITH CHECK (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can update timeline events in their agency cases"
    ON public.timeline_events FOR UPDATE
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can delete timeline events from their agency cases"
    ON public.timeline_events FOR DELETE
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- Policies for alibi_entries
CREATE POLICY "Users can view alibi entries from their agency cases"
    ON public.alibi_entries FOR SELECT
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can insert alibi entries to their agency cases"
    ON public.alibi_entries FOR INSERT
    WITH CHECK (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can update alibi entries in their agency cases"
    ON public.alibi_entries FOR UPDATE
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

CREATE POLICY "Users can delete alibi entries from their agency cases"
    ON public.alibi_entries FOR DELETE
    USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id = (SELECT agency_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Function to get all connections for an entity
CREATE OR REPLACE FUNCTION get_entity_connections(entity_uuid UUID)
RETURNS TABLE (
    connection_id UUID,
    direction TEXT,
    connected_entity_id UUID,
    connected_entity_name TEXT,
    connection_type TEXT,
    label TEXT,
    confidence TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id as connection_id,
        'outgoing' as direction,
        c.to_entity_id as connected_entity_id,
        e.name as connected_entity_name,
        c.connection_type,
        c.label,
        c.confidence
    FROM case_connections c
    JOIN case_entities e ON c.to_entity_id = e.id
    WHERE c.from_entity_id = entity_uuid

    UNION ALL

    SELECT
        c.id as connection_id,
        'incoming' as direction,
        c.from_entity_id as connected_entity_id,
        e.name as connected_entity_name,
        c.connection_type,
        c.label,
        c.confidence
    FROM case_connections c
    JOIN case_entities e ON c.from_entity_id = e.id
    WHERE c.to_entity_id = entity_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function to get timeline events for date range
CREATE OR REPLACE FUNCTION get_timeline_events_in_range(
    p_case_id UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    event_id UUID,
    event_type TEXT,
    title TEXT,
    description TEXT,
    event_time TIMESTAMP WITH TIME ZONE,
    location TEXT,
    entity_name TEXT,
    verification_status TEXT,
    confidence_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        te.id as event_id,
        te.event_type,
        te.title,
        te.description,
        COALESCE(te.event_time, te.time_range_start) as event_time,
        te.location,
        e.name as entity_name,
        te.verification_status,
        te.confidence_score
    FROM timeline_events te
    LEFT JOIN case_entities e ON te.primary_entity_id = e.id
    WHERE te.case_id = p_case_id
    AND (
        (te.event_time BETWEEN start_date AND end_date)
        OR (te.time_range_start BETWEEN start_date AND end_date)
        OR (te.time_range_end BETWEEN start_date AND end_date)
    )
    ORDER BY COALESCE(te.event_time, te.time_range_start);
END;
$$ LANGUAGE plpgsql;

-- Function to detect alibi inconsistencies
CREATE OR REPLACE FUNCTION detect_alibi_inconsistencies(
    p_subject_entity_id UUID
)
RETURNS TABLE (
    version_1 INTEGER,
    version_2 INTEGER,
    inconsistency_type TEXT,
    details TEXT
) AS $$
BEGIN
    RETURN QUERY
    WITH alibi_versions AS (
        SELECT
            version_number,
            alibi_start_time,
            alibi_end_time,
            location_claimed,
            activity_claimed
        FROM alibi_entries
        WHERE subject_entity_id = p_subject_entity_id
        ORDER BY version_number
    )
    SELECT
        a1.version_number as version_1,
        a2.version_number as version_2,
        CASE
            WHEN a1.location_claimed != a2.location_claimed THEN 'location_changed'
            WHEN a1.activity_claimed != a2.activity_claimed THEN 'activity_changed'
            WHEN a1.alibi_start_time != a2.alibi_start_time THEN 'time_changed'
            WHEN a1.alibi_end_time != a2.alibi_end_time THEN 'time_changed'
        END as inconsistency_type,
        CASE
            WHEN a1.location_claimed != a2.location_claimed THEN
                'Location changed from "' || a1.location_claimed || '" to "' || a2.location_claimed || '"'
            WHEN a1.activity_claimed != a2.activity_claimed THEN
                'Activity changed from "' || a1.activity_claimed || '" to "' || a2.activity_claimed || '"'
            WHEN a1.alibi_start_time != a2.alibi_start_time OR a1.alibi_end_time != a2.alibi_end_time THEN
                'Time range changed'
        END as details
    FROM alibi_versions a1
    CROSS JOIN alibi_versions a2
    WHERE a2.version_number = a1.version_number + 1
    AND (
        a1.location_claimed != a2.location_claimed
        OR a1.activity_claimed != a2.activity_claimed
        OR a1.alibi_start_time != a2.alibi_start_time
        OR a1.alibi_end_time != a2.alibi_end_time
    );
END;
$$ LANGUAGE plpgsql;

-- Function to get case board summary
CREATE OR REPLACE FUNCTION get_case_board_summary(p_case_id UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'entities', (
            SELECT json_agg(json_build_object(
                'id', id,
                'type', entity_type,
                'role', role,
                'name', name
            ))
            FROM case_entities
            WHERE case_id = p_case_id
        ),
        'connections', (
            SELECT COUNT(*) FROM case_connections WHERE case_id = p_case_id
        ),
        'timeline_events', (
            SELECT COUNT(*) FROM timeline_events WHERE case_id = p_case_id
        ),
        'alibis', (
            SELECT COUNT(*) FROM alibi_entries WHERE case_id = p_case_id
        ),
        'verified_events', (
            SELECT COUNT(*) FROM timeline_events
            WHERE case_id = p_case_id AND verification_status = 'verified'
        ),
        'unverified_alibis', (
            SELECT COUNT(*) FROM alibi_entries
            WHERE case_id = p_case_id AND verification_status = 'unverified'
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE public.case_entities IS 'Entities involved in cases (people, places, evidence, vehicles)';
COMMENT ON TABLE public.case_connections IS 'Connections between entities for murder board visualization';
COMMENT ON TABLE public.timeline_events IS 'Timeline events for victim actions, suspect movements, etc.';
COMMENT ON TABLE public.alibi_entries IS 'Alibi statements with version tracking for story comparison';

COMMENT ON FUNCTION get_entity_connections IS 'Get all connections (incoming and outgoing) for an entity';
COMMENT ON FUNCTION get_timeline_events_in_range IS 'Get timeline events within a date range';
COMMENT ON FUNCTION detect_alibi_inconsistencies IS 'Detect inconsistencies between alibi versions';
COMMENT ON FUNCTION get_case_board_summary IS 'Get summary statistics for case investigation board';
