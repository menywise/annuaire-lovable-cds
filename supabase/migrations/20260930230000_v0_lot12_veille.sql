-- V0 · Lot 12 — Module « Veille de sites » (watch) : découverte, détection des technologies,
-- contrôles de disponibilité. Reconstruit à partir de la veille de l'annuaire des sites
-- (menywise/annuaire-mac97000), rendue générique : les règles de détection et les seuils vivent
-- en base, les empreintes Lovable de l'annuaire sont livrées comme règles de départ.
-- Rejouable sans danger. Écrit pour l'éditeur SQL de Lovable : ni antislash ni opérateur « ? »,
-- aucune ligne vide dans une fonction.
--
-- Trois façons d'alimenter la veille :
-- - l'admin (analyse d'une adresse, sources de recherche) ;
-- - les agents (Letta, tâche Cowork) par /api/hooks/veille, secret WATCH_HOOKS_SECRET ;
-- - les membres, par le formulaire « Proposer un site » (file d'attente, 5 par jour).
-- Toutes les écritures réseau passent par le serveur (clé de service) ; rien n'est publié dans
-- l'annuaire sans un geste de l'admin (fiche créée en brouillon).

-- 1. Module « watch » (éteint, sans dépendance) ------------------------------------------------------
-- Même liste que src/config/modules.ts (26 modules).
CREATE OR REPLACE FUNCTION public.module_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT '{
    "blog": true, "faq": true, "contact": true, "newsletter": true, "forum": true,
    "members": true, "messaging": true, "testimonials": true, "reviews": true, "pricing": true,
    "onboarding": true, "directory": false, "geo": false, "crm": false, "lms": false,
    "marketplace": false, "adNetwork": false, "studio": true, "showcase": true,
    "media": true, "pages": false, "payments": false, "reports": true, "search": true,
    "shop": false, "watch": false
  }'::jsonb
$$;
GRANT EXECUTE ON FUNCTION public.module_defaults() TO anon, authenticated, service_role;

INSERT INTO public.site_settings (key, value) VALUES ('modules', public.module_defaults())
  ON CONFLICT (key) DO UPDATE
  SET value = public.module_defaults() || (
    SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    FROM jsonb_each(public.site_settings.value) AS e(k, v)
    WHERE (public.module_defaults() -> k) IS NOT NULL
  );

-- Réglages : seuil d'empreinte (0 = tout accepter), préfiltre réseau avant le scrape payant,
-- langue attendue, volumes par passage planifié.
INSERT INTO public.site_settings (key, value)
VALUES ('watch', '{"gate_min_score": 0, "prefilter_min_score": 0, "language": "fr",
  "min_language_score": 45, "search_limit": 8, "sources_per_run": 2, "checks_per_run": 25,
  "submissions_per_run": 5}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 2. Règles de détection -------------------------------------------------------------------------------
-- target html : motif cherché dans la page ; header : en-tête présent (et motif sur sa valeur) ;
-- path : adresse visitée en HEAD, réponse 2xx (et motif sur le type de contenu).
-- weight > 0 : la règle compte dans le score d'empreinte ; 0 : simple détection de technologie.
CREATE TABLE IF NOT EXISTS public.watch_detectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'autre',
  target text NOT NULL DEFAULT 'html',
  selector text NOT NULL DEFAULT '',
  pattern text NOT NULL DEFAULT '',
  weight integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.watch_detectors DROP CONSTRAINT IF EXISTS watch_detectors_check;
ALTER TABLE public.watch_detectors ADD CONSTRAINT watch_detectors_check CHECK (
  code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(code) <= 60
  AND char_length(name) BETWEEN 1 AND 80 AND char_length(kind) BETWEEN 1 AND 40
  AND char_length(pattern) <= 500 AND weight BETWEEN 0 AND 100
  AND (
    (target = 'html' AND selector = '' AND pattern <> '')
    OR (target = 'header' AND selector ~ '^[a-z0-9-]{1,80}$')
    OR (target = 'path' AND selector ~ '^/[^ ]{0,199}$')
  )
);
ALTER TABLE public.watch_detectors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_detectors FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_detectors TO authenticated;
GRANT ALL ON public.watch_detectors TO service_role;
DROP POLICY IF EXISTS watch_detectors_admin ON public.watch_detectors;
CREATE POLICY watch_detectors_admin ON public.watch_detectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Règles de départ : technologies courantes (poids 0) et empreintes Lovable de l'annuaire.
-- Ajoutées si absentes : une règle modifiée ou supprimée par l'admin n'est pas recréée.
INSERT INTO public.watch_detectors (code, name, kind, target, selector, pattern, weight)
SELECT v.code, v.name, v.kind, v.target, v.selector, v.pattern, v.weight
FROM (VALUES
  ('lovable', 'Lovable', 'plateforme', 'html', '', 'gpteng[.]co|lovable[.]dev|lovable-badge|~flock[.]js|gpt-engineer-file-uploads|lovable-uploads|lovable-tagger|gptengineer', 0),
  ('wordpress', 'WordPress', 'plateforme', 'html', '', 'wp-content/|wp-includes/', 0),
  ('shopify', 'Shopify', 'plateforme', 'html', '', 'cdn[.]shopify[.]com', 0),
  ('wix', 'Wix', 'plateforme', 'html', '', 'static[.]wixstatic[.]com|wix-code', 0),
  ('webflow', 'Webflow', 'plateforme', 'html', '', 'webflow[.]com|data-wf-site', 0),
  ('elementor', 'Elementor', 'plateforme', 'html', '', 'elementor', 0),
  ('react', 'React', 'framework', 'html', '', 'data-reactroot|react-dom|__REACT_DEVTOOLS|_jsx', 0),
  ('vite', 'Vite', 'framework', 'html', '', '/assets/index-[A-Za-z0-9_-]+[.]js|type="module"[^>]*crossorigin', 0),
  ('tanstack-start', 'TanStack Start', 'framework', 'html', '', '__TSR__|tanstack', 0),
  ('nextjs', 'Next.js', 'framework', 'html', '', '__NEXT_DATA__|/_next/', 0),
  ('astro', 'Astro', 'framework', 'html', '', 'astro-island|_astro/', 0),
  ('vue', 'Vue', 'framework', 'html', '', 'data-v-app|__VUE__', 0),
  ('supabase', 'Supabase', 'backend', 'html', '', 'supabase[.]co|supabase-js', 0),
  ('firebase', 'Firebase', 'backend', 'html', '', 'firebaseio[.]com|firebasestorage', 0),
  ('tailwind', 'Tailwind CSS', 'interface', 'html', '', 'tailwind', 0),
  ('shadcn', 'Radix / shadcn', 'interface', 'html', '', 'data-radix|radix-ui|data-slot="', 0),
  ('lucide', 'Lucide', 'interface', 'html', '', 'lucide', 0),
  ('framer-motion', 'Framer Motion', 'interface', 'html', '', 'framer-motion|motion-dom', 0),
  ('gsap', 'GSAP', 'interface', 'html', '', 'gsap', 0),
  ('threejs', 'Three.js', 'média', 'html', '', 'three[.]module|three[.]min[.]js', 0),
  ('maps', 'Mapbox / Leaflet', 'média', 'html', '', 'mapbox|leaflet', 0),
  ('youtube', 'YouTube', 'média', 'html', '', 'youtube[.]com/embed|youtube-nocookie', 0),
  ('stripe', 'Stripe', 'paiement', 'html', '', 'js[.]stripe[.]com', 0),
  ('paddle', 'Paddle', 'paiement', 'html', '', 'paddle[.]com', 0),
  ('google-analytics', 'Google Analytics', 'mesure', 'html', '', 'googletagmanager[.]com|gtag[(]', 0),
  ('plausible', 'Plausible', 'mesure', 'html', '', 'plausible[.]io', 0),
  ('umami', 'Umami', 'mesure', 'html', '', 'umami[.]js|data-website-id', 0),
  ('posthog', 'PostHog', 'mesure', 'html', '', 'posthog', 0),
  ('google-fonts', 'Google Fonts', 'police', 'html', '', 'fonts[.]googleapis[.]com|fonts[.]gstatic[.]com', 0),
  ('booking', 'Cal.com / Calendly', 'réservation', 'html', '', 'cal[.]com|calendly[.]com', 0),
  ('resend', 'Resend', 'e-mail', 'html', '', 'resend[.]com', 0),
  ('lovable-flock', 'Lovable', 'empreinte', 'path', '/~flock.js', 'javascript', 50),
  ('lovable-deployment-id', 'Lovable', 'empreinte', 'header', 'x-deployment-id', '', 10),
  ('lovable-id-preview', 'Lovable', 'empreinte', 'html', '', 'id-preview--[a-f0-9-]+[.]lovable[.]app', 30),
  ('lovable-gpt-engineer-uploads', 'Lovable', 'empreinte', 'html', '', 'gpt-engineer-file-uploads', 20),
  ('lovable-r2-bucket', 'Lovable', 'empreinte', 'html', '', 'pub-bb2e103a32db4e198524a2e9ed8f35b4[.]r2[.]dev', 20),
  ('lovable-gptengineer-js', 'Lovable', 'empreinte', 'html', '', 'gptengineer', 15),
  ('lovable-tagger', 'Lovable', 'empreinte', 'html', '', 'lovable-tagger', 15),
  ('lovable-uploads', 'Lovable', 'empreinte', 'html', '', 'lovable-uploads', 15),
  ('lovable-scope', 'Lovable', 'empreinte', 'html', '', '@lovable/', 10),
  ('lovable-build-tsr', 'Lovable', 'empreinte', 'html', '', '/_build/[^]*__TSR__|__TSR__[^]*/_build/', 10),
  ('lovable-assets-react', 'Lovable', 'empreinte', 'html', '', '/assets/index-[A-Za-z0-9_-]+[.]js[^]*(react-dom|_jsx|data-reactroot)|(react-dom|_jsx|data-reactroot)[^]*/assets/index-[A-Za-z0-9_-]+[.]js', 5),
  ('lovable-badge', 'Lovable', 'empreinte', 'html', '', 'lovable-badge|gpteng[.]co|lovable[.]dev', 5)
) AS v(code, name, kind, target, selector, pattern, weight)
ON CONFLICT (code) DO NOTHING;

-- 3. Sources de recherche -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watch_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  query text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT true,
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  found_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.watch_sources DROP CONSTRAINT IF EXISTS watch_sources_check;
ALTER TABLE public.watch_sources ADD CONSTRAINT watch_sources_check
  CHECK (char_length(label) BETWEEN 2 AND 80 AND char_length(query) BETWEEN 3 AND 300);
ALTER TABLE public.watch_sources ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_sources FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_sources TO authenticated;
GRANT ALL ON public.watch_sources TO service_role;
DROP POLICY IF EXISTS watch_sources_admin ON public.watch_sources;
CREATE POLICY watch_sources_admin ON public.watch_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Sites retenus, contrôles, refus ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.watch_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL UNIQUE,
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  language text,
  language_score integer NOT NULL DEFAULT 0,
  gate_score integer NOT NULL DEFAULT 0,
  gate_detail jsonb NOT NULL DEFAULT '[]'::jsonb,
  stack jsonb NOT NULL DEFAULT '[]'::jsonb,
  fonts text[] NOT NULL DEFAULT '{}',
  screenshot_url text,
  status text NOT NULL DEFAULT 'en_ligne',
  http_status integer,
  ttfb_ms integer,
  source text NOT NULL DEFAULT 'manuel',
  source_query text,
  submitted_by uuid,
  listing_id uuid REFERENCES public.directory_listings(id) ON DELETE SET NULL,
  last_checked_at timestamptz,
  last_analyzed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.watch_sites DROP CONSTRAINT IF EXISTS watch_sites_check;
ALTER TABLE public.watch_sites ADD CONSTRAINT watch_sites_check CHECK (
  status IN ('en_ligne', 'instable', 'hors_ligne')
  AND source IN ('manuel', 'recherche', 'source', 'agent', 'proposition')
  AND host ~ '^[a-z0-9-]+([.][a-z0-9-]+)+$' AND char_length(host) <= 253
  AND url ~ '^https://' AND char_length(title) <= 300 AND char_length(description) <= 1000
);
CREATE INDEX IF NOT EXISTS watch_sites_checked_idx ON public.watch_sites (last_checked_at NULLS FIRST);
CREATE INDEX IF NOT EXISTS watch_sites_created_idx ON public.watch_sites (created_at DESC);
ALTER TABLE public.watch_sites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_sites FROM anon, authenticated;
GRANT SELECT, DELETE ON public.watch_sites TO authenticated;
GRANT ALL ON public.watch_sites TO service_role;
DROP POLICY IF EXISTS watch_sites_admin_read ON public.watch_sites;
CREATE POLICY watch_sites_admin_read ON public.watch_sites FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS watch_sites_admin_delete ON public.watch_sites;
CREATE POLICY watch_sites_admin_delete ON public.watch_sites FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.watch_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES public.watch_sites(id) ON DELETE CASCADE,
  status text NOT NULL,
  http_status integer,
  ttfb_ms integer,
  checked_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watch_checks_site_idx ON public.watch_checks (site_id, checked_at DESC);
ALTER TABLE public.watch_checks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_checks FROM anon, authenticated;
GRANT SELECT ON public.watch_checks TO authenticated;
GRANT ALL ON public.watch_checks TO service_role;
DROP POLICY IF EXISTS watch_checks_admin_read ON public.watch_checks;
CREATE POLICY watch_checks_admin_read ON public.watch_checks FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.watch_rejects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  host text NOT NULL,
  url text NOT NULL,
  reason text NOT NULL,
  score integer,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'manuel',
  source_query text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.watch_rejects DROP CONSTRAINT IF EXISTS watch_rejects_check;
ALTER TABLE public.watch_rejects ADD CONSTRAINT watch_rejects_check
  CHECK (reason IN ('empreintes', 'langue', 'prefiltre', 'erreur', 'adresse'));
CREATE INDEX IF NOT EXISTS watch_rejects_host_idx ON public.watch_rejects (host, created_at DESC);
CREATE INDEX IF NOT EXISTS watch_rejects_created_idx ON public.watch_rejects (created_at DESC);
ALTER TABLE public.watch_rejects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_rejects FROM anon, authenticated;
GRANT SELECT, DELETE ON public.watch_rejects TO authenticated;
GRANT ALL ON public.watch_rejects TO service_role;
DROP POLICY IF EXISTS watch_rejects_admin_read ON public.watch_rejects;
CREATE POLICY watch_rejects_admin_read ON public.watch_rejects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS watch_rejects_admin_delete ON public.watch_rejects;
CREATE POLICY watch_rejects_admin_delete ON public.watch_rejects FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Contrôle de disponibilité (serveur) : état du site, point d'historique, 180 jours gardés.
CREATE OR REPLACE FUNCTION public.watch_record_check(_site_id uuid, _status text, _http integer, _ttfb integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _status NOT IN ('en_ligne', 'instable', 'hors_ligne') THEN
    RAISE EXCEPTION 'Statut inconnu : %', _status USING ERRCODE = '22023';
  END IF;
  UPDATE public.watch_sites SET status = _status, http_status = _http, ttfb_ms = _ttfb,
    last_checked_at = now()
  WHERE id = _site_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  INSERT INTO public.watch_checks (site_id, status, http_status, ttfb_ms)
  VALUES (_site_id, _status, _http, _ttfb);
  DELETE FROM public.watch_checks
  WHERE site_id = _site_id AND checked_at < now() - interval '180 days';
END;
$$;
REVOKE ALL ON FUNCTION public.watch_record_check(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.watch_record_check(uuid, text, integer, integer) TO service_role;

-- 5. Propositions des membres ----------------------------------------------------------------------------
-- Le membre dépose une adresse ; le serveur l'analyse plus tard (tâche planifiée ou bouton admin).
CREATE TABLE IF NOT EXISTS public.watch_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  host text NOT NULL,
  note text NOT NULL DEFAULT '',
  submitted_by uuid,
  status text NOT NULL DEFAULT 'en_attente',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE public.watch_submissions DROP CONSTRAINT IF EXISTS watch_submissions_check;
ALTER TABLE public.watch_submissions ADD CONSTRAINT watch_submissions_check CHECK (
  status IN ('en_attente', 'acceptee', 'refusee', 'erreur')
  AND char_length(url) BETWEEN 4 AND 300 AND char_length(note) <= 500
  AND host ~ '^[a-z0-9-]+([.][a-z0-9-]+)+$'
);
CREATE UNIQUE INDEX IF NOT EXISTS watch_submissions_pending_unique
  ON public.watch_submissions (submitted_by, host) WHERE status = 'en_attente';
CREATE INDEX IF NOT EXISTS watch_submissions_queue_idx ON public.watch_submissions (status, created_at);
ALTER TABLE public.watch_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_submissions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.watch_submissions TO authenticated;
GRANT ALL ON public.watch_submissions TO service_role;
DROP POLICY IF EXISTS watch_submissions_insert ON public.watch_submissions;
CREATE POLICY watch_submissions_insert ON public.watch_submissions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status = 'en_attente' AND result IS NULL
              AND processed_at IS NULL AND public.module_enabled('watch'));
DROP POLICY IF EXISTS watch_submissions_read ON public.watch_submissions;
CREATE POLICY watch_submissions_read ON public.watch_submissions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS watch_submissions_admin_delete ON public.watch_submissions;
CREATE POLICY watch_submissions_admin_delete ON public.watch_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Au dépôt : adresse normalisée (https, domaine en minuscules), 5 propositions par 24 h.
CREATE OR REPLACE FUNCTION public.guard_watch_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _raw text := btrim(coalesce(NEW.url, ''));
BEGIN
  IF _raw !~* '^https{0,1}://' THEN
    _raw := 'https://' || _raw;
  END IF;
  NEW.host := lower(substring(_raw from '^[A-Za-z]+://([^/:#]+)'));
  IF NEW.host IS NULL OR NEW.host !~ '^[a-z0-9-]+([.][a-z0-9-]+)+$' THEN
    RAISE EXCEPTION 'Adresse invalide : indiquez un site comme exemple.fr' USING ERRCODE = '22023';
  END IF;
  NEW.url := 'https://' || NEW.host;
  NEW.note := left(btrim(coalesce(NEW.note, '')), 500);
  NEW.created_at := now();
  IF NEW.submitted_by IS NOT NULL AND NOT public.has_role(NEW.submitted_by, 'admin') AND (
    SELECT count(*) FROM public.watch_submissions s
    WHERE s.submitted_by = NEW.submitted_by AND s.created_at > now() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'Cinq propositions par jour au plus : réessayez demain' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS watch_submissions_guard ON public.watch_submissions;
CREATE TRIGGER watch_submissions_guard BEFORE INSERT ON public.watch_submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_watch_submission();

-- 6. Publication dans l'annuaire : fiche créée en brouillon, à compléter et publier par l'admin -------
CREATE OR REPLACE FUNCTION public.watch_publish(_site_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _s record;
  _slug text;
  _id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  IF NOT public.module_enabled('directory') THEN
    RAISE EXCEPTION 'Allumez d''abord le module Annuaire' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO _s FROM public.watch_sites WHERE id = _site_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Site introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF _s.listing_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.directory_listings l WHERE l.id = _s.listing_id) THEN
    RETURN _s.listing_id;
  END IF;
  _slug := left(regexp_replace(_s.host, '[^a-z0-9]+', '-', 'g'), 100);
  IF EXISTS (SELECT 1 FROM public.directory_listings l WHERE l.slug = _slug) THEN
    _slug := left(_slug, 90) || '-' || substr(md5(_s.id::text), 1, 6);
  END IF;
  INSERT INTO public.directory_listings (name, slug, excerpt, description, website, tags, status, created_by)
  VALUES (
    left(coalesce(nullif(btrim(_s.title), ''), _s.host), 120),
    _slug,
    left(_s.description, 300),
    _s.description,
    _s.url,
    coalesce((SELECT array_agg(DISTINCT t ->> 'name') FROM jsonb_array_elements(_s.stack) AS t
              WHERE (t ->> 'kind') IN ('plateforme', 'framework')), '{}'),
    'draft',
    auth.uid()
  )
  RETURNING id INTO _id;
  UPDATE public.watch_sites SET listing_id = _id WHERE id = _site_id;
  RETURN _id;
END;
$$;
REVOKE ALL ON FUNCTION public.watch_publish(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.watch_publish(uuid) TO authenticated, service_role;

-- 7. Tableau de bord (admin, agents) -------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.watch_status()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'sites', (SELECT count(*) FROM public.watch_sites),
    'en_ligne', (SELECT count(*) FROM public.watch_sites WHERE status = 'en_ligne'),
    'instables', (SELECT count(*) FROM public.watch_sites WHERE status = 'instable'),
    'hors_ligne', (SELECT count(*) FROM public.watch_sites WHERE status = 'hors_ligne'),
    'a_publier', (SELECT count(*) FROM public.watch_sites WHERE listing_id IS NULL),
    'propositions_en_attente', (SELECT count(*) FROM public.watch_submissions WHERE status = 'en_attente'),
    'refus_7_jours', (SELECT count(*) FROM public.watch_rejects WHERE created_at > now() - interval '7 days'),
    'sources_actives', (SELECT count(*) FROM public.watch_sources WHERE enabled),
    'regles_actives', (SELECT count(*) FROM public.watch_detectors WHERE enabled)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.watch_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.watch_status() TO authenticated, service_role;

-- 8. Suppression de son compte : propositions et sites détachés du membre --------------------------------
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _ghost constant uuid := '00000000-0000-0000-0000-000000000000';
  _name constant text := 'Ancien membre';
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;
  IF public.has_role(_uid, 'admin')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin' AND user_id <> _uid) THEN
    RAISE EXCEPTION 'Vous êtes le dernier administrateur : nommez-en un autre avant de partir' USING ERRCODE = '42501';
  END IF;
  UPDATE public.forum_topics SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.forum_replies SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.blog_comments SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.reviews SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.directory_reviews SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.testimonials SET author_id = NULL, author_name = _name WHERE author_id = _uid;
  UPDATE public.blog_posts SET author_id = NULL WHERE author_id = _uid;
  UPDATE public.directory_listings SET created_by = NULL WHERE created_by = _uid;
  UPDATE public.directory_listings SET claimed_by = NULL WHERE claimed_by = _uid;
  UPDATE public.directory_listings SET claim_requested_by = NULL WHERE claim_requested_by = _uid;
  UPDATE public.site_settings SET updated_by = NULL WHERE updated_by = _uid;
  UPDATE public.payments SET user_id = _ghost WHERE user_id = _uid;
  UPDATE public.shop_orders SET user_id = _ghost WHERE user_id = _uid;
  UPDATE public.reports SET reporter_id = _ghost WHERE reporter_id = _uid;
  UPDATE public.reports SET handled_by = NULL WHERE handled_by = _uid;
  UPDATE public.watch_submissions SET submitted_by = NULL WHERE submitted_by = _uid;
  UPDATE public.watch_sites SET submitted_by = NULL WHERE submitted_by = _uid;
  DELETE FROM public.forum_likes WHERE user_id = _uid;
  DELETE FROM public.forum_follows WHERE user_id = _uid;
  DELETE FROM public.conversations WHERE user_a = _uid OR user_b = _uid;
  DELETE FROM public.messages WHERE sender_id = _uid;
  DELETE FROM public.marketplace_listings WHERE seller_id = _uid;
  DELETE FROM public.crm_interactions WHERE owner_id = _uid;
  DELETE FROM public.crm_actions WHERE owner_id = _uid;
  DELETE FROM public.crm_prospects WHERE owner_id = _uid;
  DELETE FROM public.lms_progress WHERE user_id = _uid;
  DELETE FROM public.lms_enrollments WHERE user_id = _uid;
  DELETE FROM public.member_profiles WHERE user_id = _uid;
  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;

-- 9. Grille de conformité -----------------------------------------------------------------------------
INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position)
SELECT v.code, v.area, v.label, v.requirement, v.status, v.severity, v.evidence,
       coalesce((SELECT max(position) FROM public.template_checks), 0) + v.n
FROM (VALUES
  (1, 'V0-VEILLE', 'Modules', 'Veille de sites : découverte, technologies, disponibilité',
   'Règles de détection et seuils en base ; adresses internes refusées ; agents authentifiés par un secret dédié (jamais la clé publique) ; propositions des membres limitées à 5 par jour et jamais publiées sans l''admin.',
   'a_verifier', 'majeur', 'tests/db/test_18 ; à dérouler avec la clé Firecrawl')
) AS v(n, code, area, label, requirement, status, severity, evidence)
ON CONFLICT (code) DO NOTHING;
