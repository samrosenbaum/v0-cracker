-- Clear Document Chunks and Extracted Text to Force Re-processing
--
-- This script clears bad chunk data and extracted text fields so documents
-- can be re-processed with the fixed PDF extraction logic.
--
-- Usage: Run this in your Supabase SQL editor, then re-populate the board

-- Step 1: Clear all document chunks (forces fresh extraction)
DELETE FROM document_chunks;

-- Step 2: Clear extracted text from case_files (forces re-aggregation)
UPDATE case_files
SET
  ai_extracted_text = NULL,
  ai_analyzed = FALSE,
  ai_analysis_confidence = NULL
WHERE ai_extracted_text IS NOT NULL;

-- Step 3: Reset processing jobs
UPDATE processing_jobs
SET
  status = 'pending',
  completed_at = NULL,
  error_log = NULL
WHERE status IN ('completed', 'failed');

-- Step 4: Clear investigation board data (will be repopulated)
DELETE FROM case_entities;
DELETE FROM timeline_events;
DELETE FROM case_connections;
DELETE FROM alibi_entries;

-- Verify the cleanup
SELECT
  (SELECT COUNT(*) FROM document_chunks) as chunk_count,
  (SELECT COUNT(*) FROM case_files WHERE ai_extracted_text IS NOT NULL) as extracted_files,
  (SELECT COUNT(*) FROM case_entities) as entity_count,
  (SELECT COUNT(*) FROM timeline_events) as timeline_count;

-- Expected output: All counts should be 0
