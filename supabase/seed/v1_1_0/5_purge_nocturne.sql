DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE $cron$SELECT cron.schedule('cds_purge_contact_messages', '17 3 * * *',
      'SELECT public.purge_contact_messages()')$cron$;
  ELSE
    RAISE NOTICE 'pg_cron absent : purge à lancer depuis la boîte de réception';
  END IF;
END $$;
