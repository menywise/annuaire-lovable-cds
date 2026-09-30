CREATE OR REPLACE FUNCTION public.module_defaults()
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT '{
    "blog": true, "faq": true, "contact": true, "newsletter": true, "forum": true,
    "members": true, "messaging": true, "testimonials": true, "reviews": true, "pricing": true,
    "onboarding": true, "directory": false, "geo": false, "crm": false, "lms": false,
    "marketplace": false, "adNetwork": false, "studio": true, "showcase": true,
    "media": true, "pages": false, "payments": false, "reports": true, "search": true,
    "shop": false, "watch": false
  }'::jsonb
$$;
GRANT EXECUTE ON FUNCTION public.module_defaults() TO anon, authenticated, service_role;

INSERT INTO public.site_settings (key, value) VALUES ('modules', public.module_defaults())
  ON CONFLICT (key) DO UPDATE
  SET value = public.module_defaults() || (
    SELECT coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
    FROM jsonb_each(public.site_settings.value) AS e(k, v)
    WHERE (public.module_defaults() -> k) IS NOT NULL
  );

INSERT INTO public.site_settings (key, value)
VALUES ('watch', '{"gate_min_score": 0, "prefilter_min_score": 0, "language": "fr",
  "min_language_score": 45, "search_limit": 8, "sources_per_run": 2, "checks_per_run": 25,
  "submissions_per_run": 5}'::jsonb)
ON CONFLICT (key) DO NOTHING;
