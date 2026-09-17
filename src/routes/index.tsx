import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CDS — Consensus Design System" },
      { name: "description", content: "Consensus Design System — design system réutilisable, thème clair, tokens CDS." },
      { property: "og:title", content: "CDS — Consensus Design System" },
      { property: "og:description", content: "Consensus Design System — design system réutilisable, thème clair, tokens CDS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-foreground font-medium">
        Consensus Design System — Prêt
      </p>
    </div>
  );
}
