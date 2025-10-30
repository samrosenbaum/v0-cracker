-- TEMPORARY: Disable RLS on case_documents to test if that's the issue
-- This is NOT secure for production, but will help us test

-- Drop all broken policies
DROP POLICY IF EXISTS "Users can insert case documents to their agency cases" ON public.case_documents;
DROP POLICY IF EXISTS "Users can insert case documents to their agency cases - OLD BROKEN" ON public.case_documents;
DROP POLICY IF EXISTS "Allow insert case documents for agency members" ON public.case_documents;
DROP POLICY IF EXISTS "insert_case_docs" ON public.case_documents;
DROP POLICY IF EXISTS "Users can view case documents from their agency cases" ON public.case_documents;

-- Disable RLS temporarily
ALTER TABLE public.case_documents DISABLE ROW LEVEL SECURITY;

-- Verify RLS is disabled
SELECT
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE tablename = 'case_documents';
