-- V0 · Lot 5 A — Médiathèque (module « media »).
-- Espace de stockage « media » : l'admin dépose, le public lit (adresse publique du fichier).
-- Rejouable sans danger : fonctions, politiques et espace recréés ou mis à jour, table créée si absente.

-- 1. Module « media » -----------------------------------------------------------------------
-- Même liste que src/config/modules.ts (20 modules).
CREATE OR REPLACE FUNCTION public.module_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT '{
    "blog": true, "faq": true, "contact": true, "newsletter": true, "forum": true,
    "members": true, "messaging": true, "testimonials": true, "reviews": true, "pricing": true,
    "onboarding": true, "directory": false, "geo": false, "crm": false, "lms": false,
    "marketplace": false, "adNetwork": false, "studio": true, "showcase": true,
    "media": true
  }'::jsonb
$$;
GRANT EXECUTE ON FUNCTION public.module_defaults() TO anon, authenticated, service_role;

-- Ligne « modules » complétée des clés manquantes (les choix existants sont gardés).
INSERT INTO public.site_settings (key, value) VALUES ('modules', public.module_defaults())
  ON CONFLICT (key) DO UPDATE
  SET value = public.module_defaults() || (
    SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    FROM jsonb_each(public.site_settings.value) AS e(k, v)
    WHERE public.module_defaults() ? k
  );

-- État d'un module lu par la base (les règles d'accès s'en servent). Clé inconnue = éteint.
CREATE OR REPLACE FUNCTION public.module_enabled(_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.module_defaults() ? _key AND coalesce((
    public.module_defaults()
    || coalesce((SELECT value FROM public.site_settings WHERE key = 'modules'), '{}'::jsonb)
  ) ->> _key, 'false')::boolean
$$;
REVOKE ALL ON FUNCTION public.module_enabled(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.module_enabled(text) TO anon, authenticated, service_role;

-- 2. Espace de stockage -----------------------------------------------------------------------
-- 10 Mo par fichier. Images et PDF. Pas de SVG : il peut contenir du script.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('media', 'media', true, 10485760,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Lecture publique par l'adresse du fichier (espace public) ; la liste des fichiers est réservée à l'admin.
DROP POLICY IF EXISTS media_admin_read ON storage.objects;
CREATE POLICY media_admin_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));
-- Dépôt et remplacement : admin, module allumé.
DROP POLICY IF EXISTS media_admin_insert ON storage.objects;
CREATE POLICY media_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin') AND public.module_enabled('media'));
DROP POLICY IF EXISTS media_admin_update ON storage.objects;
CREATE POLICY media_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin') AND public.module_enabled('media'));
-- Suppression : admin, même module éteint (ménage).
DROP POLICY IF EXISTS media_admin_delete ON storage.objects;
CREATE POLICY media_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(), 'admin'));

-- 3. Fiches de la médiathèque (nom d'origine, texte alternatif, dimensions) ---------------------
CREATE TABLE IF NOT EXISTS public.media_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  alt text NOT NULL DEFAULT '',
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL DEFAULT 0,
  width integer,
  height integer,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.media_files DROP CONSTRAINT IF EXISTS media_files_path_check;
ALTER TABLE public.media_files ADD CONSTRAINT media_files_path_check
  CHECK (length(path) <= 300 AND path ~ '^[a-z0-9][a-z0-9_-]*(/[a-z0-9][a-z0-9._-]*)*$');
ALTER TABLE public.media_files DROP CONSTRAINT IF EXISTS media_files_type_check;
ALTER TABLE public.media_files ADD CONSTRAINT media_files_type_check
  CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/pdf'));
ALTER TABLE public.media_files DROP CONSTRAINT IF EXISTS media_files_text_check;
ALTER TABLE public.media_files ADD CONSTRAINT media_files_text_check
  CHECK (length(name) <= 200 AND length(alt) <= 300 AND size_bytes >= 0
         AND (width IS NULL OR width > 0) AND (height IS NULL OR height > 0));
CREATE INDEX IF NOT EXISTS media_files_created_at_idx ON public.media_files (created_at DESC);

ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.media_files FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_files TO authenticated;
GRANT ALL ON public.media_files TO service_role;

DROP POLICY IF EXISTS media_files_admin_read ON public.media_files;
CREATE POLICY media_files_admin_read ON public.media_files FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS media_files_admin_insert ON public.media_files;
CREATE POLICY media_files_admin_insert ON public.media_files FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND public.module_enabled('media'));
DROP POLICY IF EXISTS media_files_admin_update ON public.media_files;
CREATE POLICY media_files_admin_update ON public.media_files FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS media_files_admin_delete ON public.media_files;
CREATE POLICY media_files_admin_delete ON public.media_files FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Date de modification et auteur tenus par la base (le chemin ne change pas après dépôt).
CREATE OR REPLACE FUNCTION public.stamp_media_file()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
    NEW.created_at := now();
  ELSE
    NEW.path := OLD.path;
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS media_files_stamp ON public.media_files;
CREATE TRIGGER media_files_stamp BEFORE INSERT OR UPDATE ON public.media_files
  FOR EACH ROW EXECUTE FUNCTION public.stamp_media_file();
