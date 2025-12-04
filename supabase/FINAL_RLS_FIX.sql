-- ============================================================
-- FINAL RLS FIX - ZERO AMBIGUITY
-- ============================================================
-- This is the DEFINITIVE security configuration.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ============================================================
-- STEP 1: NUCLEAR - DROP ALL CONTENT POLICIES
-- ============================================================
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'content')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON public.content';
    END LOOP;
END $$;

-- ============================================================
-- STEP 2: CREATE CLEAN INSERT POLICY
-- ONLY is_admin = TRUE can insert. Nothing else.
-- ============================================================
CREATE POLICY "INSERT: Admin only"
  ON public.content
  FOR INSERT
  WITH CHECK (
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  );

-- ============================================================
-- STEP 3: CREATE CLEAN UPDATE POLICY
-- ============================================================
CREATE POLICY "UPDATE: Admin only"
  ON public.content
  FOR UPDATE
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE)
  WITH CHECK ((SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE);

-- ============================================================
-- STEP 4: CREATE CLEAN DELETE POLICY
-- ============================================================
CREATE POLICY "DELETE: Admin only"
  ON public.content
  FOR DELETE
  USING ((SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE);

-- ============================================================
-- STEP 5: CREATE SELECT POLICIES
-- Premium users see all, admins see all
-- ============================================================
CREATE POLICY "SELECT: Premium users"
  ON public.content
  FOR SELECT
  USING (
    (SELECT is_premium FROM public.users WHERE id = auth.uid()) = TRUE
  );

CREATE POLICY "SELECT: Admin users"
  ON public.content
  FOR SELECT
  USING (
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  );

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Check all policies:
-- SELECT policyname, cmd, permissive FROM pg_policies WHERE tablename = 'content';
--
-- Expected:
-- INSERT: Admin only     | INSERT | PERMISSIVE
-- UPDATE: Admin only     | UPDATE | PERMISSIVE
-- DELETE: Admin only     | DELETE | PERMISSIVE
-- SELECT: Premium users  | SELECT | PERMISSIVE
-- SELECT: Admin users    | SELECT | PERMISSIVE
-- ============================================================

-- ============================================================
-- SET YOUR ADMIN USER
-- ============================================================
-- UPDATE public.users SET is_admin = TRUE WHERE email = 'your@email.com';
-- ============================================================


