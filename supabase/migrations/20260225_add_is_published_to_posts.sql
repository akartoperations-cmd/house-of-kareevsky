-- Migration: Add is_published column to public.posts
-- Created: 2026-02-25
-- Purpose: Support the two-step publish pattern required by the Supabase
--          Database Webhook architecture.  Posts are inserted with
--          is_published = false, then UPDATEd to true once all media/metadata
--          is ready.  The UPDATE triggers the webhook on public.posts (event:
--          UPDATE) which fires the push notification exactly once.
--
-- Assumption for existing rows: all rows already in public.posts were
-- previously visible to users, so we back-fill them as is_published = true.

-- 1. Add column (safe: IF NOT EXISTS-style via DO block)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'posts'
       AND column_name  = 'is_published'
  ) THEN
    ALTER TABLE public.posts
      ADD COLUMN is_published BOOLEAN NOT NULL DEFAULT false;
  END IF;
END$$;

-- 2. Back-fill existing rows so they remain visible.
UPDATE public.posts SET is_published = true WHERE is_published = false;
