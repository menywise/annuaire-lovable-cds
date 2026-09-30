import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireFeature } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { downloadPurchase } from "@/lib/shop.functions";
import { ORDER_STATUS, isDigital, isOrderPaid, orderStatusLabel, shopKindLabel } from "@/lib/shop";
import { formatDate, formatPrice } from "@/lib/format";
import { seo } from "@/lib/seo";

type PurchaseSearch = { paiement?: "reussi"; commande?: number };

type Item = {
  id: string;
  title: string;
  kind: string;
  unit_price_cents: number;
  quantity: number;
  downloads: number;
};
type Order = {
  id: string;
  number: number;
  status: string;
  total_cents: number;
  shipping_cents: number;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  carrier: string | null;
  tracking_number: string | null;
  shop_order_items: Item[];
};

export const Route = createFileRoute("/_authenticated/mes-achats")({
  validateSearch: (search: Record<string, unknown>): PurchaseSearch => {
    const commande = Number(search["commande"]);
    return search["paiement"] === "reussi"
      ? { paiement: "reussi", ...(Number.isInteger(commande) && commande > 0 ? { commande } : {}) }
      : {};
  },
  beforeLoad: () => requireFeature("shop"),
  head: () =>
    seo({
      title: "Mes achats",
      description: "Vos commandes, leur suivi et vos fichiers à télécharger.",
      path: "/mes-achats",
      noindex: true,
    }),
  component: MyPurchasesPage,
});

function MyPurchasesPage() {
  const { user } = useAuth();
  const { paiement, commande } = Route.useSearch();
  const { clear } = useCart();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("shop_orders")
      .select(
        "id, number, status, total_cents, shipping_cents, created_at, paid_at, shipped_at, carrier, tracking_number, shop_order_items(id, title, kind, unit_price_cents, quantity, downloads)",
      )
      .eq("user_id", user.id)
      .neq("status", "expired")
      .order("created_at", { ascending: false })
      .limit(100);
    setFailed(Boolean(error));
    const list = (data ?? []) as Order[];
    setOrders(list);
    return list;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Retour de Stripe : le webhook peut arriver quelques secondes après la redirection.
    let attempts = paiement === "reussi" ? 6 : 1;
    const tick = async () => {
      const list = await load();
      if (cancelled) return;
      attempts -= 1;
      const target = list?.find((o) => o.number === commande);
      if (paiement === "reussi" && target && isOrderPaid(target.status)) return;
      if (attempts > 0) timer = setTimeout(tick, 2500);
    };
    void tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user, load, paiement, commande]);

  useEffect(() => {
    if (paiement === "reussi") {
      clear();
      toast.success("Commande reçue, merci.", {
        description: "Elle est confirmée dès que Stripe nous transmet le paiement.",
      });
    }
    // Le panier n'est vidé qu'une fois, au retour de Stripe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paiement]);

  async function download(item: Item) {
    setBusy(item.id);
    try {
      const { url } = await downloadPurchase({ data: { itemId: item.id } });
      window.location.assign(url);
      void load();
    } catch (err) {
      toast.error("Téléchargement impossible.", {
        description: err instanceof Error ? err.message : "Réessayez dans un instant.",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[800px]">
        <h1 className="text-3xl font-bold text-foreground">Mes achats</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vos commandes et vos fichiers. Chaque lien de téléchargement est valable 5 minutes ; vous
          pouvez en demander un nouveau à tout moment.
        </p>

        {orders === null ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : failed ? (
          <div className="mt-6 rounded-lg border border-destructive/40 p-6 text-sm">
            <p className="text-foreground">Vos achats n'ont pas pu être chargés.</p>
            <Button
              className="mt-3"
              variant="outline"
              onClick={() => void load()}
              title="Recharger"
            >
              Réessayer
            </Button>
          </div>
        ) : orders.length === 0 ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Aucun achat pour le moment.{" "}
            <Link
              to="/boutique"
              title="Parcourir la boutique"
              className="text-primary-text hover:underline"
            >
              Parcourir la boutique
            </Link>
          </p>
        ) : (
          <ul className="mt-6 space-y-4">
            {orders.map((order) => {
              const paid = isOrderPaid(order.status);
              const tone = ORDER_STATUS[order.status]?.tone;
              return (
                <li key={order.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-foreground">
                      Commande n° {order.number}
                    </h2>
                    <Badge
                      variant={
                        tone === "ok" ? "default" : tone === "wait" ? "secondary" : "outline"
                      }
                    >
                      {orderStatusLabel(order.status)}
                    </Badge>
                    <span className="ml-auto text-sm font-semibold text-foreground">
                      {formatPrice(order.total_cents, "EUR")}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Passée le {formatDate(order.created_at)}
                    {order.shipping_cents > 0
                      ? ` · livraison ${formatPrice(order.shipping_cents, "EUR")}`
                      : ""}
                  </p>
                  {order.status === "shipped" || order.status === "delivered" ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Expédiée le {formatDate(order.shipped_at)}
                      {order.carrier ? ` par ${order.carrier}` : ""}
                      {order.tracking_number ? ` · suivi ${order.tracking_number}` : ""}
                    </p>
                  ) : null}
                  <ul className="mt-3 space-y-2 text-sm">
                    {order.shop_order_items.map((item) => (
                      <li key={item.id} className="flex flex-wrap items-center gap-2">
                        <span className="text-foreground">
                          {item.quantity > 1 ? `${item.quantity} × ` : ""}
                          {item.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {shopKindLabel(item.kind)}
                        </span>
                        {isDigital(item.kind) && paid ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="ml-auto min-h-11"
                            disabled={busy === item.id}
                            onClick={() => void download(item)}
                            title={`Télécharger ${item.title}`}
                          >
                            <Download className="size-4" aria-hidden="true" />
                            {busy === item.id ? "Préparation…" : "Télécharger"}
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {order.status === "pending" ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Paiement en cours de confirmation : cette page s'actualise toute seule.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
