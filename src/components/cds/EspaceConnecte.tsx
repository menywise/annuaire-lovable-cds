import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { PageShell } from "@/components/cds/SiteHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

/**
 * Espace connecté. La session vit dans le navigateur : le contrôle se fait après l'affichage
 * (et non dans `beforeLoad`), sinon la redirection vers la connexion intervient pendant
 * l'hydratation et React signale une page différente de celle envoyée par le serveur.
 *
 * Sert de mise en page à `src/routes/_authenticated/` et aux pages connectées d'une greffe
 * (`src/routes/(greffe)/_connecte/route.tsx`, docs/CLONER.md « Écrire une greffe »).
 */
export function EspaceConnecte() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const href = useLocation({ select: (l) => l.href });
  const sent = useRef(false);

  useEffect(() => {
    // Après connexion, le membre revient sur la page demandée.
    if (loading || user || sent.current) return;
    sent.current = true;
    void navigate({ to: "/login", search: { next: href }, replace: true });
  }, [loading, user, navigate, href]);

  if (!user) {
    return (
      <PageShell>
        <div className="mx-auto max-w-[900px] space-y-3" aria-busy="true" aria-live="polite">
          <span className="sr-only">Vérification de votre session…</span>
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-40 w-full" />
        </div>
      </PageShell>
    );
  }
  return <Outlet />;
}
