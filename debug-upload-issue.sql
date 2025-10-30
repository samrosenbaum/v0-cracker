-- Debug script to find upload issues
-- Run this in Supabase SQL Editor

-- 1. Check if case-files bucket exists
SELECT id, name, public
FROM storage.buckets
WHERE id = 'case-files';

-- 2. Check storage policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage';

-- 3. Check if current user can see cases
SELECT
    c.id,
    c.name,
    c.agency_id,
    am.user_id as your_user_id,
    am.agency_id as your_agency_id,
    CASE
        WHEN am.agency_id = c.agency_id THEN 'YES - Can upload'
        ELSE 'NO - Agency mismatch'
    END as can_upload
FROM public.cases c
CROSS JOIN (
    SELECT user_id, agency_id
    FROM public.agency_members
    LIMIT 1
) am;

-- 4. Check RLS policies on case_documents
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'case_documents'
  AND schemaname = 'public';

-- 5. Test if you can insert into case_documents (will fail but show error)
-- Replace 'YOUR_CASE_ID' with an actual case ID
DO $$
DECLARE
    test_case_id UUID;
BEGIN
    -- Get first case
    SELECT id INTO test_case_id FROM public.cases LIMIT 1;

    IF test_case_id IS NOT NULL THEN
        RAISE NOTICE 'Testing insert for case: %', test_case_id;

        -- This will show if RLS blocks the insert
        INSERT INTO public.case_documents (
            case_id,
            file_name,
            document_type,
            storage_path,
            user_id
        ) VALUES (
            test_case_id,
            'test.pdf',
            'other',
            'test/test.pdf',
            auth.uid()
        );

        RAISE NOTICE 'SUCCESS - You can insert documents!';

        -- Clean up test
        DELETE FROM public.case_documents WHERE file_name = 'test.pdf';
    ELSE
        RAISE NOTICE 'No cases found to test with';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAILED - Error: %', SQLERRM;
END $$;
