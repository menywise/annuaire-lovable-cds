-- V0 · Lot 1 « Base » — fiabilité des règles d'accès, forum, messagerie, lettre d'information, admins du studio.
-- Rejouable sans danger : chaque objet est supprimé s'il existe puis recréé.

-- 1. Lectures visiteur cassées ------------------------------------------------
-- has_role n'est pas exécutable par anon : une politique « TO anon » qui l'appelle
-- fait échouer toute lecture. On sépare visiteurs et membres (même méthode que 20260918083949).

DROP POLICY IF EXISTS "Profils listes visibles" ON public.member_profiles;
DROP POLICY IF EXISTS "Profils listes visibles par les visiteurs" ON public.member_profiles;
DROP POLICY IF EXISTS "Profils visibles par les membres" ON public.member_profiles;
CREATE POLICY "Profils listes visibles par les visiteurs" ON public.member_profiles
  FOR SELECT TO anon USING (listed);
CREATE POLICY "Profils visibles par les membres" ON public.member_profiles
  FOR SELECT TO authenticated
  USING (listed OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Commentaires valides visibles" ON public.blog_comments;
DROP POLICY IF EXISTS "Commentaires valides visibles par les visiteurs" ON public.blog_comments;
DROP POLICY IF EXISTS "Commentaires visibles par les membres" ON public.blog_comments;
CREATE POLICY "Commentaires valides visibles par les visiteurs" ON public.blog_comments
  FOR SELECT TO anon USING (approved);
CREATE POLICY "Commentaires visibles par les membres" ON public.blog_comments
  FOR SELECT TO authenticated
  USING (approved OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));

-- 2. Forum : activité des discussions ------------------------------------------
-- Le déclencheur passait par les règles d'accès : une réponse d'un autre membre
-- ne mettait jamais à jour last_activity_at.
CREATE OR REPLACE FUNCTION public.touch_topic_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.forum_topics SET last_activity_at = now() WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_topic_activity() FROM PUBLIC, anon, authenticated;

-- updated_at ne bouge plus à chaque vue ou nouvelle réponse : seulement si le contenu change.
DROP TRIGGER IF EXISTS forum_topics_updated_at ON public.forum_topics;
CREATE TRIGGER forum_topics_updated_at BEFORE UPDATE ON public.forum_topics
  FOR EACH ROW
  WHEN (OLD.title IS DISTINCT FROM NEW.title
     OR OLD.content IS DISTINCT FROM NEW.content
     OR OLD.category_id IS DISTINCT FROM NEW.category_id
     OR OLD.locked IS DISTINCT FROM NEW.locked)
  EXECUTE FUNCTION public.set_updated_at();

-- 3. Forum : garde-fous sur les modifications ------------------------------------
-- Sujet : seul un admin verrouille/déverrouille ; un sujet verrouillé n'est plus modifiable par son auteur ;
-- les compteurs ne sont pas modifiables à la main.
CREATE OR REPLACE FUNCTION public.guard_forum_topic_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW; -- fonctions internes (compteur de vues, activité)
  END IF;
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF OLD.locked THEN
    RAISE EXCEPTION 'Discussion verrouillée' USING ERRCODE = '42501';
  END IF;
  IF NEW.locked IS DISTINCT FROM OLD.locked
     OR NEW.views IS DISTINCT FROM OLD.views
     OR NEW.last_activity_at IS DISTINCT FROM OLD.last_activity_at
     OR NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'Modification non autorisée' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS forum_topics_guard ON public.forum_topics;
CREATE TRIGGER forum_topics_guard BEFORE UPDATE ON public.forum_topics
  FOR EACH ROW EXECUTE FUNCTION public.guard_forum_topic_update();

-- Réponse : l'auteur de la réponse ne modifie que son texte ; l'auteur du sujet ne modifie que « retenue ».
CREATE OR REPLACE FUNCTION public.guard_forum_reply_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _topic_author uuid;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.topic_id IS DISTINCT FROM OLD.topic_id OR NEW.author_id IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'Modification non autorisée' USING ERRCODE = '42501';
  END IF;
  SELECT author_id INTO _topic_author FROM public.forum_topics WHERE id = OLD.topic_id;
  IF NEW.accepted IS DISTINCT FROM OLD.accepted AND auth.uid() IS DISTINCT FROM _topic_author THEN
    RAISE EXCEPTION 'Seul l''auteur du sujet retient une réponse' USING ERRCODE = '42501';
  END IF;
  IF (NEW.content IS DISTINCT FROM OLD.content OR NEW.author_name IS DISTINCT FROM OLD.author_name)
     AND auth.uid() IS DISTINCT FROM OLD.author_id THEN
    RAISE EXCEPTION 'Seul l''auteur modifie sa réponse' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS forum_replies_guard ON public.forum_replies;
CREATE TRIGGER forum_replies_guard BEFORE UPDATE ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.guard_forum_reply_update();

-- 4. Messagerie ------------------------------------------------------------------
-- Date du dernier message : tenue à jour par la base.
CREATE OR REPLACE FUNCTION public.touch_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.touch_conversation() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS messages_touch_conversation ON public.messages;
CREATE TRIGGER messages_touch_conversation AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_conversation();

-- Refus des messages privés respecté par la base, pas seulement par l'écran.
CREATE OR REPLACE FUNCTION public.member_accepts_messages(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT accepts_messages FROM public.member_profiles WHERE user_id = _user_id), true)
$$;
REVOKE ALL ON FUNCTION public.member_accepts_messages(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.member_accepts_messages(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Membres ouvrent une conversation" ON public.conversations;
CREATE POLICY "Membres ouvrent une conversation" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (
    (auth.uid() = user_a AND public.member_accepts_messages(user_b))
    OR (auth.uid() = user_b AND public.member_accepts_messages(user_a))
  );

-- 5. Lettre d'information : l'admin désinscrit et supprime --------------------------
GRANT UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;
DROP POLICY IF EXISTS "Les admins modifient les abonnes" ON public.newsletter_subscribers;
CREATE POLICY "Les admins modifient les abonnes" ON public.newsletter_subscribers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Les admins suppriment les abonnes" ON public.newsletter_subscribers;
CREATE POLICY "Les admins suppriment les abonnes" ON public.newsletter_subscribers FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 6. Admins du studio ---------------------------------------------------------------
-- Les adresses administratrices d'office ne sont plus écrites dans le code de la fonction.
CREATE TABLE IF NOT EXISTS public.studio_admins (
  email text PRIMARY KEY CHECK (email = lower(email)),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.studio_admins TO authenticated;
GRANT ALL ON public.studio_admins TO service_role;
ALTER TABLE public.studio_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins gerent les admins du studio" ON public.studio_admins;
CREATE POLICY "Admins gerent les admins du studio" ON public.studio_admins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Création du compte : rôle lu dans studio_admins, nom repris de l'inscription.
CREATE OR REPLACE FUNCTION public.bootstrap_current_user(_full_name text DEFAULT NULL)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _name text := nullif(trim(coalesce(_full_name, auth.jwt() -> 'user_metadata' ->> 'full_name', '')), '');
  _role public.app_role;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;

  INSERT INTO public.profiles (id, email, full_name)
  VALUES (_uid, _email, _name)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

  IF EXISTS (SELECT 1 FROM public.studio_admins WHERE email = _email) THEN
    _role := 'admin';
  ELSE
    _role := 'user';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, _role)
  ON CONFLICT (user_id, role) DO NOTHING;

  IF public.has_role(_uid, 'admin') THEN
    RETURN 'admin';
  END IF;
  RETURN _role;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_current_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_current_user(text) TO authenticated;
