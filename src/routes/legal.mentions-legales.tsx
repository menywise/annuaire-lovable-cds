import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";

export const Route = createFileRoute("/legal/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — PMM RDS" },
      {
        name: "description",
        content:
          "Mentions légales de PMM RDS, SAS au capital de 1 000 € — siège social à Limoges, site hébergé par OVH.",
      },
      { property: "og:title", content: "Mentions légales — PMM RDS" },
      { property: "og:description", content: "Éditeur, hébergeur et propriété intellectuelle du site PMM RDS." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Mentions légales" updatedAt="17 septembre 2026">
      <Section title="Éditeur du site">
        <p>
          PMM RDS, société par actions simplifiée (SAS) au capital de 1 000 €, immatriculée au
          Registre du commerce et des sociétés de Limoges, siège social : Rue du Champfour, 87000
          Limoges, France.
        </p>
        <p>Directeur de la publication : Manuel ROHAUT.</p>
        <p>
          Contact :{" "}
          <Link to="/contact" className="font-medium text-primary hover:underline">
            formulaire de contact
          </Link>{" "}
          (aucune adresse e-mail n'est publiée en clair, afin de limiter le spam).
        </p>
      </Section>

      <Section title="Hébergement">
        <p>
          Le site est hébergé par OVH SAS, société par actions simplifiée au capital de 50 000 000 €,
          immatriculée au RCS de Lille Métropole sous le numéro 424 761 419, siège social : 2 rue
          Kellermann, 59100 Roubaix, France — téléphone : 1007.
        </p>
      </Section>

      <Section title="Propriété intellectuelle">
        <p>
          L'ensemble des contenus du site (textes, images, marques, logos, code source) est la
          propriété de PMM RDS ou de ses partenaires. Toute reproduction ou représentation, totale
          ou partielle, sans autorisation écrite préalable est interdite.
        </p>
      </Section>

      <Section title="Responsabilité">
        <p>
          PMM RDS s'efforce d'assurer l'exactitude des informations publiées mais ne saurait être
          tenue responsable des erreurs, omissions ou indisponibilités temporaires du service.
        </p>
      </Section>

      <Section title="Liens externes">
        <p>
          Les liens vers des sites tiers sont fournis à titre informatif ; PMM RDS n'exerce aucun
          contrôle sur leur contenu et décline toute responsabilité à leur égard.
        </p>
      </Section>

      <Section title="Litiges">
        <p>
          Les présentes mentions sont soumises au droit français. À défaut d'accord amiable, les
          tribunaux compétents sont ceux de Limoges.
        </p>
      </Section>
    </LegalPage>
  ),
});
