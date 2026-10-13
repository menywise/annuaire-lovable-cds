import { useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";

/**
 * État d'erreur d'une page publique dont le chargement a échoué (panne de base, réseau) :
 * une phrase et un bouton « Réessayer » qui relance les lecteurs de la page sans la recharger.
 * Le détail technique n'est jamais affiché : il est dans le journal du serveur (src/lib/check.ts).
 */
export function ErreurChargement({ message, reset }: { message: string; reset: () => void }) {
  const router = useRouter();
  return (
    <PageShell>
      <div className="mx-auto max-w-[760px]">
        <h1 className="text-xl font-semibold text-foreground">{message}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Réessayez dans un instant. Le reste du site reste accessible depuis le menu.
        </p>
        <Button
          type="button"
          className="mt-6"
          title="Recharger le contenu de la page"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Réessayer
        </Button>
      </div>
    </PageShell>
  );
}

/** Fabrique l'`errorComponent` d'une route publique avec la phrase propre à la page. */
export function erreurChargement(message: string) {
  return function ErreurChargementRoute({ reset }: ErrorComponentProps) {
    return <ErreurChargement message={message} reset={reset} />;
  };
}
