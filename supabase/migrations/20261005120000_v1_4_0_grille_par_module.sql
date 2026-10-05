-- Socle 1.4.0 — grille de conformité par module.
-- Chaque point de la grille porte les modules dont il dépend (aucun = tout site). Un point dont tous
-- les modules sont éteints sort du périmètre : il n'est ni compté ni affiché dans le score. Un clone
-- peut donc atteindre 100 % avec ses seuls modules allumés. Chaque module a son point « fini »
-- (les 8 critères de V0.md §4). Une greffe ajoute ses points avec ses modules greffe_.
-- Rejouable sans danger. Écrit pour l'éditeur SQL de Lovable : ni antislash ni point d'interrogation,
-- aucune ligne vide dans une fonction.

-- 1. Modules d'un point -----------------------------------------------------------------------------
ALTER TABLE public.template_checks ADD COLUMN IF NOT EXISTS modules text[] NOT NULL DEFAULT '{}';

-- 2. Périmètre : vrai si le point concerne tout site ou si l'un de ses modules est allumé -------------
-- Fonction sur la ligne : la grille la lit comme une colonne calculée (select=*,en_perimetre).
CREATE OR REPLACE FUNCTION public.en_perimetre(public.template_checks)
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT cardinality($1.modules) = 0
    OR EXISTS (SELECT 1 FROM unnest($1.modules) AS m WHERE public.module_enabled(m))
$$;
GRANT EXECUTE ON FUNCTION public.en_perimetre(public.template_checks) TO anon, authenticated, service_role;

-- 3. Rattachement des points existants ------------------------------------------------------------
UPDATE public.template_checks SET modules = v.modules
FROM (VALUES
  ('CNT-1', ARRAY['blog']), ('SEO-4', ARRAY['blog']),
  ('CNT-2', ARRAY['faq']),
  ('CNT-3', ARRAY['testimonials']),
  ('CNT-4', ARRAY['reviews']),
  ('CNT-5', ARRAY['newsletter']),
  ('COM-1', ARRAY['forum']),
  ('COM-2', ARRAY['members']),
  ('COM-3', ARRAY['messaging']),
  ('LEG-3', ARRAY['contact']), ('OPS-2', ARRAY['contact']), ('V0-PURGE-CONTACT', ARRAY['contact']),
  ('OPS-1', ARRAY['pricing']),
  ('V0-SIGNALEMENTS', ARRAY['reports']),
  ('V0-D-PAIEMENT', ARRAY['payments']),
  ('V0-K-BOUTIQUE', ARRAY['shop']),
  ('PIL-1', ARRAY['studio']), ('PIL-2', ARRAY['studio']), ('PIL-3', ARRAY['studio'])
) AS v(code, modules)
WHERE public.template_checks.code = v.code;
-- Le pied de page vaut pour tout site ; l'inscription à la lettre seulement si le module est allumé.
UPDATE public.template_checks
SET label = 'Pied de page en colonnes',
    requirement = 'Colonnes de liens ; inscription à la lettre d''information quand le module est allumé'
WHERE code = 'NAV-2' AND label = 'Pied de page 4 colonnes + lettre d''information';

-- 4. Un point « fini » par module (V0.md §4) -------------------------------------------------------
INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position, modules)
SELECT 'MOD-' || m.key, 'Modules', 'Module fini : ' || m.label,
  'Les 8 critères de V0.md §4 : interrupteur, aucune trace éteint, accès testés, administration complète, états de page, SEO, test automatique, ligne cochée.',
  'a_verifier', 'majeur', '', 200 + m.ordre, ARRAY[m.key]
FROM (VALUES
  ('blog', 'blog, commentaires, RSS', 1), ('faq', 'FAQ', 2), ('contact', 'contact', 3),
  ('newsletter', 'lettre d''information', 4), ('forum', 'forum', 5), ('members', 'membres', 6),
  ('messaging', 'messagerie privée', 7), ('testimonials', 'témoignages', 8), ('reviews', 'avis notés', 9),
  ('pricing', 'tarifs', 10), ('onboarding', 'parcours « Démarrer »', 11), ('directory', 'annuaire métier', 12),
  ('geo', 'géographie', 13), ('crm', 'suivi de contacts', 14), ('lms', 'formations', 15),
  ('marketplace', 'petites annonces', 16), ('adNetwork', 'régie publicitaire', 17),
  ('studio', 'pilotage', 18), ('showcase', 'composants et guide', 19), ('media', 'médiathèque', 20),
  ('pages', 'pages libres', 21), ('payments', 'paiement des formations', 22),
  ('reports', 'signalements', 23), ('search', 'recherche globale', 24), ('shop', 'boutique', 25)
) AS m(key, label, ordre)
ON CONFLICT (code) DO NOTHING;

-- 5. Version ---------------------------------------------------------------------------------------
INSERT INTO public.socle_versions (version, niveau, publie_le, resume, detail, migration_reference)
VALUES ('1.4.0', 'brique', '2026-10-05',
  'Grille de conformité par module : un clone est mesuré sur ses seuls modules allumés.',
  'Chaque point porte ses modules (aucun = tout site) ; les points dont tous les modules sont éteints sortent du score ; un point « module fini » par module ; une greffe ajoute ses points avec ses modules greffe_.',
  '20261005120000_v1_4_0_grille_par_module')
ON CONFLICT (version) DO NOTHING;
INSERT INTO public.site_settings (key, value)
VALUES ('socle', jsonb_build_object('version', '1.4.0', 'publie_le', '2026-10-05',
  'migration_reference', '20261005120000_v1_4_0_grille_par_module'))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
WHERE string_to_array(coalesce(public.site_settings.value ->> 'version', '0.0.0'), '.')::int[]
      < string_to_array('1.4.0', '.')::int[];
