-- Migration: Add poll tables and indexes
-- Created: 2026-01-14
-- Notes:
--   - Idempotent: safe to run multiple times.
--   - RLS intentionally left disabled (handled separately later).

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- polls
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts (id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  created_by UUID REFERENCES auth.users (id),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_polls_post_id ON public.polls (post_id);
ALTER TABLE public.polls DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- poll_options
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.poll_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls (id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_poll_options_poll_id ON public.poll_options (poll_id);
ALTER TABLE public.poll_options DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- poll_votes
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.poll_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id UUID REFERENCES public.polls (id) ON DELETE CASCADE,
  option_id UUID REFERENCES public.poll_options (id) ON DELETE CASCADE,
  user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent duplicate votes per poll/user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'poll_votes_unique_user' AND conrelid = 'public.poll_votes'::regclass
  ) THEN
    ALTER TABLE public.poll_votes
    ADD CONSTRAINT poll_votes_unique_user UNIQUE (poll_id, user_id);
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_id ON public.poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON public.poll_votes (option_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user_id ON public.poll_votes (user_id);
ALTER TABLE public.poll_votes DISABLE ROW LEVEL SECURITY;

-- =============================================================================
-- Grants (align with other content tables; RLS remains disabled)
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.polls TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_options TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.poll_votes TO anon, authenticated;


