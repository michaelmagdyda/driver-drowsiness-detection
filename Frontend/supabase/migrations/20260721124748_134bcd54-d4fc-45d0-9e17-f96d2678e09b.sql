
-- Lock down SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
-- authenticated keeps EXECUTE so RLS policies can call it

-- Storage policies: private buckets, per-user folder = auth.uid()::text
-- Pattern: storage_path starts with "<uid>/..."

-- uploads-videos
CREATE POLICY "Users read own videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own videos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own videos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'uploads-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own videos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads-videos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins read all videos"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads-videos' AND public.has_role(auth.uid(), 'admin'));

-- uploads-images
CREATE POLICY "Users read own images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users upload own images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'uploads-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users update own images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'uploads-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users delete own images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'uploads-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins read all images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'uploads-images' AND public.has_role(auth.uid(), 'admin'));

-- session-clips (backend-written, users read own)
CREATE POLICY "Users read own clips"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'session-clips' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins read all clips"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'session-clips' AND public.has_role(auth.uid(), 'admin'));
