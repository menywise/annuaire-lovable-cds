ALTER TABLE public.greffe_sites ADD COLUMN IF NOT EXISTS siren text;
CREATE TABLE IF NOT EXISTS public.greffe_taches (
  listing_id uuid NOT NULL REFERENCES public.directory_listings(id) ON DELETE CASCADE,
  tache text NOT NULL,
  statut text NOT NULL CHECK (statut IN ('trouve', 'sans_numero', 'inconnu_du_registre', 'erreur')),
  fait_le timestamptz NOT NULL DEFAULT now(),
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (listing_id, tache)
);
ALTER TABLE public.greffe_taches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.greffe_taches FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.greffe_taches TO authenticated;
GRANT ALL ON public.greffe_taches TO service_role;
DROP POLICY IF EXISTS greffe_taches_admin ON public.greffe_taches;
CREATE POLICY greffe_taches_admin ON public.greffe_taches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE VIEW public.greffe_r2_a_traiter WITH (security_invoker = true) AS
  SELECT s.listing_id, s.url
  FROM public.greffe_sites s
  WHERE s.etat = 'en_ligne' AND s.langue = 'fr'
    AND NOT EXISTS (SELECT 1 FROM public.greffe_taches t WHERE t.listing_id = s.listing_id AND t.tache = 'R2')
  ORDER BY s.hote;
REVOKE ALL ON public.greffe_r2_a_traiter FROM anon;
GRANT SELECT ON public.greffe_r2_a_traiter TO authenticated, service_role;
