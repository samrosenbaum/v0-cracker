-- ============================================================================
-- SUPABASE DATABASE SETUP - COMPLETE GUIDE
-- ============================================================================
-- This script helps you verify what tables you have and what you need
-- Run this in Supabase SQL Editor to check your current database status
-- ============================================================================

-- STEP 1: Check what tables already exist
-- Copy and run this first to see what you have
-- ============================================================================

SELECT
    schemaname,
    tablename,
    CASE
        WHEN tablename IN ('agencies', 'agency_members', 'cases', 'case_files', 'case_documents', 'case_analysis', 'suspects', 'evidence_events', 'quality_flags') THEN '✅ Core Tables (supabase-clean.sql)'
        WHEN tablename IN ('processing_jobs', 'document_chunks') THEN '✅ Document Processing (supabase-document-chunking-migration.sql)'
        WHEN tablename = 'analysis_jobs' THEN '✅ Analysis Jobs (supabase-analysis-jobs.sql)'
        WHEN tablename IN ('case_entities', 'case_connections', 'timeline_events', 'alibi_entries') THEN '✅ Investigation Board (supabase-investigation-board-migration.sql)'
        ELSE '⚠️ Other table'
    END as source_migration
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
ORDER BY tablename;

-- ============================================================================
-- STEP 2: Check required extensions
-- ============================================================================

SELECT
    extname as extension_name,
    extversion as version,
    CASE
        WHEN extname = 'uuid-ossp' THEN '✅ Required for UUID generation'
        WHEN extname = 'pgcrypto' THEN '✅ Required for encryption'
        WHEN extname = 'vector' THEN '✅ Required for AI embeddings (document chunking)'
        ELSE '✅ Installed'
    END as purpose
FROM pg_extension
WHERE extname IN ('uuid-ossp', 'pgcrypto', 'vector')
ORDER BY extname;

-- ============================================================================
-- REQUIRED TABLES FOR YOUR APP
-- ============================================================================
-- Your app needs these tables to function properly:
--
-- FROM supabase-clean.sql (REQUIRED - Core Schema):
--   ✅ agencies
--   ✅ agency_members
--   ✅ cases
--   ✅ case_files
--   ✅ case_documents
--   ✅ case_analysis
--   ✅ suspects
--   ✅ evidence_events
--   ✅ quality_flags
--
-- FROM supabase-document-chunking-migration.sql (REQUIRED - Document Processing):
--   ✅ processing_jobs     -- CRITICAL for Inngest document processing
--   ✅ document_chunks     -- CRITICAL for large document handling
--
-- FROM supabase-analysis-jobs.sql (REQUIRED - AI Analysis):
--   ✅ analysis_jobs       -- CRITICAL for Inngest background analysis
--
-- FROM supabase-investigation-board-migration.sql (RECOMMENDED - Visual Tools):
--   ✅ case_entities
--   ✅ case_connections
--   ✅ timeline_events
--   ✅ alibi_entries
--
-- ============================================================================

-- ============================================================================
-- STEP 3: Verify storage buckets exist
-- ============================================================================

SELECT
    id,
    name,
    public,
    CASE
        WHEN name = 'case-files' THEN '✅ Required for file uploads'
        ELSE '✅ Storage bucket'
    END as purpose
FROM storage.buckets
ORDER BY name;

-- ============================================================================
-- STEP 4: Check RLS (Row Level Security) is enabled
-- ============================================================================

SELECT
    schemaname,
    tablename,
    CASE
        WHEN rowsecurity THEN '✅ RLS Enabled'
        ELSE '❌ RLS NOT ENABLED (Security Risk!)'
    END as rls_status
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'agencies', 'agency_members', 'cases', 'case_files', 'case_documents',
    'case_analysis', 'suspects', 'evidence_events', 'quality_flags',
    'processing_jobs', 'document_chunks', 'analysis_jobs',
    'case_entities', 'case_connections', 'timeline_events', 'alibi_entries'
  )
ORDER BY tablename;

-- ============================================================================
-- STEP 5: Count policies per table
-- ============================================================================

SELECT
    schemaname,
    tablename,
    COUNT(*) as policy_count,
    CASE
        WHEN COUNT(*) = 0 THEN '❌ No policies (BAD!)'
        WHEN COUNT(*) < 3 THEN '⚠️ Limited policies'
        ELSE '✅ Has policies'
    END as policy_status
FROM pg_policies
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ============================================================================
-- STEP 6: Verify critical indexes exist
-- ============================================================================

SELECT
    schemaname,
    tablename,
    indexname,
    CASE
        WHEN indexname LIKE '%_pkey' THEN '🔑 Primary Key'
        WHEN indexname LIKE 'idx_%case_id%' THEN '✅ Case ID Index (Performance)'
        WHEN indexname LIKE '%embedding%' THEN '✅ Vector Search Index (AI)'
        ELSE '✅ Index'
    END as index_type
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'cases', 'case_files', 'processing_jobs', 'document_chunks', 'analysis_jobs'
  )
ORDER BY tablename, indexname;

-- ============================================================================
-- STEP 7: Check for the critical vector extension (needed for AI)
-- ============================================================================

SELECT
    CASE
        WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector')
        THEN '✅ pgvector extension installed - AI embeddings ready'
        ELSE '❌ pgvector NOT installed - Run: CREATE EXTENSION vector;'
    END as vector_status;

-- ============================================================================
-- STEP 8: Verify service role policies exist (for Inngest)
-- ============================================================================

SELECT
    schemaname,
    tablename,
    policyname,
    '✅ Service role can access this table' as inngest_access
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    policyname LIKE '%service_role%'
    OR policyname LIKE '%Service role%'
  )
ORDER BY tablename;

-- ============================================================================
-- WHAT TO DO IF TABLES ARE MISSING
-- ============================================================================
--
-- If the verification queries above show missing tables, run these migrations
-- IN ORDER:
--
-- 1. FIRST (Core Schema):
--    Run: supabase-clean.sql
--    Creates: agencies, cases, case_files, case_documents, case_analysis, etc.
--
-- 2. SECOND (Document Processing):
--    Run: supabase-document-chunking-migration.sql
--    Creates: processing_jobs, document_chunks
--    Required for: Large PDF handling, Inngest document jobs
--
-- 3. THIRD (Analysis Jobs):
--    Run: supabase-analysis-jobs.sql
--    Creates: analysis_jobs
--    Required for: All 10 AI analysis types (timeline, deep-analysis, etc.)
--
-- 4. FOURTH (Investigation Board - Optional but Recommended):
--    Run: supabase-investigation-board-migration.sql
--    Creates: case_entities, case_connections, timeline_events, alibi_entries
--    Required for: Visual investigation board, murder board, timelines
--
-- ============================================================================

-- ============================================================================
-- QUICK FIX: If you need to run all migrations fresh
-- ============================================================================
--
-- If you want to start fresh (WARNING: This deletes ALL data):
--
-- \i supabase-clean.sql
-- \i supabase-document-chunking-migration.sql
-- \i supabase-analysis-jobs.sql
-- \i supabase-investigation-board-migration.sql
--
-- OR manually copy-paste each file's contents into Supabase SQL Editor
--
-- ============================================================================

-- ============================================================================
-- STORAGE BUCKET SETUP (If not exists)
-- ============================================================================
--
-- If the storage bucket check failed, run this:
--
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('case-files', 'case-files', false)
-- ON CONFLICT (id) DO NOTHING;
--
-- Then set up storage policies:
--
-- CREATE POLICY "Authenticated users can upload case files"
-- ON storage.objects FOR INSERT
-- TO authenticated
-- WITH CHECK (bucket_id = 'case-files');
--
-- CREATE POLICY "Users can view their agency's case files"
-- ON storage.objects FOR SELECT
-- TO authenticated
-- USING (bucket_id = 'case-files');
--
-- ============================================================================

-- ============================================================================
-- VERIFICATION SUMMARY
-- ============================================================================
-- Run this to get a quick overview of your database status:

DO $$
DECLARE
    core_tables_count INTEGER;
    document_tables_count INTEGER;
    analysis_table_exists BOOLEAN;
    board_tables_count INTEGER;
    vector_exists BOOLEAN;
BEGIN
    -- Count core tables
    SELECT COUNT(*) INTO core_tables_count
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('agencies', 'cases', 'case_files', 'case_documents', 'case_analysis', 'suspects');

    -- Count document processing tables
    SELECT COUNT(*) INTO document_tables_count
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('processing_jobs', 'document_chunks');

    -- Check analysis_jobs table
    SELECT EXISTS (
        SELECT 1 FROM pg_tables
        WHERE schemaname = 'public' AND tablename = 'analysis_jobs'
    ) INTO analysis_table_exists;

    -- Count investigation board tables
    SELECT COUNT(*) INTO board_tables_count
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename IN ('case_entities', 'case_connections', 'timeline_events', 'alibi_entries');

    -- Check vector extension
    SELECT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) INTO vector_exists;

    -- Print summary
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DATABASE SETUP STATUS';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Core Tables (need 6): % %', core_tables_count,
        CASE WHEN core_tables_count >= 6 THEN '✅' ELSE '❌' END;
    RAISE NOTICE 'Document Processing Tables (need 2): % %', document_tables_count,
        CASE WHEN document_tables_count >= 2 THEN '✅' ELSE '❌' END;
    RAISE NOTICE 'Analysis Jobs Table: %',
        CASE WHEN analysis_table_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE 'Investigation Board Tables (need 4): % %', board_tables_count,
        CASE WHEN board_tables_count >= 4 THEN '✅' ELSE '⚠️  Optional' END;
    RAISE NOTICE 'Vector Extension (for AI): %',
        CASE WHEN vector_exists THEN '✅' ELSE '❌' END;
    RAISE NOTICE '========================================';

    -- Overall status
    IF core_tables_count >= 6 AND document_tables_count >= 2 AND analysis_table_exists AND vector_exists THEN
        RAISE NOTICE 'STATUS: ✅ Database is ready!';
    ELSE
        RAISE NOTICE 'STATUS: ❌ Missing required tables or extensions';
        RAISE NOTICE 'Run the missing migrations (see above)';
    END IF;
END $$;
