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

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- Allow everyone to select posts (public read)
CREATE POLICY "Allow select for all" ON public.posts
  FOR SELECT
  USING (true);

-- Allow inserts only for authenticated users and ensure user_id matches auth.uid()
CREATE POLICY "Allow insert for authenticated" ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Optional: allow owners to update/delete their posts
CREATE POLICY "Allow update by owner" ON public.posts
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Allow delete by owner" ON public.posts
  FOR DELETE
  USING (user_id = auth.uid());

-- Likes table
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select likes" ON public.likes
  FOR SELECT
  USING (true);
CREATE POLICY "Allow insert likes" ON public.likes
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "Allow delete likes by owner" ON public.likes
  FOR DELETE
  USING (user_id = auth.uid());

-- Comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow select comments" ON public.comments
  FOR SELECT
  USING (true);
CREATE POLICY "Allow insert comments" ON public.comments
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
CREATE POLICY "Allow delete comments by owner" ON public.comments
  FOR DELETE
  USING (user_id = auth.uid());

-- Ensure profiles table can be managed by your app (you may add RLS per requirements)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow profile upsert by owner" ON public.profiles
  FOR ALL
  USING (auth.uid() IS NOT NULL AND id = auth.uid())
  WITH CHECK (auth.uid() IS NOT NULL AND id = auth.uid());

-- End of schema
