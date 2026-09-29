import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "@/components/cds/AdminShell";
import { MediaLibrary } from "@/components/cds/MediaPicker";
import { requireFeature } from "@/config/features";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/mediatheque")({
  beforeLoad: () => requireFeature("media"),
  head: () =>
    seo({
      title: "Administration — Médiathèque",
      description: "Envoyer, décrire et supprimer les images et fichiers du site.",
      path: "/admin/mediatheque",
      noindex: true,
    }),
  component: AdminMediaPage,
});

function AdminMediaPage() {
  return (
    <AdminShell
      title="Médiathèque"
      intro="Envoyez vos images une fois, puis choisissez-les dans les formulaires (articles, formations, fiches, annonces, régie). Décrivez chaque image : le texte alternatif sert aux lecteurs d'écran et au référencement."
    >
      <MediaLibrary manage />
    </AdminShell>
  );
}
