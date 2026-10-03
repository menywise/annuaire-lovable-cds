CREATE TABLE IF NOT EXISTS public.premier_administrateur (
  verrou boolean PRIMARY KEY DEFAULT true CHECK (verrou),
  user_id uuid,
  promu_le timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.premier_administrateur ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.premier_administrateur FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.premier_administrateur TO service_role;
INSERT INTO public.premier_administrateur (verrou, user_id, promu_le)
SELECT true, r.user_id, r.created_at FROM public.user_roles r
WHERE r.role = 'admin' ORDER BY r.created_at LIMIT 1
ON CONFLICT (verrou) DO NOTHING;
