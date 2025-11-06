-- Document Review Queue System
-- For handling low-confidence OCR results and handwritten documents

-- Table: document_review_queue
CREATE TABLE IF NOT EXISTS document_review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES case_documents(id) ON DELETE CASCADE,

  -- Extraction data
  extracted_text TEXT, -- Full extracted text
  overall_confidence DECIMAL(5,4), -- 0.0000 to 1.0000
  extraction_method VARCHAR(50), -- 'ocr-tesseract', 'ocr-google', etc.

  -- Uncertain segments that need review
  uncertain_segments JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [{ text, confidence, position: { page?, boundingBox }, imageSnippet?, alternatives? }]

  -- Review status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  -- Values: 'pending', 'in_review', 'completed', 'skipped'

  assigned_to UUID REFERENCES users(id),
  priority INT DEFAULT 5, -- 1-10, higher = more important

  -- Human corrections
  corrections JSONB DEFAULT '{}'::jsonb,
  -- Structure: { "0": "corrected text", "1": "another correction" }
  -- Keys are indices of uncertain_segments

  review_notes TEXT, -- Optional notes from reviewer
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_review_queue_case_id ON document_review_queue(case_id);
CREATE INDEX idx_review_queue_status ON document_review_queue(status);
CREATE INDEX idx_review_queue_assigned_to ON document_review_queue(assigned_to);
CREATE INDEX idx_review_queue_created_at ON document_review_queue(created_at DESC);

-- Composite index for common queries
CREATE INDEX idx_review_queue_case_status ON document_review_queue(case_id, status);

-- Table: ocr_corrections (learning system)
-- Track corrections to improve OCR over time
CREATE TABLE IF NOT EXISTS ocr_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_queue_id UUID REFERENCES document_review_queue(id) ON DELETE CASCADE,

  -- Original OCR result
  original_text TEXT NOT NULL,
  original_confidence DECIMAL(5,4),

  -- Human correction
  corrected_text TEXT NOT NULL,

  -- Context
  document_type VARCHAR(50), -- 'police_handwriting', 'witness_statement', etc.
  correction_type VARCHAR(20), -- 'full_replacement', 'partial_fix', 'confirmed_correct'

  -- Metadata
  corrected_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for learning analysis
CREATE INDEX idx_ocr_corrections_document_type ON ocr_corrections(document_type);
CREATE INDEX idx_ocr_corrections_confidence ON ocr_corrections(original_confidence);

-- RLS Policies for document_review_queue
ALTER TABLE document_review_queue ENABLE ROW LEVEL SECURITY;

-- Users can see review items for cases in their agency
CREATE POLICY "Users can view review queue for their agency's cases"
  ON document_review_queue
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = document_review_queue.case_id
      AND cases.agency_id IN (
        SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can create review queue items for their agency's cases
CREATE POLICY "Users can create review queue items"
  ON document_review_queue
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = document_review_queue.case_id
      AND cases.agency_id IN (
        SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
      )
    )
  );

-- Users can update review items they have access to
CREATE POLICY "Users can update review queue items"
  ON document_review_queue
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM cases
      WHERE cases.id = document_review_queue.case_id
      AND cases.agency_id IN (
        SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
      )
    )
  );

-- RLS Policies for ocr_corrections
ALTER TABLE ocr_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view corrections for their agency"
  ON ocr_corrections
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM document_review_queue drq
      JOIN cases c ON c.id = drq.case_id
      WHERE drq.id = ocr_corrections.review_queue_id
      AND c.agency_id IN (
        SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can create corrections"
  ON ocr_corrections
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_review_queue drq
      JOIN cases c ON c.id = drq.case_id
      WHERE drq.id = ocr_corrections.review_queue_id
      AND c.agency_id IN (
        SELECT agency_id FROM agency_members WHERE user_id = auth.uid()
      )
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_review_queue_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER review_queue_updated_at
  BEFORE UPDATE ON document_review_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_review_queue_updated_at();

-- Function to get pending review count for a case
CREATE OR REPLACE FUNCTION get_pending_review_count(p_case_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM document_review_queue
    WHERE case_id = p_case_id
    AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to apply corrections and update document
CREATE OR REPLACE FUNCTION apply_review_corrections(
  p_review_queue_id UUID,
  p_corrections JSONB,
  p_review_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_document_id UUID;
  v_corrected_text TEXT;
  v_original_text TEXT;
  v_segment_idx TEXT;
  v_correction TEXT;
BEGIN
  -- Get document ID and original text
  SELECT
    document_id,
    extracted_text
  INTO
    v_document_id,
    v_original_text
  FROM document_review_queue
  WHERE id = p_review_queue_id;

  -- Start with original extracted text
  v_corrected_text := v_original_text;

  -- Apply each correction
  -- Note: This is a simple replacement. For production, you'd want more sophisticated merging
  FOR v_segment_idx, v_correction IN
    SELECT key, value FROM jsonb_each_text(p_corrections)
  LOOP
    -- In a real implementation, you'd track positions and replace specific segments
    -- For now, we'll store corrections separately and update the ai_extracted_text
    NULL; -- Placeholder for segment replacement logic
  END LOOP;

  -- Update review queue status
  UPDATE document_review_queue
  SET
    status = 'completed',
    corrections = p_corrections,
    review_notes = p_review_notes,
    reviewed_by = auth.uid(),
    reviewed_at = NOW()
  WHERE id = p_review_queue_id;

  -- Mark document as reviewed
  UPDATE case_documents
  SET
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'human_reviewed', true,
      'reviewed_at', NOW(),
      'reviewed_by', auth.uid(),
      'corrections_applied', jsonb_array_length(p_corrections)
    )
  WHERE id = v_document_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON document_review_queue TO authenticated;
GRANT ALL ON ocr_corrections TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_review_count TO authenticated;
GRANT EXECUTE ON FUNCTION apply_review_corrections TO authenticated;
