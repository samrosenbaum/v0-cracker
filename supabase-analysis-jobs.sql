-- ============================================================================
-- ANALYSIS JOBS TABLE
-- ============================================================================
-- This table tracks background analysis jobs triggered by users.
-- Jobs are processed asynchronously by Inngest workers to avoid API timeouts.
--
-- Usage:
-- 1. User clicks "Run Analysis"
-- 2. API creates a job record with status='pending'
-- 3. API triggers Inngest event and returns jobId immediately
-- 4. Frontend polls GET /api/analysis-jobs/[jobId] for status
-- 5. Inngest worker processes job and updates status to 'completed' or 'failed'
-- ============================================================================

CREATE TABLE IF NOT EXISTS analysis_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,

  -- Job configuration
  job_type TEXT NOT NULL CHECK (job_type IN ('timeline', 'deep-analysis', 'victim-timeline')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),

  -- Results and errors
  result JSONB,
  error_message TEXT,

  -- Progress tracking (0-100)
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  current_step TEXT,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Additional metadata (victim info, options, etc.)
  metadata JSONB DEFAULT '{}'::JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_case_id ON analysis_jobs(case_id);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_status ON analysis_jobs(status);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_created_at ON analysis_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analysis_jobs_case_status ON analysis_jobs(case_id, status);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_analysis_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER analysis_jobs_updated_at
  BEFORE UPDATE ON analysis_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_analysis_jobs_updated_at();

-- RLS Policies (Row Level Security)
ALTER TABLE analysis_jobs ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view jobs for their cases
CREATE POLICY "Users can view analysis jobs for their cases"
  ON analysis_jobs
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can create analysis jobs
CREATE POLICY "Users can create analysis jobs"
  ON analysis_jobs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Service role can do everything (for Inngest workers)
CREATE POLICY "Service role can manage all analysis jobs"
  ON analysis_jobs
  FOR ALL
  TO service_role
  USING (true);

-- Comments for documentation
COMMENT ON TABLE analysis_jobs IS 'Background jobs for AI analysis operations (timeline, deep-analysis, victim-timeline)';
COMMENT ON COLUMN analysis_jobs.job_type IS 'Type of analysis: timeline, deep-analysis, or victim-timeline';
COMMENT ON COLUMN analysis_jobs.status IS 'Job status: pending, running, completed, failed, or cancelled';
COMMENT ON COLUMN analysis_jobs.result IS 'Analysis results as JSON (saved when status=completed)';
COMMENT ON COLUMN analysis_jobs.error_message IS 'Error details (saved when status=failed)';
COMMENT ON COLUMN analysis_jobs.progress IS 'Percentage complete (0-100) for UI progress bars';
COMMENT ON COLUMN analysis_jobs.current_step IS 'Human-readable current operation (e.g., "Extracting documents", "Running AI analysis")';
COMMENT ON COLUMN analysis_jobs.metadata IS 'Additional job parameters (victim info for victim-timeline, etc.)';
