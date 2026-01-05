-- Migration: Create persistent content tables for posts, media, comments, direct messages, and subscriber profiles
-- Created: 2026-01-04
-- Notes:
--   - Tables are created only if they do not already exist.
--   - RLS intentionally left disabled; grants added for anon/authenticated roles.

-- Enable pgcrypto for gen_random_uuid (already enabled on most Supabase projects)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- posts
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES auth.users (id),
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'photo', 'video', 'audio', 'poll', 'i18n')),
  title TEXT,
  body_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'subscribers')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_visibility ON public.posts (visibility);

-- Ensure RLS is off until policies are added later.
ALTER TABLE public.posts DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- post_media
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.post_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts (id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio')),
  width INTEGER,
  height INTEGER,
  duration NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_media_post_id ON public.post_media (post_id);
ALTER TABLE public.post_media DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- comments
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts (id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users (id),
  body_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id_created_at ON public.comments (post_id, created_at);
ALTER TABLE public.comments DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- direct_messages
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID,
  from_user_id UUID REFERENCES auth.users (id),
  to_admin_id UUID REFERENCES auth.users (id),
  body_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_direct_messages_thread ON public.direct_messages (thread_id, created_at);
ALTER TABLE public.direct_messages DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- subscriber_profiles
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.subscriber_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users (id),
  email TEXT,
  display_name TEXT,
  locale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ,
  plan_status TEXT NOT NULL DEFAULT 'unknown',
  notes JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriber_profiles_email_idx ON public.subscriber_profiles (email);
ALTER TABLE public.subscriber_profiles DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Grants (RLS is disabled; explicit grants allow anon/authenticated access)
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_media TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriber_profiles TO anon, authenticated;

-- Helpful defaults for updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_posts_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_posts_touch_updated_at
    BEFORE UPDATE ON public.posts
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_comments_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_comments_touch_updated_at
    BEFORE UPDATE ON public.comments
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_direct_messages_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_direct_messages_touch_updated_at
    BEFORE UPDATE ON public.direct_messages
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END$$;


