import { createFileRoute, Link } from "@tanstack/react-router";
import { LegalPage, Section } from "@/components/cds/LegalPage";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/cgv")({
  head: () =>
    seo({
      title: "Conditions générales de vente",
      description:
        "Conditions générales de vente PMM RDS : offres, prix, paiement, durée, droit de rétractation et réclamations pour les indépendants, artisans et solopreneurs abonnés.",
      path: "/legal/cgv",
      type: "article",
    }),
  component: () => (
    <LegalPage title="Conditions générales de vente" updatedAt="17 septembre 2026">
      <Section title="Objet et champ d'application">
        <p>
          Les présentes conditions encadrent la souscription aux offres payantes éditées par PMM
          RDS. Toute souscription vaut acceptation pleine et entière de ces conditions.
        </p>
      </Section>
      <Section title="Offres et prix">
        <ul>
          <li>Les offres et leurs tarifs sont présentés sur la page Tarifs, en euros, toutes taxes comprises.</li>
          <li>Le prix applicable est celui affiché au moment de la souscription.</li>
          <li>Toute évolution tarifaire est annoncée avant sa prise d'effet et ne s'applique jamais rétroactivement.</li>
        </ul>
      </Section>
      <Section title="Souscription et paiement">
        <p>
          La souscription s'effectue depuis un compte créé sur le site. Le paiement s'effectue par
          carte bancaire, par période d'abonnement échue ou d'avance selon l'offre choisie. Une
          facture est mise à disposition dans l'espace personnel.
        </p>
      </Section>
      <Section title="Durée, renouvellement et résiliation">
        <ul>
          <li>Les abonnements sont conclus pour la période indiquée sur l'offre, renouvelable par tacite reconduction.</li>
          <li>La résiliation est possible à tout moment depuis l'espace personnel et prend effet à la fin de la période en cours.</li>
          <li>Aucun prélèvement n'intervient après la date de résiliation.</li>
        </ul>
      </Section>
      <Section title="Droit de rétractation">
        <p>
          Le consommateur dispose de quatorze jours pour se rétracter à compter de la souscription.
          Lorsque l'exécution du service commence immédiatement à sa demande expresse, le montant dû
          est calculé au prorata de la période consommée.
        </p>
      </Section>
      <Section title="Garanties et responsabilité">
        <p>
          PMM RDS s'engage à mettre en œuvre les moyens nécessaires au bon fonctionnement du
          service. Sa responsabilité ne saurait être engagée pour les dommages indirects ni pour une
          interruption imputable à un tiers ou à un cas de force majeure.
        </p>
      </Section>
      <Section title="Réclamations et médiation">
        <p>
          Toute réclamation est adressée via le{" "}
          <Link to="/contact" title="Adresser une réclamation via le formulaire de contact" className="font-medium text-primary-text hover:underline">
            formulaire de contact
          </Link>
          . À défaut de solution amiable, le consommateur peut recourir gratuitement à un médiateur
          de la consommation. Le droit français s'applique.
        </p>
      </Section>
    </LegalPage>
  ),
});
