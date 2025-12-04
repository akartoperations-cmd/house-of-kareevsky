-- Migration: Add Language Filtering Support
-- Run this SQL in your Supabase SQL Editor after the initial schema

-- Add preferred_languages column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS preferred_languages TEXT[] DEFAULT ARRAY['en']::TEXT[];

-- Add is_admin column to users table for admin access control
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Add language column to content table
ALTER TABLE public.content 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en' 
CHECK (language IN ('en', 'es', 'fr', 'it', 'universal'));

-- Create index for language filtering performance
CREATE INDEX IF NOT EXISTS idx_content_language ON public.content(language);

-- Create index for preferred_languages array operations
CREATE INDEX IF NOT EXISTS idx_users_preferred_languages ON public.users USING GIN(preferred_languages);

-- Create index for admin access checks
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON public.users(is_admin);

-- Update the handle_new_user function to include preferred_languages
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, preferred_languages, is_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    ARRAY['en']::TEXT[],
    FALSE
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing insecure policies if they exist
DROP POLICY IF EXISTS "Authenticated users can create content" ON public.content;
DROP POLICY IF EXISTS "Premium users can create content" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can update content" ON public.content;
DROP POLICY IF EXISTS "Premium users can update content" ON public.content;
DROP POLICY IF EXISTS "Authenticated users can delete content" ON public.content;
DROP POLICY IF EXISTS "Premium users can delete content" ON public.content;

-- Add RLS policy to allow ONLY admins to insert content
-- CRITICAL: Only users with is_admin = TRUE can create content
CREATE POLICY "Only admins can create content"
  ON public.content FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- Allow ONLY admins to update content
-- CRITICAL: Only users with is_admin = TRUE can update content
CREATE POLICY "Only admins can update content"
  ON public.content FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );

-- Allow ONLY admins to delete content (for completeness)
CREATE POLICY "Only admins can delete content"
  ON public.content FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
      AND users.is_admin = TRUE
    )
  );
