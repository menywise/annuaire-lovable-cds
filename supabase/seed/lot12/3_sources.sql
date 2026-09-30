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
