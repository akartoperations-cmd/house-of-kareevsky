-- RLS Admin Claim Fix
-- This adds the user's admin status as a custom claim to their JWT token
-- Run this in your Supabase SQL Editor

-- Step 1: Create a function to get the user's admin status
CREATE OR REPLACE FUNCTION public.get_is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.users WHERE id = user_id),
    FALSE
  );
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- Step 2: Create the custom access token hook function
-- This function is called by Supabase Auth when generating JWT tokens
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB AS $$
DECLARE
  claims JSONB;
  user_is_admin BOOLEAN;
BEGIN
  -- Get the user's admin status from public.users
  SELECT COALESCE(is_admin, FALSE) INTO user_is_admin
  FROM public.users
  WHERE id = (event->>'user_id')::UUID;

  -- Get existing claims
  claims := event->'claims';

  -- Add custom claims
  IF user_is_admin THEN
    claims := jsonb_set(claims, '{user_role}', '"admin"');
    claims := jsonb_set(claims, '{is_admin}', 'true');
  ELSE
    claims := jsonb_set(claims, '{user_role}', '"user"');
    claims := jsonb_set(claims, '{is_admin}', 'false');
  END IF;

  -- Return the modified event with updated claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 3: Grant necessary permissions for the hook to work
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON TABLE public.users TO supabase_auth_admin;

-- Step 4: Revoke public access for security
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;

-- ============================================================
-- IMPORTANT: Manual Step Required in Supabase Dashboard
-- ============================================================
-- After running this SQL, you MUST enable the hook in the Supabase Dashboard:
-- 
-- 1. Go to: Authentication > Hooks (in Supabase Dashboard)
-- 2. Find "Customize Access Token (JWT) Claims"
-- 3. Enable the hook
-- 4. Select the function: public.custom_access_token_hook
-- 5. Save changes
--
-- Without this step, the hook will NOT be called!
-- ============================================================

-- Alternative: If the hook approach doesn't work, you can also
-- check admin status directly in RLS policies (already implemented)
-- The RLS policies in language_filtering_migration.sql already check:
-- EXISTS (SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.is_admin = TRUE)

-- Step 5: Create a helper function for RLS policies to check admin status
-- This provides a cleaner way to check admin status in RLS policies
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- First try to get from JWT claims (if hook is enabled)
  IF current_setting('request.jwt.claims', true)::jsonb->>'is_admin' = 'true' THEN
    RETURN TRUE;
  END IF;
  
  -- Fallback: Check the database directly
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND is_admin = TRUE
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute on the helper function
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Step 6: Update RLS policies to use the helper function (optional optimization)
-- These replace the existing policies with ones that use the helper function

-- Drop existing admin policies first
DROP POLICY IF EXISTS "Only admins can create content" ON public.content;
DROP POLICY IF EXISTS "Only admins can update content" ON public.content;
DROP POLICY IF EXISTS "Only admins can delete content" ON public.content;

-- Recreate with helper function
CREATE POLICY "Only admins can create content"
  ON public.content FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Only admins can update content"
  ON public.content FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Only admins can delete content"
  ON public.content FOR DELETE
  USING (public.is_admin());

