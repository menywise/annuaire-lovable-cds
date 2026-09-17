import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Politique cookies — CDS" },
      { name: "description", content: "Gabarit CDS de politique cookies : catégories de traceurs, durées, consentement." },
      { property: "og:title", content: "Politique cookies — CDS" },
      { property: "og:description", content: "Gabarit CDS de politique cookies." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Politique cookies" updatedAt="17 septembre 2026">
      <Section title="Qu'est-ce qu'un cookie ?">
        <p>
          Un cookie est un petit fichier déposé sur votre terminal lors de la consultation du site,
          permettant de reconnaître votre navigateur.
        </p>
      </Section>
      <Section title="Cookies utilisés">
        <ul>
          <li>Essentiels : session, sécurité, préférences — exemptés de consentement.</li>
          <li>Mesure d'audience : statistiques anonymisées — durée [13 mois].</li>
          <li>Marketing : personnalisation et publicité — soumis à consentement.</li>
        </ul>
      </Section>
      <Section title="Gérer votre consentement">
        <p>
          Vous pouvez modifier vos choix à tout moment via le bandeau de consentement ou les
          réglages de votre navigateur.
        </p>
      </Section>
      <Section title="Conséquences du refus">
        <p>
          Le refus des cookies non essentiels n'empêche pas l'accès au service, mais peut réduire
          certaines fonctionnalités de confort.
        </p>
      </Section>
    </LegalPage>
  ),
});
