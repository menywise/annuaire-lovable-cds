import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, Package } from "lucide-react";
import { PageShell } from "@/components/cds/SiteHeader";
import { Label } from "@/components/ui/label";
import { requireFeature } from "@/config/features";
import { getShopCatalog } from "@/lib/shop.functions";
import { SHOP_KINDS, isDigital, shopKindLabel } from "@/lib/shop";
import { seo } from "@/lib/seo";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/boutique/")({
  beforeLoad: () => requireFeature("shop"),
  loader: () => getShopCatalog(),
  head: () =>
    seo({
      title: "Boutique",
      description:
        "Objets expédiés chez vous, guides PDF et livres numériques à télécharger dès le paiement.",
      path: "/boutique",
    }),
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">La boutique n'a pas pu être chargée.</p>
    </PageShell>
  ),
  component: ShopPage,
});

function ShopPage() {
  const { products, settings, failed } = Route.useLoaderData();
  const [kind, setKind] = useState("");

  const visible = useMemo(() => products.filter((p) => !kind || p.kind === kind), [products, kind]);
  const kindsPresent = SHOP_KINDS.filter((k) => products.some((p) => p.kind === k.value));

  return (
    <PageShell>
      <div className="mx-auto max-w-[1000px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">Boutique</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">
          Des outils concrets, à recevoir ou à télécharger
        </h1>
        <p className="mt-2 max-w-[65ch] text-sm text-muted-foreground">
          Les fichiers numériques se téléchargent depuis votre espace dès le paiement confirmé. Les
          objets partent par la poste
          {settings.shipping_cents > 0
            ? ` : livraison ${formatPrice(settings.shipping_cents, "EUR")}`
            : " : livraison offerte"}
          {settings.shipping_cents > 0 && settings.free_shipping_from_cents > 0
            ? `, offerte dès ${formatPrice(settings.free_shipping_from_cents, "EUR")} d'achat`
            : ""}
          .
        </p>

        {kindsPresent.length > 1 ? (
          <div className="mt-6 max-w-xs space-y-1.5">
            <Label htmlFor="shop-kind">Type de produit</Label>
            <select
              id="shop-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            >
              <option value="">Tous les produits</option>
              {kindsPresent.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <p className="mt-4 text-xs text-muted-foreground" aria-live="polite">
          {visible.length} produit{visible.length > 1 ? "s" : ""} disponible
          {visible.length > 1 ? "s" : ""}.
        </p>

        {failed ? (
          <p className="mt-6 rounded-lg border border-destructive/40 p-6 text-sm text-foreground">
            Le catalogue n'a pas pu être chargé. Rechargez la page dans un instant.
          </p>
        ) : visible.length === 0 ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Aucun produit en vente pour l'instant. Revenez bientôt.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((product) => {
              const soldOut = product.stock === 0;
              return (
                <li
                  key={product.id}
                  className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm"
                >
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={`Photo du produit ${product.title}`}
                      loading="lazy"
                      className="mb-3 aspect-square w-full rounded-lg object-cover"
                    />
                  ) : null}
                  <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    {isDigital(product.kind) ? (
                      <Download className="size-3.5" aria-hidden="true" />
                    ) : (
                      <Package className="size-3.5" aria-hidden="true" />
                    )}
                    {shopKindLabel(product.kind)}
                  </p>
                  <h2 className="mt-1 text-base font-semibold text-foreground">
                    <Link
                      to="/boutique/$slug"
                      params={{ slug: product.slug }}
                      title={`Voir le produit ${product.title}`}
                      className="hover:underline"
                    >
                      {product.title}
                    </Link>
                  </h2>
                  {product.summary ? (
                    <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                      {product.summary}
                    </p>
                  ) : null}
                  <p className="mt-auto pt-4 text-sm font-semibold text-primary-text">
                    {formatPrice(product.price_cents, "EUR")}
                    {soldOut ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">Épuisé</span>
                    ) : null}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
