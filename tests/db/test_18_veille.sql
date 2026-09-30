\set ON_ERROR_STOP 1
\i tests/db/_helpers.sql
BEGIN;
-- Lot 12 : veille de sites. Tables réservées à l'admin et au serveur, propositions des membres
-- limitées, contrôles historisés, publication en brouillon dans l'annuaire.
-- a1 : admin du studio · a2 : membre · a3 : autre membre
INSERT INTO auth.users (id, email) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com'),
  ('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr'),
  ('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
SELECT public.bootstrap_current_user('Manu');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.bootstrap_current_user('Membre');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
SELECT public.bootstrap_current_user('Autre');
RESET ROLE;

-- 1. Module éteint, réglages et règles de départ --------------------------------------------------------
DO $$ BEGIN
  IF public.module_enabled('watch') THEN RAISE EXCEPTION 'watch devrait être éteint'; END IF;
  IF (SELECT value ->> 'gate_min_score' FROM public.site_settings WHERE key = 'watch') <> '0' THEN
    RAISE EXCEPTION 'seuil par défaut : 0 (tout accepter)'; END IF;
  IF (SELECT count(*) FROM public.watch_detectors WHERE weight > 0) <> 12 THEN
    RAISE EXCEPTION 'empreintes Lovable de départ : %', (SELECT count(*) FROM public.watch_detectors WHERE weight > 0); END IF;
  IF (SELECT sum(weight) FROM public.watch_detectors WHERE code = 'lovable-flock') <> 50 THEN
    RAISE EXCEPTION 'empreinte /~flock.js'; END IF;
END $$;
SELECT pg_temp.expect_error($$INSERT INTO public.watch_detectors (code, name, target, selector, pattern) VALUES ('x', 'X', 'html', '', '')$$, 'règle HTML sans motif');
SELECT pg_temp.expect_error($$INSERT INTO public.watch_detectors (code, name, target, selector) VALUES ('y', 'Y', 'path', 'sans-barre')$$, 'chemin sans /');
SELECT pg_temp.expect_error($$INSERT INTO public.watch_detectors (code, name, target, selector) VALUES ('z', 'Z', 'header', 'Majuscules Espaces')$$, 'en-tête invalide');
SELECT pg_temp.expect_error($$INSERT INTO public.watch_detectors (code, name, pattern, weight) VALUES ('w', 'W', 'x', 101)$$, 'poids > 100');

-- 2. Accès : rien pour le visiteur ni le membre, tout pour l'admin ---------------------------------------
INSERT INTO public.watch_sites (id, host, url, title, description, stack) VALUES
  ('00000000-0000-0000-0000-0000000000e1', 'exemple.fr', 'https://exemple.fr', 'Exemple', 'Un site d''exemple.',
   '[{"name": "Lovable", "kind": "plateforme"}, {"name": "React", "kind": "framework"}, {"name": "Stripe", "kind": "paiement"}]');
INSERT INTO public.watch_sources (label, query) VALUES ('Sites Lovable', 'site:lovable.app france');
INSERT INTO public.watch_rejects (host, url, reason) VALUES ('refuse.fr', 'https://refuse.fr', 'langue');
SELECT pg_temp.as_anon();
SELECT pg_temp.expect_error($$SELECT * FROM public.watch_sites$$, 'visiteur lit les sites');
SELECT pg_temp.expect_error($$SELECT * FROM public.watch_detectors$$, 'visiteur lit les règles');
SELECT pg_temp.expect_error($$INSERT INTO public.watch_submissions (url, host) VALUES ('https://x.fr', 'x.fr')$$, 'visiteur propose un site');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.watch_sites) OR EXISTS (SELECT 1 FROM public.watch_sources)
     OR EXISTS (SELECT 1 FROM public.watch_rejects) OR EXISTS (SELECT 1 FROM public.watch_detectors) THEN
    RAISE EXCEPTION 'le membre voit la veille'; END IF;
END $$;
SELECT pg_temp.expect_error($$INSERT INTO public.watch_sites (host, url) VALUES ('pirate.fr', 'https://pirate.fr')$$, 'membre écrit un site');
SELECT pg_temp.expect_error($$SELECT public.watch_record_check('00000000-0000-0000-0000-0000000000e1', 'hors_ligne', 500, 10)$$, 'membre écrit un contrôle');
SELECT pg_temp.expect_error($$SELECT public.watch_status()$$, 'membre lit le tableau de bord');
SELECT pg_temp.expect_error($$SELECT public.watch_publish('00000000-0000-0000-0000-0000000000e1')$$, 'membre publie');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
DO $$ BEGIN
  IF (SELECT count(*) FROM public.watch_sites) <> 1 OR (SELECT count(*) FROM public.watch_rejects) <> 1 THEN
    RAISE EXCEPTION 'l''admin ne voit pas la veille'; END IF;
  IF (public.watch_status() ->> 'a_publier')::int <> 1 THEN RAISE EXCEPTION 'tableau de bord : %', public.watch_status(); END IF;
END $$;
UPDATE public.watch_sources SET enabled = false WHERE label = 'Sites Lovable';
SELECT pg_temp.expect_error($$UPDATE public.watch_sites SET title = 'x'$$, 'admin modifie un site à la main (réservé au serveur)');
RESET ROLE;

-- 3. Propositions des membres : module allumé, adresse normalisée, 5 par jour ---------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT pg_temp.expect_error($$INSERT INTO public.watch_submissions (url, host, submitted_by) VALUES ('https://a.fr', 'a.fr', '00000000-0000-0000-0000-0000000000a2')$$, 'module éteint');
RESET ROLE;
UPDATE public.site_settings SET value = value || '{"watch": true}' WHERE key = 'modules';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
INSERT INTO public.watch_submissions (url, host, submitted_by, note)
VALUES ('  WWW.Mon-Site.FR/page?x=1 ', 'ignore.fr', '00000000-0000-0000-0000-0000000000a2', 'Un outil utile');
DO $$ BEGIN
  IF (SELECT host FROM public.watch_submissions) <> 'www.mon-site.fr' THEN RAISE EXCEPTION 'domaine : %', (SELECT host FROM public.watch_submissions); END IF;
  IF (SELECT url FROM public.watch_submissions) <> 'https://www.mon-site.fr' THEN RAISE EXCEPTION 'adresse normalisée'; END IF;
END $$;
SELECT pg_temp.expect_error($$INSERT INTO public.watch_submissions (url, host, submitted_by) VALUES ('https://www.mon-site.fr', 'x.fr', '00000000-0000-0000-0000-0000000000a2')$$, 'même site en attente deux fois');
SELECT pg_temp.expect_error($$INSERT INTO public.watch_submissions (url, host, submitted_by) VALUES ('javascript:alert(1)', 'x.fr', '00000000-0000-0000-0000-0000000000a2')$$, 'adresse sans domaine');
SELECT pg_temp.expect_error($$INSERT INTO public.watch_submissions (url, host, submitted_by) VALUES ('https://b.fr', 'b.fr', '00000000-0000-0000-0000-0000000000a3')$$, 'proposer au nom d''un autre');
SELECT pg_temp.expect_error($$INSERT INTO public.watch_submissions (url, host, submitted_by, status) VALUES ('https://c.fr', 'c.fr', '00000000-0000-0000-0000-0000000000a2', 'acceptee')$$, 'proposition déjà acceptée');
INSERT INTO public.watch_submissions (url, host, submitted_by) VALUES
  ('b.fr', 'b.fr', '00000000-0000-0000-0000-0000000000a2'),
  ('c.fr', 'c.fr', '00000000-0000-0000-0000-0000000000a2'),
  ('d.fr', 'd.fr', '00000000-0000-0000-0000-0000000000a2'),
  ('e.fr', 'e.fr', '00000000-0000-0000-0000-0000000000a2');
SELECT pg_temp.expect_error($$INSERT INTO public.watch_submissions (url, host, submitted_by) VALUES ('f.fr', 'f.fr', '00000000-0000-0000-0000-0000000000a2')$$, 'sixième proposition du jour');
SELECT pg_temp.expect_error($$UPDATE public.watch_submissions SET status = 'acceptee'$$, 'membre valide sa proposition');
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'autre@test.fr');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.watch_submissions) THEN RAISE EXCEPTION 'propositions d''autrui visibles'; END IF;
END $$;
RESET ROLE;

-- 4. Contrôles (serveur) : état, historique, statut inconnu refusé ----------------------------------------
SELECT public.watch_record_check('00000000-0000-0000-0000-0000000000e1', 'hors_ligne', 503, 120);
SELECT pg_temp.expect_error($$SELECT public.watch_record_check('00000000-0000-0000-0000-0000000000e1', 'inconnu', 200, 1)$$, 'statut inconnu');
DO $$ BEGIN
  IF (SELECT status FROM public.watch_sites WHERE host = 'exemple.fr') <> 'hors_ligne' THEN RAISE EXCEPTION 'état du site'; END IF;
  IF (SELECT count(*) FROM public.watch_checks) <> 1 THEN RAISE EXCEPTION 'historique'; END IF;
END $$;

-- 5. Publication : annuaire requis, fiche en brouillon, une seule fois ------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
SELECT pg_temp.expect_error($$SELECT public.watch_publish('00000000-0000-0000-0000-0000000000e1')$$, 'annuaire éteint');
RESET ROLE;
UPDATE public.site_settings SET value = value || '{"directory": true}' WHERE key = 'modules';
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a1', 'manuel.rohaut@gmail.com');
DO $$
DECLARE
  _l uuid := public.watch_publish('00000000-0000-0000-0000-0000000000e1');
BEGIN
  IF (SELECT status FROM public.directory_listings WHERE id = _l) <> 'draft' THEN RAISE EXCEPTION 'fiche publiée sans validation'; END IF;
  IF (SELECT slug FROM public.directory_listings WHERE id = _l) <> 'exemple-fr' THEN RAISE EXCEPTION 'adresse de la fiche'; END IF;
  IF (SELECT website FROM public.directory_listings WHERE id = _l) <> 'https://exemple.fr' THEN RAISE EXCEPTION 'site'; END IF;
  IF (SELECT tags FROM public.directory_listings WHERE id = _l) <> ARRAY['Lovable', 'React'] THEN
    RAISE EXCEPTION 'étiquettes : %', (SELECT tags FROM public.directory_listings WHERE id = _l); END IF;
  IF public.watch_publish('00000000-0000-0000-0000-0000000000e1') <> _l THEN RAISE EXCEPTION 'publié deux fois'; END IF;
  IF (public.watch_status() ->> 'a_publier')::int <> 0 THEN RAISE EXCEPTION 'reste à publier'; END IF;
END $$;
RESET ROLE;

-- 6. Suppression de compte : propositions détachées du membre -------------------------------------------
SELECT pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'membre@test.fr');
SELECT public.delete_my_account();
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.watch_submissions WHERE submitted_by = '00000000-0000-0000-0000-0000000000a2') THEN
    RAISE EXCEPTION 'propositions encore liées au compte supprimé'; END IF;
  IF (SELECT count(*) FROM public.watch_submissions) <> 5 THEN RAISE EXCEPTION 'propositions perdues'; END IF;
END $$;
ROLLBACK;
