-- Migration: Photo of the Day persistence (table + RLS)
-- Created: 2026-02-08
--
-- Source of truth for the "Photo of the Day" block is this table (metadata)
-- plus the Supabase Storage object referenced by image_path.

-- Ensure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- photo_of_day
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.photo_of_day (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  image_path TEXT NOT NULL,
  caption TEXT NULL,
  created_by UUID NULL REFERENCES auth.users (id)
);

CREATE INDEX IF NOT EXISTS idx_photo_of_day_created_at ON public.photo_of_day (created_at DESC);

-- Grants (required even when RLS is enabled)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_of_day TO anon, authenticated;

-- Enable Row Level Security and scoped policies
ALTER TABLE public.photo_of_day ENABLE ROW LEVEL SECURITY;

-- Allow signed-in users to read Photo of the Day.
CREATE POLICY IF NOT EXISTS photo_of_day_select_authenticated
ON public.photo_of_day
FOR SELECT
TO authenticated
USING (true);

-- Allow inserts only when created_by matches the authenticated user.
CREATE POLICY IF NOT EXISTS photo_of_day_insert_own
ON public.photo_of_day
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Allow updates/deletes only by row owner.
CREATE POLICY IF NOT EXISTS photo_of_day_update_own
ON public.photo_of_day
FOR UPDATE
TO authenticated
USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);

CREATE POLICY IF NOT EXISTS photo_of_day_delete_own
ON public.photo_of_day
FOR DELETE
TO authenticated
USING (auth.uid() = created_by);

