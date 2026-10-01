SELECT proname AS fonction FROM pg_proc WHERE proname IN ('starter_reset_demo', 'starter_status') ORDER BY proname;
