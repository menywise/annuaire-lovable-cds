import { createFileRoute, Link } from "@tanstack/react-router";
import { ContactChannel, LegalPage, Section, editorName } from "@/components/cds/LegalPage";
import { useBrandSettings } from "@/hooks/useSiteSettings";
import { getSiteConfig } from "@/lib/site-config";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/cgu")({
  head: () =>
    seo({
      title: "Conditions générales d'utilisation",
      description:
        `Conditions générales d'utilisation des services ${editorName(getSiteConfig().brand)} : accès, compte, obligations, résiliation et droit applicable.`,
      path: "/legal/cgu",
      type: "article",
    }),
  component: CguPage,
});

function CguPage() {
  const { settings } = useBrandSettings();
  const editor = editorName(settings);
  return (
    <LegalPage title="Conditions générales d'utilisation" updatedAt="17 septembre 2026">
      <Section title="Objet">
        <p>
          Les présentes conditions régissent l'accès aux services édités par {editor} et leur
          utilisation par tout utilisateur.
        </p>
      </Section>
      <Section title="Compte utilisateur">
        <ul>
          <li>Les informations fournies à l'inscription doivent être exactes et à jour.</li>
          <li>L'utilisateur est responsable de la confidentialité de ses identifiants.</li>
          <li>
            Tout usage frauduleux doit être signalé sans délai via <ContactChannel />.
          </li>
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
          L'utilisateur peut supprimer son compte à tout moment depuis la page{" "}
          <Link
            to="/profil"
            title="Gérer mon compte et le supprimer"
            className="font-medium text-primary-text hover:underline"
          >
            Mon profil
          </Link>
          . Ses données personnelles sont alors effacées ; ses contributions publiques (forum,
          commentaires, avis) restent en ligne sous le nom « Ancien membre ». {editor} peut
          suspendre un compte en cas de manquement aux présentes conditions.
        </p>
      </Section>
      <Section title="Contact et droit applicable">
        <p>
          Toute question peut être adressée via <ContactChannel />. Les présentes conditions sont
          soumises au droit français ; à défaut d'accord amiable, les tribunaux du ressort du siège
          social de l'éditeur sont compétents.
        </p>
      </Section>
    </LegalPage>
  );
}
