-- Step 1: Find and drop the exact policy
DO $$
BEGIN
    -- Drop the policy if it exists
    EXECUTE 'DROP POLICY "Users can insert case documents to their agency cases" ON public.case_documents';
    RAISE NOTICE 'Policy dropped successfully';
EXCEPTION
    WHEN undefined_object THEN
        RAISE NOTICE 'Policy does not exist, skipping drop';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error dropping policy: %', SQLERRM;
END $$;

-- Step 2: Create the new policy with correct WITH CHECK clause
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

-- Step 3: Verify
SELECT
    policyname,
    cmd,
    CASE
        WHEN qual IS NOT NULL THEN '✓ Policy is correct'
        ELSE '❌ Policy is broken (qual is NULL)'
    END as status
FROM pg_policies
WHERE tablename = 'case_documents'
  AND schemaname = 'public'
  AND cmd = 'INSERT';
