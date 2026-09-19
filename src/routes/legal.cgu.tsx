import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/cgu")({
  head: () =>
    seo({
      title: "Conditions générales d'utilisation",
      description:
        "Conditions générales d'utilisation des services PMM RDS : accès, compte, obligations, résiliation et droit applicable.",
      path: "/legal/cgu",
      type: "article",
    }),
  component: () => (
    <LegalPage title="Conditions générales d'utilisation" updatedAt="17 septembre 2026">
      <Section title="Objet">
        <p>
          Les présentes conditions régissent l'accès aux services édités par PMM RDS et leur
          utilisation par tout utilisateur.
        </p>
      </Section>
      <Section title="Compte utilisateur">
        <ul>
          <li>Les informations fournies à l'inscription doivent être exactes et à jour.</li>
          <li>L'utilisateur est responsable de la confidentialité de ses identifiants.</li>
          <li>Tout usage frauduleux doit être signalé sans délai via le formulaire de contact.</li>
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
          L'utilisateur peut supprimer son compte à tout moment. PMM RDS peut suspendre un compte en
          cas de manquement aux présentes conditions.
        </p>
      </Section>
      <Section title="Contact et droit applicable">
        <p>
          Toute question peut être adressée via le{" "}
          <Link
            to="/contact"
            title="Nous écrire via le formulaire de contact protégé"
            className="font-medium text-primary-text hover:underline"
          >
            formulaire de contact
          </Link>
          . Les présentes conditions sont soumises au droit français ; à défaut d'accord amiable,
          les tribunaux de Limoges sont compétents.
        </p>
      </Section>
    </LegalPage>
  ),
});
