-- Socle 1.1.0 — registre des versions du socle et registre de l'installation.
-- « socle_versions » : les versions publiées du socle (identique dans toutes les bases).
-- « socle_installation » : la version du socle qu'embarque cette base, ligne par ligne au fil des
-- mises à niveau. Vide dans le socle ; chaque installation y inscrit sa propre histoire.
-- La table socle_versions existait déjà dans la base du socle (créée à la main le 03/10, version
-- 1.0.0) mais pas dans ce dépôt : cette migration l'y inscrit à l'identique.
-- Rejouable sans danger. Écrit pour l'éditeur SQL de Lovable : ni antislash ni point d'interrogation,
-- aucune ligne vide dans une fonction.

-- 1. Versions publiées du socle -----------------------------------------------------------------------
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

-- 2. Version embarquée par cette installation ---------------------------------------------------------
-- niveau : « anterieur » (base née avant le scellement, écart non mesuré), « installation » (née d'un
-- socle versionné), « mise_a_niveau » (passage d'une version à la suivante).
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

-- 3. Historique des versions --------------------------------------------------------------------------
-- Le Remix de Lovable copie la structure, pas les données : l'historique est donc écrit ici.
INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES
  ('1.0.0', 'initial', '2026-10-03',
   'État initial consolidé du socle : tout ce qui précède est scellé dans cette version.',
   'Lots 1 à 13 a, Boutique et identité neutre appliqués par l''éditeur SQL, hors journal des migrations. Dernière migration inscrite dans ce journal : 20260918093638. Dernière migration du dépôt appliquée en base : 20261002090000_v0_identite_neutre.',
   '20261002090000_v0_identite_neutre'),
  ('1.1.0', 'brique', '2026-10-03',
   'Registres des versions : socle_versions inscrite au dépôt, socle_installation ajoutée.',
   'Chaque base sait quelle version du socle elle embarque (réglage « socle » et table socle_installation). Rattrapage dans la base du socle de starter_status() et de la ligne V0-KIT-DEMARRAGE du lot 13 a, présentes au dépôt depuis la 1.0.0.',
   '20261003120000_v1_1_0_versions_installation')
ON CONFLICT (version) DO NOTHING;

-- 4. Réglage « socle » : version embarquée, jamais revue à la baisse ---------------------------------
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.1.0', 'publie_le', '2026-10-03',
  'migration_reference', '20261003120000_v1_1_0_versions_installation'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.1.0', '.')::int[];
