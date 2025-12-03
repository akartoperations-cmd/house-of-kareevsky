-- Migration: Add Language Filtering Support
-- Run this SQL in your Supabase SQL Editor after the initial schema

-- Add preferred_languages column to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS preferred_languages TEXT[] DEFAULT ARRAY['en']::TEXT[];

-- Add language column to content table
ALTER TABLE public.content 
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en' 
CHECK (language IN ('en', 'es', 'fr', 'it', 'universal'));

-- Create index for language filtering performance
CREATE INDEX IF NOT EXISTS idx_content_language ON public.content(language);

-- Create index for preferred_languages array operations
CREATE INDEX IF NOT EXISTS idx_users_preferred_languages ON public.users USING GIN(preferred_languages);

-- Update the handle_new_user function to include preferred_languages
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, preferred_languages)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    ARRAY['en']::TEXT[]
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policy to allow authenticated users to insert content (for admin)
-- You may want to restrict this further based on is_admin or is_premium
CREATE POLICY "Authenticated users can create content"
  ON public.content FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update content they created (for admin editing)
-- In production, you might want to restrict this to admins only
CREATE POLICY "Authenticated users can update content"
  ON public.content FOR UPDATE
  USING (auth.uid() IS NOT NULL);
