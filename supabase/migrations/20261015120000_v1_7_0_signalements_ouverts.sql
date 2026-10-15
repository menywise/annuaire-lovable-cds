-- Socle 1.7.0 — signalements ouverts aux visiteurs.
-- 1. Un visiteur sans compte signale une erreur, un oubli ou propose une correction. Le membre garde
--    son parcours (motifs de modération, 10 signalements par 24 heures).
-- 2. Les envois passent par une fonction (report_submit) : bornes, champ piège, un lien au plus,
--    plafonds d'envoi des visiteurs sans stocker d'adresse IP (même principe que le contact, 1.6.1).
-- 3. Chaque signalement reçoit un code de suivi : le visiteur suit son traitement (report_status).
-- 4. L'administrateur écrit une réponse publique : les corrections appliquées avec une réponse
--    publique forment la page « Le site s'améliore grâce à vous » (report_improvements), sans nom.
-- 5. L'adresse e-mail facultative d'un visiteur est effacée 3 mois après le traitement (pg_cron).
-- 6. Grille de conformité et version 1.7.0.
-- Rejouable sans danger. Les expressions régulières écrivent le point « [.] », sans antislash : l'éditeur
-- SQL de Lovable le refuse, et les blocs de supabase/seed/v1_7_0/ reprennent ce texte tel quel.

-- 1. Table des signalements : visiteurs, correction proposée, suivi, réponse publique --------------
ALTER TABLE public.reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'membre';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS proposed_value text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS public_note text;

-- Un signalement de membre porte son auteur ; celui d'un visiteur n'en porte jamais.
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_source_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_source_check CHECK (
  (source = 'membre' AND reporter_id IS NOT NULL) OR (source = 'visiteur' AND reporter_id IS NULL));
-- « page » : la page entière, quand le signalement ne vise pas un contenu précis.
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_content_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_content_type_check CHECK (content_type IN (
  'article', 'commentaire', 'sujet', 'reponse', 'avis', 'fiche', 'avis_fiche', 'annonce',
  'temoignage', 'membre', 'formation', 'page', 'autre'));
-- « oubli » : une information manque ; « correction » : le visiteur propose la bonne valeur.
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reason_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_reason_check CHECK (reason IN (
  'spam', 'contenu_inapproprie', 'harcelement', 'fraude', 'information_erronee', 'doublon',
  'droit_auteur', 'contenu_illegal', 'oubli', 'correction', 'autre'));
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_proposed_length;
ALTER TABLE public.reports ADD CONSTRAINT reports_proposed_length CHECK (char_length(proposed_value) <= 2000);
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_public_note_length;
ALTER TABLE public.reports ADD CONSTRAINT reports_public_note_length CHECK (char_length(public_note) <= 500);
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_contact_email_format;
ALTER TABLE public.reports ADD CONSTRAINT reports_contact_email_format CHECK (contact_email IS NULL OR (
  char_length(contact_email) <= 254 AND contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'));
-- Un lien au plus dans le texte libre : au-delà, c'est presque toujours de la publicité.
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_links_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_links_check CHECK (
  regexp_count(coalesce(details, '') || ' ' || coalesce(proposed_value, ''), '(https|http)://|www[.]', 1, 'i') <= 1);
CREATE UNIQUE INDEX IF NOT EXISTS reports_tracking_code_key ON public.reports (tracking_code);
CREATE INDEX IF NOT EXISTS reports_improvements_idx ON public.reports (handled_at DESC)
  WHERE status = 'action_prise' AND public_note IS NOT NULL;

-- Insertion directe par un membre : toujours en son nom, sans réponse publique ni code choisi.
DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid() AND source = 'membre' AND status = 'en_attente' AND admin_note IS NULL
    AND public_note IS NULL AND handled_at IS NULL AND handled_by IS NULL
    AND public.module_enabled('reports')
  );

-- Dépôt : code de suivi et date tenus par la base, limite des membres. Traitement : le dépôt reste
-- figé ; seule l'adresse du visiteur peut être effacée (purge).
CREATE OR REPLACE FUNCTION public.guard_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.tracking_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    IF NEW.reporter_id IS NOT NULL AND NOT public.has_role(NEW.reporter_id, 'admin') AND (
      SELECT count(*) FROM public.reports r
      WHERE r.reporter_id = NEW.reporter_id AND r.created_at > now() - interval '24 hours'
    ) >= 10 THEN
      RAISE EXCEPTION 'Trop de signalements aujourd''hui : réessayez demain' USING ERRCODE = '54000';
    END IF;
    RETURN NEW;
  END IF;
  -- Seule anonymisation permise : identifiant neutre (suppression de compte).
  NEW.reporter_id := CASE WHEN NEW.reporter_id = '00000000-0000-0000-0000-000000000000'::uuid
                          THEN NEW.reporter_id ELSE OLD.reporter_id END;
  NEW.source := OLD.source;
  NEW.content_type := OLD.content_type;
  NEW.content_id := OLD.content_id;
  NEW.reason := OLD.reason;
  NEW.details := OLD.details;
  NEW.proposed_value := OLD.proposed_value;
  NEW.reported_url := OLD.reported_url;
  NEW.tracking_code := OLD.tracking_code;
  NEW.contact_email := CASE WHEN NEW.contact_email IS NULL THEN NULL ELSE OLD.contact_email END;
  NEW.created_at := OLD.created_at;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.admin_note IS DISTINCT FROM OLD.admin_note
     OR NEW.public_note IS DISTINCT FROM OLD.public_note THEN
    NEW.handled_at := CASE WHEN NEW.status = 'en_attente' THEN NULL ELSE now() END;
    NEW.handled_by := CASE WHEN NEW.status = 'en_attente' THEN NULL ELSE auth.uid() END;
  ELSE
    NEW.handled_at := OLD.handled_at;
    NEW.handled_by := CASE WHEN NEW.handled_by IS NULL THEN NULL ELSE OLD.handled_by END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reports_guard ON public.reports;
CREATE TRIGGER reports_guard BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_report();

-- 2. Envoyer un signalement, visiteur ou membre ----------------------------------------------------
-- Les protections du navigateur (champ piège, délai de 3 secondes) ne valent rien face à un appel
-- direct : les bornes et les plafonds sont posés ici. Champ piège rempli : un faux code est rendu et
-- rien n'est enregistré, pour ne pas apprendre au robot qu'il est repéré.
-- Plafonds des visiteurs : 30 signalements par heure pour tout le site (CDS04), 5 par 24 heures par
-- adresse e-mail donnée (CDS05), le même texte déjà en attente sur la même page refusé (CDS06).
-- Les membres gardent la limite du dépôt (10 par 24 heures) et l'unicité par contenu en attente.
CREATE OR REPLACE FUNCTION public.report_submit(
  _content_type text, _reason text, _details text DEFAULT NULL, _content_id uuid DEFAULT NULL,
  _proposed_value text DEFAULT NULL, _reported_url text DEFAULT NULL,
  _contact_email text DEFAULT NULL, _trap text DEFAULT NULL)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _text text := nullif(btrim(coalesce(_details, '')), '');
  _value text := nullif(btrim(coalesce(_proposed_value, '')), '');
  _mail text := nullif(lower(btrim(coalesce(_contact_email, ''))), '');
  _path text := nullif(btrim(coalesce(_reported_url, '')), '');
  _code text;
BEGIN
  IF NOT public.module_enabled('reports') THEN
    RAISE EXCEPTION 'Les signalements sont désactivés' USING ERRCODE = '42501';
  END IF;
  IF coalesce(_trap, '') <> '' THEN
    RETURN upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
  END IF;
  IF _reason = 'correction' AND _value IS NULL THEN
    RAISE EXCEPTION 'Indiquez la correction que vous proposez' USING ERRCODE = '23514';
  END IF;
  IF _uid IS NULL AND char_length(coalesce(_text, '') || coalesce(_value, '')) < 5 THEN
    RAISE EXCEPTION 'Décrivez ce que vous avez vu (5 caractères au moins)' USING ERRCODE = '23514';
  END IF;
  IF _uid IS NULL THEN
    -- Un envoi à la fois : deux envois simultanés ne passent pas tous les deux sous le plafond.
    PERFORM pg_advisory_xact_lock(hashtext('cds.reports.visiteur'));
    IF (SELECT count(*) FROM public.reports r
        WHERE r.source = 'visiteur' AND r.created_at > now() - interval '1 hour') >= 30 THEN
      RAISE EXCEPTION 'Beaucoup de signalements reçus pour le moment. Réessayez dans une heure.'
        USING ERRCODE = 'CDS04';
    END IF;
    IF _mail IS NOT NULL AND (SELECT count(*) FROM public.reports r
        WHERE r.source = 'visiteur' AND r.created_at > now() - interval '24 hours'
          AND r.contact_email = _mail) >= 5 THEN
      RAISE EXCEPTION 'Plusieurs signalements ont déjà été envoyés avec cette adresse aujourd''hui. Réessayez demain.'
        USING ERRCODE = 'CDS05';
    END IF;
    IF EXISTS (SELECT 1 FROM public.reports r
        WHERE r.source = 'visiteur' AND r.status = 'en_attente'
          AND r.reported_url IS NOT DISTINCT FROM _path
          AND r.details IS NOT DISTINCT FROM _text
          AND r.proposed_value IS NOT DISTINCT FROM _value) THEN
      RAISE EXCEPTION 'Ce signalement a déjà été reçu : l''équipe l''examine.' USING ERRCODE = 'CDS06';
    END IF;
  END IF;
  INSERT INTO public.reports (reporter_id, source, content_type, content_id, reason, details,
                              proposed_value, reported_url, contact_email)
  VALUES (_uid, CASE WHEN _uid IS NULL THEN 'visiteur' ELSE 'membre' END, _content_type, _content_id,
          _reason, _text, _value, _path, CASE WHEN _uid IS NULL THEN _mail END)
  RETURNING tracking_code INTO _code;
  RETURN _code;
END;
$$;
REVOKE ALL ON FUNCTION public.report_submit(text, text, text, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_submit(text, text, text, uuid, text, text, text, text)
  TO anon, authenticated, service_role;

-- 3. Suivre son signalement avec son code ------------------------------------------------------------
-- Rend l'état et la réponse publique, jamais la note interne ni l'auteur.
CREATE OR REPLACE FUNCTION public.report_status(_code text)
RETURNS TABLE (status text, reason text, created_at timestamptz, handled_at timestamptz, public_note text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.status, r.reason, r.created_at, r.handled_at, r.public_note
  FROM public.reports r
  WHERE public.module_enabled('reports')
    AND char_length(coalesce(_code, '')) BETWEEN 6 AND 20
    AND r.tracking_code = upper(btrim(_code))
$$;
REVOKE ALL ON FUNCTION public.report_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_status(text) TO anon, authenticated, service_role;

-- 4. Les améliorations apportées grâce aux visiteurs et aux membres ---------------------------------
-- Seuls les signalements suivis d'une action ET d'une réponse publique écrite par l'administrateur
-- sont montrés. Ni auteur, ni texte du signalement : la réponse publique seule.
CREATE OR REPLACE FUNCTION public.report_improvements(_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, reason text, content_type text, reported_url text, public_note text, handled_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.reason, r.content_type, r.reported_url, r.public_note, r.handled_at
  FROM public.reports r
  WHERE public.module_enabled('reports') AND r.status = 'action_prise' AND r.public_note IS NOT NULL
  ORDER BY r.handled_at DESC
  LIMIT least(greatest(coalesce(_limit, 50), 1), 200)
$$;
REVOKE ALL ON FUNCTION public.report_improvements(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.report_improvements(integer) TO anon, authenticated, service_role;

-- 5. Effacement de l'adresse e-mail des visiteurs (politique de confidentialité) -------------------
-- 3 mois après le traitement ; 12 mois après l'envoi pour un signalement jamais traité.
CREATE OR REPLACE FUNCTION public.purge_report_contacts()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _n integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  UPDATE public.reports SET contact_email = NULL
  WHERE contact_email IS NOT NULL
    AND ((handled_at IS NOT NULL AND handled_at < now() - interval '3 months')
         OR created_at < now() - interval '12 months');
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END;
$$;
REVOKE ALL ON FUNCTION public.purge_report_contacts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_report_contacts() TO authenticated, service_role;

-- Planification nocturne (03:27) si pg_cron est disponible (Supabase : oui ; base de test : non).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
    EXECUTE $cron$SELECT cron.schedule('cds_purge_report_contacts', '27 3 * * *',
      'SELECT public.purge_report_contacts()')$cron$;
  ELSE
    RAISE NOTICE 'pg_cron absent : effacement des adresses des signalements à lancer à la main';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Planification de l''effacement impossible (%) : à lancer à la main', SQLERRM;
END $$;

-- 6. Grille de conformité et version ---------------------------------------------------------------
INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position, modules)
SELECT 'V1-SIGNALEMENTS-VISITEURS', 'Modération', 'Signalements ouverts aux visiteurs',
  'Erreur, oubli ou correction proposée sans compte : champ piège, délai de 3 secondes, un lien au plus, plafonds par heure et par adresse, code de suivi, réponse publique sur « Le site s''améliore grâce à vous », adresse effacée 3 mois après le traitement.',
  'conforme', 'majeur', 'tests/db/test_28',
  coalesce((SELECT max(position) FROM public.template_checks), 0) + 1, ARRAY['reports']
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.7.0', 'brique', '2026-10-15',
  'Signalements ouverts aux visiteurs : erreur, oubli ou correction proposée, avec suivi et réponse publique.',
  'Envoi sans compte par report_submit (champ piège, délai, un lien au plus, plafonds sans adresse IP) ; code de suivi (report_status) ; réponse publique de l''administrateur et page des améliorations (report_improvements) ; adresse e-mail facultative effacée 3 mois après le traitement.',
  '20261015120000_v1_7_0_signalements_ouverts')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.7.0', 'publie_le', '2026-10-15',
  'migration_reference', '20261015120000_v1_7_0_signalements_ouverts'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.7.0', '.')::int[];
