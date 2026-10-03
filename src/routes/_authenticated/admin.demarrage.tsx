import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { toast } from "sonner";
import { AdminShell, useIsAdmin } from "@/components/cds/AdminShell";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
import { MODULES, isModuleOn } from "@/config/modules";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";
import { getSiteConfig } from "@/lib/site-config";
import { brandFallback } from "@/config/brand";
import { starterEnvironment } from "@/lib/starter.functions";

export const Route = createFileRoute("/_authenticated/admin/demarrage")({
  head: () =>
    seo({
      title: "Démarrage",
      description: "Ce qui reste à régler pour lancer ce site, à partir du socle.",
      path: "/admin/demarrage",
      noindex: true,
    }),
  component: StarterPage,
});

type Status = {
  exemples: number;
  demarrage: number;
  administrateurs: number;
  membres: number;
  domaine_envoi: string;
};
type Env = { emailService: boolean; cronSecret: boolean; stripe: string; stripeWebhook: boolean };

type Item = { done: boolean; title: string; detail: string; to?: string; optional?: boolean };

function StarterPage() {
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<Status | null>(null);
  const [env, setEnv] = useState<Env | null>(null);
  const { brand, modules } = getSiteConfig();

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("starter_status");
    if (error)
      toast.error("État du démarrage indisponible.", {
        description: "Le SQL du lot 13 a est-il passé ?",
      });
    setStatus((data ?? null) as Status | null);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
    starterEnvironment()
      .then(setEnv)
      .catch(() => setEnv(null));
  }, [isAdmin, load]);

  async function reset(scope: "exemples" | "demarrage") {
    const { data, error } = await supabase.rpc("starter_reset_demo", { _scope: scope });
    if (error) {
      toast.error("Retrait impossible.", { description: error.message });
      return;
    }
    const total = Object.values((data ?? {}) as Record<string, number>).reduce((a, b) => a + b, 0);
    toast.success(`${total} élément(s) retiré(s).`);
    void load();
  }

  const paying = isModuleOn(modules, "payments") || isModuleOn(modules, "shop");
  const on = MODULES.filter((m) => isModuleOn(modules, m.key));
  const items: Item[] = [
    {
      done: brand.name !== brandFallback.name && brand.shortName !== brandFallback.shortName,
      title: "Nom du site",
      detail: `Nom complet et nom court (actuellement « ${brand.name} »).`,
      to: "/admin",
    },
    {
      done: /^https:\/\//.test(brand.url),
      title: "Adresse publique",
      detail: brand.url
        ? `Adresse : ${brand.url}. Elle sert aux liens canoniques, au plan du site et aux e-mails.`
        : "Indispensable au référencement, au plan du site et aux e-mails.",
      to: "/admin",
    },
    {
      done: Boolean(brand.legal.company && brand.legal.address && brand.legal.publisher),
      title: "Mentions légales",
      detail: "Société, adresse et directeur de la publication.",
      to: "/admin",
    },
    {
      done: Boolean(brand.host.name),
      title: "Hébergeur",
      detail: "Nom et coordonnées de l'hébergeur, affichés dans les mentions légales.",
      to: "/admin",
    },
    {
      done: Boolean(brand.email.senderDomain) && env?.emailService === true,
      title: "Envoi des e-mails",
      detail: brand.email.senderDomain
        ? `Sous-domaine d'envoi : ${brand.email.senderDomain}${env?.emailService ? "." : ". Service d'envoi de Lovable non configuré."}`
        : "Sous-domaine d'envoi à régler, une fois le domaine validé dans Lovable (Cloud → Emails). Sans lui, aucun e-mail de compte ne part.",
      to: "/admin",
    },
    {
      done: env?.cronSecret === true,
      title: "Tâches planifiées",
      detail: "Secret LOVABLE_CRON_SECRET, pour la purge automatique des messages de contact.",
      optional: true,
    },
    ...(paying
      ? [
          {
            done: env !== null && env.stripe !== "absent" && env.stripeWebhook,
            title: "Paiement Stripe",
            detail:
              env && env.stripe !== "absent"
                ? `Clé en mode ${env.stripe === "live" ? "réel" : "test"}${env.stripeWebhook ? ", webhook configuré." : ", secret du webhook manquant."}`
                : "Secrets STRIPE_SECRET_KEY et STRIPE_WEBHOOK_SECRET à ajouter au projet.",
            to: "/admin/paiements",
          },
        ]
      : []),
    {
      done: (status?.administrateurs ?? 0) >= 1,
      title: "Administrateurs",
      detail: `${status?.administrateurs ?? "…"} compte(s) administrateur. Deux au moins, pour ne jamais perdre l'accès.`,
      to: "/admin/utilisateurs",
    },
    {
      done: on.length > 0,
      title: "Modules",
      detail: `${on.length} module(s) allumé(s) : ${on.map((m) => m.label.split(" (")[0]).join(", ")}.`,
      to: "/admin/modules",
      optional: true,
    },
  ];
  const remaining = items.filter((i) => !i.done && !i.optional).length;

  return (
    <AdminShell
      title="Démarrage"
      intro="Ce site est un clone du socle. Cette page dit ce qui reste à régler avant de l'ouvrir au public : identité, mentions légales, e-mails, paiement, comptes, et retrait des contenus de démonstration."
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {remaining === 0
          ? "Tout l'essentiel est réglé."
          : `${remaining} point(s) essentiel(s) à régler.`}{" "}
        Mode d'emploi complet :{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">docs/CLONER.md</code>.
      </p>

      <ul className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((item) => (
          <li key={item.title} className="flex items-start gap-3 p-4 text-sm">
            {item.done ? (
              <CheckCircle2
                className="mt-0.5 size-5 shrink-0 text-success-text"
                aria-label="Réglé"
              />
            ) : (
              <Circle
                className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                aria-label="À régler"
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                {item.title}
                {item.optional && !item.done ? (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">facultatif</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-muted-foreground">{item.detail}</p>
            </div>
            {item.to && !item.done ? (
              <Link
                to={item.to}
                className="inline-flex min-h-11 items-center rounded-md border border-border px-3 text-sm text-foreground hover:bg-accent"
                title={`Régler : ${item.title}`}
              >
                Régler
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      <section className="mt-8 rounded-xl border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground">Contenus de démonstration</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Le socle arrive avec deux jeux de contenus fictifs. Retirez-les avant l'ouverture. Un
          contenu que vous avez déjà modifié n'est jamais retiré.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">Exemples de la recette</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Discussion, formations, annonce, avis, témoignage et commentaire « Exemple — », avec
              le membre fictif qui les signe. Ils servent au robot de recette.
            </p>
            <p className="mt-2 text-sm text-foreground">
              {status ? `${status.exemples} en place` : "…"}
            </p>
            <div className="mt-3">
              <ConfirmButton
                label="Retirer les exemples"
                title="Retirer les exemples de la recette"
                question="Retirer les exemples de la recette ?"
                detail="Les contenus « Exemple — » et le membre fictif sont supprimés. Le robot de recette testera alors moins de pages dynamiques."
                confirmLabel="Retirer"
                onConfirm={() => reset("exemples")}
              />
            </div>
          </div>
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-foreground">Contenus de démarrage</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Les 4 questions de la FAQ, les 3 offres de la page Tarifs et l'article de blog livrés
              avec le socle.
            </p>
            <p className="mt-2 text-sm text-foreground">
              {status ? `${status.demarrage} en place` : "…"}
            </p>
            <div className="mt-3">
              <ConfirmButton
                label="Retirer le démarrage"
                title="Retirer les contenus de démarrage"
                question="Retirer la FAQ, les offres et l'article d'origine ?"
                detail="Seuls les contenus restés identiques à ceux du socle sont supprimés."
                confirmLabel="Retirer"
                onConfirm={() => reset("demarrage")}
              />
            </div>
          </div>
        </div>
      </section>
    </AdminShell>
  );
}
