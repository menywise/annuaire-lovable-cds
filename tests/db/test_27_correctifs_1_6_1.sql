\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Socle 1.6.1 : correctifs issus de l'audit du 13/10.
-- b1 : membre · b2 : autre membre · b3 : tiers
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'un@test.fr'),
  ('00000000-0000-0000-0000-0000000000b2', 'deux@test.fr'),
  ('00000000-0000-0000-0000-0000000000b3', 'tiers@test.fr');

-- 1. Messagerie privée : messages et conversations verrouillés ----------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
INSERT INTO public.conversations (id, user_a, user_b) VALUES
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000b2');
RESET ROLE;
UPDATE public.conversations SET last_message_at = now() - interval '1 day'
  WHERE id = '00000000-0000-0000-0000-0000000000c1';

-- b1 écrit à b2 : l'envoi met toujours à jour la date du dernier message.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b1', 'un@test.fr');
INSERT INTO public.messages (id, conversation_id, sender_id, content) VALUES
  ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000b1', 'Bonjour');
DO $$ BEGIN
  IF (SELECT last_message_at FROM public.conversations WHERE id = '00000000-0000-0000-0000-0000000000c1')
     < now() - interval '1 minute' THEN RAISE EXCEPTION 'last_message_at non mis à jour'; END IF;
END $$;
-- L'expéditeur ne marque pas son propre message comme lu.
UPDATE public.messages SET read_at = now() WHERE id = '00000000-0000-0000-0000-0000000000d1';
DO $$ BEGIN
  IF (SELECT read_at FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000000d1') IS NOT NULL
  THEN RAISE EXCEPTION 'expéditeur marque son message comme lu'; END IF;
END $$;

-- b2 (destinataire) ne réécrit ni le texte, ni l'expéditeur, ni la date, ni la conversation.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2', 'deux@test.fr');
SELECT pg_temp.expect_error($$UPDATE public.messages SET content = 'Réécrit' WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire réécrit le texte');
SELECT pg_temp.expect_error($$UPDATE public.messages SET sender_id = '00000000-0000-0000-0000-0000000000b2' WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire change l''expéditeur');
SELECT pg_temp.expect_error($$UPDATE public.messages SET created_at = now() - interval '1 year' WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire change la date');
SELECT pg_temp.expect_error($$UPDATE public.messages SET conversation_id = conversation_id WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire change la conversation');
SELECT pg_temp.expect_error($$DELETE FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire supprime le message');
SELECT pg_temp.expect_error($$TRUNCATE public.messages$$, 'membre vide les messages');
-- Il marque toujours le message reçu comme lu (même requête que l'écran de messagerie).
UPDATE public.messages SET read_at = now()
  WHERE conversation_id = '00000000-0000-0000-0000-0000000000c1'
    AND sender_id <> '00000000-0000-0000-0000-0000000000b2' AND read_at IS NULL;
DO $$ BEGIN
  IF (SELECT read_at FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000000d1') IS NULL
  THEN RAISE EXCEPTION 'destinataire ne marque plus comme lu'; END IF;
END $$;
-- Il ne remet pas un message lu à « non lu ».
SELECT pg_temp.expect_error($$UPDATE public.messages SET read_at = NULL WHERE id = '00000000-0000-0000-0000-0000000000d1'$$, 'destinataire remet à non lu');
RESET ROLE;
DO $$ BEGIN
  IF (SELECT read_at FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000000d1') IS NULL
  THEN RAISE EXCEPTION 'message remis à non lu'; END IF;
  IF (SELECT content FROM public.messages WHERE id = '00000000-0000-0000-0000-0000000000d1') <> 'Bonjour'
  THEN RAISE EXCEPTION 'texte du message modifié'; END IF;
END $$;

-- Aucun participant ne change les membres ni la date d'une conversation.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b2', 'deux@test.fr');
SELECT pg_temp.expect_error($$UPDATE public.conversations SET user_a = '00000000-0000-0000-0000-0000000000b3' WHERE id = '00000000-0000-0000-0000-0000000000c1'$$, 'participant remplace user_a');
SELECT pg_temp.expect_error($$UPDATE public.conversations SET user_b = '00000000-0000-0000-0000-0000000000b3' WHERE id = '00000000-0000-0000-0000-0000000000c1'$$, 'participant remplace user_b');
SELECT pg_temp.expect_error($$UPDATE public.conversations SET last_message_at = now() + interval '1 year' WHERE id = '00000000-0000-0000-0000-0000000000c1'$$, 'participant change last_message_at');
SELECT pg_temp.expect_error($$DELETE FROM public.conversations WHERE id = '00000000-0000-0000-0000-0000000000c1'$$, 'participant supprime la conversation');
SELECT pg_temp.expect_error($$TRUNCATE public.conversations CASCADE$$, 'membre vide les conversations');
-- Le tiers ne lit toujours rien.
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000b3', 'tiers@test.fr');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.conversations) OR EXISTS (SELECT 1 FROM public.messages)
  THEN RAISE EXCEPTION 'tiers lit la messagerie'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF has_table_privilege('authenticated', 'public.conversations', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.messages', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.messages', 'content', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.messages', 'sender_id', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.messages', 'created_at', 'UPDATE')
     OR has_column_privilege('authenticated', 'public.messages', 'conversation_id', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.messages', 'read_at', 'UPDATE')
  THEN RAISE EXCEPTION 'droits de modification de la messagerie'; END IF;
END $$;

-- Rejouable (toujours en dernier) ---------------------------------------------------------------------------------------
\i supabase/migrations/20261013120000_v1_6_1_correctifs_audit.sql
DO $$ BEGIN
  IF has_column_privilege('authenticated', 'public.messages', 'content', 'UPDATE')
     OR NOT has_column_privilege('authenticated', 'public.messages', 'read_at', 'UPDATE')
  THEN RAISE EXCEPTION 'rejeu de la messagerie'; END IF;
END $$;
ROLLBACK;
