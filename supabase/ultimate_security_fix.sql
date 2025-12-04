-- ============================================================
-- ULTIMATE SECURITY FIX - Final RLS Lockdown
-- ============================================================
-- This is the FINAL, DEFINITIVE security fix.
-- Run this LAST after all other migrations.
-- ============================================================

-- STEP 1: NUCLEAR OPTION - Drop ALL content modification policies
DO $$ 
DECLARE
    policy_record RECORD;
BEGIN
    FOR policy_record IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE tablename = 'content' 
        AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.content', policy_record.policyname);
    END LOOP;
END $$;

-- Also drop known policy names explicitly
DROP POLICY IF EXISTS "Only admins can create content" ON public.content;
DROP POLICY IF EXISTS "Only admins can update content" ON public.content;
DROP POLICY IF EXISTS "Only admins can delete content" ON public.content;
DROP POLICY IF EXISTS "Strict admin only insert" ON public.content;
DROP POLICY IF EXISTS "Strict admin only update" ON public.content;
DROP POLICY IF EXISTS "Strict admin only delete" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can create content" ON public.content;
DROP POLICY IF EXISTS "Premium users can create content" ON public.content;
DROP POLICY IF EXISTS "Users can create public content" ON public.content;
DROP POLICY IF EXISTS "Anyone can create public content" ON public.content;
DROP POLICY IF EXISTS "Public content can be created" ON public.content;

-- STEP 2: Create FINAL admin-only INSERT policy
-- CRITICAL: This checks ONLY is_admin, NOT is_public
CREATE POLICY "FINAL admin only insert"
  ON public.content FOR INSERT
  WITH CHECK (
    -- User MUST exist in users table with is_admin = TRUE
    -- The is_public column is IRRELEVANT for this check
    (
      SELECT is_admin 
      FROM public.users 
      WHERE id = auth.uid()
    ) = TRUE
  );

-- STEP 3: Create FINAL admin-only UPDATE policy
CREATE POLICY "FINAL admin only update"
  ON public.content FOR UPDATE
  USING (
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  )
  WITH CHECK (
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  );

-- STEP 4: Create FINAL admin-only DELETE policy
CREATE POLICY "FINAL admin only delete"
  ON public.content FOR DELETE
  USING (
    (SELECT is_admin FROM public.users WHERE id = auth.uid()) = TRUE
  );

-- ============================================================
-- VERIFICATION QUERY - Run this to confirm policies
-- ============================================================
-- SELECT policyname, cmd, qual, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'content';
-- ============================================================

-- You should see:
-- FINAL admin only insert | INSERT | NULL | (SELECT is_admin...)
-- FINAL admin only update | UPDATE | (SELECT is_admin...) | (SELECT is_admin...)
-- FINAL admin only delete | DELETE | (SELECT is_admin...) | NULL
-- ============================================================

