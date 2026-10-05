import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ErrorComponent, NotFoundComponent } from "./routes/__root";

/** Navigation en cours : fine barre animée en haut de page, annoncée aux lecteurs d'écran. */
function PendingComponent() {
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-50">
      <div className="h-0.5 w-full animate-pulse bg-primary" aria-hidden="true" />
      <span className="sr-only">Chargement de la page…</span>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ErrorComponent,
    defaultNotFoundComponent: NotFoundComponent,
    // Indicateur affiché seulement si le chargement dépasse 300 ms, puis gardé 300 ms au moins
    // pour éviter un clignotement.
    defaultPendingComponent: PendingComponent,
    defaultPendingMs: 300,
    defaultPendingMinMs: 300,
  });

  return router;
};
