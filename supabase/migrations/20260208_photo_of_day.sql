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

-- Grants (RLS is intentionally NOT enabled here; can be added later.)
-- Keep access restricted to authenticated users for now.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_of_day TO authenticated;

