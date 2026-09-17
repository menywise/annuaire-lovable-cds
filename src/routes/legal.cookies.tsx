import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Politique cookies — PMM RDS" },
      {
        name: "description",
        content:
          "Politique cookies PMM RDS : catégories de traceurs, durées de conservation et gestion du consentement.",
      },
      { property: "og:title", content: "Politique cookies — PMM RDS" },
      { property: "og:description", content: "Traceurs utilisés et gestion du consentement." },
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
          <li>Mesure d'audience : statistiques anonymisées — durée 13 mois.</li>
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
      <Section title="Contact">
        <p>
          Pour toute question relative aux traceurs, utilisez le{" "}
          <Link to="/contact" className="font-medium text-primary hover:underline">
            formulaire de contact
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  ),
});
