CREATE OR REPLACE FUNCTION public.module_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT '{
    "blog": false, "faq": false, "contact": false, "newsletter": false, "forum": false,
    "members": false, "messaging": false, "testimonials": false, "reviews": false, "pricing": false,
    "onboarding": false, "directory": false, "geo": false, "crm": false, "lms": false,
    "marketplace": false, "adNetwork": false, "studio": true, "showcase": false,
    "media": true, "pages": false, "payments": false, "reports": false, "search": true,
    "shop": false
  }'::jsonb
$$;
GRANT EXECUTE ON FUNCTION public.module_defaults() TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.module_socle_keys()
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT ARRAY['studio', 'media', 'search']
$$;
GRANT EXECUTE ON FUNCTION public.module_socle_keys() TO anon, authenticated, service_role;
