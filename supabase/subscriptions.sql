-- Idempotent SQL script for Supabase SQL Editor
-- Creates: public.subscriptions
-- Notes:
-- - RLS is disabled intentionally (policies will be added later).
-- - Reuses public.touch_updated_at() trigger function if it already exists.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Reuse or create updated_at helper.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users (id),
  email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'canceled', 'refunded', 'chargeback', 'pending')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  canceled_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NULL,
  last_event_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  digistore_order_id TEXT NULL,
  digistore_product_id TEXT NULL,
  raw_event JSONB NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON public.subscriptions (email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);

-- Idempotency key for webhook upsert
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_email_order_id_uidx
ON public.subscriptions (email, digistore_order_id);

-- updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_subscriptions_touch_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at();
  END IF;
END$$;

-- Grants (RLS disabled; align with existing content tables)
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO anon, authenticated;

