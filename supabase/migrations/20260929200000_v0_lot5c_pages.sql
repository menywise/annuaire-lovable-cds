-- V0 · Lot 5 C — Pages libres par sections (module « pages »), accueil compris.
-- Contenu au format de données de Puck (éditeur MIT) : {"root":{"props":{}},"content":[{"type":"Hero","props":{...}}]}.
-- L'éditeur Puck pourra se brancher plus tard sans migrer les pages.
-- Rejouable sans danger : fonctions, contraintes et politiques recréées, table créée si absente.

-- 1. Module « pages » (éteint par défaut : l'accueil de démonstration reste en place) -----------
-- Même liste que src/config/modules.ts (21 modules).
CREATE OR REPLACE FUNCTION public.module_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT '{
    "blog": true, "faq": true, "contact": true, "newsletter": true, "forum": true,
    "members": true, "messaging": true, "testimonials": true, "reviews": true, "pricing": true,
    "onboarding": true, "directory": false, "geo": false, "crm": false, "lms": false,
    "marketplace": false, "adNetwork": false, "studio": true, "showcase": true,
    "media": true, "pages": false
  }'::jsonb
$$;
GRANT EXECUTE ON FUNCTION public.module_defaults() TO anon, authenticated, service_role;

INSERT INTO public.site_settings (key, value) VALUES ('modules', public.module_defaults())
  ON CONFLICT (key) DO UPDATE
  SET value = public.module_defaults() || (
    SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    FROM jsonb_each(public.site_settings.value) AS e(k, v)
    WHERE public.module_defaults() ? k
  );

-- 2. Contrôle du contenu (format Puck) ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.valid_page_data(_data jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_typeof(_data) = 'object'
     AND jsonb_typeof(_data -> 'content') = 'array'
     AND jsonb_array_length(_data -> 'content') <= 60
     AND (NOT _data ? 'root' OR jsonb_typeof(_data -> 'root') = 'object')
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(_data -> 'content') AS s(section)
       WHERE jsonb_typeof(s.section) <> 'object'
          OR jsonb_typeof(s.section -> 'type') IS DISTINCT FROM 'string'
          OR NOT (s.section ->> 'type') ~ '^[A-Z][A-Za-z0-9]{0,39}$'
          OR jsonb_typeof(s.section -> 'props') IS DISTINCT FROM 'object'
     )
$$;
GRANT EXECUTE ON FUNCTION public.valid_page_data(jsonb) TO anon, authenticated, service_role;

-- 3. Table des pages -------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  data jsonb NOT NULL DEFAULT '{"root":{"props":{}},"content":[]}'::jsonb,
  is_home boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_slug_check;
ALTER TABLE public.pages ADD CONSTRAINT pages_slug_check
  CHECK (length(slug) <= 80 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_text_check;
ALTER TABLE public.pages ADD CONSTRAINT pages_text_check
  CHECK (length(btrim(title)) BETWEEN 1 AND 160 AND length(description) <= 300);
ALTER TABLE public.pages DROP CONSTRAINT IF EXISTS pages_data_check;
ALTER TABLE public.pages ADD CONSTRAINT pages_data_check
  CHECK (public.valid_page_data(data) AND pg_column_size(data) <= 262144);
-- Une seule page d'accueil.
CREATE UNIQUE INDEX IF NOT EXISTS pages_one_home ON public.pages ((true)) WHERE is_home;

ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.pages TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pages TO authenticated;
GRANT ALL ON public.pages TO service_role;

-- Lecture : pages publiées, module allumé. L'admin voit tout (brouillons compris).
DROP POLICY IF EXISTS pages_public_read ON public.pages;
CREATE POLICY pages_public_read ON public.pages FOR SELECT TO anon, authenticated
  USING (published AND public.module_enabled('pages'));
DROP POLICY IF EXISTS pages_admin_read ON public.pages;
CREATE POLICY pages_admin_read ON public.pages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS pages_admin_insert ON public.pages;
CREATE POLICY pages_admin_insert ON public.pages FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS pages_admin_update ON public.pages;
CREATE POLICY pages_admin_update ON public.pages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS pages_admin_delete ON public.pages;
CREATE POLICY pages_admin_delete ON public.pages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Dates et auteur de la dernière modification tenus par la base.
CREATE OR REPLACE FUNCTION public.stamp_page()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
  ELSE
    NEW.created_at := OLD.created_at;
  END IF;
  IF NEW.published AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pages_stamp ON public.pages;
CREATE TRIGGER pages_stamp BEFORE INSERT OR UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.stamp_page();
