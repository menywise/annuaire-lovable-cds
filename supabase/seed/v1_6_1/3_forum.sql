CREATE OR REPLACE FUNCTION public.forum_author_name(_user_id uuid)
RETURNS text LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(
    (SELECT nullif(nullif(btrim(mp.display_name), ''), 'Membre')
     FROM public.member_profiles mp WHERE mp.user_id = _user_id),
    (SELECT nullif(btrim(p.full_name), '') FROM public.profiles p WHERE p.id = _user_id),
    'Membre')
$$;
REVOKE ALL ON FUNCTION public.forum_author_name(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.forum_author_name(uuid) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.guard_forum_topic_insert()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  NEW := jsonb_populate_record(NEW, '{"pinned": false}'::jsonb);
  NEW.views := 0;
  NEW.locked := false;
  NEW.created_at := now();
  NEW.updated_at := now();
  NEW.last_activity_at := now();
  NEW.author_name := public.forum_author_name(auth.uid());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_forum_topic_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS forum_topics_guard_insert ON public.forum_topics;
CREATE TRIGGER forum_topics_guard_insert BEFORE INSERT ON public.forum_topics
  FOR EACH ROW EXECUTE FUNCTION public.guard_forum_topic_insert();
CREATE OR REPLACE FUNCTION public.guard_forum_reply_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _locked boolean;
BEGIN
  IF auth.uid() IS NOT NULL AND public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  SELECT t.locked INTO _locked FROM public.forum_topics t WHERE t.id = NEW.topic_id FOR NO KEY UPDATE;
  IF _locked THEN
    RAISE EXCEPTION 'Discussion verrouillée' USING ERRCODE = '42501';
  END IF;
  NEW.accepted := false;
  NEW.created_at := now();
  NEW.author_name := public.forum_author_name(auth.uid());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_forum_reply_insert() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS forum_replies_guard_insert ON public.forum_replies;
CREATE TRIGGER forum_replies_guard_insert BEFORE INSERT ON public.forum_replies
  FOR EACH ROW WHEN (current_user IN ('anon', 'authenticated'))
  EXECUTE FUNCTION public.guard_forum_reply_insert();
