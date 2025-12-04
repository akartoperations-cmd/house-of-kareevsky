-- ============================================================
-- ULTIMATE BREAK FIX: REMOVE SECURITY AMBIGUITY
-- ENFORCE ADMIN-ONLY POSTING
-- ============================================================
-- This file fixes the RLS error loop by:
-- 1. Removing ALL ambiguity from content policies
-- 2. INSERT policy checks ONLY is_admin = TRUE (nothing else)
-- 3. Ensuring premium users can read content
-- ============================================================
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- STEP 1: NUCLEAR - DROP ALL EXISTING CONTENT POLICIES
-- ============================================================
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop ALL policies on content table
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'content' 
        AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.content', policy_record.policyname);
    END LOOP;
END $$;

-- Also explicitly drop known policy names
DROP POLICY IF EXISTS "Only admins can create content" ON public.content;
DROP POLICY IF EXISTS "Only admins can update content" ON public.content;
DROP POLICY IF EXISTS "Only admins can delete content" ON public.content;
DROP POLICY IF EXISTS "Strict admin only insert" ON public.content;
DROP POLICY IF EXISTS "Strict admin only update" ON public.content;
DROP POLICY IF EXISTS "Strict admin only delete" ON public.content;
DROP POLICY IF EXISTS "FINAL admin only insert" ON public.content;
DROP POLICY IF EXISTS "FINAL admin only update" ON public.content;
DROP POLICY IF EXISTS "FINAL admin only delete" ON public.content;
DROP POLICY IF EXISTS "INSERT: Admin only" ON public.content;
DROP POLICY IF EXISTS "UPDATE: Admin only" ON public.content;
DROP POLICY IF EXISTS "DELETE: Admin only" ON public.content;
DROP POLICY IF EXISTS "SELECT: Premium users" ON public.content;
DROP POLICY IF EXISTS "SELECT: Admin users" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can create content" ON public.content;
DROP POLICY IF EXISTS "Premium users can create content" ON public.content;
DROP POLICY IF EXISTS "Users can create public content" ON public.content;
DROP POLICY IF EXISTS "Anyone can create public content" ON public.content;
DROP POLICY IF EXISTS "Public content can be created" ON public.content;
DROP POLICY IF EXISTS "Premium users can read all content" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can read public content" ON public.content;

-- ============================================================
-- STEP 2: CREATE STRICT INSERT POLICY
-- ONLY is_admin = TRUE. NO OTHER LOGIC ALLOWED.
-- ============================================================
CREATE POLICY "STRICT_ADMIN_INSERT_ONLY"
  ON public.content
  FOR INSERT
  WITH CHECK (
    -- CRITICAL: This is the ONLY check. No other conditions.
    -- No is_public checks. No premium checks. Only admin.
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  );

-- ============================================================
-- STEP 3: CREATE UPDATE POLICY (Admin only)
-- ============================================================
CREATE POLICY "STRICT_ADMIN_UPDATE_ONLY"
  ON public.content
  FOR UPDATE
  USING (
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  )
  WITH CHECK (
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  );

-- ============================================================
-- STEP 4: CREATE DELETE POLICY (Admin only)
-- ============================================================
CREATE POLICY "STRICT_ADMIN_DELETE_ONLY"
  ON public.content
  FOR DELETE
  USING (
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  );

-- ============================================================
-- STEP 5: CREATE SELECT POLICIES
-- Premium users and admins can read all content
-- ============================================================
CREATE POLICY "PREMIUM_USERS_READ_ALL"
  ON public.content
  FOR SELECT
  USING (
    (SELECT is_premium FROM public.users WHERE id = auth.uid()) = TRUE
  );

CREATE POLICY "ADMINS_READ_ALL"
  ON public.content
  FOR SELECT
  USING (
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  );

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run this to verify policies are correct:
-- 
-- SELECT 
--   policyname, 
--   cmd, 
--   permissive,
--   qual,
--   with_check
-- FROM pg_policies 
-- WHERE tablename = 'content' 
-- AND schemaname = 'public'
-- ORDER BY cmd, policyname;
--
-- Expected output:
-- STRICT_ADMIN_DELETE_ONLY | DELETE | PERMISSIVE | (SELECT is_admin...) | NULL
-- STRICT_ADMIN_INSERT_ONLY  | INSERT | PERMISSIVE | NULL                  | (SELECT is_admin...) = TRUE
-- STRICT_ADMIN_UPDATE_ONLY  | UPDATE | PERMISSIVE | (SELECT is_admin...)  | (SELECT is_admin...) = TRUE
-- ADMINS_READ_ALL           | SELECT | PERMISSIVE | (SELECT is_admin...)  | NULL
-- PREMIUM_USERS_READ_ALL    | SELECT | PERMISSIVE | (SELECT is_premium...) | NULL
-- ============================================================

-- ============================================================
-- IMPORTANT: Set your admin user
-- ============================================================
-- UPDATE public.users SET is_admin = TRUE WHERE email = 'your@email.com';
-- ============================================================

