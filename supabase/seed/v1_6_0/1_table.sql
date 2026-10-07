CREATE TABLE IF NOT EXISTS public.activites (
  code text PRIMARY KEY,
  libelle text NOT NULL,
  type text NOT NULL CHECK (type IN ('professionnel', 'non_professionnel')),
  categorie text NOT NULL,
  cadran text CHECK (cadran IN ('E', 'S')),
  code_naf_2025 text,
  statut text NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif')),
  source text NOT NULL DEFAULT 'Registre eqNAF, base SCM',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS activites_categorie_idx ON public.activites (categorie);
ALTER TABLE public.activites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activites FROM anon;
GRANT SELECT ON public.activites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activites TO authenticated;
GRANT ALL ON public.activites TO service_role;
DROP POLICY IF EXISTS activites_lecture ON public.activites;
CREATE POLICY activites_lecture ON public.activites FOR SELECT TO anon, authenticated USING (statut = 'actif');
DROP POLICY IF EXISTS activites_admin ON public.activites;
CREATE POLICY activites_admin ON public.activites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS activites_updated_at ON public.activites;
CREATE TRIGGER activites_updated_at BEFORE UPDATE ON public.activites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
