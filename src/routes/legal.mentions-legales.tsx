import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";
import { useBrandSettings } from "@/hooks/useSiteSettings";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/mentions-legales")({
  head: () =>
    seo({
      title: "Mentions légales",
      description:
        "Mentions légales de PMM RDS, SAS au capital de 1 000 €, siège social à Limoges — site hébergé par OVH.",
      path: "/legal/mentions-legales",
      type: "article",
    }),
  component: MentionsLegalesPage,
});

function MentionsLegalesPage() {
  const { settings } = useBrandSettings();
  const { legal, host } = settings;

  return (
    <LegalPage title="Mentions légales" updatedAt="17 septembre 2026">
      <Section title="Éditeur du site">
        <p>
          {legal.company}, {legal.form} au capital de {legal.capital}, immatriculée au{" "}
          {legal.rcs}, siège social : {legal.address}, {legal.country}.
        </p>
        <p>Directeur de la publication : {legal.publisher}.</p>
        <p>
          Contact :{" "}
          <Link to="/contact" title="Nous écrire via le formulaire de contact protégé" className="font-medium text-primary hover:underline">
            formulaire de contact
          </Link>{" "}
          (aucune adresse e-mail n'est publiée en clair, afin de limiter le spam).
        </p>
      </Section>

      <Section title="Hébergement">
        <p>
          Le site est hébergé par {host.name}, immatriculée sous le numéro {host.detail}, siège
          social : {host.address} — téléphone : {host.phone}.
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L'ensemble des contenus du site (textes, images, marques, logos, code source) est la
          propriété de {legal.company} ou de ses partenaires. Toute reproduction ou représentation,
          totale ou partielle, sans autorisation écrite préalable est interdite.
        </p>
      </Section>

      <Section title="Responsabilité">
        <p>
          {legal.company} s'efforce d'assurer l'exactitude des informations publiées mais ne saurait
          être tenue responsable des erreurs, omissions ou indisponibilités temporaires du service.
        </p>
      </Section>

      <Section title="Liens externes">
        <p>
          Les liens vers des sites tiers sont fournis à titre informatif ; {legal.company} n'exerce
          aucun contrôle sur leur contenu et décline toute responsabilité à leur égard.
        </p>
      </Section>

      <Section title="Litiges">
        <p>
          Les présentes mentions sont soumises au droit français. À défaut d'accord amiable, les
          tribunaux compétents sont ceux du ressort du siège social de l'éditeur.
        </p>
      </Section>
    </LegalPage>
  );
}
