-- Fix for "unable to schedule job" error on deep-analysis endpoint
-- Add service_role policy to processing_jobs table to allow server-side operations

-- Service role can do everything (for Inngest workers and API routes)
CREATE POLICY "Service role can manage all processing jobs"
  ON public.processing_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Verify the policy was created
SELECT
    schemaname,
    tablename,
    policyname,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'processing_jobs'
ORDER BY policyname;
