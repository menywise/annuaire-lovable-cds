import { createFileRoute } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";

export const Route = createFileRoute("/legal/cgu")({
  head: () => ({
    meta: [
      { title: "Conditions générales d'utilisation — CDS" },
      { name: "description", content: "Gabarit CDS de conditions générales d'utilisation : accès, compte, obligations, résiliation." },
      { property: "og:title", content: "Conditions générales d'utilisation — CDS" },
      { property: "og:description", content: "Gabarit CDS de conditions générales d'utilisation." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <LegalPage title="Conditions générales d'utilisation" updatedAt="17 septembre 2026">
      <Section title="Objet">
        <p>
          Les présentes conditions régissent l'accès au service [nom du service] et son utilisation
          par tout utilisateur.
        </p>
      </Section>
      <Section title="Compte utilisateur">
        <ul>
          <li>Les informations fournies à l'inscription doivent être exactes et à jour.</li>
          <li>L'utilisateur est responsable de la confidentialité de ses identifiants.</li>
          <li>Tout usage frauduleux doit être signalé sans délai à [e-mail].</li>
        </ul>
      </Section>
      <Section title="Obligations de l'utilisateur">
        <p>
          L'utilisateur s'interdit toute utilisation illicite, toute tentative d'atteinte à la
          sécurité du service et toute extraction massive de contenus.
        </p>
      </Section>
      <Section title="Disponibilité">
        <p>
          Le service est fourni « en l'état ». Des interruptions pour maintenance peuvent survenir,
          annoncées lorsque cela est possible.
        </p>
      </Section>
      <Section title="Résiliation">
        <p>
          L'utilisateur peut supprimer son compte à tout moment. L'éditeur peut suspendre un compte
          en cas de manquement aux présentes conditions.
        </p>
      </Section>
      <Section title="Droit applicable">
        <p>
          Les présentes conditions sont soumises au droit français. À défaut d'accord amiable, les
          tribunaux de [ville] sont compétents.
        </p>
      </Section>
    </LegalPage>
  ),
});
