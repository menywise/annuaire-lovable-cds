REVOKE UPDATE, DELETE, TRUNCATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;
DROP POLICY IF EXISTS "Participants marquent comme lu" ON public.messages;
CREATE POLICY "Participants marquent comme lu" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id <> auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()))
  WITH CHECK (
    sender_id <> auth.uid()
    AND read_at IS NOT NULL
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );
REVOKE UPDATE, DELETE, TRUNCATE ON public.conversations FROM anon, authenticated;
DROP POLICY IF EXISTS "Participants mettent a jour" ON public.conversations;
