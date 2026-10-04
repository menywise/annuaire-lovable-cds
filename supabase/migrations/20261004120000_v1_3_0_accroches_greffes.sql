-- Socle 1.3.0 — accroches pour greffes.
-- Un projet (clone du socle) ajoute ses modules, ses tables et ses pages sans modifier un fichier
-- ni une table du socle (Loi des Quatre Interdits). Ce qui appartient au projet porte la marque
-- « greffe » : modules et objets SQL greffe_<nom>, code dans src/greffe/ et src/routes/(greffe)/.
-- Mode d'emploi : docs/CLONER.md, « Écrire une greffe ».
-- Rejouable sans danger. Écrit pour l'éditeur SQL de Lovable : ni antislash ni point d'interrogation,
-- aucune ligne vide dans une fonction.

-- 1. Clé de module d'un projet ---------------------------------------------------------------------
-- greffe_ puis 1 à 40 minuscules, chiffres ou soulignés (même règle que isGreffeKey dans le code).
CREATE OR REPLACE FUNCTION public.module_is_greffe(_key text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(_key ~ '^greffe_[a-z0-9_]{1,40}$', false)
$$;
GRANT EXECUTE ON FUNCTION public.module_is_greffe(text) TO anon, authenticated, service_role;

-- Les modules d'un projet contenus dans un réglage. Une migration du socle qui réécrit le réglage
-- « modules » les remet toujours : value = nouvelles_valeurs || public.module_greffe_values(value).
CREATE OR REPLACE FUNCTION public.module_greffe_values(_value jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  FROM jsonb_each(coalesce(_value, '{}'::jsonb)) AS e
  WHERE public.module_is_greffe(e.key) AND jsonb_typeof(e.value) = 'boolean'
$$;
GRANT EXECUTE ON FUNCTION public.module_greffe_values(jsonb) TO anon, authenticated, service_role;

-- 2. État d'un module lu par la base ----------------------------------------------------------------
-- Outil d'administration = allumé ; module du socle = réglage ou valeur par défaut ; module d'un
-- projet = réglage, éteint par défaut ; clé inconnue = éteint.
CREATE OR REPLACE FUNCTION public.module_enabled(_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _key = ANY (public.module_socle_keys())
    OR ((public.module_defaults() -> _key) IS NOT NULL AND coalesce((
      public.module_defaults()
      || coalesce((SELECT value FROM public.site_settings WHERE key = 'modules'), '{}'::jsonb)
    ) ->> _key, 'false')::boolean)
    OR (public.module_is_greffe(_key) AND coalesce(
      (SELECT value ->> _key FROM public.site_settings WHERE key = 'modules'), 'false') = 'true')
$$;
REVOKE ALL ON FUNCTION public.module_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.module_enabled(text) TO anon, authenticated, service_role;

-- 3. Contrôle du réglage « modules » ----------------------------------------------------------------
-- Clé acceptée : module du socle ou module d'un projet (greffe_). Les dépendances d'un module de
-- projet sont vérifiées par le code ; ses règles d'accès s'appuient sur module_enabled.
CREATE OR REPLACE FUNCTION public.validate_modules_setting()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _k text;
  _v jsonb;
  _m jsonb;
BEGIN
  IF NEW.key <> 'modules' THEN
    RETURN NEW;
  END IF;
  IF jsonb_typeof(NEW.value) <> 'object' THEN
    RAISE EXCEPTION 'Modules : objet attendu' USING ERRCODE = '22023';
  END IF;
  FOR _k, _v IN SELECT * FROM jsonb_each(NEW.value) LOOP
    IF (public.module_defaults() -> _k) IS NULL AND NOT public.module_is_greffe(_k) THEN
      RAISE EXCEPTION 'Module inconnu : %', _k USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(_v) <> 'boolean' THEN
      RAISE EXCEPTION 'Module % : vrai ou faux attendu', _k USING ERRCODE = '22023';
    END IF;
    IF _k = ANY (public.module_socle_keys()) AND NOT _v::text::boolean THEN
      RAISE EXCEPTION 'Outil d''administration toujours allumé : %', _k USING ERRCODE = '23514';
    END IF;
  END LOOP;
  _m := public.module_defaults() || NEW.value;
  IF (_m ->> 'geo')::boolean AND NOT (_m ->> 'directory')::boolean THEN
    RAISE EXCEPTION 'La géographie exige l''annuaire métier' USING ERRCODE = '23514';
  END IF;
  IF (_m ->> 'messaging')::boolean AND NOT (_m ->> 'members')::boolean THEN
    RAISE EXCEPTION 'La messagerie exige les membres' USING ERRCODE = '23514';
  END IF;
  IF (_m ->> 'marketplace')::boolean AND NOT (_m ->> 'messaging')::boolean THEN
    RAISE EXCEPTION 'Les petites annonces exigent la messagerie' USING ERRCODE = '23514';
  END IF;
  IF (_m ->> 'payments')::boolean AND NOT (_m ->> 'lms')::boolean THEN
    RAISE EXCEPTION 'Le paiement en ligne exige les formations' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- 4. Table d'extension d'une fiche de l'annuaire métier ---------------------------------------------
-- Une greffe ajoute ses colonnes dans sa propre table, liée par id avec suppression en cascade :
--   CREATE TABLE public.greffe_<nom> (listing_id uuid PRIMARY KEY
--     REFERENCES public.directory_listings(id) ON DELETE CASCADE, ...);
-- et reprend les droits de la fiche avec ces deux fonctions, sans les réécrire :
--   lecture : USING (public.directory_listing_visible(listing_id))
--   écriture : USING / WITH CHECK (public.directory_listing_modifiable(listing_id))
-- Exécutées avec les droits de l'appelant : les règles d'accès de la fiche s'appliquent telles quelles.
CREATE OR REPLACE FUNCTION public.directory_listing_visible(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.directory_listings WHERE id = _id)
$$;
GRANT EXECUTE ON FUNCTION public.directory_listing_visible(uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.directory_listing_modifiable(_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.directory_listings l
    WHERE l.id = _id
      AND (l.claimed_by = auth.uid() OR l.created_by = auth.uid()
           OR public.has_role(auth.uid(), 'admin'::public.app_role)))
$$;
GRANT EXECUTE ON FUNCTION public.directory_listing_modifiable(uuid) TO anon, authenticated, service_role;

-- 5. Version ---------------------------------------------------------------------------------------
INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.3.0', 'brique', '2026-10-04',
  'Accroches pour greffes : un projet ajoute ses modules, ses menus, ses pages et ses tables sans modifier le socle.',
  'Modules greffe_ acceptés et conservés par la base ; prise src/greffe/index.ts lue par les menus, le plan du site, le sitemap, la recette et les pages protégées ; fonctions de droits des fiches de l''annuaire pour les tables d''extension.',
  '20261004120000_v1_3_0_accroches_greffes')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.3.0', 'publie_le', '2026-10-04',
  'migration_reference', '20261004120000_v1_3_0_accroches_greffes'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.3.0', '.')::int[];
