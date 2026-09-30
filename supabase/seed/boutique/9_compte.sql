CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _ghost constant uuid := '00000000-0000-0000-0000-000000000000';
  _name constant text := 'Ancien membre';
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Non authentifié' USING ERRCODE = '42501';
  END IF;
  IF public.has_role(_uid, 'admin')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin' AND user_id <> _uid) THEN
    RAISE EXCEPTION 'Vous êtes le dernier administrateur : nommez-en un autre avant de partir' USING ERRCODE = '42501';
  END IF;
  UPDATE public.forum_topics SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.forum_replies SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.blog_comments SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.reviews SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.directory_reviews SET author_id = _ghost, author_name = _name WHERE author_id = _uid;
  UPDATE public.testimonials SET author_id = NULL, author_name = _name WHERE author_id = _uid;
  UPDATE public.blog_posts SET author_id = NULL WHERE author_id = _uid;
  UPDATE public.directory_listings SET created_by = NULL WHERE created_by = _uid;
  UPDATE public.directory_listings SET claimed_by = NULL WHERE claimed_by = _uid;
  UPDATE public.directory_listings SET claim_requested_by = NULL WHERE claim_requested_by = _uid;
  UPDATE public.site_settings SET updated_by = NULL WHERE updated_by = _uid;
  UPDATE public.payments SET user_id = _ghost WHERE user_id = _uid;
  UPDATE public.shop_orders SET user_id = _ghost WHERE user_id = _uid;
  UPDATE public.reports SET reporter_id = _ghost WHERE reporter_id = _uid;
  UPDATE public.reports SET handled_by = NULL WHERE handled_by = _uid;
  DELETE FROM public.forum_likes WHERE user_id = _uid;
  DELETE FROM public.forum_follows WHERE user_id = _uid;
  DELETE FROM public.conversations WHERE user_a = _uid OR user_b = _uid;
  DELETE FROM public.messages WHERE sender_id = _uid;
  DELETE FROM public.marketplace_listings WHERE seller_id = _uid;
  DELETE FROM public.crm_interactions WHERE owner_id = _uid;
  DELETE FROM public.crm_actions WHERE owner_id = _uid;
  DELETE FROM public.crm_prospects WHERE owner_id = _uid;
  DELETE FROM public.lms_progress WHERE user_id = _uid;
  DELETE FROM public.lms_enrollments WHERE user_id = _uid;
  DELETE FROM public.member_profiles WHERE user_id = _uid;
  DELETE FROM public.user_roles WHERE user_id = _uid;
  DELETE FROM public.profiles WHERE id = _uid;
  DELETE FROM auth.users WHERE id = _uid;
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
