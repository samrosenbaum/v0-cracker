-- Add AI extraction columns to case_documents table
-- This enables caching of extracted document content

ALTER TABLE case_documents
ADD COLUMN IF NOT EXISTS ai_extracted_text TEXT,
ADD COLUMN IF NOT EXISTS ai_transcription TEXT,
ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_analysis_confidence DECIMAL(3,2);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_case_documents_ai_analyzed ON case_documents(ai_analyzed);
CREATE INDEX IF NOT EXISTS idx_case_documents_storage_path ON case_documents(storage_path);

-- Also add to case_files table for backward compatibility
ALTER TABLE case_files
ADD COLUMN IF NOT EXISTS ai_extracted_text TEXT,
ADD COLUMN IF NOT EXISTS ai_transcription TEXT,
ADD COLUMN IF NOT EXISTS ai_analyzed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ai_analysis_confidence DECIMAL(3,2);

CREATE INDEX IF NOT EXISTS idx_case_files_ai_analyzed ON case_files(ai_analyzed);
CREATE INDEX IF NOT EXISTS idx_case_files_storage_path ON case_files(storage_path);

-- Log what we did
DO $$
BEGIN
    RAISE NOTICE 'Added AI extraction columns to case_documents and case_files tables';
    RAISE NOTICE 'Columns added: ai_extracted_text, ai_transcription, ai_analyzed, ai_analysis_confidence';
END $$;
