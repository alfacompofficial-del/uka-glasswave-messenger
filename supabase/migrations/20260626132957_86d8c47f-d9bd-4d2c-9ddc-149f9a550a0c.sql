-- Allow chat members to read voice files stored under <conversation_id>/...
CREATE POLICY "voice: members can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND public.is_conversation_member(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );

-- Allow authenticated users to upload into their own subpath: <conversation_id>/<user_id>/file
CREATE POLICY "voice: sender can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-messages'
    AND (split_part(name, '/', 2))::uuid = auth.uid()
    AND public.is_conversation_member(
      (split_part(name, '/', 1))::uuid,
      auth.uid()
    )
  );