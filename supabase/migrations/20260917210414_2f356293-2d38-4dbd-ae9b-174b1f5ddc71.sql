-- ============ FORUM : thématiques ============
CREATE TABLE public.forum_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '#0d6efd',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_categories TO authenticated;
GRANT ALL ON public.forum_categories TO service_role;
ALTER TABLE public.forum_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Thematiques visibles" ON public.forum_categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins gerent les thematiques" ON public.forum_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER forum_categories_updated_at BEFORE UPDATE ON public.forum_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FORUM : colonnes supplémentaires ============
ALTER TABLE public.forum_topics
  ADD COLUMN category_id uuid REFERENCES public.forum_categories(id) ON DELETE SET NULL,
  ADD COLUMN views integer NOT NULL DEFAULT 0,
  ADD COLUMN last_activity_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.forum_replies
  ADD COLUMN accepted boolean NOT NULL DEFAULT false;

-- ============ FORUM : j'aime ============
CREATE TABLE public.forum_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_id uuid REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  reply_id uuid REFERENCES public.forum_replies(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_likes_target CHECK (num_nonnulls(topic_id, reply_id) = 1)
);
CREATE UNIQUE INDEX forum_likes_topic_unique ON public.forum_likes (user_id, topic_id) WHERE topic_id IS NOT NULL;
CREATE UNIQUE INDEX forum_likes_reply_unique ON public.forum_likes (user_id, reply_id) WHERE reply_id IS NOT NULL;
GRANT SELECT ON public.forum_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.forum_likes TO authenticated;
GRANT ALL ON public.forum_likes TO service_role;
ALTER TABLE public.forum_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Jaime visibles" ON public.forum_likes FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Membres aiment" ON public.forum_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Membres retirent leur jaime" ON public.forum_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ FORUM : suivi ============
CREATE TABLE public.forum_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic_id uuid NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id)
);
GRANT SELECT, INSERT, DELETE ON public.forum_follows TO authenticated;
GRANT ALL ON public.forum_follows TO service_role;
ALTER TABLE public.forum_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Chacun lit ses suivis" ON public.forum_follows FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Chacun suit" ON public.forum_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Chacun ne suit plus" ON public.forum_follows FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ MEMBRES ============
CREATE TABLE public.member_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT 'Membre',
  avatar_url text,
  bio text NOT NULL DEFAULT '',
  job_title text NOT NULL DEFAULT '',
  website text,
  listed boolean NOT NULL DEFAULT true,
  accepts_messages boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.member_profiles TO anon;
GRANT SELECT, INSERT, UPDATE ON public.member_profiles TO authenticated;
GRANT ALL ON public.member_profiles TO service_role;
ALTER TABLE public.member_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profils listes visibles" ON public.member_profiles FOR SELECT TO anon, authenticated
  USING (listed OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Chacun cree son profil membre" ON public.member_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Chacun modifie son profil membre" ON public.member_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER member_profiles_updated_at BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ MESSAGERIE ============
CREATE TABLE public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a uuid NOT NULL,
  user_b uuid NOT NULL,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pair CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants lisent la conversation" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Membres ouvrent une conversation" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);
CREATE POLICY "Participants mettent a jour" ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() = user_a OR auth.uid() = user_b) WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND (c.user_a = _user_id OR c.user_b = _user_id)
  )
$$;
REVOKE ALL ON FUNCTION public.is_conversation_participant(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_conversation_participant(uuid, uuid) TO authenticated, service_role;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_conversation_idx ON public.messages (conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Participants lisent les messages" ON public.messages FOR SELECT TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Participants envoient" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND public.is_conversation_participant(conversation_id, auth.uid()));
CREATE POLICY "Participants marquent comme lu" ON public.messages FOR UPDATE TO authenticated
  USING (public.is_conversation_participant(conversation_id, auth.uid()))
  WITH CHECK (public.is_conversation_participant(conversation_id, auth.uid()));

-- ============ TÉMOIGNAGES ============
CREATE TABLE public.testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid,
  author_name text NOT NULL,
  role_title text NOT NULL DEFAULT '',
  company text NOT NULL DEFAULT '',
  avatar_url text,
  content text NOT NULL,
  outcome text NOT NULL DEFAULT '',
  featured boolean NOT NULL DEFAULT false,
  approved boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.testimonials TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.testimonials TO authenticated;
GRANT ALL ON public.testimonials TO service_role;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Temoignages valides visibles" ON public.testimonials FOR SELECT TO anon, authenticated
  USING (approved OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Chacun depose un temoignage" ON public.testimonials FOR INSERT TO anon, authenticated
  WITH CHECK (approved = false AND featured = false);
CREATE POLICY "Admins gerent les temoignages" ON public.testimonials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER testimonials_updated_at BEFORE UPDATE ON public.testimonials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PILOTAGE : feuille de route ============
CREATE TABLE public.roadmap_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  lot text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'a_faire',
  priority text NOT NULL DEFAULT 'normale',
  position integer NOT NULL DEFAULT 0,
  public_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roadmap_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_items TO authenticated;
GRANT ALL ON public.roadmap_items TO service_role;
ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Feuille de route visible" ON public.roadmap_items FOR SELECT TO anon, authenticated
  USING (public_visible OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gerent la feuille de route" ON public.roadmap_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER roadmap_items_updated_at BEFORE UPDATE ON public.roadmap_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PILOTAGE : plan directeur ============
CREATE TABLE public.masterplan_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.masterplan_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.masterplan_sections TO authenticated;
GRANT ALL ON public.masterplan_sections TO service_role;
ALTER TABLE public.masterplan_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plan directeur visible" ON public.masterplan_sections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins gerent le plan directeur" ON public.masterplan_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER masterplan_sections_updated_at BEFORE UPDATE ON public.masterplan_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PILOTAGE : audits ============
CREATE TABLE public.audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  max_score integer NOT NULL DEFAULT 100,
  summary text NOT NULL DEFAULT '',
  performed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audits TO authenticated;
GRANT ALL ON public.audits TO service_role;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins lisent les audits" ON public.audits FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gerent les audits" ON public.audits FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.audit_findings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id uuid NOT NULL REFERENCES public.audits(id) ON DELETE CASCADE,
  code text NOT NULL,
  severity text NOT NULL DEFAULT 'mineur',
  location text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_findings_audit_idx ON public.audit_findings (audit_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_findings TO authenticated;
GRANT ALL ON public.audit_findings TO service_role;
ALTER TABLE public.audit_findings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerent les anomalies" ON public.audit_findings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ FONCTIONS COMMUNAUTÉ ============
CREATE OR REPLACE FUNCTION public.increment_topic_views(_topic_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.forum_topics SET views = views + 1 WHERE id = _topic_id;
$$;
REVOKE ALL ON FUNCTION public.increment_topic_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_topic_views(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.forum_top_members(_since timestamptz DEFAULT NULL)
RETURNS TABLE (user_id uuid, display_name text, topics bigint, replies bigint, likes bigint, score bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH t AS (
    SELECT author_id AS uid, max(author_name) AS name, count(*) AS n
    FROM public.forum_topics
    WHERE _since IS NULL OR created_at >= _since
    GROUP BY author_id
  ), r AS (
    SELECT author_id AS uid, max(author_name) AS name, count(*) AS n
    FROM public.forum_replies
    WHERE _since IS NULL OR created_at >= _since
    GROUP BY author_id
  ), l AS (
    SELECT coalesce(ft.author_id, fr.author_id) AS uid, count(*) AS n
    FROM public.forum_likes fl
    LEFT JOIN public.forum_topics ft ON ft.id = fl.topic_id
    LEFT JOIN public.forum_replies fr ON fr.id = fl.reply_id
    WHERE _since IS NULL OR fl.created_at >= _since
    GROUP BY coalesce(ft.author_id, fr.author_id)
  ), ids AS (
    SELECT uid FROM t UNION SELECT uid FROM r UNION SELECT uid FROM l
  )
  SELECT
    ids.uid,
    coalesce(mp.display_name, t.name, r.name, 'Membre') AS display_name,
    coalesce(t.n, 0) AS topics,
    coalesce(r.n, 0) AS replies,
    coalesce(l.n, 0) AS likes,
    coalesce(t.n, 0) * 3 + coalesce(r.n, 0) * 2 + coalesce(l.n, 0) AS score
  FROM ids
  LEFT JOIN t ON t.uid = ids.uid
  LEFT JOIN r ON r.uid = ids.uid
  LEFT JOIN l ON l.uid = ids.uid
  LEFT JOIN public.member_profiles mp ON mp.user_id = ids.uid
  WHERE ids.uid IS NOT NULL
  ORDER BY score DESC
  LIMIT 10;
$$;
REVOKE ALL ON FUNCTION public.forum_top_members(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forum_top_members(timestamptz) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.touch_topic_activity()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.forum_topics SET last_activity_at = now() WHERE id = NEW.topic_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER forum_replies_touch_topic AFTER INSERT ON public.forum_replies
  FOR EACH ROW EXECUTE FUNCTION public.touch_topic_activity();

-- ============ DONNÉES INITIALES ============
INSERT INTO public.forum_categories (slug, name, description, color, position) VALUES
  ('demarrage', 'Démarrage', 'Premiers pas, installation, premières questions.', '#0d6efd', 1),
  ('design', 'Design et interface', 'Couleurs, typographie, composants, accessibilité.', '#7c3aed', 2),
  ('technique', 'Technique', 'Intégration, données, performances, sécurité.', '#0891b2', 3),
  ('visibilite', 'Visibilité', 'Référencement, contenu, conversion.', '#15803d', 4),
  ('entraide', 'Entraide libre', 'Tout ce qui ne rentre pas ailleurs.', '#b45200', 5);

INSERT INTO public.masterplan_sections (title, content, position) VALUES
  ('Vision', 'CDS est le socle commun de tous les projets du workspace : un thème, un kit de pages système et une communauté prêts à être réutilisés sans repartir de zéro.', 1),
  ('Pour qui', 'Indépendants, artisans et solopreneurs qui veulent un site sérieux sans recommencer chaque fondation à chaque projet.', 2),
  ('Promesse', 'Vous démarrez un nouveau projet avec des fondations déjà auditées : accessibilité, référencement, mentions légales, comptes et communauté.', 3),
  ('Modules activés', 'FAQ, blog, forum, avis, témoignages, lettre d''information, tarifs, tunnel de vente, espace membre, messagerie, administration.', 4);

INSERT INTO public.roadmap_items (title, description, lot, status, priority, position) VALUES
  ('Forum communautaire', 'Thématiques, texte enrichi, j''aime, suivi, réponse acceptée, membres actifs.', 'Lot 1', 'en_cours', 'haute', 1),
  ('Profils et messagerie', 'Annuaire des membres, profil public, messages privés.', 'Lot 2', 'en_cours', 'haute', 2),
  ('Témoignages', 'Page dédiée, bandeau réutilisable, validation en administration.', 'Lot 3', 'en_cours', 'normale', 3),
  ('Navigation et mobile', 'En-tête fixe, pied de page 4 colonnes, installation sur mobile, responsive vérifié.', 'Lot 4', 'en_cours', 'haute', 4),
  ('Tableau de bord de pilotage', 'Feuille de route, plan directeur, audits avec mémoire.', 'Lot 5', 'en_cours', 'normale', 5),
  ('Paiement des offres', 'Brancher Stripe ou Paddle sur les offres tarifaires.', 'À venir', 'bloque', 'haute', 6),
  ('Envoi e-mail du contact', 'Acheminer les messages de contact par e-mail.', 'À venir', 'bloque', 'normale', 7);
