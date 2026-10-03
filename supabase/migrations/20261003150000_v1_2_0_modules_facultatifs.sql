-- Socle 1.2.0 — modules facultatifs éteints par défaut, outils d'administration verrouillés.
-- Outils d'administration (socle, toujours allumés, impossibles à éteindre) : studio (pilotage,
-- conformité, MCP), media (médiathèque : logo, icônes, image de partage), search (recherche).
-- Modules : les 22 autres briques, facultatives, éteintes tant que l'administrateur ne les allume pas.
-- Le choix des modules se fait au lancement du projet (écran Démarrage) ; la base date le premier
-- choix enregistré par un administrateur (réglage « demarrage »).
-- Rejouable sans danger. Écrit pour l'éditeur SQL de Lovable : ni antislash ni point d'interrogation,
-- aucune ligne vide dans une fonction.

-- 1. Valeurs par défaut ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.module_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT '{
    "blog": false, "faq": false, "contact": false, "newsletter": false, "forum": false,
    "members": false, "messaging": false, "testimonials": false, "reviews": false, "pricing": false,
    "onboarding": false, "directory": false, "geo": false, "crm": false, "lms": false,
    "marketplace": false, "adNetwork": false, "studio": true, "showcase": false,
    "media": true, "pages": false, "payments": false, "reports": false, "search": true,
    "shop": false
  }'::jsonb
$$;
GRANT EXECUTE ON FUNCTION public.module_defaults() TO anon, authenticated, service_role;

-- Outils d'administration : toujours allumés.
CREATE OR REPLACE FUNCTION public.module_socle_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY['studio', 'media', 'search']
$$;
GRANT EXECUTE ON FUNCTION public.module_socle_keys() TO anon, authenticated, service_role;

-- 2. État d'un module lu par la base (les règles d'accès s'en servent) ------------------------------
-- Outil d'administration = allumé ; clé inconnue = éteint.
CREATE OR REPLACE FUNCTION public.module_enabled(_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _key = ANY (public.module_socle_keys())
    OR ((public.module_defaults() -> _key) IS NOT NULL AND coalesce((
      public.module_defaults()
      || coalesce((SELECT value FROM public.site_settings WHERE key = 'modules'), '{}'::jsonb)
    ) ->> _key, 'false')::boolean)
$$;
REVOKE ALL ON FUNCTION public.module_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.module_enabled(text) TO anon, authenticated, service_role;

-- 3. Contrôle du réglage « modules » ----------------------------------------------------------------
-- La base refuse une clé inconnue, une valeur non booléenne, un outil d'administration éteint ou une
-- dépendance manquante.
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
    IF (public.module_defaults() -> _k) IS NULL THEN
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

-- 4. Date du choix des modules ----------------------------------------------------------------------
-- Un administrateur connecté enregistre les modules : la base date ce choix dans le réglage
-- « demarrage ». Une migration (sans session) ne compte pas comme un choix.
CREATE OR REPLACE FUNCTION public.mark_modules_choice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.key = 'modules' AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.site_settings (key, value)
    VALUES ('demarrage', jsonb_build_object('modules_choisis_le', now()))
    ON CONFLICT (key) DO UPDATE
      SET value = public.site_settings.value || jsonb_build_object('modules_choisis_le', now()),
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_modules_choice() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS site_settings_mark_modules_choice ON public.site_settings;
CREATE TRIGGER site_settings_mark_modules_choice AFTER INSERT OR UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.mark_modules_choice();

-- 5. Bases existantes ---------------------------------------------------------------------------
-- Un réglage enregistré par un administrateur vaut choix fait.
INSERT INTO public.site_settings (key, value)
SELECT 'demarrage', jsonb_build_object('modules_choisis_le', s.updated_at)
FROM public.site_settings s
WHERE s.key = 'modules' AND s.updated_by IS NOT NULL
ON CONFLICT (key) DO NOTHING;
-- Personne n'a choisi : le réglage reprend les nouvelles valeurs par défaut (tout éteint sauf les
-- outils). Sinon, les outils d'administration sont rallumés et le reste du choix est gardé.
UPDATE public.site_settings SET value = public.module_defaults(), updated_at = now()
WHERE key = 'modules'
  AND NOT EXISTS (SELECT 1 FROM public.site_settings d
                  WHERE d.key = 'demarrage' AND (d.value -> 'modules_choisis_le') IS NOT NULL);
UPDATE public.site_settings
SET value = value || '{"studio": true, "media": true, "search": true}'::jsonb
WHERE key = 'modules'
  AND (value ->> 'studio' = 'false' OR value ->> 'media' = 'false' OR value ->> 'search' = 'false');

-- 6. État du démarrage : choix des modules --------------------------------------------------------
CREATE OR REPLACE FUNCTION public.starter_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _brand jsonb := coalesce((SELECT value FROM public.site_settings WHERE key = 'brand'), '{}'::jsonb);
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'marque_reglee', (SELECT count(*) FROM public.site_settings WHERE key = 'brand') > 0,
    'modules_choisis', EXISTS (SELECT 1 FROM public.site_settings
                               WHERE key = 'demarrage' AND (value -> 'modules_choisis_le') IS NOT NULL),
    'exemples', (SELECT count(*) FROM public.forum_topics WHERE id::text LIKE 'e7000000-%')
              + (SELECT count(*) FROM public.lms_courses WHERE id::text LIKE 'e7000000-%')
              + (SELECT count(*) FROM public.marketplace_listings WHERE id::text LIKE 'e7000000-%')
              + (SELECT count(*) FROM public.reviews WHERE id::text LIKE 'e7000000-%')
              + (SELECT count(*) FROM public.testimonials WHERE id::text LIKE 'e7000000-%')
              + (SELECT count(*) FROM public.blog_comments WHERE id::text LIKE 'e7000000-%'),
    'demarrage', (SELECT count(*) FROM public.faq_items WHERE question IN (
                    'Combien de temps faut-il pour lancer un site avec ce modèle ' || chr(63),
                    'Dois-je toucher au code pour changer mes informations ' || chr(63),
                    'Mes données et celles de mes visiteurs sont-elles protégées ' || chr(63),
                    'Le référencement est-il vraiment prêt ' || chr(63)))
               + (SELECT count(*) FROM public.pricing_plans WHERE (name, tagline) IN (
                    ('Découverte', 'Pour valider votre idée sans rien avancer.'),
                    ('Professionnel', 'Pour le site qui doit convaincre et convertir.'),
                    ('Expert', 'Pour les équipes qui pilotent plusieurs projets.')))
               + (SELECT count(*) FROM public.blog_posts
                  WHERE slug = 'pourquoi-un-socle-commun-fait-gagner-des-semaines'
                    AND title = 'Pourquoi un socle commun vous fait gagner des semaines sur chaque projet'),
    'administrateurs', (SELECT count(*) FROM public.user_roles WHERE role = 'admin'),
    'membres', (SELECT count(*) FROM public.profiles WHERE id::text NOT LIKE 'e7000000-%'),
    'domaine_envoi', coalesce(_brand -> 'email' ->> 'senderDomain', '')
  );
END;
$$;
REVOKE ALL ON FUNCTION public.starter_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.starter_status() TO authenticated, service_role;

-- 7. Version ---------------------------------------------------------------------------------------
INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.2.0', 'brique', '2026-10-03',
  'Modules facultatifs éteints par défaut ; pilotage, médiathèque et recherche deviennent des outils d''administration toujours allumés.',
  'Le choix des modules se fait dans l''écran Démarrage et la base date ce choix (réglage « demarrage »). Une base où aucun administrateur n''a encore choisi repasse à tout éteint.',
  '20261003150000_v1_2_0_modules_facultatifs')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.2.0', 'publie_le', '2026-10-03',
  'migration_reference', '20261003150000_v1_2_0_modules_facultatifs'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.2.0', '.')::int[];
