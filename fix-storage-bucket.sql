-- Ensure storage bucket exists and has correct policies
-- Run this in Supabase SQL Editor

-- 1. Create the bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-files', 'case-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Authenticated users can upload case files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view case files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete case files" ON storage.objects;
DROP POLICY IF EXISTS "Public can view case files" ON storage.objects;

-- 3. Create fresh policies
CREATE POLICY "Authenticated users can upload case files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-files');

CREATE POLICY "Authenticated users can view case files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'case-files');

CREATE POLICY "Users can delete case files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'case-files');

CREATE POLICY "Public can view case files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'case-files');

-- 4. Verify setup
SELECT 'Bucket exists:' as check_type, id, name, public
FROM storage.buckets
WHERE id = 'case-files'
UNION ALL
SELECT 'Storage policies:', policyname::text, cmd::text, roles::text
FROM pg_policies
WHERE schemaname = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE '%case files%';
