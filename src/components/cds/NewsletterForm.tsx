import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { isFeatureOn } from "@/config/features";

/**
 * Bloc d'inscription à la lettre d'information.
 * Protégé par piège à robots (champ invisible + délai minimal).
 */
/** Formulaire d'inscription : rien n'est affiché quand le module Lettre d'information est éteint. */
export function NewsletterForm({ source = "site" }: { source?: string }) {
  if (!isFeatureOn("newsletter")) return null;
  return <NewsletterFormInner source={source} />;
}

function NewsletterFormInner({ source }: { source: string }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const openedAt = useRef(Date.now());
  // Formulaire monté après chargement : les extensions (gestionnaires de mots de passe)
  // injectent des éléments dans les champs et provoquaient un décalage d'affichage.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    openedAt.current = Date.now();
    setMounted(true);
  }, []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const trap = String(form.get("website") ?? "");
    if (trap.length > 0 || Date.now() - openedAt.current < 2000) {
      toast.warning("Inscription suspendue.", {
        description: "Votre envoi ressemble à celui d'un robot. Réessayez dans un instant.",
      });
      return;
    }
    setBusy(true);
    // Abonnement par une fonction de la base : une adresse déjà inscrite reçoit la même réponse
    // qu'une nouvelle, le formulaire ne révèle donc pas qui est abonné.
    const { error } = await supabase.rpc("newsletter_subscribe", {
      _email: String(form.get("email") ?? "")
        .trim()
        .toLowerCase(),
      _first_name: String(form.get("first_name") ?? "").trim(),
      _source: source,
    });
    setBusy(false);
    if (error) {
      if (error.code === "22023") {
        toast.error("Inscription impossible.", {
          description: "Vérifiez votre adresse e-mail et votre prénom (80 caractères au plus).",
        });
        return;
      }
      toast.error("Inscription impossible.", {
        description: "Réessayez dans un instant, votre place reste disponible.",
      });
      return;
    }
    toast.success("Bienvenue, c'est noté.", {
      description: "Vous recevrez nos prochaines publications, sans bruit inutile.",
    });
    setDone(true);
  }

  return (
    <section className="rounded-xl border border-border bg-card p-6">
      <h2 className="text-base font-semibold text-foreground">
        Recevez ce qui vous fait gagner du temps
      </h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Une publication utile de temps en temps : méthodes, modèles et raccourcis concrets. Vous
        partez quand vous voulez, en un clic.
      </p>

      {done ? (
        <p className="mt-4 rounded-lg border border-border bg-muted p-4 text-sm text-foreground">
          Votre inscription est enregistrée. À très vite.
        </p>
      ) : !mounted ? (
        <div className="mt-4 h-[74px]" aria-hidden="true" />
      ) : (
        <form
          onSubmit={onSubmit}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        >
          <div className="space-y-1.5">
            <Label htmlFor="nl-first-name">Prénom</Label>
            <Input
              id="nl-first-name"
              name="first_name"
              autoComplete="given-name"
              maxLength={80}
              placeholder="Votre prénom"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nl-email">Adresse e-mail</Label>
            <Input
              id="nl-email"
              name="email"
              type="email"
              required
              autoComplete="email"
              maxLength={254}
              placeholder="nom@exemple.fr"
            />
          </div>
          <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="nl-website">Site web (ne pas remplir)</label>
            <input id="nl-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>
          <Button type="submit" disabled={busy} title="S'inscrire à la lettre d'information">
            {busy ? "Inscription…" : "Je m'inscris"}
          </Button>
        </form>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        Votre adresse sert uniquement à vous écrire.{" "}
        <Link
          to="/legal/confidentialite"
          title="Lire la politique de confidentialité"
          className="text-primary-text hover:underline"
        >
          Politique de confidentialité
        </Link>
        .
      </p>
    </section>
  );
}
