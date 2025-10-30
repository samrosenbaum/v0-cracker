-- Force fix the case_documents RLS policy
-- Use CASCADE to ensure it's dropped even if there are dependencies

-- Drop the broken policy with CASCADE
DROP POLICY IF EXISTS "Users can insert case documents to their agency cases" ON public.case_documents CASCADE;

-- Wait a moment, then recreate it
CREATE POLICY "Users can insert case documents to their agency cases"
ON public.case_documents
FOR INSERT
TO public
WITH CHECK (
    case_id IN (
        SELECT id
        FROM public.cases
        WHERE agency_id IN (
            SELECT agency_id
            FROM public.agency_members
            WHERE user_id = auth.uid()
        )
    )
);

-- Verify it worked
SELECT
    policyname,
    cmd,
    CASE
        WHEN qual IS NULL THEN '❌ NULL (broken)'
        ELSE '✓ Has WITH CHECK clause'
    END as status,
    qual as with_check_clause
FROM pg_policies
WHERE tablename = 'case_documents'
  AND schemaname = 'public'
  AND cmd = 'INSERT';
