import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";

export const Route = createFileRoute("/legal/confidentialite")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité — PMM RDS" },
      {
        name: "description",
        content:
          "Politique de confidentialité PMM RDS : données collectées, finalités, durées de conservation et droits RGPD.",
      },
      { property: "og:title", content: "Politique de confidentialité — PMM RDS" },
      { property: "og:description", content: "Données personnelles, finalités et droits RGPD chez PMM RDS." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Politique de confidentialité" updatedAt="17 septembre 2026">
      <Section title="Responsable du traitement">
        <p>
          PMM RDS (SAS), Rue du Champfour, 87000 Limoges, France. Responsable : Manuel ROHAUT.
          Pour toute demande, utilisez le{" "}
          <Link to="/contact" className="font-medium text-primary hover:underline">
            formulaire de contact
          </Link>
          .
        </p>
      </Section>
      <Section title="Données collectées">
        <ul>
          <li>Données de compte : nom, adresse e-mail, mot de passe chiffré.</li>
          <li>Données d'usage : pages consultées, journaux techniques, adresse IP.</li>
          <li>Données transmises volontairement via le formulaire de contact.</li>
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
          3 ans après la clôture. Les journaux techniques sont conservés 12 mois. Les messages de
          contact sont conservés 3 ans à compter du dernier échange.
        </p>
      </Section>
      <Section title="Destinataires et sous-traitants">
        <p>
          Les données sont hébergées par OVH SAS (France, Union européenne). D'autres prestataires
          (envoi d'e-mails, mesure d'audience) peuvent intervenir, encadrés par des clauses
          contractuelles conformes au RGPD.
        </p>
      </Section>
      <Section title="Vos droits">
        <p>
          Vous disposez des droits d'accès, de rectification, d'effacement, de limitation,
          d'opposition et de portabilité. Exercez-les via le{" "}
          <Link to="/contact" className="font-medium text-primary hover:underline">
            formulaire de contact
          </Link>
          . Vous pouvez également introduire une réclamation auprès de la CNIL.
        </p>
      </Section>
      <Section title="Sécurité">
        <p>
          Chiffrement des échanges (HTTPS), mots de passe hachés, accès restreints et journalisés.
        </p>
      </Section>
    </LegalPage>
  ),
});
