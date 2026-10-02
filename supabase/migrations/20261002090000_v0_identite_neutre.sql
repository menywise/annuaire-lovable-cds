-- V0 · Identité neutre — premier administrateur sans adresse écrite dans le code.
-- Règle : sur une base sans administrateur, le premier compte qui se connecte devient administrateur,
-- une seule fois dans la vie de la base (verrou). Ensuite seul un administrateur en nomme un autre,
-- et la base refuse de retirer le dernier administrateur.
-- Rejouable sans danger. Écrit pour l'éditeur SQL de Lovable : ni antislash ni point d'interrogation,
-- aucune ligne vide dans une fonction.

-- 1. Verrou du premier administrateur ----------------------------------------------------------------
-- Une seule ligne possible (clé booléenne toujours vraie). Aucun droit pour les comptes : seules les
-- fonctions de la base y écrivent.
CREATE TABLE IF NOT EXISTS public.premier_administrateur (
  verrou boolean PRIMARY KEY DEFAULT true CHECK (verrou),
  user_id uuid,
  promu_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.premier_administrateur ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premier_administrateur FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.premier_administrateur TO service_role;

-- Base qui a déjà un administrateur : verrou fermé tout de suite.
INSERT INTO public.premier_administrateur (verrou, user_id, promu_le)
SELECT true, r.user_id, r.created_at FROM public.user_roles r
WHERE r.role = 'admin' ORDER BY r.created_at LIMIT 1
ON CONFLICT (verrou) DO NOTHING;

-- 2. Création du compte ------------------------------------------------------------------------------
-- Administrateur si son adresse a été nommée d'avance (liste saisie en admin), ou s'il est le premier
-- compte d'une base sans administrateur. L'insertion dans le verrou est atomique : deux inscriptions
-- simultanées ne donnent qu'un administrateur.
CREATE OR REPLACE FUNCTION public.bootstrap_current_user(_full_name text DEFAULT NULL)
RETURNS public.app_role
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  _name text := nullif(trim(coalesce(_full_name, auth.jwt() -> 'user_metadata' ->> 'full_name', '')), '');
  _role public.app_role := 'user';
  _n integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifie';
  END IF;
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (_uid, _email, _name)
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);
  IF _email <> '' AND EXISTS (SELECT 1 FROM public.studio_admins WHERE email = _email) THEN
    _role := 'admin';
  ELSIF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.premier_administrateur (verrou, user_id) VALUES (true, _uid)
      ON CONFLICT (verrou) DO NOTHING;
    GET DIAGNOSTICS _n = ROW_COUNT;
    IF _n = 1 THEN
      _role := 'admin';
    END IF;
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_uid, _role)
  ON CONFLICT (user_id, role) DO NOTHING;
  IF public.has_role(_uid, 'admin') THEN
    RETURN 'admin';
  END IF;
  RETURN _role;
END;
$$;
REVOKE ALL ON FUNCTION public.bootstrap_current_user(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bootstrap_current_user(text) TO authenticated;

-- 3. Jamais zéro administrateur une fois le verrou fermé ----------------------------------------------
-- Couvre tous les chemins : rétrogradation, suppression de son compte, suppression d'un compte depuis
-- le tableau de bord de la base (cascade vers user_roles).
CREATE OR REPLACE FUNCTION public.garder_un_administrateur()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.premier_administrateur)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    RAISE EXCEPTION 'Le dernier administrateur ne peut pas être retiré : nommez-en un autre d''abord' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.garder_un_administrateur() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS user_roles_garder_un_administrateur ON public.user_roles;
CREATE TRIGGER user_roles_garder_un_administrateur AFTER DELETE OR UPDATE ON public.user_roles
  FOR EACH STATEMENT EXECUTE FUNCTION public.garder_un_administrateur();

-- 4. Adresses nommées d'avance : la liste peut être vide -----------------------------------------------
-- La garantie « au moins un administrateur » porte désormais sur les rôles, pas sur cette liste.
DROP TRIGGER IF EXISTS studio_admins_keep_one ON public.studio_admins;
DROP FUNCTION IF EXISTS public.keep_one_studio_admin();

-- Retrait des adresses déjà utilisées : compte existant et déjà administrateur. Le rôle reste acquis ;
-- seule la ligne de la liste disparaît. Les adresses pas encore utilisées restent.
DELETE FROM public.studio_admins s
WHERE EXISTS (
  SELECT 1 FROM auth.users u
  JOIN public.user_roles r ON r.user_id = u.id AND r.role = 'admin'
  WHERE lower(u.email) = s.email
);
-- Base neuve (aucun compte) : la liste ne peut venir que d'une ancienne migration, jamais d'une saisie
-- en admin. Elle est vidée.
DELETE FROM public.studio_admins WHERE NOT EXISTS (SELECT 1 FROM auth.users);

-- 5. Grille de conformité -------------------------------------------------------------------------------
INSERT INTO public.template_checks (code, area, label, requirement, status, severity, evidence, position)
SELECT v.code, v.area, v.label, v.requirement, v.status, v.severity, v.evidence,
       coalesce((SELECT max(position) FROM public.template_checks), 0) + v.n
FROM (VALUES
  (1, 'V0-IDENTITE-NEUTRE', 'Socle', 'Identité neutre et premier administrateur',
   'Aucune adresse ni marque dans le code : le premier compte d''une base vide devient administrateur, une seule fois ; couleurs, logo, icônes, image de partage et accueil se règlent dans les paramètres.',
   'a_verifier', 'bloquant', 'tests/db/test_19_premier_administrateur.sql ; tests/unit/identite-neutre.test.ts')
) AS v(n, code, area, label, requirement, status, severity, evidence)
ON CONFLICT (code) DO NOTHING;
