INSERT INTO public.site_settings (key, value)
SELECT 'demarrage', jsonb_build_object('modules_choisis_le', s.updated_at)
FROM public.site_settings s
WHERE s.key = 'modules' AND s.updated_by IS NOT NULL
ON CONFLICT (key) DO NOTHING;
UPDATE public.site_settings SET value = public.module_defaults(), updated_at = now()
WHERE key = 'modules'
  AND NOT EXISTS (SELECT 1 FROM public.site_settings d
                  WHERE d.key = 'demarrage' AND (d.value -> 'modules_choisis_le') IS NOT NULL);
UPDATE public.site_settings
SET value = value || '{"studio": true, "media": true, "search": true}'::jsonb
WHERE key = 'modules'
  AND (value ->> 'studio' = 'false' OR value ->> 'media' = 'false' OR value ->> 'search' = 'false');
