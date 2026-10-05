-- Socle 1.4.1 — correctifs issus de l'audit de l'annuaire (05/10).
-- 1. Géographie : protection de geo_places réaffirmée (trouvée désactivée en production), aucune
--    écriture possible pour un visiteur sur les tables géographiques.
-- 2. Annuaire : module éteint, un membre ne crée plus de fiche, d'avis ni de demande de propriété.
-- 3. Pilotage : colonne roadmap_items.public_visible supprimée (aucune page publique ne la lisait).
-- 4. Sécurité : tables_sans_protection() liste les tables publiques sans sécurité par ligne ;
--    point de grille SEC-RLS.
-- 5. Version 1.4.1.
-- Rejouable sans danger.

-- 1. Géographie ------------------------------------------------------------------------------------
ALTER TABLE public.geo_places ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS geo_places_read ON public.geo_places;
CREATE POLICY geo_places_read ON public.geo_places FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS geo_places_admin ON public.geo_places;
CREATE POLICY geo_places_admin ON public.geo_places FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS geo_places_updated_at ON public.geo_places;
CREATE TRIGGER geo_places_updated_at BEFORE UPDATE ON public.geo_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.geo_places FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.geo_adjacency FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.geo_departements FROM anon;

-- 2. Annuaire : rien de nouveau quand le module est éteint (l'admin garde la main) ------------------
DROP POLICY IF EXISTS dir_list_insert_auth ON public.directory_listings;
CREATE POLICY dir_list_insert_auth ON public.directory_listings FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.module_enabled('directory')
      AND created_by = auth.uid()
      AND status = 'draft'
      AND verified = false AND featured = false AND plan = 'free'
      AND claimed_by IS NULL AND claimed_at IS NULL
      AND (claim_requested_by IS NULL OR claim_requested_by = auth.uid())
    )
  );
DROP POLICY IF EXISTS dir_rev_insert_auth ON public.directory_reviews;
CREATE POLICY dir_rev_insert_auth ON public.directory_reviews FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND approved = false AND public.module_enabled('directory'));

CREATE OR REPLACE FUNCTION public.request_directory_claim(_listing_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;
  IF NOT public.module_enabled('directory') THEN
    RETURN false;
  END IF;
  UPDATE public.directory_listings
     SET claim_requested_by = _uid,
         claim_requested_at = now()
   WHERE id = _listing_id
     AND status = 'published'
     AND claimed_by IS NULL;
  RETURN FOUND;
END;
$$;
REVOKE ALL ON FUNCTION public.request_directory_claim(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_directory_claim(uuid) TO authenticated;

-- 3. Pilotage : « visible du public » retiré -------------------------------------------------------
ALTER TABLE public.roadmap_items DROP COLUMN IF EXISTS public_visible CASCADE;

-- 4. Sécurité : tables publiques sans protection ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.tables_sans_protection()
RETURNS SETOF text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs';
  END IF;
  RETURN QUERY
    SELECT c.relname::text
    FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relrowsecurity
    ORDER BY 1;
END;
$$;
REVOKE ALL ON FUNCTION public.tables_sans_protection() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tables_sans_protection() TO authenticated, service_role;

INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position, modules)
VALUES ('SEC-RLS', 'Sécurité', 'Aucune table sans protection',
  'En production, tables_sans_protection() ne renvoie rien : chaque table publique a la sécurité par ligne activée.',
  'a_verifier', 'bloquant', '', 150, '{}')
ON CONFLICT (code) DO NOTHING;

-- 5. Version ---------------------------------------------------------------------------------------
INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.4.1', 'correctif', '2026-10-05',
  'Correctifs de l''audit de l''annuaire : sécurité, états de page, pilotage, pages légales, accessibilité.',
  'Protection de geo_places réaffirmée et contrôle tables_sans_protection() (point SEC-RLS) ; annuaire fermé aux membres quand il est éteint ; « visible du public » retiré du pilotage.',
  '20261005150000_v1_4_1_correctifs')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.4.1', 'publie_le', '2026-10-05',
  'migration_reference', '20261005150000_v1_4_1_correctifs'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.4.1', '.')::int[];
