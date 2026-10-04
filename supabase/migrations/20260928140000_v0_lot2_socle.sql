-- V0 · Lot 2 « Socle » — modules en base, utilisateurs et rôles, suppression de son compte.
-- Rejouable sans danger : fonctions et déclencheurs recréés, paramètres complétés sans écraser.

-- 1. Modules en base ----------------------------------------------------------------
-- Valeurs par défaut des 19 modules (V0.md §2) : l'existant allumé, les briques optionnelles éteintes.
CREATE OR REPLACE FUNCTION public.module_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT '{
    "blog": true, "faq": true, "contact": true, "newsletter": true, "forum": true,
    "members": true, "messaging": true, "testimonials": true, "reviews": true, "pricing": true,
    "onboarding": true, "directory": false, "geo": false, "crm": false, "lms": false,
    "marketplace": false, "adNetwork": false, "studio": true, "showcase": true
  }'::jsonb
$$;
GRANT EXECUTE ON FUNCTION public.module_defaults() TO anon, authenticated, service_role;

-- La base refuse une clé inconnue, une valeur non booléenne ou une dépendance manquante.
CREATE OR REPLACE FUNCTION public.validate_modules_setting()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _k text;
  _v jsonb;
  _m jsonb;
BEGIN
  IF NEW.key <> 'modules' THEN
    RETURN NEW;
  END IF;
  IF jsonb_typeof(NEW.value) <> 'object' THEN
    RAISE EXCEPTION 'Modules : objet attendu' USING ERRCODE = '22023';
  END IF;
  FOR _k, _v IN SELECT * FROM jsonb_each(NEW.value) LOOP
    IF NOT public.module_defaults() ? _k THEN
      RAISE EXCEPTION 'Module inconnu : %', _k USING ERRCODE = '22023';
    END IF;
    IF jsonb_typeof(_v) <> 'boolean' THEN
      RAISE EXCEPTION 'Module % : vrai ou faux attendu', _k USING ERRCODE = '22023';
    END IF;
  END LOOP;
  _m := public.module_defaults() || NEW.value;
  IF (_m ->> 'geo')::boolean AND NOT (_m ->> 'directory')::boolean THEN
    RAISE EXCEPTION 'La géographie exige l''annuaire métier' USING ERRCODE = '23514';
  END IF;
  IF (_m ->> 'messaging')::boolean AND NOT (_m ->> 'members')::boolean THEN
    RAISE EXCEPTION 'La messagerie exige les membres' USING ERRCODE = '23514';
  END IF;
  IF (_m ->> 'marketplace')::boolean AND NOT (_m ->> 'messaging')::boolean THEN
    RAISE EXCEPTION 'Les petites annonces exigent la messagerie' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS site_settings_validate_modules ON public.site_settings;
CREATE TRIGGER site_settings_validate_modules BEFORE INSERT OR UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.validate_modules_setting();

-- Ligne « modules » : créée si absente, complétée des clés manquantes sinon (les choix existants sont gardés).
INSERT INTO public.site_settings (key, value) VALUES ('modules', public.module_defaults())
  ON CONFLICT (key) DO UPDATE
  SET value = public.module_defaults() || (
    SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    FROM jsonb_each(public.site_settings.value) AS e(k, v)
    WHERE public.module_defaults() ? k
  );

-- 1 bis. Annuaire des membres : inscription volontaire (RGPD) -----------------------------
-- Un nouveau profil public n'est plus listé par défaut. Les profils existants ne changent pas.
ALTER TABLE public.member_profiles ALTER COLUMN listed SET DEFAULT false;

-- 2. Utilisateurs et rôles ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  is_admin boolean,
  is_studio_admin boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id,
         lower(u.email)::text,
         p.full_name,
         u.created_at,
         u.last_sign_in_at,
         public.has_role(u.id, 'admin'),
         EXISTS (SELECT 1 FROM public.studio_admins s WHERE s.email = lower(u.email))
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  ORDER BY u.created_at DESC;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Promotion / rétrogradation. Garde-fous : pas soi-même, pas un admin du studio.
CREATE OR REPLACE FUNCTION public.admin_set_admin(_user_id uuid, _admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _email text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  SELECT lower(email) INTO _email FROM auth.users WHERE id = _user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utilisateur introuvable' USING ERRCODE = 'P0002';
  END IF;
  IF _admin THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'admin')
      ON CONFLICT (user_id, role) DO NOTHING;
    RETURN;
  END IF;
  IF _user_id = auth.uid() THEN
    RAISE EXCEPTION 'Vous ne pouvez pas retirer votre propre rôle d''administrateur' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.studio_admins WHERE email = _email) THEN
    RAISE EXCEPTION 'Adresse des admins du studio : retirez-la d''abord de cette liste' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = _user_id AND role = 'admin';
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'user')
    ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_admin(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_admin(uuid, boolean) TO authenticated;

-- Admins du studio : une adresse ajoutée promeut aussitôt le compte existant.
CREATE OR REPLACE FUNCTION public.promote_studio_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  SELECT u.id, 'admin' FROM auth.users u WHERE lower(u.email) = NEW.email
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.promote_studio_admin() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS studio_admins_promote ON public.studio_admins;
CREATE TRIGGER studio_admins_promote AFTER INSERT ON public.studio_admins
  FOR EACH ROW EXECUTE FUNCTION public.promote_studio_admin();

-- La liste des admins du studio ne peut pas être vidée.
CREATE OR REPLACE FUNCTION public.keep_one_studio_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.studio_admins) THEN
    RAISE EXCEPTION 'Il faut au moins une adresse d''admin du studio' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.keep_one_studio_admin() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS studio_admins_keep_one ON public.studio_admins;
CREATE TRIGGER studio_admins_keep_one AFTER DELETE ON public.studio_admins
  FOR EACH STATEMENT EXECUTE FUNCTION public.keep_one_studio_admin();

-- 3. Suppression de son compte (promise dans les CGU) ----------------------------------------
-- Contributions publiques conservées mais anonymisées (« Ancien membre », identifiant neutre).
-- Données privées supprimées : conversations, annonces, suivi de contacts, formations, j'aime, suivis.
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _ghost constant uuid := '00000000-0000-0000-0000-000000000000';
  _name constant text := 'Ancien membre';
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;
  IF public.has_role(_uid, 'admin')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin' AND user_id <> _uid) THEN
    RAISE EXCEPTION 'Vous êtes le dernier administrateur : nommez-en un autre avant de partir' USING ERRCODE = '42501';
  END IF;

  UPDATE public.forum_topics SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.forum_replies SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.blog_comments SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.reviews SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.directory_reviews SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.testimonials SET author_id = NULL, author_name = _name WHERE author_id = _uid;
  UPDATE public.blog_posts SET author_id = NULL WHERE author_id = _uid;
  UPDATE public.directory_listings SET created_by = NULL WHERE created_by = _uid;
  UPDATE public.directory_listings SET claimed_by = NULL WHERE claimed_by = _uid;
  UPDATE public.directory_listings SET claim_requested_by = NULL WHERE claim_requested_by = _uid;
  UPDATE public.site_settings SET updated_by = NULL WHERE updated_by = _uid;

  DELETE FROM public.forum_likes WHERE user_id = _uid;
  DELETE FROM public.forum_follows WHERE user_id = _uid;
  DELETE FROM public.conversations WHERE user_a = _uid OR user_b = _uid;
  DELETE FROM public.messages WHERE sender_id = _uid;
  DELETE FROM public.marketplace_listings WHERE seller_id = _uid;
  DELETE FROM public.crm_interactions WHERE owner_id = _uid;
  DELETE FROM public.crm_actions WHERE owner_id = _uid;
  DELETE FROM public.crm_prospects WHERE owner_id = _uid;
  DELETE FROM public.lms_progress WHERE user_id = _uid;
  DELETE FROM public.lms_enrollments WHERE user_id = _uid;
  DELETE FROM public.member_profiles WHERE user_id = _uid;
  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
