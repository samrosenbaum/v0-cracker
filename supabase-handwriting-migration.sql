-- ============================================================================
-- HANDWRITING DIGITIZATION SYSTEM MIGRATION
-- ============================================================================
-- This migration adds support for specialized handwriting recognition,
-- writer profile calibration, and enhanced document review for cold case files.
-- ============================================================================

-- ============================================================================
-- WRITER PROFILES TABLE
-- Stores calibration data for recurring writers (officers, witnesses, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS writer_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,

  -- Writer identification
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100), -- e.g., "Investigating Officer", "Witness", "Coroner"
  description TEXT,

  -- Calibration data
  sample_count INTEGER DEFAULT 0,
  average_confidence DECIMAL(5, 4) DEFAULT 0,
  characteristic_patterns JSONB DEFAULT '[]'::JSONB,
  known_quirks TEXT[] DEFAULT '{}',
  calibrated BOOLEAN DEFAULT FALSE,
  last_calibrated_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for case-based queries
CREATE INDEX IF NOT EXISTS idx_writer_profiles_case_id ON writer_profiles(case_id);
CREATE INDEX IF NOT EXISTS idx_writer_profiles_calibrated ON writer_profiles(calibrated);

-- ============================================================================
-- WRITER PROFILE SAMPLES TABLE
-- Stores verified text samples used for calibration
-- ============================================================================

CREATE TABLE IF NOT EXISTS writer_profile_samples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES writer_profiles(id) ON DELETE CASCADE,

  -- Sample data
  storage_path TEXT NOT NULL,
  verified_text TEXT NOT NULL,
  document_type VARCHAR(100),

  -- Quality metrics
  extraction_confidence DECIMAL(5, 4),
  pattern_contributions JSONB DEFAULT '{}'::JSONB,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_writer_profile_samples_profile ON writer_profile_samples(profile_id);

-- ============================================================================
-- HANDWRITING EXTRACTIONS TABLE
-- Stores extraction history and results for handwritten documents
-- ============================================================================

CREATE TABLE IF NOT EXISTS handwriting_extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES case_documents(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE CASCADE,

  -- Extraction results
  extracted_text TEXT,
  confidence DECIMAL(5, 4),
  method VARCHAR(50), -- 'handwriting-claude-vision', 'handwriting-tesseract', 'handwriting-hybrid'

  -- Handwriting analysis
  handwriting_analysis JSONB DEFAULT '{}'::JSONB,
  /*
    {
      "writingStyle": "cursive|print|mixed|block",
      "legibilityScore": 0.0-1.0,
      "estimatedEra": "1970s",
      "writingInstrument": "pen|pencil|marker|typewriter",
      "documentCondition": "excellent|good|fair|poor|damaged",
      "degradationFactors": ["fading", "stains", "tears"],
      "languageDetected": "en",
      "specialCharacteristics": ["left-handed slant", "unusual 'g' formation"]
    }
  */

  -- Line-by-line extraction for detailed review
  line_by_line_extraction JSONB DEFAULT '[]'::JSONB,
  /*
    [
      {
        "lineNumber": 1,
        "text": "...",
        "confidence": 0.85,
        "needsReview": false,
        "wordExtractions": [...]
      }
    ]
  */

  -- Uncertain segments requiring review
  uncertain_segments JSONB DEFAULT '[]'::JSONB,
  alternative_readings JSONB DEFAULT '[]'::JSONB,

  -- Structured data extracted
  structured_data JSONB DEFAULT '{}'::JSONB,

  -- Processing metadata
  preprocessing_applied JSONB DEFAULT '[]'::JSONB,
  writer_profile_id UUID REFERENCES writer_profiles(id) ON DELETE SET NULL,
  needs_review BOOLEAN DEFAULT FALSE,

  -- Timestamps
  extracted_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_handwriting_extractions_document ON handwriting_extractions(document_id);
CREATE INDEX IF NOT EXISTS idx_handwriting_extractions_case ON handwriting_extractions(case_id);
CREATE INDEX IF NOT EXISTS idx_handwriting_extractions_needs_review ON handwriting_extractions(needs_review);
CREATE INDEX IF NOT EXISTS idx_handwriting_extractions_confidence ON handwriting_extractions(confidence);

-- ============================================================================
-- ENHANCE DOCUMENT REVIEW QUEUE FOR HANDWRITING
-- Add handwriting-specific columns to the existing review queue
-- ============================================================================

-- Add new columns if they don't exist
DO $$
BEGIN
  -- Add review_type column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_review_queue' AND column_name = 'review_type'
  ) THEN
    ALTER TABLE document_review_queue ADD COLUMN review_type VARCHAR(50) DEFAULT 'ocr';
  END IF;

  -- Add handwriting_analysis column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_review_queue' AND column_name = 'handwriting_analysis'
  ) THEN
    ALTER TABLE document_review_queue ADD COLUMN handwriting_analysis JSONB DEFAULT '{}'::JSONB;
  END IF;

  -- Add line_by_line_extraction column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_review_queue' AND column_name = 'line_by_line_extraction'
  ) THEN
    ALTER TABLE document_review_queue ADD COLUMN line_by_line_extraction JSONB DEFAULT '[]'::JSONB;
  END IF;

  -- Add alternative_readings column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_review_queue' AND column_name = 'alternative_readings'
  ) THEN
    ALTER TABLE document_review_queue ADD COLUMN alternative_readings JSONB DEFAULT '[]'::JSONB;
  END IF;

  -- Add writer_profile_id column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_review_queue' AND column_name = 'writer_profile_id'
  ) THEN
    ALTER TABLE document_review_queue ADD COLUMN writer_profile_id UUID REFERENCES writer_profiles(id) ON DELETE SET NULL;
  END IF;

  -- Add corrected_text column for storing reviewer corrections
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_review_queue' AND column_name = 'corrected_text'
  ) THEN
    ALTER TABLE document_review_queue ADD COLUMN corrected_text TEXT;
  END IF;

  -- Add correction_log column for tracking changes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'document_review_queue' AND column_name = 'correction_log'
  ) THEN
    ALTER TABLE document_review_queue ADD COLUMN correction_log JSONB DEFAULT '[]'::JSONB;
  END IF;
END $$;

-- Index for review type
CREATE INDEX IF NOT EXISTS idx_document_review_queue_type ON document_review_queue(review_type);

-- ============================================================================
-- ADD HANDWRITING COLUMNS TO CASE_DOCUMENTS
-- ============================================================================

DO $$
BEGIN
  -- Add handwriting_analysis column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_documents' AND column_name = 'handwriting_analysis'
  ) THEN
    ALTER TABLE case_documents ADD COLUMN handwriting_analysis JSONB DEFAULT '{}'::JSONB;
  END IF;

  -- Add is_handwritten flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_documents' AND column_name = 'is_handwritten'
  ) THEN
    ALTER TABLE case_documents ADD COLUMN is_handwritten BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add writer_profile_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'case_documents' AND column_name = 'writer_profile_id'
  ) THEN
    ALTER TABLE case_documents ADD COLUMN writer_profile_id UUID REFERENCES writer_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- HANDWRITING REVIEW CORRECTIONS TABLE
-- Tracks all corrections made during review for audit and training
-- ============================================================================

CREATE TABLE IF NOT EXISTS handwriting_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  extraction_id UUID REFERENCES handwriting_extractions(id) ON DELETE CASCADE,
  document_id UUID REFERENCES case_documents(id) ON DELETE CASCADE,

  -- Correction details
  original_text TEXT NOT NULL,
  corrected_text TEXT NOT NULL,
  correction_type VARCHAR(50), -- 'word', 'line', 'segment', 'full'

  -- Position information
  line_number INTEGER,
  word_index INTEGER,
  character_range INT4RANGE,

  -- Context
  surrounding_context TEXT,
  confidence_before DECIMAL(5, 4),
  confidence_after DECIMAL(5, 4) DEFAULT 1.0, -- Human-verified

  -- Reviewer info
  corrected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  corrected_at TIMESTAMPTZ DEFAULT NOW(),

  -- For training writer profiles
  used_for_calibration BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_handwriting_corrections_extraction ON handwriting_corrections(extraction_id);
CREATE INDEX IF NOT EXISTS idx_handwriting_corrections_document ON handwriting_corrections(document_id);

-- ============================================================================
-- DOCUMENT ERA ESTIMATES TABLE
-- Stores AI-estimated document ages for context
-- ============================================================================

CREATE TABLE IF NOT EXISTS document_era_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID UNIQUE REFERENCES case_documents(id) ON DELETE CASCADE,

  -- Era estimation
  estimated_era VARCHAR(50), -- e.g., "1970s", "1980s-1990s"
  confidence DECIMAL(5, 4),
  indicators TEXT[], -- Visual clues used

  -- Estimation method
  estimation_method VARCHAR(50), -- 'claude-vision', 'metadata', 'user-provided'

  -- Timestamps
  estimated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_era_estimates_document ON document_era_estimates(document_id);

-- ============================================================================
-- VIEWS FOR HANDWRITING REVIEW DASHBOARD
-- ============================================================================

-- View: Pending handwriting reviews with priority ranking
CREATE OR REPLACE VIEW v_handwriting_review_queue AS
SELECT
  drq.id AS review_id,
  drq.document_id,
  drq.case_id,
  cd.file_name,
  cd.storage_path,
  cd.document_type,
  drq.extracted_text,
  drq.overall_confidence,
  drq.uncertain_segments,
  drq.alternative_readings,
  drq.line_by_line_extraction,
  drq.handwriting_analysis,
  drq.priority,
  drq.status,
  drq.assigned_to,
  drq.created_at,
  drq.updated_at,
  wp.name AS writer_name,
  wp.role AS writer_role,
  c.title AS case_title,
  c.case_number
FROM document_review_queue drq
JOIN case_documents cd ON drq.document_id = cd.id
JOIN cases c ON drq.case_id = c.id
LEFT JOIN writer_profiles wp ON drq.writer_profile_id = wp.id
WHERE drq.review_type = 'handwriting'
  AND drq.status IN ('pending', 'in_review')
ORDER BY drq.priority DESC, drq.created_at ASC;

-- View: Handwriting extraction statistics per case
CREATE OR REPLACE VIEW v_case_handwriting_stats AS
SELECT
  c.id AS case_id,
  c.title AS case_title,
  c.case_number,
  COUNT(DISTINCT cd.id) FILTER (WHERE cd.is_handwritten = TRUE) AS handwritten_documents,
  COUNT(DISTINCT he.id) AS total_extractions,
  AVG(he.confidence) AS avg_confidence,
  COUNT(DISTINCT he.id) FILTER (WHERE he.needs_review = TRUE) AS pending_review,
  COUNT(DISTINCT he.id) FILTER (WHERE he.reviewed_at IS NOT NULL) AS reviewed,
  COUNT(DISTINCT wp.id) AS writer_profiles,
  MAX(he.extracted_at) AS last_extraction
FROM cases c
LEFT JOIN case_documents cd ON c.id = cd.case_id
LEFT JOIN handwriting_extractions he ON cd.id = he.document_id
LEFT JOIN writer_profiles wp ON c.id = wp.case_id
GROUP BY c.id, c.title, c.case_number;

-- View: Writer profile effectiveness
CREATE OR REPLACE VIEW v_writer_profile_effectiveness AS
SELECT
  wp.id AS profile_id,
  wp.name,
  wp.role,
  wp.case_id,
  wp.sample_count,
  wp.average_confidence AS profile_confidence,
  wp.calibrated,
  COUNT(DISTINCT he.id) AS documents_processed,
  AVG(he.confidence) AS extraction_avg_confidence,
  COUNT(DISTINCT hc.id) AS corrections_made,
  wp.created_at,
  wp.last_calibrated_at
FROM writer_profiles wp
LEFT JOIN handwriting_extractions he ON wp.id = he.writer_profile_id
LEFT JOIN handwriting_corrections hc ON he.id = hc.extraction_id
GROUP BY wp.id, wp.name, wp.role, wp.case_id, wp.sample_count,
         wp.average_confidence, wp.calibrated, wp.created_at, wp.last_calibrated_at;

-- ============================================================================
-- FUNCTIONS FOR HANDWRITING PROCESSING
-- ============================================================================

-- Function: Get next document for review based on priority and assignment
CREATE OR REPLACE FUNCTION get_next_handwriting_review(
  p_user_id UUID DEFAULT NULL,
  p_case_id UUID DEFAULT NULL
)
RETURNS TABLE (
  review_id UUID,
  document_id UUID,
  case_id UUID,
  file_name TEXT,
  storage_path TEXT,
  extracted_text TEXT,
  confidence DECIMAL,
  uncertain_segments JSONB,
  handwriting_analysis JSONB,
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    drq.id,
    drq.document_id,
    drq.case_id,
    cd.file_name,
    cd.storage_path,
    drq.extracted_text,
    drq.overall_confidence,
    drq.uncertain_segments,
    drq.handwriting_analysis,
    drq.priority
  FROM document_review_queue drq
  JOIN case_documents cd ON drq.document_id = cd.id
  WHERE drq.review_type = 'handwriting'
    AND drq.status = 'pending'
    AND (p_case_id IS NULL OR drq.case_id = p_case_id)
    AND (drq.assigned_to IS NULL OR drq.assigned_to = p_user_id)
  ORDER BY drq.priority DESC, drq.created_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate review priority based on document characteristics
CREATE OR REPLACE FUNCTION calculate_handwriting_priority(
  p_confidence DECIMAL,
  p_uncertain_count INTEGER,
  p_is_key_document BOOLEAN DEFAULT FALSE
)
RETURNS INTEGER AS $$
DECLARE
  v_priority INTEGER := 5;
BEGIN
  -- Base priority on confidence
  IF p_confidence < 0.5 THEN
    v_priority := 10;
  ELSIF p_confidence < 0.6 THEN
    v_priority := 8;
  ELSIF p_confidence < 0.7 THEN
    v_priority := 6;
  END IF;

  -- Adjust for uncertain segments
  IF p_uncertain_count > 10 THEN
    v_priority := GREATEST(v_priority, 9);
  ELSIF p_uncertain_count > 5 THEN
    v_priority := GREATEST(v_priority, 7);
  END IF;

  -- Boost for key documents
  IF p_is_key_document THEN
    v_priority := LEAST(v_priority + 2, 10);
  END IF;

  RETURN v_priority;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE writer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE writer_profile_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE handwriting_extractions ENABLE ROW LEVEL SECURITY;
ALTER TABLE handwriting_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_era_estimates ENABLE ROW LEVEL SECURITY;

-- Basic policies (adjust based on your auth model)
CREATE POLICY "Users can view writer profiles for their cases"
  ON writer_profiles FOR SELECT
  USING (TRUE); -- Adjust based on case access

CREATE POLICY "Users can manage writer profiles"
  ON writer_profiles FOR ALL
  USING (TRUE); -- Adjust based on roles

CREATE POLICY "Users can view handwriting extractions"
  ON handwriting_extractions FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can create handwriting extractions"
  ON handwriting_extractions FOR INSERT
  WITH CHECK (TRUE);

CREATE POLICY "Users can update handwriting extractions"
  ON handwriting_extractions FOR UPDATE
  USING (TRUE);

CREATE POLICY "Users can view corrections"
  ON handwriting_corrections FOR SELECT
  USING (TRUE);

CREATE POLICY "Users can create corrections"
  ON handwriting_corrections FOR INSERT
  WITH CHECK (TRUE);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE writer_profiles IS 'Calibration profiles for recurring writers (officers, witnesses) to improve recognition';
COMMENT ON TABLE writer_profile_samples IS 'Verified text samples used to calibrate writer profiles';
COMMENT ON TABLE handwriting_extractions IS 'Results of handwriting extraction with detailed analysis';
COMMENT ON TABLE handwriting_corrections IS 'Human corrections to handwriting extractions for audit and training';
COMMENT ON TABLE document_era_estimates IS 'AI-estimated document ages for context in extraction';

COMMENT ON COLUMN writer_profiles.characteristic_patterns IS 'JSON array of character patterns learned from samples';
COMMENT ON COLUMN writer_profiles.known_quirks IS 'Known handwriting quirks like "writes 7s with a cross"';
COMMENT ON COLUMN handwriting_extractions.line_by_line_extraction IS 'Detailed line-by-line extraction with confidence per line';
COMMENT ON COLUMN handwriting_extractions.alternative_readings IS 'Alternative interpretations for ambiguous text';
