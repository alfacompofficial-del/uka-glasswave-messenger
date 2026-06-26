-- Allow members to update their own membership row (last_read_at)
CREATE POLICY "members update own row"
  ON public.conversation_members
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Make sure realtime delivers full row updates so other side sees last_read_at changes
ALTER TABLE public.conversation_members REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;