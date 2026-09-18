ALTER TABLE public.blog_posts ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';

CREATE TABLE public.template_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  area text NOT NULL,
  label text NOT NULL,
  requirement text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'a_verifier',
  severity text NOT NULL DEFAULT 'majeur',
  evidence text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT template_checks_status_check CHECK (status IN ('conforme','a_corriger','a_verifier','non_applicable')),
  CONSTRAINT template_checks_severity_check CHECK (severity IN ('bloquant','majeur','mineur'))
);

GRANT SELECT ON public.template_checks TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.template_checks TO authenticated;
GRANT ALL ON public.template_checks TO service_role;

ALTER TABLE public.template_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Grille de conformite visible par tous"
  ON public.template_checks FOR SELECT
  USING (true);

CREATE POLICY "Admins gerent la grille de conformite"
  ON public.template_checks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER template_checks_updated_at
  BEFORE UPDATE ON public.template_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.template_checks (code, area, label, requirement, status, severity, position) VALUES
('NAV-1','Navigation','En-tete fixe et menu mobile','En-tete collant, hamburger 44 px, menu visiteur different du menu connecte','conforme','majeur',1),
('NAV-2','Navigation','Pied de page 4 colonnes + lettre d''information','Quatre colonnes de liens et inscription a la lettre d''information','conforme','majeur',2),
('NAV-3','Navigation','Tous les liens fonctionnent','Aucun lien mort, attribut title descriptif sur chaque lien','conforme','majeur',3),
('NAV-4','Navigation','Plan du site lisible','Page /plan-du-site listant toutes les pages publiques','conforme','mineur',4),
('CNT-1','Contenus','Blog complet','Recherche, etiquettes, temps de lecture, articles lies, commentaires moderes, partage','a_verifier','majeur',10),
('CNT-2','Contenus','FAQ complete','Recherche, categories, ancres par question, donnees structurees FAQPage','a_verifier','majeur',11),
('CNT-3','Contenus','Temoignages','Page dediee, depot par les membres, validation en coulisses','conforme','majeur',12),
('CNT-4','Contenus','Avis et notations','Notes etoilees, moderation, affichage public','conforme','mineur',13),
('CNT-5','Contenus','Lettre d''information','Inscription, piege anti-robots, export de la liste','conforme','mineur',14),
('COM-1','Communaute','Forum de niveau communaute','Texte enrichi, thematiques, j''aime, suivi, reponse retenue, membres actifs','conforme','majeur',20),
('COM-2','Communaute','Annuaire des membres','Profils publics, visibilite reglable','conforme','mineur',21),
('COM-3','Communaute','Messagerie privee','Conversations entre membres, accord prealable','conforme','mineur',22),
('ACC-1','Comptes','Parcours de connexion complet','Connexion, inscription, mot de passe oublie, verification e-mail, Google','conforme','majeur',30),
('ACC-2','Comptes','Espace connecte','Tableau de bord, mon compte, mon profil','conforme','majeur',31),
('ACC-3','Comptes','Roles et administration','Role administrateur separe, back-office complet','conforme','majeur',32),
('LEG-1','Legal','Pages legales completes','Mentions legales, confidentialite, CGU, CGV, cookies','conforme','majeur',40),
('LEG-2','Legal','Bandeau cookies','Accepter ou refuser, aucun traceur avant accord','conforme','majeur',41),
('LEG-3','Legal','Formulaire de contact protege','Piege anti-robots, aucune adresse en clair','conforme','mineur',42),
('SEO-1','Referencement','Metadonnees sur chaque page','Titre, description, partage social, adresse canonique','a_verifier','majeur',50),
('SEO-2','Referencement','Plan de site et robots','sitemap.xml a jour et robots.txt','a_verifier','majeur',51),
('SEO-3','Referencement','Donnees structurees','Organisation, article, FAQ, fil d''Ariane, avis','a_verifier','mineur',52),
('SEO-4','Referencement','Flux de syndication','Flux RSS des articles','a_corriger','mineur',53),
('DES-1','Design','Police Inter uniquement','Aucune autre police chargee','conforme','majeur',60),
('DES-2','Design','Theme clair uniquement','Aucune trace de mode sombre','conforme','majeur',61),
('DES-3','Design','Source de verite des jetons','CDS_TOKENS.md unique reference','conforme','majeur',62),
('DES-4','Design','Contrastes AA','Tous les textes au-dessus du seuil WCAG AA','conforme','majeur',63),
('DES-5','Design','Cibles tactiles 44 px','Boutons et liens tactiles suffisamment grands','a_verifier','mineur',64),
('MOB-1','Mobile','Installation sur l''ecran d''accueil','Manifeste, icones, couleur de theme','conforme','mineur',70),
('MOB-2','Mobile','Affichage mobile teste','Cartes defilantes, tarifs empiles, menu hamburger','a_verifier','majeur',71),
('PIL-1','Pilotage','Feuille de route','Suivi des lots et de leur etat','conforme','mineur',80),
('PIL-2','Pilotage','Plan directeur','Cap du projet documente','conforme','mineur',81),
('PIL-3','Pilotage','Audits avec memoire','Historique des audits et de leurs constats','conforme','majeur',82),
('OPS-1','Exploitation','Paiement des offres','Encaissement reel branche sur les offres','non_applicable','majeur',90),
('OPS-2','Exploitation','Envoi des e-mails','Messages de contact envoyes par e-mail','non_applicable','majeur',91),
('OPS-3','Exploitation','Dependances sans faille connue','Aucune vulnerabilite haute non corrigee','a_corriger','majeur',92);