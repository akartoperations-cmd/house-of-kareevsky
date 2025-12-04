-- ============================================================
-- CRITICAL SECURITY FIX: Content Upload Lockdown
-- ============================================================
-- This migration ensures ONLY users with is_admin = TRUE can
-- INSERT, UPDATE, or DELETE content. No exceptions.
-- Run this AFTER schema.sql and language_filtering_migration.sql
-- ============================================================

-- Step 1: Drop ALL existing content modification policies
-- This ensures no conflicting or permissive policies exist
DROP POLICY IF EXISTS "Only admins can create content" ON public.content;
DROP POLICY IF EXISTS "Only admins can update content" ON public.content;
DROP POLICY IF EXISTS "Only admins can delete content" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can create content" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can update content" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can delete content" ON public.content;
DROP POLICY IF EXISTS "Premium users can create content" ON public.content;
DROP POLICY IF EXISTS "Premium users can update content" ON public.content;
DROP POLICY IF EXISTS "Premium users can delete content" ON public.content;
DROP POLICY IF EXISTS "Users can create public content" ON public.content;
DROP POLICY IF EXISTS "Anyone can create public content" ON public.content;
DROP POLICY IF EXISTS "Public content can be created" ON public.content;

-- Step 2: Create the is_admin helper function (if not exists)
-- This function checks admin status directly from the database
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- Check the database directly - most reliable method
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Step 3: Create STRICT admin-only policies for content modification
-- These policies check is_admin = TRUE regardless of any other column values

-- INSERT: ONLY admins can create ANY content (public or private)
CREATE POLICY "Strict admin only insert"
  ON public.content FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- UPDATE: ONLY admins can update ANY content
CREATE POLICY "Strict admin only update"
  ON public.content FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- DELETE: ONLY admins can delete ANY content
CREATE POLICY "Strict admin only delete"
  ON public.content FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- Step 4: Verify SELECT policies are correct (read-only for users)
-- Drop and recreate to ensure consistency
DROP POLICY IF EXISTS "Premium users can read all content" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can read public content" ON public.content;

-- Premium users can read ALL content
CREATE POLICY "Premium users can read all content"
  ON public.content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_premium = TRUE
    )
  );

-- Any authenticated user can read PUBLIC content only
CREATE POLICY "Authenticated users can read public content"
  ON public.content FOR SELECT
  USING (
    is_public = TRUE
    AND auth.uid() IS NOT NULL
  );

-- Admins can always read all content
CREATE POLICY "Admins can read all content"
  ON public.content FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- ============================================================
-- VERIFICATION: Run this query to check policies are correct
-- ============================================================
-- SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
-- FROM pg_policies 
-- WHERE tablename = 'content';
-- ============================================================

-- ============================================================
-- IMPORTANT: After running this SQL
-- ============================================================
-- 1. Verify your admin user has is_admin = TRUE:
--    SELECT id, email, is_admin FROM public.users WHERE email = 'your@email.com';
--
-- 2. If not, set it:
--    UPDATE public.users SET is_admin = TRUE WHERE email = 'your@email.com';
--
-- 3. Sign out and sign back in to refresh your session
-- ============================================================

