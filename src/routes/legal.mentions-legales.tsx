import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";

export const Route = createFileRoute("/legal/mentions-legales")({
  head: () => ({
    meta: [
      { title: "Mentions légales — CDS" },
      { name: "description", content: "Gabarit CDS de mentions légales : éditeur, hébergeur, propriété intellectuelle." },
      { property: "og:title", content: "Mentions légales — CDS" },
      { property: "og:description", content: "Gabarit CDS de mentions légales." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Mentions légales" updatedAt="17 septembre 2026">
      <Section title="Éditeur du site">
        <p>
          [Raison sociale], [forme juridique] au capital de [montant] €, immatriculée au RCS de
          [ville] sous le numéro [SIREN], siège social : [adresse complète].
        </p>
        <p>Directeur de la publication : [nom]. Contact : [e-mail] — [téléphone].</p>
      </Section>
      <Section title="Hébergement">
        <p>Le site est hébergé par [hébergeur], [adresse], [contact].</p>
      </Section>
      <Section title="Propriété intellectuelle">
        <p>
          L'ensemble des contenus (textes, images, marques, logos, code) est protégé. Toute
          reproduction ou représentation, totale ou partielle, sans autorisation écrite préalable
          est interdite.
        </p>
      </Section>
      <Section title="Responsabilité">
        <p>
          L'éditeur s'efforce d'assurer l'exactitude des informations publiées mais ne saurait être
          tenu responsable des erreurs, omissions ou indisponibilités du service.
        </p>
      </Section>
      <Section title="Liens externes">
        <p>
          Les liens vers des sites tiers sont fournis à titre informatif ; l'éditeur n'exerce aucun
          contrôle sur leur contenu.
        </p>
      </Section>
    </LegalPage>
  ),
});
