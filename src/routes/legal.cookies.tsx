import { createFileRoute } from "@tanstack/react-router";
import { ContactChannel, LegalPage, Section, editorName } from "@/components/cds/LegalPage";
import { getSiteConfig } from "@/lib/site-config";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/cookies")({
  head: () =>
    seo({
      title: "Politique de cookies",
      description:
        `Politique de gestion des cookies ${editorName(getSiteConfig().brand)} : traceurs utilisés, consentement, durée de conservation et paramétrage.`,
      path: "/legal/cookies",
      type: "article",
    }),
  component: CookiesPage,
});

function CookiesPage() {
  return (
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
          Pour toute question relative aux traceurs, utilisez <ContactChannel />.
        </p>
      </Section>
    </LegalPage>
  );
}
