import { createFileRoute, Link } from "@tanstack/react-router";
import { ContactChannel, LegalPage, Section, editorName } from "@/components/cds/LegalPage";
import { useBrandSettings } from "@/hooks/useSiteSettings";
import { getSiteConfig } from "@/lib/site-config";
import { isFeatureOn } from "@/config/features";

import { seo } from "@/lib/seo";

export const Route = createFileRoute("/legal/cgv")({
  head: () =>
    seo({
      title: "Conditions générales de vente",
      description: `Conditions générales de vente ${editorName(getSiteConfig().brand)} : offres, prix, paiement, durée, droit de rétractation et réclamations.`,
      path: "/legal/cgv",
      type: "article",
    }),
  component: CgvPage,
});

function CgvPage() {
  const { settings } = useBrandSettings();
  const editor = editorName(settings);
  // Chaque partie ne s'affiche que si le module payant correspondant est allumé.
  const pricing = isFeatureOn("pricing");
  const payments = isFeatureOn("payments");
  const shop = isFeatureOn("shop");
  const sold = [
    pricing ? "les abonnements présentés sur la page Tarifs" : null,
    payments ? "les formations en ligne" : null,
    shop ? "les articles de la boutique" : null,
  ].filter(Boolean);

  if (sold.length === 0) {
    return (
      <LegalPage title="Conditions générales de vente" updatedAt="17 septembre 2026">
        <Section title="Objet et champ d'application">
          <p>
            Le site ne propose actuellement aucune offre payante. Si {editor} en propose une, ces
            conditions seront complétées avant son ouverture.
          </p>
        </Section>
      </LegalPage>
    );
  }

  return (
    <LegalPage title="Conditions générales de vente" updatedAt="17 septembre 2026">
      <Section title="Objet et champ d'application">
        <p>
          Les présentes conditions encadrent les ventes conclues sur le site édité par {editor} :{" "}
          {sold.join(", ")}. Tout achat vaut acceptation pleine et entière de ces conditions.
        </p>
      </Section>
      {pricing ? (
        <>
          <Section title="Offres et prix">
            <ul>
              <li>
                Les offres et leurs tarifs sont présentés sur la page{" "}
                <Link
                  to="/tarifs"
                  title="Consulter les offres et leurs tarifs"
                  className="font-medium text-primary-text hover:underline"
                >
                  Tarifs
                </Link>
                , en euros, toutes taxes comprises.
              </li>
              <li>Le prix applicable est celui affiché au moment de la souscription.</li>
              <li>
                Toute évolution tarifaire est annoncée avant sa prise d'effet et ne s'applique
                jamais rétroactivement.
              </li>
            </ul>
          </Section>
          <Section title="Souscription et paiement">
            <p>
              La souscription s'effectue depuis un compte créé sur le site. Le paiement s'effectue
              par carte bancaire, par période d'abonnement échue ou d'avance selon l'offre choisie.
              Une facture est mise à disposition dans l'espace personnel.
            </p>
          </Section>
          <Section title="Durée, renouvellement et résiliation">
            <ul>
              <li>
                Les abonnements sont conclus pour la période indiquée sur l'offre, renouvelable par
                tacite reconduction.
              </li>
              <li>
                La résiliation est possible à tout moment depuis l'espace personnel et prend effet à
                la fin de la période en cours.
              </li>
              <li>Aucun prélèvement n'intervient après la date de résiliation.</li>
            </ul>
          </Section>
          <Section title="Droit de rétractation">
            <p>
              Le consommateur dispose de quatorze jours pour se rétracter à compter de la
              souscription. Lorsque l'exécution du service commence immédiatement à sa demande
              expresse, le montant dû est calculé au prorata de la période consommée.
            </p>
          </Section>
        </>
      ) : null}
      {payments ? (
        <Section title="Formations en ligne">
          <ul>
            <li>
              Le prix d'une formation est affiché sur sa page, toutes taxes comprises. Le paiement
              se fait par carte bancaire sur la page sécurisée de notre prestataire Stripe ; nous ne
              recevons jamais vos coordonnées bancaires.
            </li>
            <li>L'accès à toutes les leçons s'ouvre dès que Stripe confirme le paiement.</li>
            <li>
              Contenu numérique fourni immédiatement : avant de payer, vous demandez expressément
              l'accès immédiat et renoncez à votre droit de rétractation (article L221-28 13° du
              Code de la consommation). La date de cet accord est conservée avec le paiement.
            </li>
            <li>
              En cas de remboursement, l'accès aux leçons réservées se ferme. Les paiements sont
              conservés dix ans, comme l'exige la loi pour les pièces comptables.
            </li>
          </ul>
        </Section>
      ) : null}
      {shop ? (
        <Section title="Boutique">
          <ul>
            <li>
              Les prix sont affichés en euros, toutes taxes comprises. Les frais de livraison et le
              total sont indiqués dans le panier avant tout paiement. Le paiement se fait par carte
              bancaire sur la page sécurisée de notre prestataire Stripe ; nous ne recevons jamais
              vos coordonnées bancaires.
            </li>
            <li>
              Objets : livrés à l'adresse saisie sur la page de paiement, dans les pays proposés à
              cette étape, au plus tard trente jours après la commande (article L216-1 du Code de la
              consommation). Le numéro de suivi apparaît dans « Mes achats » dès l'expédition.
            </li>
            <li>
              Objets : vous disposez de quatorze jours après réception pour vous rétracter, sans
              avoir à vous justifier (article L221-18). Écrivez-nous, puis renvoyez l'objet dans les
              quatorze jours ; les frais de retour restent à votre charge. Le remboursement
              intervient dans les quatorze jours, et au plus tard à la réception de l'objet.
            </li>
            <li>
              Fichiers numériques (PDF, livres numériques) : téléchargeables depuis « Mes achats »
              dès la confirmation du paiement. Avant de payer, vous demandez expressément leur
              fourniture immédiate et renoncez à votre droit de rétractation (article L221-28 13°).
              La date de cet accord est conservée avec la commande. Chaque achat se télécharge vingt
              fois au plus ; écrivez-nous au-delà.
            </li>
            <li>
              Les objets bénéficient de la garantie légale de conformité (deux ans, articles L217-3
              et suivants) et de la garantie des vices cachés (articles 1641 et suivants du Code
              civil). Un remboursement ferme le téléchargement des fichiers concernés. Les commandes
              sont conservées dix ans, comme l'exige la loi pour les pièces comptables.
            </li>
          </ul>
        </Section>
      ) : null}
      <Section title="Garanties et responsabilité">
        <p>
          {editor} s'engage à mettre en œuvre les moyens nécessaires au bon fonctionnement du
          service. Sa responsabilité ne saurait être engagée pour les dommages indirects ni pour une
          interruption imputable à un tiers ou à un cas de force majeure.
        </p>
      </Section>
      <Section title="Réclamations et médiation">
        <p>
          Toute réclamation est adressée via <ContactChannel />. À défaut de solution amiable, le
          consommateur peut recourir gratuitement à un médiateur de la consommation. Le droit
          français s'applique.
        </p>
      </Section>
    </LegalPage>
  );
}
