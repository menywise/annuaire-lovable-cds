-- Socle 1.6.1 — correctifs issus de l'audit (13/10).
-- 1. Messagerie privée : un participant ne réécrit plus un message (texte, date, expéditeur) et ne
--    change plus les membres d'une conversation. Seul le destinataire marque un message comme lu.
-- Rejouable sans danger.

-- 1. Messagerie privée -----------------------------------------------------------------------------
-- Messages : seule la colonne read_at reste modifiable. Le retrait au niveau de la table retire aussi
-- les droits par colonne : l'ordre REVOKE puis GRANT compte.
REVOKE UPDATE, DELETE, TRUNCATE ON public.messages FROM anon, authenticated;
GRANT UPDATE (read_at) ON public.messages TO authenticated;
-- Marquer comme lu : uniquement les messages reçus, jamais les siens.
DROP POLICY IF EXISTS "Participants marquent comme lu" ON public.messages;
CREATE POLICY "Participants marquent comme lu" ON public.messages FOR UPDATE TO authenticated
  USING (sender_id <> auth.uid() AND public.is_conversation_participant(conversation_id, auth.uid()))
  WITH CHECK (
    sender_id <> auth.uid()
    AND read_at IS NOT NULL
    AND public.is_conversation_participant(conversation_id, auth.uid())
  );

-- Conversations : aucune modification par un membre. La date du dernier message reste tenue par
-- touch_conversation (déclencheur SECURITY DEFINER, droits du propriétaire).
REVOKE UPDATE, DELETE, TRUNCATE ON public.conversations FROM anon, authenticated;
DROP POLICY IF EXISTS "Participants mettent a jour" ON public.conversations;
