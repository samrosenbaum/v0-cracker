-- Fix the case_documents RLS policies
-- The INSERT policy is missing the WITH CHECK clause

-- Drop the broken policy
DROP POLICY IF EXISTS "Users can insert case documents to their agency cases" ON public.case_documents;

-- Recreate it with the correct WITH CHECK clause
CREATE POLICY "Users can insert case documents to their agency cases"
ON public.case_documents
FOR INSERT
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

-- Verify the policy is correct
SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual as "with_check_clause"
FROM pg_policies
WHERE tablename = 'case_documents'
  AND schemaname = 'public'
  AND cmd = 'INSERT';
