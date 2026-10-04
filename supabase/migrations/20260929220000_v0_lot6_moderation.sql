-- V0 · Lot 6 — Modération avec note visible (admins seulement, décision du 29/09).
-- L'admin corrige un contenu (lien, insulte), le valide et signe une note publique :
-- « Modéré par l'équipe : lien retiré ». La base date et signe la note ; un membre ne peut
-- ni en écrire une, ni la modifier ; s'il réécrit son texte, la note ne s'applique plus et disparaît.
-- Rejouable sans danger : colonnes ajoutées si absentes, contraintes, fonction et déclencheurs recréés.

CREATE OR REPLACE FUNCTION public.guard_moderation_note()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  _is_admin boolean := current_user NOT IN ('authenticated', 'anon') OR public.has_role(auth.uid(), 'admin');
  _content_changed boolean := TG_OP = 'UPDATE'
    AND (to_jsonb(NEW) ->> 'content') IS DISTINCT FROM (to_jsonb(OLD) ->> 'content');
BEGIN
  IF NOT _is_admin THEN
    IF TG_OP = 'INSERT' OR _content_changed THEN
      NEW.moderation_note := NULL;
      NEW.moderated_at := NULL;
      NEW.moderated_by := NULL;
    ELSE
      NEW.moderation_note := OLD.moderation_note;
      NEW.moderated_at := OLD.moderated_at;
      NEW.moderated_by := OLD.moderated_by;
    END IF;
    RETURN NEW;
  END IF;
  NEW.moderation_note := nullif(btrim(coalesce(NEW.moderation_note, '')), '');
  IF NEW.moderation_note IS NULL THEN
    NEW.moderated_at := NULL;
    NEW.moderated_by := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.moderation_note IS DISTINCT FROM OLD.moderation_note OR _content_changed THEN
    NEW.moderated_at := now();
    NEW.moderated_by := auth.uid();
  ELSE
    NEW.moderated_at := OLD.moderated_at;
    NEW.moderated_by := OLD.moderated_by;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE _t text;
BEGIN
  FOREACH _t IN ARRAY ARRAY['blog_comments', 'reviews', 'forum_topics', 'forum_replies', 'directory_reviews', 'testimonials'] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS moderation_note text', _t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS moderated_at timestamptz', _t);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS moderated_by uuid', _t);
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', _t, _t || '_moderation_note_length');
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (length(moderation_note) <= 500)', _t, _t || '_moderation_note_length');
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', _t || '_moderation', _t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.guard_moderation_note()', _t || '_moderation', _t);
  END LOOP;
END $$;
