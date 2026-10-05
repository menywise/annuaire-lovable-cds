import { createFileRoute } from "@tanstack/react-router";
import { ContactChannel, LegalPage, Section, editorName } from "@/components/cds/LegalPage";
import { openCookieBanner } from "@/components/cds/CookieBanner";
import { Button } from "@/components/ui/button";
import { isFeatureOn } from "@/config/features";
import { getSiteConfig } from "@/lib/site-config";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/cookies")({
  head: () =>
    seo({
      title: "Politique de cookies",
      description: `Politique de gestion des cookies ${editorName(getSiteConfig().brand)} : traceurs utilisés, consentement et paramétrage.`,
      path: "/legal/cookies",
      type: "article",
    }),
  component: CookiesPage,
});

/**
 * Le socle ne dépose aucun traceur de mesure d'audience ni de publicité : la page ne décrit
 * que les traceurs essentiels réellement utilisés. Si un projet en ajoute, il complète
 * cette page et s'appuie sur le bandeau de consentement (`CookieBanner`).
 */
function CookiesPage() {
  return (
    <LegalPage title="Politique cookies" updatedAt="17 septembre 2026">
      <Section title="Qu'est-ce qu'un cookie ?">
        <p>
          Un cookie est un petit fichier déposé sur votre terminal lors de la consultation du site,
          permettant de reconnaître votre navigateur. Les mêmes règles s'appliquent au stockage
          local du navigateur, que le site utilise aussi.
        </p>
      </Section>
      <Section title="Traceurs utilisés">
        <p>
          Le site n'utilise que des traceurs essentiels à son fonctionnement, exemptés de
          consentement :
        </p>
        <ul>
          <li>maintien de votre connexion à votre espace personnel ;</li>
          {isFeatureOn("shop") ? <li>contenu de votre panier de la boutique ;</li> : null}
          <li>mémorisation de votre choix sur le bandeau de consentement.</li>
        </ul>
        <p>
          Aucun traceur de mesure d'audience ni de publicité n'est déposé. Si le site venait à en
          utiliser, ils ne seraient déposés qu'après votre accord et cette page serait mise à jour.
        </p>
      </Section>
      <Section title="Gérer votre consentement">
        <p>
          Vous pouvez modifier vos choix à tout moment avec le lien « Gérer les cookies » en pied de
          page, ou avec le bouton ci-dessous. Vous pouvez aussi supprimer les traceurs depuis les
          réglages de votre navigateur ; vous serez alors déconnecté.
        </p>
        <Button
          type="button"
          variant="outline"
          title="Rouvrir le bandeau pour modifier vos choix de cookies"
          onClick={openCookieBanner}
        >
          Gérer les cookies
        </Button>
      </Section>
      <Section title="Contact">
        <p>
          Pour toute question relative aux traceurs, utilisez <ContactChannel />.
        </p>
      </Section>
    </LegalPage>
  );
}
