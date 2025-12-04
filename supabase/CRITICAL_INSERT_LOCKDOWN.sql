-- ============================================================
-- CRITICAL: CONTENT INSERT LOCKDOWN
-- ============================================================
-- RUN THIS IMMEDIATELY IN SUPABASE SQL EDITOR
-- This fixes the security flaw allowing non-admin uploads
-- ============================================================

-- STEP 1: DROP ALL INSERT POLICIES ON CONTENT TABLE
DROP POLICY IF EXISTS "FINAL admin only insert" ON public.content;
DROP POLICY IF EXISTS "Strict admin only insert" ON public.content;
DROP POLICY IF EXISTS "Only admins can create content" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can create content" ON public.content;
DROP POLICY IF EXISTS "Premium users can create content" ON public.content;
DROP POLICY IF EXISTS "Users can create public content" ON public.content;
DROP POLICY IF EXISTS "Anyone can create public content" ON public.content;
DROP POLICY IF EXISTS "Public content can be created" ON public.content;
DROP POLICY IF EXISTS "Allow public content creation" ON public.content;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.content;
DROP POLICY IF EXISTS "content_insert_policy" ON public.content;

-- STEP 2: CREATE THE ONLY INSERT POLICY
-- THIS IS THE SINGLE SOURCE OF TRUTH FOR INSERT PERMISSIONS
CREATE POLICY "LOCKED: Admin only insert"
  ON public.content
  FOR INSERT
  WITH CHECK (
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  );

-- ============================================================
-- VERIFY: Run this query to confirm only admin policy exists
-- ============================================================
-- SELECT policyname, cmd FROM pg_policies 
-- WHERE tablename = 'content' AND cmd = 'INSERT';
--
-- Expected result: 
-- policyname              | cmd
-- ------------------------|--------
-- LOCKED: Admin only insert | INSERT
-- ============================================================

-- ============================================================
-- TEST: Try inserting as non-admin (should fail)
-- ============================================================
-- INSERT INTO public.content (title, type, url, is_public, language)
-- VALUES ('Test', 'text', 'test', true, 'en');
-- 
-- Expected: ERROR - new row violates row-level security policy
-- ============================================================

