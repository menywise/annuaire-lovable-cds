import { createFileRoute } from "@tanstack/react-router";
import { ContactChannel, LegalPage, Section, editorName } from "@/components/cds/LegalPage";
import { getSiteConfig } from "@/lib/site-config";
import { useBrandSettings } from "@/hooks/useSiteSettings";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/mentions-legales")({
  head: () =>
    seo({
      title: "Mentions légales",
      description:
        `Mentions légales de ${editorName(getSiteConfig().brand)} : éditeur, directeur de la publication, hébergeur et propriété intellectuelle.`,
      path: "/legal/mentions-legales",
      type: "article",
    }),
  component: MentionsLegalesPage,
});

function MentionsLegalesPage() {
  const { settings } = useBrandSettings();
  const { legal, host } = settings;
  const editor = editorName(settings);

  return (
    <LegalPage title="Mentions légales" updatedAt="17 septembre 2026">
      <Section title="Éditeur du site">
        <p>
          {[
            editor,
            legal.form && legal.capital ? `${legal.form} au capital de ${legal.capital}` : legal.form,
            legal.rcs ? `immatriculée au ${legal.rcs}` : "",
            [legal.address, legal.country].filter(Boolean).join(", ")
              ? `siège social : ${[legal.address, legal.country].filter(Boolean).join(", ")}`
              : "",
          ]
            .filter(Boolean)
            .join(", ")}
          .
        </p>
        {legal.publisher ? <p>Directeur de la publication : {legal.publisher}.</p> : null}
        <p>
          Contact : <ContactChannel /> (aucune adresse e-mail n'est publiée en clair, afin de limiter
          le spam).
        </p>
      </Section>

      <Section title="Hébergement">
        <p>
          {host.name
            ? [
                `Le site est hébergé par ${host.name}`,
                host.detail ? `immatriculée sous le numéro ${host.detail}` : "",
                host.address ? `siège social : ${host.address}` : "",
                host.phone ? `téléphone : ${host.phone}` : "",
              ]
                .filter(Boolean)
                .join(", ") + "."
            : "Hébergeur : à renseigner dans l'administration (Paramètres du site)."}
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L'ensemble des contenus du site (textes, images, marques, logos, code source) est la
          propriété de {editor} ou de ses partenaires. Toute reproduction ou représentation,
          totale ou partielle, sans autorisation écrite préalable est interdite.
        </p>
      </Section>

      <Section title="Responsabilité">
        <p>
          {editor} s'efforce d'assurer l'exactitude des informations publiées mais ne saurait
          être tenue responsable des erreurs, omissions ou indisponibilités temporaires du service.
        </p>
      </Section>

      <Section title="Liens externes">
        <p>
          Les liens vers des sites tiers sont fournis à titre informatif ; {editor} n'exerce
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
