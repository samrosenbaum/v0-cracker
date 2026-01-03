-- Migration for Evidence Chain of Custody Tracking
-- Tracks evidence items and their complete handling history

-- ============================================
-- TABLE: evidence_items
-- Stores evidence items with chain of custody
-- ============================================
CREATE TABLE IF NOT EXISTS public.evidence_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    evidence_number TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_type TEXT NOT NULL CHECK (evidence_type IN (
        'physical', 'biological', 'digital', 'documentary', 'photographic',
        'video', 'audio', 'weapon', 'clothing', 'vehicle', 'financial', 'other'
    )),
    collected_at TIMESTAMPTZ NOT NULL,
    collected_by TEXT NOT NULL,
    collection_location TEXT NOT NULL,
    current_location TEXT NOT NULL,
    current_custodian TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'collected' CHECK (status IN (
        'collected', 'in_transit', 'in_storage', 'in_analysis',
        'returned', 'disposed', 'released_to_owner', 'submitted_to_court'
    )),
    physical_description TEXT,
    storage_conditions TEXT,
    chain_of_custody JSONB DEFAULT '[]'::JSONB NOT NULL,
    analysis_history JSONB DEFAULT '[]'::JSONB NOT NULL,
    related_documents UUID[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Ensure unique evidence numbers within a case
    UNIQUE(case_id, evidence_number)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_evidence_items_case ON public.evidence_items(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_items_status ON public.evidence_items(status);
CREATE INDEX IF NOT EXISTS idx_evidence_items_type ON public.evidence_items(evidence_type);
CREATE INDEX IF NOT EXISTS idx_evidence_items_custodian ON public.evidence_items(current_custodian);
CREATE INDEX IF NOT EXISTS idx_evidence_items_number ON public.evidence_items(evidence_number);

-- Full-text search on evidence description
CREATE INDEX IF NOT EXISTS idx_evidence_items_fts ON public.evidence_items
    USING gin(to_tsvector('english', description));

-- JSONB indexes for chain of custody queries
CREATE INDEX IF NOT EXISTS idx_evidence_chain ON public.evidence_items
    USING gin(chain_of_custody);
CREATE INDEX IF NOT EXISTS idx_evidence_analysis ON public.evidence_items
    USING gin(analysis_history);

-- ============================================
-- TRIGGER for updated_at
-- ============================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.evidence_items
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.evidence_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence from their agency cases"
ON public.evidence_items FOR SELECT
USING (
    case_id IN (
        SELECT id FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

CREATE POLICY "Users can manage evidence for their agency cases"
ON public.evidence_items FOR ALL
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
-- FUNCTIONS for evidence reporting
-- ============================================

-- Get evidence summary for a case
CREATE OR REPLACE FUNCTION get_case_evidence_summary(case_id_param UUID)
RETURNS TABLE (
    total_items INTEGER,
    in_storage INTEGER,
    in_analysis INTEGER,
    submitted_to_court INTEGER,
    by_type JSONB,
    total_custody_transfers INTEGER,
    avg_transfers_per_item DECIMAL
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER AS total_items,
        COUNT(*) FILTER (WHERE status = 'in_storage')::INTEGER AS in_storage,
        COUNT(*) FILTER (WHERE status = 'in_analysis')::INTEGER AS in_analysis,
        COUNT(*) FILTER (WHERE status = 'submitted_to_court')::INTEGER AS submitted_to_court,
        jsonb_object_agg(
            evidence_type,
            type_count
        ) AS by_type,
        SUM(jsonb_array_length(chain_of_custody))::INTEGER AS total_custody_transfers,
        AVG(jsonb_array_length(chain_of_custody))::DECIMAL AS avg_transfers_per_item
    FROM public.evidence_items e
    LEFT JOIN (
        SELECT evidence_type, COUNT(*) AS type_count
        FROM public.evidence_items
        WHERE case_id = case_id_param
        GROUP BY evidence_type
    ) type_counts USING (evidence_type)
    WHERE e.case_id = case_id_param;
END;
$$;

-- Search evidence by description or custodian
CREATE OR REPLACE FUNCTION search_evidence(
    case_id_param UUID,
    search_text TEXT
)
RETURNS SETOF public.evidence_items
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM public.evidence_items
    WHERE case_id = case_id_param
      AND (
          to_tsvector('english', description) @@ plainto_tsquery('english', search_text)
          OR current_custodian ILIKE '%' || search_text || '%'
          OR evidence_number ILIKE '%' || search_text || '%'
      )
    ORDER BY collected_at DESC;
END;
$$;

-- Get evidence custody timeline
CREATE OR REPLACE FUNCTION get_evidence_timeline(evidence_id_param UUID)
RETURNS TABLE (
    event_time TIMESTAMPTZ,
    event_type TEXT,
    event_description TEXT,
    actor TEXT,
    location TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        (event->>'timestamp')::TIMESTAMPTZ AS event_time,
        'transfer' AS event_type,
        'Transferred from ' || (event->>'fromPerson') || ' to ' || (event->>'toPerson') AS event_description,
        event->>'toPerson' AS actor,
        event->>'toLocation' AS location
    FROM public.evidence_items,
         jsonb_array_elements(chain_of_custody) AS event
    WHERE id = evidence_id_param
    UNION ALL
    SELECT
        (analysis->>'timestamp')::TIMESTAMPTZ AS event_time,
        'analysis' AS event_type,
        (analysis->>'analysisType') || ' performed' AS event_description,
        analysis->>'performedBy' AS actor,
        analysis->>'facility' AS location
    FROM public.evidence_items,
         jsonb_array_elements(analysis_history) AS analysis
    WHERE id = evidence_id_param
    ORDER BY event_time;
END;
$$;

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.evidence_items IS 'Stores physical and digital evidence with complete chain of custody tracking';
COMMENT ON COLUMN public.evidence_items.chain_of_custody IS 'Array of custody transfer events';
COMMENT ON COLUMN public.evidence_items.analysis_history IS 'Array of analysis/testing events';
COMMENT ON FUNCTION get_case_evidence_summary IS 'Returns aggregate statistics for evidence in a case';
COMMENT ON FUNCTION get_evidence_timeline IS 'Returns chronological timeline of all evidence handling events';
