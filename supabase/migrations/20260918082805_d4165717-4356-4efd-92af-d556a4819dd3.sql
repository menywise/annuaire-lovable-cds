CREATE POLICY "Auteur du sujet valide une reponse"
ON public.forum_replies
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.forum_topics t WHERE t.id = forum_replies.topic_id AND t.author_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.forum_topics t WHERE t.id = forum_replies.topic_id AND t.author_id = auth.uid()));