import { createFileRoute, Link } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { NewsletterForm } from "@/components/cds/NewsletterForm";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { listFaq } from "@/lib/content.functions";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/faq")({
  loader: () => listFaq(),
  head: ({ loaderData }) => {
    const base = seo({
      title: "Questions fréquentes",
      description:
        "Vos questions avant de démarrer : délais, administration sans code, sécurité des données, référencement. Des réponses directes, sans jargon.",
      path: "/faq",
      type: "website",
    });
    const items = loaderData ?? [];
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: items.map((item) => ({
              "@type": "Question",
              name: item.question,
              acceptedAnswer: { "@type": "Answer", text: item.answer },
            })),
          }),
        },
      ],
    };
  },
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">
        Les questions n'ont pas pu être chargées. Rechargez la page dans un instant.
      </p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Cette page n'existe pas.</p>
    </PageShell>
  ),
  component: FaqPage,
});

function FaqPage() {
  const items = Route.useLoaderData();
  const categories = [...new Set(items.map((i) => i.category))];

  return (
    <PageShell>
      <div className="mx-auto max-w-[760px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">Questions fréquentes</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Ce que vous vous demandez avant de vous lancer
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vous avez sans doute déjà une idée précise de ce que vous voulez construire. Voici les
          réponses aux questions qui reviennent le plus, pour que rien ne vous retienne.
        </p>

        {categories.map((category) => (
          <section key={category} className="mt-8">
            <h2 className="text-base font-semibold text-foreground">{category}</h2>
            <Accordion type="single" collapsible className="mt-2">
              {items
                .filter((i) => i.category === category)
                .map((item) => (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
            </Accordion>
          </section>
        ))}

        <p className="mt-8 text-sm text-muted-foreground">
          Votre question n'y figure pas ?{" "}
          <Link to="/contact" title="Poser votre question via le formulaire de contact" className="text-primary-text hover:underline">
            Posez-la ici
          </Link>
          , vous aurez une réponse sous 48 heures ouvrées.
        </p>

        <div className="mt-10">
          <NewsletterForm source="faq" />
        </div>
      </div>
    </PageShell>
  );
}
