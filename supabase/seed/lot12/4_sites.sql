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
