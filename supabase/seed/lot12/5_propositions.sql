CREATE TABLE IF NOT EXISTS public.watch_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  host text NOT NULL,
  note text NOT NULL DEFAULT '',
  submitted_by uuid,
  status text NOT NULL DEFAULT 'en_attente',
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
ALTER TABLE public.watch_submissions DROP CONSTRAINT IF EXISTS watch_submissions_check;
ALTER TABLE public.watch_submissions ADD CONSTRAINT watch_submissions_check CHECK (
  status IN ('en_attente', 'acceptee', 'refusee', 'erreur')
  AND char_length(url) BETWEEN 4 AND 300 AND char_length(note) <= 500
  AND host ~ '^[a-z0-9-]+([.][a-z0-9-]+)+$'
);
CREATE UNIQUE INDEX IF NOT EXISTS watch_submissions_pending_unique
  ON public.watch_submissions (submitted_by, host) WHERE status = 'en_attente';
CREATE INDEX IF NOT EXISTS watch_submissions_queue_idx ON public.watch_submissions (status, created_at);
ALTER TABLE public.watch_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_submissions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.watch_submissions TO authenticated;
GRANT ALL ON public.watch_submissions TO service_role;
DROP POLICY IF EXISTS watch_submissions_insert ON public.watch_submissions;
CREATE POLICY watch_submissions_insert ON public.watch_submissions FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status = 'en_attente' AND result IS NULL
              AND processed_at IS NULL AND public.module_enabled('watch'));
DROP POLICY IF EXISTS watch_submissions_read ON public.watch_submissions;
CREATE POLICY watch_submissions_read ON public.watch_submissions FOR SELECT TO authenticated
  USING (submitted_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS watch_submissions_admin_delete ON public.watch_submissions;
CREATE POLICY watch_submissions_admin_delete ON public.watch_submissions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.guard_watch_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _raw text := btrim(coalesce(NEW.url, ''));
BEGIN
  IF _raw !~* '^https{0,1}://' THEN
    _raw := 'https://' || _raw;
  END IF;
  NEW.host := lower(substring(_raw from '^[A-Za-z]+://([^/:#]+)'));
  IF NEW.host IS NULL OR NEW.host !~ '^[a-z0-9-]+([.][a-z0-9-]+)+$' THEN
    RAISE EXCEPTION 'Adresse invalide : indiquez un site comme exemple.fr' USING ERRCODE = '22023';
  END IF;
  NEW.url := 'https://' || NEW.host;
  NEW.note := left(btrim(coalesce(NEW.note, '')), 500);
  NEW.created_at := now();
  IF NEW.submitted_by IS NOT NULL AND NOT public.has_role(NEW.submitted_by, 'admin') AND (
    SELECT count(*) FROM public.watch_submissions s
    WHERE s.submitted_by = NEW.submitted_by AND s.created_at > now() - interval '24 hours'
  ) >= 5 THEN
    RAISE EXCEPTION 'Cinq propositions par jour au plus : réessayez demain' USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS watch_submissions_guard ON public.watch_submissions;
CREATE TRIGGER watch_submissions_guard BEFORE INSERT ON public.watch_submissions
  FOR EACH ROW EXECUTE FUNCTION public.guard_watch_submission();
