-- Description textuelle du schéma d'une base, une ligne par objet, triée : à passer avec
-- « psql -At -f » sur deux bases pour les comparer par diff (tests/db/blocs_egalite.sh).
-- Couvre : schémas et leurs droits, extensions, types énumérés et domaines, tables et vues (sécurité
-- par ligne, droits), colonnes (type, nullité, défaut, identité, génération, droits), contraintes,
-- index, séquences, fonctions (signature, propriétés, droits, corps sans commentaires ni espaces
-- superflus), déclencheurs, politiques, droits par défaut. Position des colonnes et commentaires
-- (COMMENT ON) ignorés. Schémas système exclus.
WITH schemas AS (
  SELECT oid, nspname FROM pg_namespace
  WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast') AND nspname NOT LIKE 'pg_temp%'
    AND nspname NOT LIKE 'pg_toast_temp%'
),
acl AS (
  SELECT oid, nspname, (SELECT string_agg(a::text, ',' ORDER BY a::text) FROM unnest(nspacl) a) AS droits
  FROM pg_namespace WHERE oid IN (SELECT oid FROM schemas)
),
lignes AS (
  SELECT 'schema|' || nspname || '|' || coalesce(droits, '-') AS l FROM acl
  UNION ALL
  SELECT 'extension|' || extname || '|' || extversion FROM pg_extension
  UNION ALL
  SELECT 'type_enum|' || n.nspname || '.' || t.typname || '|' ||
         (SELECT string_agg(enumlabel, ',' ORDER BY enumsortorder) FROM pg_enum e WHERE e.enumtypid = t.oid)
  FROM pg_type t JOIN schemas n ON n.oid = t.typnamespace WHERE t.typtype = 'e'
  UNION ALL
  SELECT 'domaine|' || n.nspname || '.' || t.typname || '|' || format_type(t.typbasetype, t.typtypmod) ||
         CASE WHEN t.typnotnull THEN ' NOT NULL' ELSE '' END ||
         coalesce(' DEFAULT ' || t.typdefault, '') ||
         coalesce((SELECT ' ' || string_agg(pg_get_constraintdef(c.oid), ' ' ORDER BY pg_get_constraintdef(c.oid))
                   FROM pg_constraint c WHERE c.contypid = t.oid), '')
  FROM pg_type t JOIN schemas n ON n.oid = t.typnamespace WHERE t.typtype = 'd'
  UNION ALL
  SELECT 'relation|' || n.nspname || '.' || c.relname || '|' || c.relkind::text || ' rls=' || c.relrowsecurity ||
         ' force=' || c.relforcerowsecurity || ' droits=' ||
         coalesce((SELECT string_agg(a::text, ',' ORDER BY a::text) FROM unnest(c.relacl) a), '-')
  FROM pg_class c JOIN schemas n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f') AND c.relname NOT LIKE 'pg_%'
  UNION ALL
  SELECT 'vue|' || n.nspname || '.' || c.relname || '|' ||
         regexp_replace(pg_get_viewdef(c.oid, true), '\s+', ' ', 'g')
  FROM pg_class c JOIN schemas n ON n.oid = c.relnamespace WHERE c.relkind IN ('v', 'm')
  UNION ALL
  SELECT 'colonne|' || n.nspname || '.' || c.relname || '.' || a.attname || '|' ||
         format_type(a.atttypid, a.atttypmod) ||
         CASE WHEN a.attnotnull THEN ' NOT NULL' ELSE '' END ||
         coalesce(' DEFAULT ' || pg_get_expr(d.adbin, d.adrelid), '') ||
         CASE a.attidentity WHEN 'a' THEN ' IDENTITY ALWAYS' WHEN 'd' THEN ' IDENTITY BY DEFAULT' ELSE '' END ||
         CASE a.attgenerated WHEN 's' THEN ' GENERATED STORED' ELSE '' END ||
         coalesce(' COLLATE ' || nullif(co.collname, 'default'), '') ||
         ' droits=' || coalesce((SELECT string_agg(x::text, ',' ORDER BY x::text) FROM unnest(a.attacl) x), '-')
  FROM pg_attribute a
  JOIN pg_class c ON c.oid = a.attrelid
  JOIN schemas n ON n.oid = c.relnamespace
  LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
  LEFT JOIN pg_collation co ON co.oid = a.attcollation
  WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f') AND a.attnum > 0 AND NOT a.attisdropped
  UNION ALL
  SELECT 'contrainte|' || n.nspname || '.' || c.relname || '.' || k.conname || '|' || pg_get_constraintdef(k.oid) ||
         CASE WHEN k.condeferrable THEN ' DEFERRABLE' ELSE '' END ||
         CASE WHEN k.condeferrable AND k.condeferred THEN ' INITIALLY DEFERRED' ELSE '' END ||
         CASE WHEN NOT k.convalidated THEN ' NOT VALID' ELSE '' END
  FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid JOIN schemas n ON n.oid = c.relnamespace
  UNION ALL
  SELECT 'index|' || schemaname || '.' || tablename || '.' || indexname || '|' || indexdef
  FROM pg_indexes WHERE schemaname IN (SELECT nspname FROM schemas)
  UNION ALL
  SELECT 'sequence|' || s.schemaname || '.' || s.sequencename || '|' || s.data_type || ' start=' || s.start_value ||
         ' min=' || s.min_value || ' max=' || s.max_value || ' inc=' || s.increment_by || ' cycle=' || s.cycle ||
         ' proprietaire=' || coalesce(
           (SELECT t.relname || '.' || a.attname
            FROM pg_depend dp
            JOIN pg_class t ON t.oid = dp.refobjid
            JOIN pg_attribute a ON a.attrelid = dp.refobjid AND a.attnum = dp.refobjsubid
            WHERE dp.objid = (quote_ident(s.schemaname) || '.' || quote_ident(s.sequencename))::regclass
              AND dp.deptype = 'a' AND dp.classid = 'pg_class'::regclass LIMIT 1), '-')
  FROM pg_sequences s WHERE s.schemaname IN (SELECT nspname FROM schemas)
  UNION ALL
  SELECT 'fonction|' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' ||
         CASE p.prokind WHEN 'f' THEN 'function' WHEN 'p' THEN 'procedure' WHEN 'a' THEN 'aggregate' ELSE 'window' END ||
         ' -> ' || pg_get_function_result(p.oid) ||
         ' lang=' || l.lanname || ' vol=' || p.provolatile::text || ' secdef=' || p.prosecdef || ' strict=' || p.proisstrict ||
         ' leakproof=' || p.proleakproof || ' parallel=' || p.proparallel::text ||
         ' config=' || coalesce(array_to_string(p.proconfig, ','), '-') ||
         ' droits=' || coalesce((SELECT string_agg(a::text, ',' ORDER BY a::text) FROM unnest(p.proacl) a), '-')
  FROM pg_proc p JOIN schemas n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang
  UNION ALL
  -- Corps sans commentaires « -- » ni espaces superflus : les blocs sont « sans commentaires ».
  SELECT 'fonction_corps|' || n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' ||
         btrim(regexp_replace(regexp_replace(p.prosrc, '--[^\n]*', '', 'g'), '\s+', ' ', 'g'))
  FROM pg_proc p JOIN schemas n ON n.oid = p.pronamespace WHERE p.prokind IN ('f', 'p')
  UNION ALL
  SELECT 'declencheur|' || n.nspname || '.' || c.relname || '.' || t.tgname || '|' || pg_get_triggerdef(t.oid, true) ||
         ' enabled=' || t.tgenabled::text
  FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN schemas n ON n.oid = c.relnamespace
  WHERE NOT t.tgisinternal
  UNION ALL
  SELECT 'politique|' || schemaname || '.' || tablename || '.' || policyname || '|' || permissive || ' ' || cmd ||
         ' roles=' || (SELECT string_agg(r, ',' ORDER BY r) FROM unnest(roles) r) ||
         ' using=' || coalesce(regexp_replace(qual, '\s+', ' ', 'g'), '-') ||
         ' check=' || coalesce(regexp_replace(with_check, '\s+', ' ', 'g'), '-')
  FROM pg_policies WHERE schemaname IN (SELECT nspname FROM schemas)
  UNION ALL
  SELECT 'droits_par_defaut|' || coalesce(n.nspname, '*') || '.' || d.defaclobjtype::text || '|' ||
         pg_get_userbyid(d.defaclrole) || ' ' ||
         coalesce((SELECT string_agg(a::text, ',' ORDER BY a::text) FROM unnest(d.defaclacl) a), '-')
  FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
)
SELECT l FROM lignes ORDER BY l;
