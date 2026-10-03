CREATE OR REPLACE FUNCTION public.mark_modules_choice()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.key = 'modules' AND auth.uid() IS NOT NULL THEN
    INSERT INTO public.site_settings (key, value)
    VALUES ('demarrage', jsonb_build_object('modules_choisis_le', now()))
    ON CONFLICT (key) DO UPDATE
      SET value = public.site_settings.value || jsonb_build_object('modules_choisis_le', now()),
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_modules_choice() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS site_settings_mark_modules_choice ON public.site_settings;
CREATE TRIGGER site_settings_mark_modules_choice AFTER INSERT OR UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.mark_modules_choice();
