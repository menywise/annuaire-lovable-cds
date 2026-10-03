CREATE TABLE IF NOT EXISTS public.socle_installation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE CHECK (version ~ '^[0-9]+[.][0-9]+[.][0-9]+$'),
  niveau text NOT NULL CHECK (niveau IN ('anterieur', 'installation', 'mise_a_niveau')),
  installe_le date NOT NULL,
  resume text NOT NULL CHECK (length(btrim(resume)) > 0),
  detail text,
  migration_reference text,
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.socle_installation ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.socle_installation FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.socle_installation TO anon, authenticated;
GRANT ALL ON public.socle_installation TO service_role;
DROP POLICY IF EXISTS socle_installation_lecture ON public.socle_installation;
CREATE POLICY socle_installation_lecture ON public.socle_installation
  FOR SELECT TO anon, authenticated USING (true);
