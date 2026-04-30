-- Supabase schema for Social Media Platform
-- Run this in Supabase SQL Editor

-- Enable pgcrypto for gen_random_uuid() if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE,
  name text,
  avatar_url text,
  bio text,
  updated_at timestamptz DEFAULT now()
);

-- Posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Likes table
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ===== ROW LEVEL SECURITY =====

-- Enable RLS for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- ===== PROFILES POLICIES =====
DROP POLICY IF EXISTS "Allow profile upsert by owner" ON public.profiles;
CREATE POLICY "Allow profile upsert by owner" ON public.profiles
  FOR ALL
  USING (auth.uid() IS NOT NULL AND id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND id = auth.uid());

-- ===== POSTS POLICIES =====
DROP POLICY IF EXISTS "Allow select for all" ON public.posts;
CREATE POLICY "Allow select for all" ON public.posts
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.posts;
CREATE POLICY "Allow insert for authenticated" ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Allow update by owner" ON public.posts;
CREATE POLICY "Allow update by owner" ON public.posts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Allow delete by owner" ON public.posts;
CREATE POLICY "Allow delete by owner" ON public.posts
  FOR DELETE
  USING (user_id = auth.uid());

-- ===== LIKES POLICIES =====
DROP POLICY IF EXISTS "Allow select likes" ON public.likes;
CREATE POLICY "Allow select likes" ON public.likes
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow insert likes" ON public.likes;
CREATE POLICY "Allow insert likes" ON public.likes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Allow delete likes by owner" ON public.likes;
CREATE POLICY "Allow delete likes by owner" ON public.likes
  FOR DELETE
  USING (user_id = auth.uid());

-- ===== COMMENTS POLICIES =====
DROP POLICY IF EXISTS "Allow select comments" ON public.comments;
CREATE POLICY "Allow select comments" ON public.comments
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow insert comments" ON public.comments;
CREATE POLICY "Allow insert comments" ON public.comments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Allow delete comments by owner" ON public.comments;
CREATE POLICY "Allow delete comments by owner" ON public.comments
  FOR DELETE
  USING (user_id = auth.uid());

-- End of schema
