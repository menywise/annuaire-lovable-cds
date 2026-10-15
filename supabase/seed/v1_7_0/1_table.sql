ALTER TABLE public.reports ALTER COLUMN reporter_id DROP NOT NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'membre';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS proposed_value text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS contact_email text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS public_note text;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_source_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_source_check CHECK (
  (source = 'membre' AND reporter_id IS NOT NULL) OR (source = 'visiteur' AND reporter_id IS NULL));
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_content_type_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_content_type_check CHECK (content_type IN (
  'article', 'commentaire', 'sujet', 'reponse', 'avis', 'fiche', 'avis_fiche', 'annonce',
  'temoignage', 'membre', 'formation', 'page', 'autre'));
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_reason_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_reason_check CHECK (reason IN (
  'spam', 'contenu_inapproprie', 'harcelement', 'fraude', 'information_erronee', 'doublon',
  'droit_auteur', 'contenu_illegal', 'oubli', 'correction', 'autre'));
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_proposed_length;
ALTER TABLE public.reports ADD CONSTRAINT reports_proposed_length CHECK (char_length(proposed_value) <= 2000);
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_public_note_length;
ALTER TABLE public.reports ADD CONSTRAINT reports_public_note_length CHECK (char_length(public_note) <= 500);
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_contact_email_format;
ALTER TABLE public.reports ADD CONSTRAINT reports_contact_email_format CHECK (contact_email IS NULL OR (
  char_length(contact_email) <= 254 AND contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'));
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_links_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_links_check CHECK (
  regexp_count(coalesce(details, '') || ' ' || coalesce(proposed_value, ''), '(https|http)://|www[.]', 1, 'i') <= 1);
CREATE UNIQUE INDEX IF NOT EXISTS reports_tracking_code_key ON public.reports (tracking_code);
CREATE INDEX IF NOT EXISTS reports_improvements_idx ON public.reports (handled_at DESC)
  WHERE status = 'action_prise' AND public_note IS NOT NULL;
DROP POLICY IF EXISTS reports_insert ON public.reports;
CREATE POLICY reports_insert ON public.reports FOR INSERT TO authenticated
  WITH CHECK (
    reporter_id = auth.uid() AND source = 'membre' AND status = 'en_attente' AND admin_note IS NULL
    AND public_note IS NULL AND handled_at IS NULL AND handled_by IS NULL
    AND public.module_enabled('reports')
  );
CREATE OR REPLACE FUNCTION public.guard_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    NEW.tracking_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));
    IF NEW.reporter_id IS NOT NULL AND NOT public.has_role(NEW.reporter_id, 'admin') AND (
      SELECT count(*) FROM public.reports r
      WHERE r.reporter_id = NEW.reporter_id AND r.created_at > now() - interval '24 hours'
    ) >= 10 THEN
      RAISE EXCEPTION 'Trop de signalements aujourd''hui : réessayez demain' USING ERRCODE = '54000';
    END IF;
    RETURN NEW;
  END IF;
  NEW.reporter_id := CASE WHEN NEW.reporter_id = '00000000-0000-0000-0000-000000000000'::uuid
                          THEN NEW.reporter_id ELSE OLD.reporter_id END;
  NEW.source := OLD.source;
  NEW.content_type := OLD.content_type;
  NEW.content_id := OLD.content_id;
  NEW.reason := OLD.reason;
  NEW.details := OLD.details;
  NEW.proposed_value := OLD.proposed_value;
  NEW.reported_url := OLD.reported_url;
  NEW.tracking_code := OLD.tracking_code;
  NEW.contact_email := CASE WHEN NEW.contact_email IS NULL THEN NULL ELSE OLD.contact_email END;
  NEW.created_at := OLD.created_at;
  IF NEW.status IS DISTINCT FROM OLD.status OR NEW.admin_note IS DISTINCT FROM OLD.admin_note
     OR NEW.public_note IS DISTINCT FROM OLD.public_note THEN
    NEW.handled_at := CASE WHEN NEW.status = 'en_attente' THEN NULL ELSE now() END;
    NEW.handled_by := CASE WHEN NEW.status = 'en_attente' THEN NULL ELSE auth.uid() END;
  ELSE
    NEW.handled_at := OLD.handled_at;
    NEW.handled_by := CASE WHEN NEW.handled_by IS NULL THEN NULL ELSE OLD.handled_by END;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reports_guard ON public.reports;
CREATE TRIGGER reports_guard BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.guard_report();
