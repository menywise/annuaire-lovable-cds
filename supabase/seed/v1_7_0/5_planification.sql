DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE $cron$SELECT cron.schedule('cds_purge_report_contacts', '27 3 * * *',
      'SELECT public.purge_report_contacts()')$cron$;
  ELSE
    RAISE NOTICE 'pg_cron absent : effacement des adresses des signalements à lancer à la main';
  END IF;
END $$;
