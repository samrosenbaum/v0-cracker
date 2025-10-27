-- FreshEyes Intelligence Platform - Supabase Database Migration
-- Copy and paste this into your Supabase SQL Editor
-- Go to: https://app.supabase.com/project/YOUR_PROJECT/sql/new

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Agencies table
CREATE TABLE IF NOT EXISTS public.agencies (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Insert default agency FIRST (before other tables reference it)
INSERT INTO public.agencies (id, name, slug)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Agency', 'default')
ON CONFLICT (id) DO NOTHING;

-- Agency members (users belonging to agencies)
CREATE TABLE IF NOT EXISTS public.agency_members (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    agency_id UUID REFERENCES public.agencies(id) ON DELETE CASCADE NOT NULL,
    role TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    PRIMARY KEY (user_id, agency_id)
);

-- Cases table
CREATE TABLE IF NOT EXISTS public.cases (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'active' NOT NULL,
    priority TEXT DEFAULT 'medium' NOT NULL,
    agency_id UUID REFERENCES public.agencies(id) DEFAULT '00000000-0000-0000-0000-000000000000'::UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    "assignedTo" TEXT,
    ai_prompt TEXT,
    "lastUpdated" TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Case files
CREATE TABLE IF NOT EXISTS public.case_files (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    storage_path TEXT,
    checksum TEXT,
    notes TEXT,
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Case documents
CREATE TABLE IF NOT EXISTS public.case_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    file_name TEXT NOT NULL,
    document_type TEXT NOT NULL,
    storage_path TEXT,
    metadata JSONB DEFAULT '{}'::JSONB,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Case analysis
CREATE TABLE IF NOT EXISTS public.case_analysis (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    analysis_type TEXT NOT NULL,
    analysis_data JSONB NOT NULL,
    confidence_score NUMERIC(5,2),
    used_prompt TEXT,
    agency_id UUID REFERENCES public.agencies(id) DEFAULT '00000000-0000-0000-0000-000000000000'::UUID NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Suspects
CREATE TABLE IF NOT EXISTS public.suspects (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    analysis_id UUID REFERENCES public.case_analysis(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    alias TEXT,
    description TEXT,
    location TEXT,
    confidence NUMERIC(5,2),
    priority TEXT DEFAULT 'medium' NOT NULL,
    status TEXT DEFAULT 'active' NOT NULL,
    evidence JSONB DEFAULT '{}'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Evidence events
CREATE TABLE IF NOT EXISTS public.evidence_events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    type TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT,
    location TEXT,
    personnel TEXT,
    sample_id TEXT,
    status TEXT,
    priority TEXT,
    tags TEXT[],
    related_events TEXT[],
    user_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Quality flags
CREATE TABLE IF NOT EXISTS public.quality_flags (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    analysis_id UUID REFERENCES public.case_analysis(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('low_confidence', 'no_suspects', 'missing_data', 'inconsistency', 'incomplete_analysis')),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'reviewed', 'resolved', 'dismissed')),
    title TEXT NOT NULL,
    description TEXT,
    recommendation TEXT,
    affected_findings TEXT[] DEFAULT ARRAY[]::TEXT[],
    metadata JSONB DEFAULT '{}'::JSONB,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cases_agency_id ON public.cases(agency_id);
CREATE INDEX IF NOT EXISTS idx_cases_user_id ON public.cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_status ON public.cases(status);
CREATE INDEX IF NOT EXISTS idx_cases_priority ON public.cases(priority);

CREATE INDEX IF NOT EXISTS idx_case_files_case_id ON public.case_files(case_id);
CREATE INDEX IF NOT EXISTS idx_case_documents_case_id ON public.case_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_case_analysis_case_id ON public.case_analysis(case_id);
CREATE INDEX IF NOT EXISTS idx_suspects_case_id ON public.suspects(case_id);
CREATE INDEX IF NOT EXISTS idx_evidence_events_case_id ON public.evidence_events(case_id);
CREATE INDEX IF NOT EXISTS idx_quality_flags_case_id ON public.quality_flags(case_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.agencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suspects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_flags ENABLE ROW LEVEL SECURITY;

-- Agencies policies
CREATE POLICY "Users can view their agencies" ON public.agencies
    FOR SELECT USING (
        id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
    );

-- Agency members policies
CREATE POLICY "Users can view their agency memberships" ON public.agency_members
    FOR SELECT USING (user_id = auth.uid());

-- Cases policies
CREATE POLICY "Users can view cases from their agency" ON public.cases
    FOR SELECT USING (
        agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can insert cases to their agency" ON public.cases
    FOR INSERT WITH CHECK (
        agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        AND user_id = auth.uid()
    );

CREATE POLICY "Users can update cases in their agency" ON public.cases
    FOR UPDATE USING (
        agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can delete their own cases" ON public.cases
    FOR DELETE USING (user_id = auth.uid());

-- Case files policies
CREATE POLICY "Users can view case files from their agency cases" ON public.case_files
    FOR SELECT USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert case files to their agency cases" ON public.case_files
    FOR INSERT WITH CHECK (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

-- Case documents policies
CREATE POLICY "Users can view case documents from their agency cases" ON public.case_documents
    FOR SELECT USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert case documents to their agency cases" ON public.case_documents
    FOR INSERT WITH CHECK (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

-- Case analysis policies
CREATE POLICY "Users can view analysis from their agency cases" ON public.case_analysis
    FOR SELECT USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can insert analysis to their agency cases" ON public.case_analysis
    FOR INSERT WITH CHECK (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

-- Suspects policies
CREATE POLICY "Users can view suspects from their agency cases" ON public.suspects
    FOR SELECT USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage suspects in their agency cases" ON public.suspects
    FOR ALL USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

-- Evidence events policies
CREATE POLICY "Users can view evidence events from their agency cases" ON public.evidence_events
    FOR SELECT USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage evidence events in their agency cases" ON public.evidence_events
    FOR ALL USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

-- Quality flags policies
CREATE POLICY "Users can view quality flags from their agency cases" ON public.quality_flags
    FOR SELECT USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

CREATE POLICY "Users can manage quality flags in their agency cases" ON public.quality_flags
    FOR ALL USING (
        case_id IN (
            SELECT id FROM public.cases
            WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
        )
    );

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get current user's agency ID
CREATE OR REPLACE FUNCTION public.current_agency_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN (
        SELECT agency_id
        FROM public.agency_members
        WHERE user_id = auth.uid()
        LIMIT 1
    );
END;
$$;

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.agencies
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.cases
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.case_files
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.case_documents
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.case_analysis
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.suspects
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.evidence_events
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.quality_flags
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- STORAGE BUCKETS (Run this in the Supabase Storage section)
-- ============================================================================

-- Note: Storage buckets should be created via the Supabase UI or Storage API
-- Go to: https://app.supabase.com/project/YOUR_PROJECT/storage/buckets
-- Create a bucket named: "case-files"
-- Set it to private (not public)

-- Then run this SQL to set up storage policies:
-- CREATE POLICY "Users can upload case files to their agency cases"
-- ON storage.objects FOR INSERT
-- WITH CHECK (
--     bucket_id = 'case-files' AND
--     (storage.foldername(name))[1] IN (
--         SELECT id::text FROM public.cases
--         WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
--     )
-- );

-- CREATE POLICY "Users can view case files from their agency"
-- ON storage.objects FOR SELECT
-- USING (
--     bucket_id = 'case-files' AND
--     (storage.foldername(name))[1] IN (
--         SELECT id::text FROM public.cases
--         WHERE agency_id IN (SELECT agency_id FROM public.agency_members WHERE user_id = auth.uid())
--     )
-- );
