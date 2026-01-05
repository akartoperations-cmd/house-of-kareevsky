-- Migration: Enable RLS and add scoped policies for content tables
-- Created: 2026-01-05
-- Goal: Allow authenticated users (or row owners) to insert/select/update/delete their own rows while keeping data protected.

-- POSTS ---------------------------------------------------------------------
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Select public posts or own posts.
CREATE POLICY IF NOT EXISTS posts_select_public_or_own
ON public.posts
FOR SELECT
TO public
USING (visibility = 'public' OR auth.uid() = author_id);

-- Insert only by authenticated user as author.
CREATE POLICY IF NOT EXISTS posts_insert_own
ON public.posts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = author_id);

-- Update only by owner.
CREATE POLICY IF NOT EXISTS posts_update_own
ON public.posts
FOR UPDATE
TO authenticated
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- Delete only by owner.
CREATE POLICY IF NOT EXISTS posts_delete_own
ON public.posts
FOR DELETE
TO authenticated
USING (auth.uid() = author_id);

-- POST_MEDIA ----------------------------------------------------------------
ALTER TABLE public.post_media ENABLE ROW LEVEL SECURITY;

-- Select media for public posts or owned posts.
CREATE POLICY IF NOT EXISTS post_media_select_public_or_own
ON public.post_media
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_media.post_id
      AND (p.visibility = 'public' OR auth.uid() = p.author_id)
  )
);

-- Insert media only when user owns the parent post.
CREATE POLICY IF NOT EXISTS post_media_insert_with_owned_post
ON public.post_media
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_media.post_id
      AND auth.uid() = p.author_id
  )
);

-- Update media only when user owns the parent post.
CREATE POLICY IF NOT EXISTS post_media_update_with_owned_post
ON public.post_media
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_media.post_id
      AND auth.uid() = p.author_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_media.post_id
      AND auth.uid() = p.author_id
  )
);

-- Delete media only when user owns the parent post.
CREATE POLICY IF NOT EXISTS post_media_delete_with_owned_post
ON public.post_media
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = post_media.post_id
      AND auth.uid() = p.author_id
  )
);

-- COMMENTS ------------------------------------------------------------------
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Select comments if the parent post is public or owned.
CREATE POLICY IF NOT EXISTS comments_select_public_or_own_post
ON public.comments
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = comments.post_id
      AND (p.visibility = 'public' OR auth.uid() = p.author_id)
  )
);

-- Insert comments by authenticated user; must own the comment.
CREATE POLICY IF NOT EXISTS comments_insert_own
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update/delete only own comments.
CREATE POLICY IF NOT EXISTS comments_update_own
ON public.comments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS comments_delete_own
ON public.comments
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


