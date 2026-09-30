INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-files', 'shop-files', false, 52428800,
        ARRAY['application/pdf', 'application/epub+zip', 'application/zip'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS shop_files_admin_read ON storage.objects;
CREATE POLICY shop_files_admin_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shop-files' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shop_files_admin_insert ON storage.objects;
CREATE POLICY shop_files_admin_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-files' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shop_files_admin_update ON storage.objects;
CREATE POLICY shop_files_admin_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'shop-files' AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS shop_files_admin_delete ON storage.objects;
CREATE POLICY shop_files_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-files' AND public.has_role(auth.uid(), 'admin'));
