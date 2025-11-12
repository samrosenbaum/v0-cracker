-- Migration for document chunking and parallel processing system
-- This enables handling thousands of pages without data loss

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================
-- TABLE: processing_jobs
-- Tracks overall document processing jobs
-- ============================================
CREATE TABLE IF NOT EXISTS public.processing_jobs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_id UUID REFERENCES public.cases(id) ON DELETE CASCADE NOT NULL,
    job_type TEXT NOT NULL CHECK (job_type IN ('document_extraction', 'ai_analysis', 'embedding_generation')),
    total_units INTEGER NOT NULL DEFAULT 0,
    completed_units INTEGER NOT NULL DEFAULT 0,
    failed_units INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    progress_percentage DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE
            WHEN total_units > 0 THEN (completed_units::DECIMAL / total_units::DECIMAL * 100)
            ELSE 0
        END
    ) STORED,
    estimated_completion TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_summary JSONB DEFAULT '{}'::JSONB,
    metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- ============================================
-- TABLE: document_chunks
-- Stores individual pages/chunks with embeddings
-- ============================================
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    case_file_id UUID REFERENCES public.case_files(id) ON DELETE CASCADE NOT NULL,
    processing_job_id UUID REFERENCES public.processing_jobs(id) ON DELETE SET NULL,
    chunk_index INTEGER NOT NULL,
    chunk_type TEXT NOT NULL DEFAULT 'page' CHECK (chunk_type IN ('page', 'section', 'paragraph', 'sliding-window')),
    content TEXT,
    content_embedding VECTOR(1536), -- OpenAI text-embedding-3-small dimension
    content_length INTEGER GENERATED ALWAYS AS (LENGTH(content)) STORED,
    extraction_confidence DECIMAL(5,2) CHECK (extraction_confidence >= 0 AND extraction_confidence <= 1),
    extraction_method TEXT CHECK (extraction_method IN ('pdf-parse', 'pdfjs-dist', 'ocr-tesseract', 'ocr-google', 'whisper-transcription', 'direct-read', 'cached')),
    metadata JSONB DEFAULT '{}'::JSONB, -- {pageNumber, startChar, endChar, bbox, language, etc}
    processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    processing_attempts INTEGER NOT NULL DEFAULT 0,
    error_log TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Ensure no duplicate chunks for the same file
    UNIQUE(case_file_id, chunk_index, chunk_type)
);

-- ============================================
-- INDEXES for performance
-- ============================================

-- Processing jobs indexes
CREATE INDEX idx_processing_jobs_case_id ON public.processing_jobs(case_id);
CREATE INDEX idx_processing_jobs_status ON public.processing_jobs(status);
CREATE INDEX idx_processing_jobs_type ON public.processing_jobs(job_type);
CREATE INDEX idx_processing_jobs_created ON public.processing_jobs(created_at DESC);

-- Document chunks indexes
CREATE INDEX idx_document_chunks_case_file ON public.document_chunks(case_file_id);
CREATE INDEX idx_document_chunks_job ON public.document_chunks(processing_job_id);
CREATE INDEX idx_document_chunks_status ON public.document_chunks(processing_status);
CREATE INDEX idx_document_chunks_type ON public.document_chunks(chunk_type);
CREATE INDEX idx_document_chunks_index ON public.document_chunks(case_file_id, chunk_index);

-- Vector similarity search index (using IVFFlat for performance)
-- This index enables fast semantic search across document chunks
CREATE INDEX idx_document_chunks_embedding ON public.document_chunks
USING ivfflat (content_embedding vector_cosine_ops)
WITH (lists = 100); -- Adjust lists based on dataset size (sqrt of rows is typical)

-- Composite index for pending chunk queries
CREATE INDEX idx_document_chunks_pending ON public.document_chunks(processing_job_id, processing_status)
WHERE processing_status = 'pending';

-- ============================================
-- TRIGGERS for updated_at
-- ============================================
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.processing_jobs
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.document_chunks
FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;

-- Users can view processing jobs for cases in their agency
CREATE POLICY "Users can view processing jobs from their agency cases"
ON public.processing_jobs FOR SELECT
USING (
    case_id IN (
        SELECT id FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

-- Users can insert processing jobs for cases in their agency
CREATE POLICY "Users can create processing jobs for their agency cases"
ON public.processing_jobs FOR INSERT
WITH CHECK (
    case_id IN (
        SELECT id FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

-- Users can update processing jobs for cases in their agency
CREATE POLICY "Users can update processing jobs for their agency cases"
ON public.processing_jobs FOR UPDATE
USING (
    case_id IN (
        SELECT id FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

-- Users can view document chunks from their agency cases
CREATE POLICY "Users can view document chunks from their agency cases"
ON public.document_chunks FOR SELECT
USING (
    case_file_id IN (
        SELECT cf.id FROM public.case_files cf
        JOIN public.cases c ON cf.case_id = c.id
        WHERE c.agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

-- Users can insert document chunks for their agency cases
CREATE POLICY "Users can create document chunks for their agency cases"
ON public.document_chunks FOR INSERT
WITH CHECK (
    case_file_id IN (
        SELECT cf.id FROM public.case_files cf
        JOIN public.cases c ON cf.case_id = c.id
        WHERE c.agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

-- Users can update document chunks for their agency cases
CREATE POLICY "Users can update document chunks for their agency cases"
ON public.document_chunks FOR UPDATE
USING (
    case_file_id IN (
        SELECT cf.id FROM public.case_files cf
        JOIN public.cases c ON cf.case_id = c.id
        WHERE c.agency_id IN (
            SELECT agency_id FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

-- ============================================
-- FUNCTIONS for semantic search
-- ============================================

-- Vector similarity search function
-- Searches document chunks using cosine similarity on embeddings
CREATE OR REPLACE FUNCTION search_document_chunks(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.7,
    match_count INT DEFAULT 20,
    case_id_filter UUID DEFAULT NULL,
    case_file_id_filter UUID DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    case_file_id UUID,
    chunk_index INTEGER,
    chunk_type TEXT,
    content TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        dc.id,
        dc.case_file_id,
        dc.chunk_index,
        dc.chunk_type,
        dc.content,
        dc.metadata,
        1 - (dc.content_embedding <=> query_embedding) AS similarity
    FROM public.document_chunks dc
    JOIN public.case_files cf ON dc.case_file_id = cf.id
    WHERE
        dc.content_embedding IS NOT NULL
        AND dc.processing_status = 'completed'
        AND 1 - (dc.content_embedding <=> query_embedding) > match_threshold
        AND (case_id_filter IS NULL OR cf.case_id = case_id_filter)
        AND (case_file_id_filter IS NULL OR dc.case_file_id = case_file_id_filter)
        -- RLS: Only return chunks from user's agency
        AND cf.case_id IN (
            SELECT c.id FROM public.cases c
            WHERE c.agency_id IN (
                SELECT agency_id FROM public.agency_members
                WHERE user_id = auth.uid()
            )
        )
    ORDER BY dc.content_embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Get processing job statistics
CREATE OR REPLACE FUNCTION get_processing_job_stats(job_id_param UUID)
RETURNS TABLE (
    total_chunks INTEGER,
    completed_chunks INTEGER,
    failed_chunks INTEGER,
    pending_chunks INTEGER,
    processing_chunks INTEGER,
    total_characters BIGINT,
    avg_confidence DECIMAL(5,2),
    progress_pct DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::INTEGER AS total_chunks,
        COUNT(*) FILTER (WHERE processing_status = 'completed')::INTEGER AS completed_chunks,
        COUNT(*) FILTER (WHERE processing_status = 'failed')::INTEGER AS failed_chunks,
        COUNT(*) FILTER (WHERE processing_status = 'pending')::INTEGER AS pending_chunks,
        COUNT(*) FILTER (WHERE processing_status = 'processing')::INTEGER AS processing_chunks,
        SUM(content_length)::BIGINT AS total_characters,
        AVG(extraction_confidence) AS avg_confidence,
        (COUNT(*) FILTER (WHERE processing_status = 'completed')::DECIMAL /
         NULLIF(COUNT(*)::DECIMAL, 0) * 100) AS progress_pct
    FROM public.document_chunks
    WHERE processing_job_id = job_id_param;
END;
$$;

-- Get chunks by case with aggregation
CREATE OR REPLACE FUNCTION get_case_chunks_summary(case_id_param UUID)
RETURNS TABLE (
    total_files INTEGER,
    total_chunks INTEGER,
    completed_chunks INTEGER,
    failed_chunks INTEGER,
    total_characters BIGINT,
    avg_confidence DECIMAL(5,2),
    completion_pct DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT dc.case_file_id)::INTEGER AS total_files,
        COUNT(dc.id)::INTEGER AS total_chunks,
        COUNT(dc.id) FILTER (WHERE dc.processing_status = 'completed')::INTEGER AS completed_chunks,
        COUNT(dc.id) FILTER (WHERE dc.processing_status = 'failed')::INTEGER AS failed_chunks,
        SUM(dc.content_length)::BIGINT AS total_characters,
        AVG(dc.extraction_confidence) AS avg_confidence,
        (COUNT(dc.id) FILTER (WHERE dc.processing_status = 'completed')::DECIMAL /
         NULLIF(COUNT(dc.id)::DECIMAL, 0) * 100) AS completion_pct
    FROM public.document_chunks dc
    JOIN public.case_files cf ON dc.case_file_id = cf.id
    WHERE cf.case_id = case_id_param
        -- RLS: Only count chunks from user's agency
        AND cf.case_id IN (
            SELECT c.id FROM public.cases c
            WHERE c.agency_id IN (
                SELECT agency_id FROM public.agency_members
                WHERE user_id = auth.uid()
            )
        );
END;
$$;

-- ============================================
-- COMMENTS for documentation
-- ============================================
COMMENT ON TABLE public.processing_jobs IS 'Tracks document processing jobs with progress monitoring';
COMMENT ON TABLE public.document_chunks IS 'Stores individual document chunks/pages with embeddings for semantic search';
COMMENT ON COLUMN public.document_chunks.content_embedding IS 'Vector embedding (1536 dimensions) for semantic similarity search using OpenAI text-embedding-3-small';
COMMENT ON INDEX idx_document_chunks_embedding IS 'IVFFlat index for fast vector similarity search using cosine distance';
COMMENT ON FUNCTION search_document_chunks IS 'Performs semantic search across document chunks using vector similarity';
COMMENT ON FUNCTION get_processing_job_stats IS 'Returns statistics for a processing job including chunk counts and progress';
COMMENT ON FUNCTION get_case_chunks_summary IS 'Returns aggregated chunk statistics for a case';
