CREATE TABLE IF NOT EXISTS public.socle_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE CHECK (version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  niveau text NOT NULL CHECK (niveau IN ('palier', 'brique', 'correctif', 'initial')),
  publie_le date NOT NULL DEFAULT CURRENT_DATE,
  resume text NOT NULL CHECK (length(btrim(resume)) > 0),
  detail text,
  migration_reference text NOT NULL,
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.socle_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.socle_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.socle_versions TO anon, authenticated;
GRANT ALL ON public.socle_versions TO service_role;
DROP POLICY IF EXISTS socle_versions_lecture ON public.socle_versions;
CREATE POLICY socle_versions_lecture ON public.socle_versions
  FOR SELECT TO anon, authenticated USING (true);
