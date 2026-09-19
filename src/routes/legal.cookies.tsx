import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/cookies")({
  head: () =>
    seo({
      title: "Politique de cookies",
      description:
        "Politique de gestion des cookies PMM RDS : traceurs utilisés, consentement, durée de conservation et paramétrage.",
      path: "/legal/cookies",
      type: "article",
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
          <Link
            to="/contact"
            title="Nous écrire via le formulaire de contact protégé"
            className="font-medium text-primary-text hover:underline"
          >
            formulaire de contact
          </Link>
          .
        </p>
      </Section>
    </LegalPage>
  ),
});
