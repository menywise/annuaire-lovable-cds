-- V0 · Lot 4 — failles des briques 12 à 16 (annuaire, géographie, CRM, formations, annonces).
-- Rejouable sans danger : politiques, fonctions et déclencheurs recréés, colonne ajoutée si absente.
-- Géographie et CRM : aucune faille trouvée (lecture publique / accès au seul propriétaire).

-- 1. Petites annonces ----------------------------------------------------------------------
-- Dépôt toujours « en attente de validation ».
DROP POLICY IF EXISTS mkt_list_insert ON public.marketplace_listings;
CREATE POLICY mkt_list_insert ON public.marketplace_listings FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() AND approved = false AND views = 0);

-- Le vendeur ne valide pas, ne gonfle pas les vues, ne change pas de propriétaire ;
-- une annonce validée dont il modifie le contenu repasse en attente de validation.
CREATE OR REPLACE FUNCTION public.guard_marketplace_listing_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.approved IS DISTINCT FROM OLD.approved AND NEW.approved
     OR NEW.views IS DISTINCT FROM OLD.views
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN
    RAISE EXCEPTION 'Modification non autorisée' USING ERRCODE = '42501';
  END IF;
  IF (NEW.title, NEW.description, NEW.price_cents, NEW.currency, NEW.photos, NEW.category_id,
      NEW.tags, NEW.city, NEW.departement, NEW.slug)
     IS DISTINCT FROM
     (OLD.title, OLD.description, OLD.price_cents, OLD.currency, OLD.photos, OLD.category_id,
      OLD.tags, OLD.city, OLD.departement, OLD.slug) THEN
    NEW.approved := false;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS marketplace_listings_guard ON public.marketplace_listings;
CREATE TRIGGER marketplace_listings_guard BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_marketplace_listing_update();

-- Compteur de vues : seulement par cette fonction, seulement sur une annonce visible.
CREATE OR REPLACE FUNCTION public.increment_listing_views(_listing_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.marketplace_listings SET views = views + 1
  WHERE id = _listing_id AND status = 'active' AND approved;
$$;
REVOKE ALL ON FUNCTION public.increment_listing_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_listing_views(uuid) TO anon, authenticated;

-- 2. Annuaire métier -------------------------------------------------------------------------
-- Une fiche proposée par un membre arrive en brouillon, sans vérification, mise en avant ni propriétaire
-- (au plus une demande de revendication à son nom).
DROP POLICY IF EXISTS dir_list_insert_auth ON public.directory_listings;
CREATE POLICY dir_list_insert_auth ON public.directory_listings FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      created_by = auth.uid()
      AND status = 'draft'
      AND verified = false AND featured = false AND plan = 'free'
      AND claimed_by IS NULL AND claimed_at IS NULL
      -- L'auteur peut demander la propriété de sa fiche ; l'admin valide la demande.
      AND (claim_requested_by IS NULL OR claim_requested_by = auth.uid())
    )
  );

-- L'auteur ou le propriétaire modifie le contenu ; publication, vérification, mise en avant,
-- offre et propriété restent à l'admin. Il peut repasser sa fiche en brouillon ou l'archiver.
CREATE OR REPLACE FUNCTION public.guard_directory_listing_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NEW.verified IS DISTINCT FROM OLD.verified
     OR NEW.featured IS DISTINCT FROM OLD.featured
     OR NEW.plan IS DISTINCT FROM OLD.plan
     OR NEW.claimed_by IS DISTINCT FROM OLD.claimed_by
     OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at
     OR NEW.claim_requested_by IS DISTINCT FROM OLD.claim_requested_by
     OR NEW.claim_requested_at IS DISTINCT FROM OLD.claim_requested_at
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR (NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'published') THEN
    RAISE EXCEPTION 'Modification réservée à l''administration' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS directory_listings_guard ON public.directory_listings;
CREATE TRIGGER directory_listings_guard BEFORE UPDATE ON public.directory_listings
  FOR EACH ROW EXECUTE FUNCTION public.guard_directory_listing_update();

-- Avis sur une fiche : dépôt en attente ; l'auteur ne valide pas ; une modification repasse en attente.
DROP POLICY IF EXISTS dir_rev_insert_auth ON public.directory_reviews;
CREATE POLICY dir_rev_insert_auth ON public.directory_reviews FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND approved = false);

CREATE OR REPLACE FUNCTION public.guard_directory_review_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF (NEW.approved IS DISTINCT FROM OLD.approved AND NEW.approved)
     OR NEW.author_id IS DISTINCT FROM OLD.author_id
     OR NEW.listing_id IS DISTINCT FROM OLD.listing_id THEN
    RAISE EXCEPTION 'Modification non autorisée' USING ERRCODE = '42501';
  END IF;
  IF (NEW.rating, NEW.content, NEW.author_name) IS DISTINCT FROM (OLD.rating, OLD.content, OLD.author_name) THEN
    NEW.approved := false;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS directory_reviews_guard ON public.directory_reviews;
CREATE TRIGGER directory_reviews_guard BEFORE UPDATE ON public.directory_reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_directory_review_update();

-- 3. Formations ------------------------------------------------------------------------------
-- Paiement enregistré par l'admin (en attendant Stripe) ; une formation payante n'ouvre son
-- contenu qu'une fois réglée. L'inscription à une formation payante vaut réservation.
ALTER TABLE public.lms_enrollments ADD COLUMN IF NOT EXISTS paid_at timestamptz;

DROP POLICY IF EXISTS lms_enrollments_own ON public.lms_enrollments;
DROP POLICY IF EXISTS lms_enrollments_read ON public.lms_enrollments;
DROP POLICY IF EXISTS lms_enrollments_insert ON public.lms_enrollments;
DROP POLICY IF EXISTS lms_enrollments_delete ON public.lms_enrollments;
DROP POLICY IF EXISTS lms_enrollments_admin ON public.lms_enrollments;
CREATE POLICY lms_enrollments_read ON public.lms_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY lms_enrollments_insert ON public.lms_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      user_id = auth.uid() AND paid_at IS NULL
      AND EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.id = course_id AND c.published)
    )
  );
CREATE POLICY lms_enrollments_delete ON public.lms_enrollments FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY lms_enrollments_admin ON public.lms_enrollments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Accès à une leçon : aperçu gratuit d'une formation publiée, inscription (réglée si payante), ou admin.
CREATE OR REPLACE FUNCTION public.can_access_lesson(_lesson_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id, 'admin') OR EXISTS (
    SELECT 1
    FROM public.lms_lessons l
    JOIN public.lms_modules m ON m.id = l.module_id
    JOIN public.lms_courses c ON c.id = m.course_id
    WHERE l.id = _lesson_id
      AND c.published
      AND (
        l.free_preview
        OR EXISTS (
          SELECT 1 FROM public.lms_enrollments e
          WHERE e.course_id = c.id AND e.user_id = _user_id
            AND (c.price_cents = 0 OR e.paid_at IS NOT NULL)
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION public.can_access_lesson(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_access_lesson(uuid, uuid) TO authenticated;

-- Le contenu (texte, vidéo) n'est plus lisible directement : seulement via lms_lesson_content.
REVOKE SELECT ON public.lms_lessons FROM anon, authenticated;
GRANT SELECT (id, module_id, title, content_type, duration_minutes, position, free_preview, created_at)
  ON public.lms_lessons TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.lms_lesson_content(_lesson_id uuid)
RETURNS TABLE (content text, video_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT l.content, l.video_url
  FROM public.lms_lessons l
  WHERE l.id = _lesson_id AND public.can_access_lesson(_lesson_id, auth.uid())
$$;
REVOKE ALL ON FUNCTION public.lms_lesson_content(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lms_lesson_content(uuid) TO anon, authenticated;

-- Progression : seulement sur une leçon accessible.
DROP POLICY IF EXISTS lms_progress_own ON public.lms_progress;
DROP POLICY IF EXISTS lms_progress_read ON public.lms_progress;
DROP POLICY IF EXISTS lms_progress_write ON public.lms_progress;
DROP POLICY IF EXISTS lms_progress_update ON public.lms_progress;
DROP POLICY IF EXISTS lms_progress_delete ON public.lms_progress;
CREATE POLICY lms_progress_read ON public.lms_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY lms_progress_write ON public.lms_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_access_lesson(lesson_id, auth.uid()));
CREATE POLICY lms_progress_update ON public.lms_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND public.can_access_lesson(lesson_id, auth.uid()));
CREATE POLICY lms_progress_delete ON public.lms_progress FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
