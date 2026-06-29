-- ============================================================
-- FIX: "Database error saving new user" on Google OAuth
-- Run this entire script in your Supabase SQL Editor:
--   https://supabase.com/dashboard → your project → SQL Editor
-- ============================================================

-- Step 1: Drop any existing (broken) trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 2: Create a new trigger function that matches the actual
--         public.users schema (from scripts/migrate.sql)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id,
    email,
    name,
    tier,
    "deviceLimit",
    "isAdmin",
    created_at
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    'free',
    2,
    false,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;   -- safe if the row already exists

  RETURN NEW;
END;
$$;

-- Step 3: Attach the trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Step 4: Make sure the insert RLS policy allows this
--         (SECURITY DEFINER means it runs as the function owner,
--          but let's ensure the policy exists just in case)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'users'
      AND policyname = 'users: insert own'
  ) THEN
    CREATE POLICY "users: insert own" ON public.users
      FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END;
$$;
