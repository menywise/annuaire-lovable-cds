CREATE TABLE IF NOT EXISTS public.watch_detectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'autre',
  target text NOT NULL DEFAULT 'html',
  selector text NOT NULL DEFAULT '',
  pattern text NOT NULL DEFAULT '',
  weight integer NOT NULL DEFAULT 0,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.watch_detectors DROP CONSTRAINT IF EXISTS watch_detectors_check;
ALTER TABLE public.watch_detectors ADD CONSTRAINT watch_detectors_check CHECK (
  code ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND char_length(code) <= 60
  AND char_length(name) BETWEEN 1 AND 80 AND char_length(kind) BETWEEN 1 AND 40
  AND char_length(pattern) <= 500 AND weight BETWEEN 0 AND 100
  AND (
    (target = 'html' AND selector = '' AND pattern <> '')
    OR (target = 'header' AND selector ~ '^[a-z0-9-]{1,80}$')
    OR (target = 'path' AND selector ~ '^/[^ ]{0,199}$')
  )
);
ALTER TABLE public.watch_detectors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.watch_detectors FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.watch_detectors TO authenticated;
GRANT ALL ON public.watch_detectors TO service_role;
DROP POLICY IF EXISTS watch_detectors_admin ON public.watch_detectors;
CREATE POLICY watch_detectors_admin ON public.watch_detectors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.watch_detectors (code, name, kind, target, selector, pattern, weight)
SELECT v.code, v.name, v.kind, v.target, v.selector, v.pattern, v.weight
FROM (VALUES
  ('lovable', 'Lovable', 'plateforme', 'html', '', 'gpteng[.]co|lovable[.]dev|lovable-badge|~flock[.]js|gpt-engineer-file-uploads|lovable-uploads|lovable-tagger|gptengineer', 0),
  ('wordpress', 'WordPress', 'plateforme', 'html', '', 'wp-content/|wp-includes/', 0),
  ('shopify', 'Shopify', 'plateforme', 'html', '', 'cdn[.]shopify[.]com', 0),
  ('wix', 'Wix', 'plateforme', 'html', '', 'static[.]wixstatic[.]com|wix-code', 0),
  ('webflow', 'Webflow', 'plateforme', 'html', '', 'webflow[.]com|data-wf-site', 0),
  ('elementor', 'Elementor', 'plateforme', 'html', '', 'elementor', 0),
  ('react', 'React', 'framework', 'html', '', 'data-reactroot|react-dom|__REACT_DEVTOOLS|_jsx', 0),
  ('vite', 'Vite', 'framework', 'html', '', '/assets/index-[A-Za-z0-9_-]+[.]js|type="module"[^>]*crossorigin', 0),
  ('tanstack-start', 'TanStack Start', 'framework', 'html', '', '__TSR__|tanstack', 0),
  ('nextjs', 'Next.js', 'framework', 'html', '', '__NEXT_DATA__|/_next/', 0),
  ('astro', 'Astro', 'framework', 'html', '', 'astro-island|_astro/', 0),
  ('vue', 'Vue', 'framework', 'html', '', 'data-v-app|__VUE__', 0),
  ('supabase', 'Supabase', 'backend', 'html', '', 'supabase[.]co|supabase-js', 0),
  ('firebase', 'Firebase', 'backend', 'html', '', 'firebaseio[.]com|firebasestorage', 0),
  ('tailwind', 'Tailwind CSS', 'interface', 'html', '', 'tailwind', 0),
  ('shadcn', 'Radix / shadcn', 'interface', 'html', '', 'data-radix|radix-ui|data-slot="', 0),
  ('lucide', 'Lucide', 'interface', 'html', '', 'lucide', 0),
  ('framer-motion', 'Framer Motion', 'interface', 'html', '', 'framer-motion|motion-dom', 0),
  ('gsap', 'GSAP', 'interface', 'html', '', 'gsap', 0),
  ('threejs', 'Three.js', 'média', 'html', '', 'three[.]module|three[.]min[.]js', 0),
  ('maps', 'Mapbox / Leaflet', 'média', 'html', '', 'mapbox|leaflet', 0),
  ('youtube', 'YouTube', 'média', 'html', '', 'youtube[.]com/embed|youtube-nocookie', 0),
  ('stripe', 'Stripe', 'paiement', 'html', '', 'js[.]stripe[.]com', 0),
  ('paddle', 'Paddle', 'paiement', 'html', '', 'paddle[.]com', 0),
  ('google-analytics', 'Google Analytics', 'mesure', 'html', '', 'googletagmanager[.]com|gtag[(]', 0),
  ('plausible', 'Plausible', 'mesure', 'html', '', 'plausible[.]io', 0),
  ('umami', 'Umami', 'mesure', 'html', '', 'umami[.]js|data-website-id', 0),
  ('posthog', 'PostHog', 'mesure', 'html', '', 'posthog', 0),
  ('google-fonts', 'Google Fonts', 'police', 'html', '', 'fonts[.]googleapis[.]com|fonts[.]gstatic[.]com', 0),
  ('booking', 'Cal.com / Calendly', 'réservation', 'html', '', 'cal[.]com|calendly[.]com', 0),
  ('resend', 'Resend', 'e-mail', 'html', '', 'resend[.]com', 0),
  ('lovable-flock', 'Lovable', 'empreinte', 'path', '/~flock.js', 'javascript', 50),
  ('lovable-deployment-id', 'Lovable', 'empreinte', 'header', 'x-deployment-id', '', 10),
  ('lovable-id-preview', 'Lovable', 'empreinte', 'html', '', 'id-preview--[a-f0-9-]+[.]lovable[.]app', 30),
  ('lovable-gpt-engineer-uploads', 'Lovable', 'empreinte', 'html', '', 'gpt-engineer-file-uploads', 20),
  ('lovable-r2-bucket', 'Lovable', 'empreinte', 'html', '', 'pub-bb2e103a32db4e198524a2e9ed8f35b4[.]r2[.]dev', 20),
  ('lovable-gptengineer-js', 'Lovable', 'empreinte', 'html', '', 'gptengineer', 15),
  ('lovable-tagger', 'Lovable', 'empreinte', 'html', '', 'lovable-tagger', 15),
  ('lovable-uploads', 'Lovable', 'empreinte', 'html', '', 'lovable-uploads', 15),
  ('lovable-scope', 'Lovable', 'empreinte', 'html', '', '@lovable/', 10),
  ('lovable-build-tsr', 'Lovable', 'empreinte', 'html', '', '/_build/[^]*__TSR__|__TSR__[^]*/_build/', 10),
  ('lovable-assets-react', 'Lovable', 'empreinte', 'html', '', '/assets/index-[A-Za-z0-9_-]+[.]js[^]*(react-dom|_jsx|data-reactroot)|(react-dom|_jsx|data-reactroot)[^]*/assets/index-[A-Za-z0-9_-]+[.]js', 5),
  ('lovable-badge', 'Lovable', 'empreinte', 'html', '', 'lovable-badge|gpteng[.]co|lovable[.]dev', 5)
) AS v(code, name, kind, target, selector, pattern, weight)
ON CONFLICT (code) DO NOTHING;
