import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireFeature } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";
import { formatDate, formatPrice } from "@/lib/format";

type Row = {
  id: string;
  title: string;
  slug: string;
  price_cents: number;
  currency: string | null;
  status: string;
  approved: boolean;
  views: number | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  active: "En ligne",
  sold: "Vendue",
  archived: "Archivée",
};

export const Route = createFileRoute("/_authenticated/mes-annonces")({
  beforeLoad: () => requireFeature("marketplace"),
  head: () =>
    seo({
      title: "Mes annonces",
      description: "Suivez vos annonces publiées, leur statut et leur nombre de vues.",
      path: "/mes-annonces",
      noindex: true,
    }),
  component: MyListingsPage,
});

function MyListingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void supabase
      .from("marketplace_listings")
      .select("id, title, slug, price_cents, currency, status, approved, views, created_at")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!cancelled) setRows((data ?? []) as Row[]);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("marketplace_listings").update({ status }).eq("id", id);
    if (error) {
      toast.error("Modification impossible.", { description: "Réessayez dans un instant." });
      return;
    }
    setRows((prev) => prev?.map((row) => (row.id === id ? { ...row, status } : row)) ?? null);
    toast.success("Annonce mise à jour.");
    router.invalidate();
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[900px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mes annonces</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Marquez vendue dès que c'est conclu : les acheteurs voient tout de suite ce qui est
              encore disponible.
            </p>
          </div>
          <Button asChild variant="outline" title="Publier une nouvelle annonce">
            <Link to="/marketplace/publier">Publier une annonce</Link>
          </Button>
        </div>

        {rows === null ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Vous n'avez publié aucune annonce pour l'instant.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      <Link
                        to="/marketplace/$slug"
                        params={{ slug: row.slug }}
                        title={`Voir l'annonce ${row.title}`}
                        className="hover:underline"
                      >
                        {row.title}
                      </Link>
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatPrice(row.price_cents, row.currency ?? "EUR")} ·{" "}
                      {STATUS_LABEL[row.status] ?? row.status} ·{" "}
                      {row.approved ? "validée" : "en attente de validation"} · {row.views ?? 0} vue
                      {(row.views ?? 0) > 1 ? "s" : ""} · {formatDate(row.created_at)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {row.status !== "sold" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(row.id, "sold")}
                        title="Marquer cette annonce comme vendue"
                      >
                        Vendue
                      </Button>
                    ) : null}
                    {row.status !== "archived" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(row.id, "archived")}
                        title="Archiver cette annonce"
                      >
                        Archiver
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(row.id, "active")}
                        title="Remettre cette annonce en ligne"
                      >
                        Remettre en ligne
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
