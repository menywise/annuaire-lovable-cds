-- ============ BRIQUE 11 — GÉOGRAPHIE ============
CREATE TABLE public.geo_departements (
  code text PRIMARY KEY,
  nom text NOT NULL,
  region text NOT NULL DEFAULT '',
  slug text NOT NULL UNIQUE,
  population integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.geo_departements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_departements TO authenticated;
GRANT ALL ON public.geo_departements TO service_role;
ALTER TABLE public.geo_departements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geo_dep_read_anon" ON public.geo_departements FOR SELECT TO anon USING (true);
CREATE POLICY "geo_dep_read_auth" ON public.geo_departements FOR SELECT TO authenticated USING (true);
CREATE POLICY "geo_dep_admin" ON public.geo_departements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.geo_communes (
  code_insee text PRIMARY KEY,
  nom text NOT NULL,
  slug text NOT NULL,
  departement text NOT NULL REFERENCES public.geo_departements(code) ON DELETE CASCADE,
  code_postal text NOT NULL DEFAULT '',
  latitude numeric,
  longitude numeric,
  population integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX geo_communes_departement_idx ON public.geo_communes (departement);
CREATE INDEX geo_communes_slug_idx ON public.geo_communes (slug);
GRANT SELECT ON public.geo_communes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geo_communes TO authenticated;
GRANT ALL ON public.geo_communes TO service_role;
ALTER TABLE public.geo_communes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "geo_com_read_anon" ON public.geo_communes FOR SELECT TO anon USING (true);
CREATE POLICY "geo_com_read_auth" ON public.geo_communes FOR SELECT TO authenticated USING (true);
CREATE POLICY "geo_com_admin" ON public.geo_communes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ BRIQUE 12 — ANNUAIRE MÉTIER ============
CREATE TABLE public.directory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.directory_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_categories TO authenticated;
GRANT ALL ON public.directory_categories TO service_role;
ALTER TABLE public.directory_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dir_cat_read_anon" ON public.directory_categories FOR SELECT TO anon USING (true);
CREATE POLICY "dir_cat_read_auth" ON public.directory_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "dir_cat_admin" ON public.directory_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER directory_categories_updated_at BEFORE UPDATE ON public.directory_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.directory_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.directory_categories(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  departement text REFERENCES public.geo_departements(code) ON DELETE SET NULL,
  latitude numeric,
  longitude numeric,
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  website text NOT NULL DEFAULT '',
  logo_url text,
  cover_url text,
  photos text[] NOT NULL DEFAULT '{}',
  hours jsonb NOT NULL DEFAULT '{}'::jsonb,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','premium')),
  featured boolean NOT NULL DEFAULT false,
  verified boolean NOT NULL DEFAULT false,
  claimed_by uuid,
  claimed_at timestamptz,
  claim_requested_by uuid,
  claim_requested_at timestamptz,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX directory_listings_status_idx ON public.directory_listings (status);
CREATE INDEX directory_listings_departement_idx ON public.directory_listings (departement);
CREATE INDEX directory_listings_category_idx ON public.directory_listings (category_id);
GRANT SELECT ON public.directory_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_listings TO authenticated;
GRANT ALL ON public.directory_listings TO service_role;
ALTER TABLE public.directory_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dir_list_read_anon" ON public.directory_listings FOR SELECT TO anon
  USING (status = 'published');
CREATE POLICY "dir_list_read_auth" ON public.directory_listings FOR SELECT TO authenticated
  USING (status = 'published' OR claimed_by = auth.uid() OR created_by = auth.uid()
    OR claim_requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dir_list_insert_auth" ON public.directory_listings FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dir_list_update_owner" ON public.directory_listings FOR UPDATE TO authenticated
  USING (claimed_by = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (claimed_by = auth.uid() OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dir_list_delete_admin" ON public.directory_listings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER directory_listings_updated_at BEFORE UPDATE ON public.directory_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.directory_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.directory_listings(id) ON DELETE CASCADE,
  author_id uuid NOT NULL,
  author_name text NOT NULL DEFAULT '',
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content text NOT NULL DEFAULT '',
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX directory_reviews_listing_idx ON public.directory_reviews (listing_id);
GRANT SELECT ON public.directory_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.directory_reviews TO authenticated;
GRANT ALL ON public.directory_reviews TO service_role;
ALTER TABLE public.directory_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dir_rev_read_anon" ON public.directory_reviews FOR SELECT TO anon USING (approved);
CREATE POLICY "dir_rev_read_auth" ON public.directory_reviews FOR SELECT TO authenticated
  USING (approved OR author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dir_rev_insert_auth" ON public.directory_reviews FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "dir_rev_update" ON public.directory_reviews FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "dir_rev_delete" ON public.directory_reviews FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ BRIQUE 13 — SUIVI DE PROSPECTS ============
CREATE TABLE public.crm_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  name text NOT NULL,
  company text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  sector text NOT NULL DEFAULT '',
  stage text NOT NULL DEFAULT 'inconnu'
    CHECK (stage IN ('inconnu','curieux','abonne','ami','client','ambassadeur')),
  notes text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_prospects_owner_idx ON public.crm_prospects (owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_prospects TO authenticated;
GRANT ALL ON public.crm_prospects TO service_role;
ALTER TABLE public.crm_prospects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_prospects_own" ON public.crm_prospects FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER crm_prospects_updated_at BEFORE UPDATE ON public.crm_prospects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.crm_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.crm_prospects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'note'
    CHECK (type IN ('note','appel','email','message','rencontre','autre')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_interactions_prospect_idx ON public.crm_interactions (prospect_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_interactions TO authenticated;
GRANT ALL ON public.crm_interactions TO service_role;
ALTER TABLE public.crm_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_interactions_own" ON public.crm_interactions FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.crm_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid REFERENCES public.crm_prospects(id) ON DELETE SET NULL,
  owner_id uuid NOT NULL,
  title text NOT NULL,
  due_date date,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_actions_owner_idx ON public.crm_actions (owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_actions TO authenticated;
GRANT ALL ON public.crm_actions TO service_role;
ALTER TABLE public.crm_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_actions_own" ON public.crm_actions FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ BRIQUE 15 — FORMATIONS ============
CREATE TABLE public.lms_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  excerpt text NOT NULL DEFAULT '',
  cover_url text,
  level text NOT NULL DEFAULT 'debutant' CHECK (level IN ('debutant','intermediaire','avance')),
  duration_minutes integer NOT NULL DEFAULT 0,
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  published boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.lms_courses TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_courses TO authenticated;
GRANT ALL ON public.lms_courses TO service_role;
ALTER TABLE public.lms_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_courses_read_anon" ON public.lms_courses FOR SELECT TO anon USING (published);
CREATE POLICY "lms_courses_read_auth" ON public.lms_courses FOR SELECT TO authenticated
  USING (published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "lms_courses_admin" ON public.lms_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER lms_courses_updated_at BEFORE UPDATE ON public.lms_courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.lms_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lms_modules_course_idx ON public.lms_modules (course_id);
GRANT SELECT ON public.lms_modules TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_modules TO authenticated;
GRANT ALL ON public.lms_modules TO service_role;
ALTER TABLE public.lms_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_modules_read_anon" ON public.lms_modules FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.id = course_id AND c.published));
CREATE POLICY "lms_modules_read_auth" ON public.lms_modules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lms_courses c WHERE c.id = course_id AND c.published)
    OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "lms_modules_admin" ON public.lms_modules FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lms_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.lms_modules(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  content_type text NOT NULL DEFAULT 'texte' CHECK (content_type IN ('texte','video','quiz')),
  video_url text,
  duration_minutes integer NOT NULL DEFAULT 0,
  position integer NOT NULL DEFAULT 0,
  free_preview boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lms_lessons_module_idx ON public.lms_lessons (module_id);
GRANT SELECT ON public.lms_lessons TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_lessons TO authenticated;
GRANT ALL ON public.lms_lessons TO service_role;
ALTER TABLE public.lms_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_lessons_read_anon" ON public.lms_lessons FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.lms_modules m JOIN public.lms_courses c ON c.id = m.course_id
    WHERE m.id = module_id AND c.published));
CREATE POLICY "lms_lessons_read_auth" ON public.lms_lessons FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.lms_modules m JOIN public.lms_courses c ON c.id = m.course_id
    WHERE m.id = module_id AND c.published) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "lms_lessons_admin" ON public.lms_lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lms_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  course_id uuid NOT NULL REFERENCES public.lms_courses(id) ON DELETE CASCADE,
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_enrollments TO authenticated;
GRANT ALL ON public.lms_enrollments TO service_role;
ALTER TABLE public.lms_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_enrollments_own" ON public.lms_enrollments FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.lms_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  lesson_id uuid NOT NULL REFERENCES public.lms_lessons(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lms_progress TO authenticated;
GRANT ALL ON public.lms_progress TO service_role;
ALTER TABLE public.lms_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "lms_progress_own" ON public.lms_progress FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============ BRIQUE 16 — PETITES ANNONCES ============
CREATE TABLE public.marketplace_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.marketplace_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_categories TO authenticated;
GRANT ALL ON public.marketplace_categories TO service_role;
ALTER TABLE public.marketplace_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_cat_read_anon" ON public.marketplace_categories FOR SELECT TO anon USING (true);
CREATE POLICY "mkt_cat_read_auth" ON public.marketplace_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "mkt_cat_admin" ON public.marketplace_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  seller_name text NOT NULL DEFAULT '',
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.marketplace_categories(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  price_cents integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'EUR',
  negotiable boolean NOT NULL DEFAULT false,
  city text NOT NULL DEFAULT '',
  departement text REFERENCES public.geo_departements(code) ON DELETE SET NULL,
  photos text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','sold','archived')),
  approved boolean NOT NULL DEFAULT false,
  views integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX marketplace_listings_status_idx ON public.marketplace_listings (status, approved);
CREATE INDEX marketplace_listings_seller_idx ON public.marketplace_listings (seller_id);
GRANT SELECT ON public.marketplace_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_listings TO authenticated;
GRANT ALL ON public.marketplace_listings TO service_role;
ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mkt_list_read_anon" ON public.marketplace_listings FOR SELECT TO anon
  USING (status = 'active' AND approved);
CREATE POLICY "mkt_list_read_auth" ON public.marketplace_listings FOR SELECT TO authenticated
  USING ((status = 'active' AND approved) OR seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mkt_list_insert" ON public.marketplace_listings FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());
CREATE POLICY "mkt_list_update" ON public.marketplace_listings FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "mkt_list_delete" ON public.marketplace_listings FOR DELETE TO authenticated
  USING (seller_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER marketplace_listings_updated_at BEFORE UPDATE ON public.marketplace_listings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BRIQUE 17 — RÉGIE PUBLICITAIRE ============
CREATE TABLE public.ad_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  location text NOT NULL DEFAULT 'sidebar',
  format text NOT NULL DEFAULT 'banner',
  width integer,
  height integer,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ad_placements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_placements TO authenticated;
GRANT ALL ON public.ad_placements TO service_role;
ALTER TABLE public.ad_placements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_pl_read_anon" ON public.ad_placements FOR SELECT TO anon USING (active);
CREATE POLICY "ad_pl_read_auth" ON public.ad_placements FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ad_pl_admin" ON public.ad_placements FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_id uuid NOT NULL REFERENCES public.ad_placements(id) ON DELETE CASCADE,
  advertiser text NOT NULL,
  contact_email text NOT NULL DEFAULT '',
  title text NOT NULL,
  image_url text,
  link_url text NOT NULL,
  alt_text text NOT NULL DEFAULT '',
  starts_at timestamptz,
  ends_at timestamptz,
  type text NOT NULL DEFAULT 'direct'
    CHECK (type IN ('direct','affiliation','cross-promo','sponsorise')),
  affiliate_code text NOT NULL DEFAULT '',
  commission_pct numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ad_campaigns_placement_idx ON public.ad_campaigns (placement_id);
GRANT SELECT ON public.ad_campaigns TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ad_campaigns TO authenticated;
GRANT ALL ON public.ad_campaigns TO service_role;
ALTER TABLE public.ad_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_camp_read_anon" ON public.ad_campaigns FOR SELECT TO anon USING (active);
CREATE POLICY "ad_camp_read_auth" ON public.ad_campaigns FOR SELECT TO authenticated
  USING (active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "ad_camp_admin" ON public.ad_campaigns FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER ad_campaigns_updated_at BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.ad_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.ad_campaigns(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('impression','click')),
  page_path text NOT NULL DEFAULT '',
  user_agent text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ad_events_campaign_idx ON public.ad_events (campaign_id, event_type);
GRANT INSERT ON public.ad_events TO anon;
GRANT SELECT, INSERT ON public.ad_events TO authenticated;
GRANT ALL ON public.ad_events TO service_role;
ALTER TABLE public.ad_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ad_ev_insert_anon" ON public.ad_events FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "ad_ev_insert_auth" ON public.ad_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ad_ev_read_admin" ON public.ad_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));