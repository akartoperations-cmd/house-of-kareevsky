-- Final idempotent SQL script for Supabase SQL Editor
-- Creates: public.subscriptions
-- Notes:
-- - Does NOT touch RLS/policies (we will set them later).
-- - Does NOT GRANT anon/authenticated INSERT/UPDATE/DELETE.
-- - Does NOT overwrite any shared touch_updated_at() function.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_email_lower ON public.subscriptions (lower(email));
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions (user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions (status);

-- Idempotency for webhooks: prevent duplicates when order_id exists (case-insensitive by email)
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_email_lower_order_id_uidx
ON public.subscriptions (lower(email), digistore_order_id)
WHERE digistore_order_id IS NOT NULL;

-- updated_at: dedicated function for this table only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'touch_updated_at_subscriptions'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.touch_updated_at_subscriptions()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    $fn$;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_touch_updated_at'
  ) THEN
    CREATE TRIGGER trg_subscriptions_touch_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at_subscriptions();
  END IF;
END$$;

-- Allow service_role to manage this table (required for webhook and server-side access checks)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscriptions TO service_role;
  END IF;
END$$;

