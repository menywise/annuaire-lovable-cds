import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Package } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { requireFeature } from "@/config/features";
import { useCart } from "@/hooks/useCart";
import { RichText } from "@/lib/richtext";
import { getShopProduct } from "@/lib/shop.functions";
import { CART_MAX_QUANTITY, addToCart, isDigital, shopKindLabel } from "@/lib/shop";
import { absoluteUrl } from "@/lib/site-config";
import { breadcrumbJsonLd, clampText, seo } from "@/lib/seo";
import { formatPrice } from "@/lib/format";

export const Route = createFileRoute("/boutique/$slug")({
  beforeLoad: () => requireFeature("shop"),
  loader: async ({ params }) => {
    const data = await getShopProduct({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Produit introuvable" }, { name: "robots", content: "noindex" }] };
    }
    const { product } = loaderData;
    const image =
      product.image_url && /^https:\/\//.test(product.image_url) ? product.image_url : undefined;
    return {
      ...seo({
        title: product.title,
        description: clampText(
          product.summary || `${shopKindLabel(product.kind)} en vente dans la boutique.`,
          200,
        ),
        path: `/boutique/${product.slug}`,
        ...(image ? { image } : {}),
      }),
      scripts: [
        breadcrumbJsonLd([
          { name: "Boutique", path: "/boutique" },
          { name: product.title, path: `/boutique/${product.slug}` },
        ]),
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            name: product.title,
            description: product.summary || undefined,
            image,
            offers: {
              "@type": "Offer",
              url: absoluteUrl(`/boutique/${product.slug}`),
              price: (product.price_cents / 100).toFixed(2),
              priceCurrency: "EUR",
              availability:
                product.stock === 0
                  ? "https://schema.org/OutOfStock"
                  : "https://schema.org/InStock",
            },
          }),
        },
      ],
    };
  },
  errorComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">Ce produit n'a pas pu être chargé.</p>
    </PageShell>
  ),
  notFoundComponent: () => (
    <PageShell>
      <p className="text-sm text-muted-foreground">
        Ce produit n'existe pas ou n'est plus en vente.{" "}
        <Link to="/boutique" title="Revenir à la boutique" className="underline">
          Revenir à la boutique
        </Link>
      </p>
    </PageShell>
  ),
  component: ProductPage,
});

function ProductPage() {
  const { product } = Route.useLoaderData();
  const { cart, update } = useCart();
  const [quantity, setQuantity] = useState(1);
  const digital = isDigital(product.kind);
  const soldOut = product.stock === 0;
  const max = Math.min(CART_MAX_QUANTITY, product.stock ?? CART_MAX_QUANTITY);
  const inCart = cart.find((l) => l.productId === product.id);

  function add() {
    update((current) => addToCart(current, product.id, product.kind, digital ? 1 : quantity));
    toast.success("Ajouté au panier.", {
      action: {
        label: "Voir le panier",
        onClick: () => window.location.assign("/boutique/panier"),
      },
    });
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[900px]">
        <nav aria-label="Fil d'Ariane" className="text-xs text-muted-foreground">
          <Link to="/boutique" title="Revenir à la boutique" className="hover:underline">
            Boutique
          </Link>
          {" / "}
          {product.title}
        </nav>

        <div className="mt-4 grid gap-8 md:grid-cols-2">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={`Photo du produit ${product.title}`}
              className="aspect-square w-full rounded-xl border border-border object-cover"
            />
          ) : null}
          <div className={product.image_url ? "" : "md:col-span-2"}>
            <p className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {digital ? (
                <Download className="size-3.5" aria-hidden="true" />
              ) : (
                <Package className="size-3.5" aria-hidden="true" />
              )}
              {shopKindLabel(product.kind)}
              {digital ? " · téléchargement dès le paiement" : " · expédié par la poste"}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-foreground">{product.title}</h1>
            {product.summary ? (
              <p className="mt-3 text-sm text-muted-foreground">{product.summary}</p>
            ) : null}
            <p className="mt-4 text-2xl font-semibold text-primary-text">
              {formatPrice(product.price_cents, "EUR")}
            </p>

            <div className="mt-6 rounded-xl border border-border bg-card p-5">
              {soldOut ? (
                <p className="text-sm text-muted-foreground">
                  Épuisé pour le moment. Revenez bientôt.
                </p>
              ) : (
                <>
                  {!digital && product.stock !== null && product.stock <= 5 ? (
                    <p className="mb-3 text-xs text-muted-foreground">
                      Plus que {product.stock} en stock.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-end gap-3">
                    {!digital ? (
                      <div className="space-y-1.5">
                        <Label htmlFor="product-qty">Quantité</Label>
                        <select
                          id="product-qty"
                          value={quantity}
                          onChange={(e) => setQuantity(Number(e.target.value))}
                          className="h-11 w-24 rounded-md border border-border bg-card px-3 text-sm text-foreground"
                        >
                          {Array.from({ length: Math.max(1, max) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                    <Button
                      onClick={add}
                      disabled={digital && Boolean(inCart)}
                      title={`Ajouter ${product.title} au panier`}
                    >
                      {digital && inCart ? "Déjà dans le panier" : "Ajouter au panier"}
                    </Button>
                    {inCart ? (
                      <Button asChild variant="outline" title="Voir le panier et commander">
                        <Link to="/boutique/panier">Voir le panier</Link>
                      </Button>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {product.description ? (
          <section className="mt-10">
            <h2 className="text-base font-semibold text-foreground">Description</h2>
            <RichText value={product.description} className="mt-3 text-sm text-foreground" />
          </section>
        ) : null}
      </div>
    </PageShell>
  );
}
