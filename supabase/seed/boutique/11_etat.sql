SELECT 'tables boutique (4 attendues)' AS controle, count(*)::text AS resultat
FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'shop_%'
UNION ALL
SELECT 'fonctions boutique (5 attendues)', count(*)::text FROM pg_proc
WHERE proname IN ('shop_start_checkout', 'shop_set_customer', 'shop_download', 'guard_shop_order', 'shop_products_touch')
UNION ALL
SELECT 'espace de fichiers privé (1 attendu)', count(*)::text FROM storage.buckets WHERE id = 'shop-files' AND NOT public
UNION ALL
SELECT 'colonne payments.order_id (1 attendue)', count(*)::text FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'order_id'
UNION ALL
SELECT 'module shop (false attendu)', coalesce((SELECT value ->> 'shop' FROM public.site_settings WHERE key = 'modules'), 'absent')
UNION ALL
SELECT 'réglages de livraison', coalesce((SELECT value::text FROM public.site_settings WHERE key = 'shop'), 'absent');
