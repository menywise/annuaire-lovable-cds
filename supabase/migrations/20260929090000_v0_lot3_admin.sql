-- V0 · Lot 3 « Admin complet » — modération fiable, boîte de contact, offres.
-- Rejouable sans danger : colonnes ajoutées si absentes, politiques et fonctions recréées.

-- 1. Modération : un membre dépose, l'admin valide ------------------------------------------
-- Avant : un membre pouvait insérer un avis ou un commentaire déjà « approved = true ».
DROP POLICY IF EXISTS "Membres deposent un avis" ON public.reviews;
CREATE POLICY "Membres deposent un avis" ON public.reviews FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND approved = false);

DROP POLICY IF EXISTS "Membres commentent" ON public.blog_comments;
CREATE POLICY "Membres commentent" ON public.blog_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id AND approved = false);

-- Témoignages : déposés par un membre connecté, à son propre nom, jamais au nom d'un autre.
DROP POLICY IF EXISTS "Chacun depose un temoignage" ON public.testimonials;
CREATE POLICY "Chacun depose un temoignage" ON public.testimonials FOR INSERT TO authenticated
  WITH CHECK (approved = false AND featured = false AND author_id = auth.uid());

-- 2. Boîte de contact : statut, traitement, suppression ----------------------------------------
ALTER TABLE public.contact_messages
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'nouveau',
  ADD COLUMN IF NOT EXISTS handled_at timestamptz;
ALTER TABLE public.contact_messages DROP CONSTRAINT IF EXISTS contact_messages_status_check;
ALTER TABLE public.contact_messages
  ADD CONSTRAINT contact_messages_status_check CHECK (status IN ('nouveau', 'traite', 'archive'));
CREATE INDEX IF NOT EXISTS contact_messages_status_idx ON public.contact_messages (status, created_at DESC);

-- Le visiteur n'envoie que des messages « nouveau ».
DROP POLICY IF EXISTS "Tout le monde peut envoyer un message" ON public.contact_messages;
CREATE POLICY "Tout le monde peut envoyer un message" ON public.contact_messages FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'nouveau' AND handled_at IS NULL);

GRANT UPDATE, DELETE ON public.contact_messages TO authenticated;
DROP POLICY IF EXISTS "Les admins traitent les messages" ON public.contact_messages;
CREATE POLICY "Les admins traitent les messages" ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Les admins suppriment les messages" ON public.contact_messages;
CREATE POLICY "Les admins suppriment les messages" ON public.contact_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Date de traitement tenue par la base.
CREATE OR REPLACE FUNCTION public.stamp_contact_message()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.handled_at := CASE WHEN NEW.status = 'nouveau' THEN NULL ELSE coalesce(OLD.handled_at, now()) END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS contact_messages_stamp ON public.contact_messages;
CREATE TRIGGER contact_messages_stamp BEFORE UPDATE ON public.contact_messages
  FOR EACH ROW EXECUTE FUNCTION public.stamp_contact_message();

-- 3. Offres : la liste des avantages est toujours une liste ----------------------------------
ALTER TABLE public.pricing_plans DROP CONSTRAINT IF EXISTS pricing_plans_features_array;
ALTER TABLE public.pricing_plans
  ADD CONSTRAINT pricing_plans_features_array CHECK (jsonb_typeof(features) = 'array') NOT VALID;
