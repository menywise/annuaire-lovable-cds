import { createFileRoute } from "@tanstack/react-router";
import { EspaceConnecte } from "@/components/cds/EspaceConnecte";

/** Espace connecté du socle : la garde vit dans `EspaceConnecte`, partagée avec les greffes. */
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: EspaceConnecte,
});
