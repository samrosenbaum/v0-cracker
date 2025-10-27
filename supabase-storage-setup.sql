-- Create storage bucket for case files
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-files', 'case-files', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for case files bucket
-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload case files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-files');

-- Allow authenticated users to view files
CREATE POLICY "Authenticated users can view case files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'case-files');

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete case files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'case-files');

-- Allow public access for viewing (since bucket is public)
CREATE POLICY "Public can view case files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'case-files');
