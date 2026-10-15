CREATE INDEX IF NOT EXISTS forum_likes_topic_idx ON public.forum_likes (topic_id) WHERE topic_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS forum_likes_reply_idx ON public.forum_likes (reply_id) WHERE reply_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.forum_category_counts()
RETURNS TABLE (category_id uuid, topics bigint, replies bigint, likes bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  WITH r AS (
    SELECT fr.topic_id, count(*) AS n FROM public.forum_replies fr GROUP BY fr.topic_id
  ), l AS (
    SELECT coalesce(fl.topic_id, fr.topic_id) AS topic_id, count(*) AS n
    FROM public.forum_likes fl
    LEFT JOIN public.forum_replies fr ON fr.id = fl.reply_id
    GROUP BY coalesce(fl.topic_id, fr.topic_id)
  )
  SELECT t.category_id,
         count(*) AS topics,
         coalesce(sum(r.n), 0)::bigint AS replies,
         coalesce(sum(l.n), 0)::bigint AS likes
  FROM public.forum_topics t
  LEFT JOIN r ON r.topic_id = t.id
  LEFT JOIN l ON l.topic_id = t.id
  WHERE public.module_enabled('forum')
  GROUP BY t.category_id
$$;
REVOKE ALL ON FUNCTION public.forum_category_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forum_category_counts() TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.forum_topic_counts(_topic_ids uuid[])
RETURNS TABLE (topic_id uuid, replies bigint, likes bigint)
LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  IF _topic_ids IS NULL OR cardinality(_topic_ids) = 0 THEN
    RETURN;
  END IF;
  IF cardinality(_topic_ids) > 500 THEN
    RAISE EXCEPTION 'Cinq cents sujets au plus par appel' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    SELECT t.id,
           (SELECT count(*) FROM public.forum_replies fr WHERE fr.topic_id = t.id),
           (SELECT count(*) FROM public.forum_likes fl WHERE fl.topic_id = t.id)
    FROM public.forum_topics t
    WHERE t.id = ANY (_topic_ids) AND public.module_enabled('forum');
END;
$$;
REVOKE ALL ON FUNCTION public.forum_topic_counts(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forum_topic_counts(uuid[]) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.forum_reply_like_counts(_topic_id uuid)
RETURNS TABLE (reply_id uuid, likes bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT fl.reply_id, count(*) AS likes
  FROM public.forum_likes fl
  JOIN public.forum_replies fr ON fr.id = fl.reply_id
  WHERE fr.topic_id = _topic_id AND public.module_enabled('forum')
  GROUP BY fl.reply_id
$$;
REVOKE ALL ON FUNCTION public.forum_reply_like_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.forum_reply_like_counts(uuid) TO anon, authenticated, service_role;
CREATE INDEX IF NOT EXISTS lms_enrollments_course_idx ON public.lms_enrollments (course_id);
CREATE OR REPLACE FUNCTION public.lms_course_learners()
RETURNS TABLE (course_id uuid, learners bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, count(e.id) AS learners
  FROM public.lms_courses c
  LEFT JOIN public.lms_enrollments e ON e.course_id = c.id
  WHERE c.published AND public.module_enabled('lms')
  GROUP BY c.id
$$;
REVOKE ALL ON FUNCTION public.lms_course_learners() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lms_course_learners() TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.directory_departement_counts()
RETURNS TABLE (departement text, listings bigint)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT d.departement, count(*) AS listings
  FROM public.directory_listings d
  WHERE d.status = 'published' AND d.departement IS NOT NULL AND public.module_enabled('directory')
  GROUP BY d.departement
$$;
REVOKE ALL ON FUNCTION public.directory_departement_counts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.directory_departement_counts() TO anon, authenticated, service_role;
