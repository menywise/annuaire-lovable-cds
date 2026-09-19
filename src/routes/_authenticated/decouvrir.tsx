import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/cds/SiteHeader";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/decouvrir")({
  head: () =>
    seo({
      title: "Découvrir tout ce que votre espace permet",
      description:
        "Le parcours de prise en main : ce que vous avez déjà activé, et les occasions encore ouvertes.",
      path: "/decouvrir",
      noindex: true,
    }),
  component: DecouvrirPage,
});

type StepKey =
  | "profil"
  | "annuaire"
  | "sujet"
  | "reponse"
  | "jaime"
  | "message"
  | "avis"
  | "temoignage"
  | "commentaire";

type Step = {
  key: StepKey;
  title: string;
  benefit: string;
  to: string;
  cta: string;
  linkTitle: string;
};

const steps: Step[] = [
  {
    key: "profil",
    title: "Compléter votre profil",
    benefit:
      "Un profil renseigné vous rend crédible en un coup d'œil : les autres savent qui vous êtes avant même de vous lire.",
    to: "/profil",
    cta: "Compléter mon profil",
    linkTitle: "Renseigner mon nom affiché, mon métier et ma présentation",
  },
  {
    key: "annuaire",
    title: "Apparaître dans l'annuaire",
    benefit:
      "Être visible dans l'annuaire, c'est laisser les bonnes personnes vous trouver sans que vous ayez à les chercher.",
    to: "/membres",
    cta: "Voir l'annuaire",
    linkTitle: "Parcourir l'annuaire des membres",
  },
  {
    key: "sujet",
    title: "Lancer une première discussion",
    benefit:
      "Une question posée clairement vous fait gagner des heures de recherche, et reste utile à ceux qui passeront après vous.",
    to: "/forum",
    cta: "Ouvrir le forum",
    linkTitle: "Publier une discussion sur le forum",
  },
  {
    key: "reponse",
    title: "Répondre à quelqu'un",
    benefit:
      "Chaque réponse utile construit votre réputation et vous place dans le classement des membres les plus actifs.",
    to: "/forum",
    cta: "Trouver une discussion",
    linkTitle: "Répondre à une discussion en cours",
  },
  {
    key: "jaime",
    title: "Soutenir un message d'un « j'aime »",
    benefit:
      "Un simple geste qui fait remonter les meilleures réponses et guide les prochains lecteurs.",
    to: "/forum",
    cta: "Parcourir les échanges",
    linkTitle: "Aimer une discussion ou une réponse",
  },
  {
    key: "message",
    title: "Échanger en privé",
    benefit:
      "Pour les sujets qui ne se règlent pas en public : un message direct, sans donner votre adresse e-mail.",
    to: "/messagerie",
    cta: "Ouvrir la messagerie",
    linkTitle: "Ouvrir ma messagerie privée",
  },
  {
    key: "commentaire",
    title: "Réagir à un article",
    benefit:
      "Vos commentaires prolongent les articles et attirent des lecteurs qui vous découvriront à cette occasion.",
    to: "/blog",
    cta: "Lire le blog",
    linkTitle: "Lire les articles et y réagir",
  },
  {
    key: "avis",
    title: "Déposer un avis",
    benefit:
      "Votre retour aide les prochains à décider, et vous donne un droit de regard sur ce qui est construit.",
    to: "/avis",
    cta: "Donner mon avis",
    linkTitle: "Déposer un avis noté",
  },
  {
    key: "temoignage",
    title: "Partager votre expérience",
    benefit:
      "Un témoignage publié met en avant votre activité auprès de tous les visiteurs du site.",
    to: "/temoignages",
    cta: "Écrire mon témoignage",
    linkTitle: "Proposer un témoignage",
  },
];

function DecouvrirPage() {
  const { user } = useAuth();
  const [done, setDone] = useState<Record<StepKey, boolean> | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const uid = user.id;
      const count = { count: "exact" as const, head: true };
      const [profil, topics, replies, likes, messages, reviews, testimonials, comments] =
        await Promise.all([
          supabase
            .from("member_profiles")
            .select("user_id, display_name, bio, listed", { count: "exact" })
            .eq("user_id", uid),
          supabase.from("forum_topics").select("id", count).eq("author_id", uid),
          supabase.from("forum_replies").select("id", count).eq("author_id", uid),
          supabase.from("forum_likes").select("id", count).eq("user_id", uid),
          supabase.from("messages").select("id", count).eq("sender_id", uid),
          supabase.from("reviews").select("id", count).eq("author_id", uid),
          supabase.from("testimonials").select("id", count).eq("author_id", uid),
          supabase.from("blog_comments").select("id", count).eq("author_id", uid),
        ]);
      if (!active) return;
      const row = profil.data?.[0];
      setDone({
        profil: Boolean(row && row.display_name && row.bio),
        annuaire: Boolean(row?.listed),
        sujet: (topics.count ?? 0) > 0,
        reponse: (replies.count ?? 0) > 0,
        jaime: (likes.count ?? 0) > 0,
        message: (messages.count ?? 0) > 0,
        avis: (reviews.count ?? 0) > 0,
        temoignage: (testimonials.count ?? 0) > 0,
        commentaire: (comments.count ?? 0) > 0,
      });
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const completed = done ? steps.filter((step) => done[step.key]).length : 0;
  const percent = Math.round((completed / steps.length) * 100);
  const remaining = steps.filter((step) => !done || !done[step.key]);

  return (
    <PageShell>
      <div className="mx-auto max-w-[900px]">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
          <Link
            to="/tableau-de-bord"
            title="Revenir au tableau de bord"
            className="hover:text-foreground"
          >
            Tableau de bord
          </Link>
          <span aria-hidden="true"> / </span>
          <span className="text-foreground">Découvrir</span>
        </nav>

        <h1 className="mt-2 text-3xl font-bold text-foreground">Tirez tout de votre espace</h1>
        <p className="mt-2 max-w-[70ch] text-sm text-muted-foreground">
          Voici, en clair, tout ce que votre compte vous permet déjà de faire. Ce qui est coché est
          derrière vous. Le reste, ce sont des occasions encore ouvertes — à prendre quand cela vous
          arrange.
        </p>

        <section className="mt-8 rounded-xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-semibold text-foreground">Votre prise en main</p>
            <span className="ml-auto text-sm font-semibold text-primary-text">
              {completed}/{steps.length}
            </span>
          </div>
          <div
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progression de la prise en main"
          >
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {done === null
              ? "Nous regardons où vous en êtes…"
              : remaining.length === 0
                ? "Vous avez fait le tour complet. Rien ne vous échappe."
                : `${remaining.length} occasion${remaining.length > 1 ? "s" : ""} que vous n'avez pas encore saisie${remaining.length > 1 ? "s" : ""}.`}
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-semibold text-foreground">Les fonctionnalités actives</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {steps.map((step) => {
              const isDone = Boolean(done?.[step.key]);
              return (
                <li
                  key={step.key}
                  className="flex flex-col rounded-xl border border-border bg-card p-5"
                >
                  <div className="flex items-start gap-2">
                    <span
                      aria-hidden="true"
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        isDone
                          ? "bg-success-text text-white"
                          : "border border-border text-muted-foreground"
                      }`}
                    >
                      {isDone ? "✓" : ""}
                    </span>
                    <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
                    <span className="ml-auto text-xs text-muted-foreground">
                      {isDone ? "Fait" : "À découvrir"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{step.benefit}</p>
                  <Link
                    to={step.to}
                    title={step.linkTitle}
                    className="mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-primary-text hover:underline"
                  >
                    {isDone ? "Y retourner" : step.cta}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </PageShell>
  );
}
