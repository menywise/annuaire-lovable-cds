-- Essai de mise à niveau (objet témoin, à retirer après l'essai). Rejouable sans danger.
CREATE TABLE IF NOT EXISTS public.essai_mise_a_niveau (
  id integer PRIMARY KEY,
  note text NOT NULL DEFAULT '',
  cree_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.essai_mise_a_niveau ENABLE ROW LEVEL SECURITY;
INSERT INTO public.essai_mise_a_niveau (id, note) VALUES (1, 'temoin') ON CONFLICT (id) DO NOTHING;
CREATE OR REPLACE FUNCTION public.essai_mise_a_niveau_version()
RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'essai-1'::text $$;
