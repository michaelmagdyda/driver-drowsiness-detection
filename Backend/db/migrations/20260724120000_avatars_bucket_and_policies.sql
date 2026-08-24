-- =========================================================================
-- Avatars storage bucket + RLS policies
-- =========================================================================
-- Independent, idempotent add-on to the two base migrations
-- (20260721124650 schema, 20260721124748 lockdown + storage policies).
--
-- It neither modifies nor depends on them: it references only storage.buckets
-- and storage.objects (Supabase-managed) and auth.uid(), all of which exist in
-- any Supabase project. Safe to run before or after the base migrations, and
-- safe to run more than once.
--
-- Why this file exists: the frontend profile page and the backend
-- (app/core/constants.py -> BUCKET_AVATARS) reference an "avatars" bucket that
-- neither base migration creates. This closes that gap and nothing more.
--
-- Design: avatars is a PUBLIC bucket (profile pictures are meant to be readable
-- by URL without a signed request), so READ is public while WRITES are confined
-- to each user's own folder - the first path segment must equal their uid,
-- exactly the per-user-folder pattern the base storage policies use.
-- =========================================================================


-- -------------------------------------------------------------------------
-- 1. Bucket
-- -------------------------------------------------------------------------
-- Idempotent: ON CONFLICT on the primary key (id) makes a re-run a no-op.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;


-- -------------------------------------------------------------------------
-- 2. Policies on storage.objects
-- -------------------------------------------------------------------------
-- PostgreSQL has no CREATE POLICY IF NOT EXISTS, so each policy is dropped
-- first: DROP POLICY IF EXISTS is the idempotent idiom. Every policy is scoped
-- to bucket_id = 'avatars', so none of them affects the private buckets defined
-- in the base migration.

-- Public read: anyone (including anon) may read avatar objects.
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Upload: authenticated users may write only into their own folder.
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: authenticated users may change only their own avatar objects.
DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: authenticated users may remove only their own avatar objects.
DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
