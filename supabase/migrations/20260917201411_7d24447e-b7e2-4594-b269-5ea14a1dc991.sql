CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- FAQ ---------------------------------------------------------------
CREATE TABLE public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text NOT NULL DEFAULT 'Général',
  position integer NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.faq_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.faq_items TO authenticated;
GRANT ALL ON public.faq_items TO service_role;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "FAQ publiee visible" ON public.faq_items FOR SELECT TO anon, authenticated
  USING (published OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins gerent la FAQ" ON public.faq_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER faq_items_updated_at BEFORE UPDATE ON public.faq_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Newsletter --------------------------------------------------------
CREATE TABLE public.newsletter_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  first_name text,
  source text NOT NULL DEFAULT 'site',
  consent_at timestamptz NOT NULL DEFAULT now(),
  unsubscribed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.newsletter_subscribers TO anon;
GRANT SELECT, INSERT ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tout le monde peut s abonner" ON public.newsletter_subscribers FOR INSERT TO anon, authenticated
  WITH CHECK (true);
CREATE POLICY "Les admins lisent les abonnes" ON public.newsletter_subscribers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Blog --------------------------------------------------------------
CREATE TABLE public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  excerpt text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  cover_url text,
  author_id uuid,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_posts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_posts TO authenticated;
GRANT ALL ON public.blog_posts TO service_role;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Articles publies visibles" ON public.blog_posts FOR SELECT TO anon, authenticated
  USING (published OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins gerent le blog" ON public.blog_posts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER blog_posts_updated_at BEFORE UPDATE ON public.blog_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.blog_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT 'Membre',
  content text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.blog_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blog_comments TO authenticated;
GRANT ALL ON public.blog_comments TO service_role;
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Commentaires valides visibles" ON public.blog_comments FOR SELECT TO anon, authenticated
  USING (approved OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Membres commentent" ON public.blog_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Auteur modifie son commentaire" ON public.blog_comments FOR UPDATE TO authenticated
  USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id AND approved = false);
CREATE POLICY "Admins moderent les commentaires" ON public.blog_comments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Avis --------------------------------------------------------------
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT 'Membre',
  rating smallint NOT NULL,
  title text NOT NULL DEFAULT '',
  content text NOT NULL,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviews_rating_range CHECK (rating BETWEEN 1 AND 5)
);
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reviews TO authenticated;
GRANT ALL ON public.reviews TO service_role;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Avis valides visibles" ON public.reviews FOR SELECT TO anon, authenticated
  USING (approved OR auth.uid() = author_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Membres deposent un avis" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Auteur modifie son avis" ON public.reviews FOR UPDATE TO authenticated
  USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id AND approved = false);
CREATE POLICY "Admins moderent les avis" ON public.reviews FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Forum -------------------------------------------------------------
CREATE TABLE public.forum_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT 'Membre',
  title text NOT NULL,
  content text NOT NULL,
  locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_topics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_topics TO authenticated;
GRANT ALL ON public.forum_topics TO service_role;
ALTER TABLE public.forum_topics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sujets visibles" ON public.forum_topics FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Membres ouvrent un sujet" ON public.forum_topics FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Auteur modifie son sujet" ON public.forum_topics FOR UPDATE TO authenticated
  USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Admins moderent les sujets" ON public.forum_topics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER forum_topics_updated_at BEFORE UPDATE ON public.forum_topics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.forum_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.forum_topics(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT 'Membre',
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.forum_replies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_replies TO authenticated;
GRANT ALL ON public.forum_replies TO service_role;
ALTER TABLE public.forum_replies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reponses visibles" ON public.forum_replies FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Membres repondent" ON public.forum_replies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Auteur modifie sa reponse" ON public.forum_replies FOR UPDATE TO authenticated
  USING (auth.uid() = author_id) WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Admins moderent les reponses" ON public.forum_replies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Tarifs ------------------------------------------------------------
CREATE TABLE public.pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  period text NOT NULL DEFAULT 'mois',
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_label text NOT NULL DEFAULT 'Commencer',
  highlighted boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pricing_plans TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_plans TO authenticated;
GRANT ALL ON public.pricing_plans TO service_role;
ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Offres actives visibles" ON public.pricing_plans FOR SELECT TO anon, authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Admins gerent les offres" ON public.pricing_plans FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE TRIGGER pricing_plans_updated_at BEFORE UPDATE ON public.pricing_plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Contenus de démarrage ---------------------------------------------
INSERT INTO public.faq_items (question, answer, category, position) VALUES
('Combien de temps faut-il pour lancer un site avec ce modèle ?', 'Vous démarrez avec les pages déjà en place : comptes, pages légales, contact, blog, FAQ, tarifs. Ce qui prenait deux semaines se règle en une après-midi, et vous gardez le temps pour ce qui compte vraiment : votre offre.', 'Démarrage', 1),
('Dois-je toucher au code pour changer mes informations ?', 'Non. Votre espace d''administration regroupe le nom du site, vos coordonnées légales et vos offres. Vous modifiez, vous enregistrez, le site suit immédiatement.', 'Administration', 2),
('Mes données et celles de mes visiteurs sont-elles protégées ?', 'Chaque table est fermée par défaut : un visiteur ne lit que ce qui est publié, un membre ne modifie que ce qui lui appartient, vous seul accédez aux messages et aux abonnés.', 'Sécurité', 3),
('Le référencement est-il vraiment prêt ?', 'Chaque page porte un titre unique, une description, une adresse canonique, un aperçu de partage et des données structurées. Le plan du site se met à jour tout seul.', 'Référencement', 4);

INSERT INTO public.pricing_plans (name, tagline, price_cents, period, features, cta_label, highlighted, position) VALUES
('Découverte', 'Pour valider votre idée sans rien avancer.', 0, 'mois', '["Toutes les pages du modèle","Comptes et espace membre","Pages légales conformes","Formulaire de contact protégé"]'::jsonb, 'Commencer gratuitement', false, 1),
('Professionnel', 'Pour le site qui doit convaincre et convertir.', 2900, 'mois', '["Tout Découverte","Blog et commentaires","FAQ et avis clients","Newsletter et tunnel de vente","Assistance sous 48 h"]'::jsonb, 'Choisir Professionnel', true, 2),
('Expert', 'Pour les équipes qui pilotent plusieurs projets.', 7900, 'mois', '["Tout Professionnel","Forum et communauté","Modèle réutilisable sur vos projets","Accompagnement personnalisé","Assistance prioritaire"]'::jsonb, 'Parler à un expert', false, 3);

INSERT INTO public.blog_posts (slug, title, excerpt, content, published, published_at) VALUES
('pourquoi-un-socle-commun-fait-gagner-des-semaines',
 'Pourquoi un socle commun vous fait gagner des semaines sur chaque projet',
 'Vous connaissez ce moment : le projet est validé, l''envie est là, et vous repartez pour la cinquième fois sur les mêmes pages de connexion et de mentions légales. Voici comment arrêter.',
 E'Vous connaissez ce moment. Le projet est validé, l''envie est là, et vous voilà reparti à écrire une page de connexion, un mot de passe oublié, des mentions légales. Encore. La cinquième fois cette année.\n\nUn socle commun change l''ordre des choses. Les fondations sont déjà posées et vérifiées : les couleurs, les composants, les comptes, les pages légales, le référencement. Ce que vous ouvrez le premier jour, ce n''est plus un chantier, c''est un site qui fonctionne.\n\nCe que vous y gagnez concrètement :\n\n- Du temps : les pages obligatoires sont déjà là, testées, cohérentes.\n- De la sérénité : la sécurité et la conformité ne dépendent plus de votre mémoire.\n- De la cohérence : vos projets se ressemblent, vos clients vous reconnaissent.\n\nEt surtout, vous retrouvez votre attention pour la seule chose que personne ne peut faire à votre place : votre offre, vos mots, votre relation client.',
 true, now());