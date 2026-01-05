-- Migration: Storage RLS policies for media bucket
-- Created: 2026-01-06
-- Enables authenticated users to manage objects in the "media" bucket while keeping RLS on.

-- Ensure RLS is enabled (Supabase enables by default, but keep explicit)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read media bucket objects.
CREATE POLICY IF NOT EXISTS storage_media_select_authenticated
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'media');

-- Allow authenticated users to upload to media bucket.
CREATE POLICY IF NOT EXISTS storage_media_insert_authenticated
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'media');

-- Allow authenticated users to update their media bucket objects.
CREATE POLICY IF NOT EXISTS storage_media_update_authenticated
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'media')
WITH CHECK (bucket_id = 'media');

-- Allow authenticated users to delete their media bucket objects.
CREATE POLICY IF NOT EXISTS storage_media_delete_authenticated
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'media');


