CREATE TABLE IF NOT EXISTS public.greffe_sites (
  listing_id uuid PRIMARY KEY REFERENCES public.directory_listings(id) ON DELETE CASCADE,
  url text NOT NULL,
  hote text NOT NULL UNIQUE,
  langue text,
  pays text,
  usage_principal text,
  usage_secondaire text,
  activite_categorie text,
  activite_code text REFERENCES public.activites(code),
  etat text NOT NULL DEFAULT 'en_ligne' CHECK (etat IN ('en_ligne', 'instable', 'mort')),
  ancien_id uuid UNIQUE,
  importe_le timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.greffe_sites ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.greffe_sites FROM anon;
GRANT SELECT ON public.greffe_sites TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.greffe_sites TO authenticated;
GRANT ALL ON public.greffe_sites TO service_role;
DROP POLICY IF EXISTS greffe_sites_lecture ON public.greffe_sites;
CREATE POLICY greffe_sites_lecture ON public.greffe_sites FOR SELECT TO anon, authenticated
  USING (public.directory_listing_visible(listing_id) AND public.module_enabled('greffe_sites'));
DROP POLICY IF EXISTS greffe_sites_admin ON public.greffe_sites;
CREATE POLICY greffe_sites_admin ON public.greffe_sites FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE IF NOT EXISTS public.greffe_sites_audit (
  listing_id uuid PRIMARY KEY REFERENCES public.directory_listings(id) ON DELETE CASCADE,
  lovable_score integer,
  lovable_verifie_le timestamptz,
  audit_score integer,
  audit_palier text,
  audit_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_le timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.greffe_sites_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.greffe_sites_audit FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.greffe_sites_audit TO authenticated;
GRANT ALL ON public.greffe_sites_audit TO service_role;
DROP POLICY IF EXISTS greffe_sites_audit_admin ON public.greffe_sites_audit;
CREATE POLICY greffe_sites_audit_admin ON public.greffe_sites_audit FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TABLE IF NOT EXISTS public.greffe_classements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.directory_listings(id) ON DELETE CASCADE,
  axe text NOT NULL CHECK (axe IN ('geographie', 'activite', 'usage', 'cible', 'langue')),
  rang integer NOT NULL DEFAULT 1 CHECK (rang IN (1, 2)),
  valeur text NOT NULL,
  regle text NOT NULL,
  version_regle text NOT NULL,
  preuve text NOT NULL DEFAULT '',
  confiance text NOT NULL CHECK (confiance IN ('source', 'estime', 'hypothese', 'intuition', 'a_classer')),
  classe_le timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, axe, rang, version_regle)
);
CREATE INDEX IF NOT EXISTS greffe_classements_listing_idx ON public.greffe_classements (listing_id);
CREATE INDEX IF NOT EXISTS greffe_classements_axe_idx ON public.greffe_classements (axe, confiance);
ALTER TABLE public.greffe_classements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.greffe_classements FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.greffe_classements TO authenticated;
GRANT ALL ON public.greffe_classements TO service_role;
DROP POLICY IF EXISTS greffe_classements_admin ON public.greffe_classements;
CREATE POLICY greffe_classements_admin ON public.greffe_classements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS greffe_sites_updated_at ON public.greffe_sites;
CREATE TRIGGER greffe_sites_updated_at BEFORE UPDATE ON public.greffe_sites
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS greffe_sites_audit_updated_at ON public.greffe_sites_audit;
CREATE TRIGGER greffe_sites_audit_updated_at BEFORE UPDATE ON public.greffe_sites_audit
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
