ALTER TABLE public.template_checks ADD COLUMN IF NOT EXISTS modules text[] NOT NULL DEFAULT '{}';
