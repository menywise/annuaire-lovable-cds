import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";

export const Route = createFileRoute("/legal/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — CDS" },
      { name: "description", content: "Gabarit CDS de politique de confidentialité conforme RGPD : données, finalités, droits." },
      { property: "og:title", content: "Politique de confidentialité — CDS" },
      { property: "og:description", content: "Gabarit CDS de politique de confidentialité (RGPD)." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Politique de confidentialité" updatedAt="17 septembre 2026">
      <Section title="Responsable du traitement">
        <p>[Raison sociale], [adresse]. Contact : [e-mail de contact / DPO].</p>
      </Section>
      <Section title="Données collectées">
        <ul>
          <li>Données de compte : nom, adresse e-mail, mot de passe chiffré.</li>
          <li>Données d'usage : pages consultées, journaux techniques, adresse IP.</li>
          <li>Données transmises volontairement via les formulaires de contact.</li>
        </ul>
      </Section>
      <Section title="Finalités et bases légales">
        <ul>
          <li>Fourniture du service et gestion du compte — exécution du contrat.</li>
          <li>Sécurité, prévention des abus — intérêt légitime.</li>
          <li>Communications marketing — consentement.</li>
        </ul>
      </Section>
      <Section title="Durée de conservation">
        <p>
          Les données de compte sont conservées pendant la durée d'utilisation du service, puis
          [durée] après la clôture. Les journaux techniques sont conservés [durée].
        </p>
      </Section>
      <Section title="Destinataires et sous-traitants">
        <p>
          Les données peuvent être traitées par nos prestataires d'hébergement, d'envoi d'e-mails et
          de mesure d'audience, situés [zone géographique], encadrés par des clauses contractuelles.
        </p>
      </Section>
      <Section title="Vos droits">
        <p>
          Vous disposez des droits d'accès, de rectification, d'effacement, de limitation,
          d'opposition et de portabilité. Écrivez à [e-mail]. Vous pouvez introduire une réclamation
          auprès de la CNIL.
        </p>
      </Section>
      <Section title="Sécurité">
        <p>
          Chiffrement des échanges, mots de passe hachés, accès restreints et journalisés.
        </p>
      </Section>
    </LegalPage>
  ),
});
