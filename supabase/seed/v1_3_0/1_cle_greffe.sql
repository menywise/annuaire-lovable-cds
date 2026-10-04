CREATE OR REPLACE FUNCTION public.module_is_greffe(_key text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(_key ~ '^greffe_[a-z0-9_]{1,40}$', false)
$$;
GRANT EXECUTE ON FUNCTION public.module_is_greffe(text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.module_greffe_values(_value jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT coalesce(jsonb_object_agg(e.key, e.value), '{}'::jsonb)
  FROM jsonb_each(coalesce(_value, '{}'::jsonb)) AS e
  WHERE public.module_is_greffe(e.key) AND jsonb_typeof(e.value) = 'boolean'
$$;
GRANT EXECUTE ON FUNCTION public.module_greffe_values(jsonb) TO anon, authenticated, service_role;
