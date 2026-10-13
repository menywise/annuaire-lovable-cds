import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { publicClient } from "@/lib/supabase-public";
import { check, decrireErreurBase } from "@/lib/check";
import {
  CART_MAX_LINES,
  CART_MAX_QUANTITY,
  SHOP_SETTINGS_KEY,
  normalizeShopSettings,
} from "@/lib/shop";

/**
 * CDS — Module K « Boutique » : lecture publique du catalogue, commande et téléchargement.
 * Le montant payé est calculé en base (`shop_start_checkout`), jamais à partir du navigateur.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PRODUCT_COLUMNS =
  "id, slug, title, summary, description, kind, price_cents, currency, image_url, stock, position";

async function readSettings(client: ReturnType<typeof publicClient>) {
  const data = check(
    await client.from("site_settings").select("value").eq("key", SHOP_SETTINGS_KEY).maybeSingle(),
    { contexte: "site_settings" },
  );
  return normalizeShopSettings(data?.value);
}

/** Catalogue publié (vide si la boutique est éteinte) et réglages de livraison. */
export const getShopCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const client = publicClient();
  const [{ data, error }, settings] = await Promise.all([
    client
      .from("shop_products")
      .select(PRODUCT_COLUMNS)
      .eq("published", true)
      .order("position", { ascending: true })
      .order("created_at", { ascending: false }),
    readSettings(client),
  ]);
  return { products: data ?? [], settings, failed: Boolean(error) };
});

/** Fiche d'un produit publié. */
export const getShopProduct = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => ({ slug: String(input?.slug ?? "").slice(0, 120) }))
  .handler(async ({ data }) => {
    const client = publicClient();
    const [productRes, settings] = await Promise.all([
      client
        .from("shop_products")
        .select(PRODUCT_COLUMNS)
        .eq("published", true)
        .eq("slug", data.slug)
        .maybeSingle(),
      readSettings(client),
    ]);
    const product = check(productRes, { contexte: "shop_products" });
    return product ? { product, settings } : null;
  });

/** Produits du panier encore en vente (les autres disparaissent du panier). */
export const getShopProducts = createServerFn({ method: "POST" })
  .inputValidator((input: { ids: string[] }) => ({
    ids: (Array.isArray(input?.ids) ? input.ids : [])
      .map(String)
      .filter((id) => UUID.test(id))
      .slice(0, CART_MAX_LINES),
  }))
  .handler(async ({ data }) => {
    const client = publicClient();
    const settings = await readSettings(client);
    if (data.ids.length === 0) return { products: [], settings };
    const products = check(
      await client
        .from("shop_products")
        .select(PRODUCT_COLUMNS)
        .eq("published", true)
        .in("id", data.ids),
      { contexte: "shop_products" },
    );
    return { products: products ?? [], settings };
  });

/** Adresse publique du site : celle saisie en admin, sinon celle de la requête. */
async function siteOrigin() {
  const { loadSiteConfig } = await import("@/lib/site-config.functions");
  const site = await loadSiteConfig().catch(() => null);
  if (site?.brand.url && /^https?:\/\//.test(site.brand.url)) return site.brand.url;
  return new URL(getRequest().url).origin;
}

type CheckoutRow = {
  order_id: string;
  order_number: number;
  payment_id: string;
  lines: Array<{ name: string; unit_amount: number; quantity: number }>;
  shipping_cents: number;
  total_cents: number;
  currency: string;
  countries: string[];
  superseded_sessions: string[];
};

/** Passe la commande du panier : contrôles en base, puis page de paiement Stripe. */
export const startShopCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { items: Array<{ productId: string; quantity: number }>; waiver: boolean }) => {
      const items = (Array.isArray(input?.items) ? input.items : [])
        .slice(0, CART_MAX_LINES)
        .map((i) => ({
          product_id: String(i?.productId ?? ""),
          quantity: Math.min(CART_MAX_QUANTITY, Math.max(1, Math.floor(Number(i?.quantity) || 1))),
        }));
      if (items.length === 0) throw new Error("Votre panier est vide.");
      if (items.some((i) => !UUID.test(i.product_id))) throw new Error("Produit inconnu.");
      return { items, waiver: input?.waiver === true };
    },
  )
  .handler(async ({ data, context }) => {
    const { stripeSecretKey, createCheckoutSession, expireCheckoutSession } =
      await import("@/lib/stripe.server");
    if (!stripeSecretKey()) throw new Error("Le paiement en ligne n'est pas encore configuré.");

    const { isSessionAttached } = await import("@/lib/paiement-rattachement");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Les refus de la base (panier vide, produit épuisé, quantité…) s'affichent au membre.
    const rows = check(
      await supabaseAdmin.rpc("shop_start_checkout", {
        _user_id: context.userId,
        _items: data.items,
        _waiver: data.waiver,
      }),
      { contexte: "shop_start_checkout", metier: true },
    );
    const order = (rows as unknown as CheckoutRow[] | null)?.[0];
    if (!order) throw new Error("Commande impossible.");

    // Commande précédente encore ouverte chez Stripe (autre onglet) : fermée avant d'en ouvrir une.
    // Son stock est déjà rendu : toute commande qui passe à « expired » le rend, une seule fois
    // (déclencheur shop_orders_release_stock, migration 1.6.1).
    for (const old of order.superseded_sessions ?? []) {
      if ((await expireCheckoutSession(old)) === "paid") {
        await supabaseAdmin
          .from("payments")
          .update({ status: "failed" })
          .eq("id", order.payment_id);
        await supabaseAdmin
          .from("shop_orders")
          .update({ status: "expired" })
          .eq("id", order.order_id);
        throw new Error(
          "Votre commande précédente vient d'être payée : retrouvez-la dans « Mes achats ».",
        );
      }
    }

    const origin = await siteOrigin();
    const email = typeof context.claims.email === "string" ? context.claims.email : null;
    const session = await createCheckoutSession({
      paymentId: order.payment_id,
      lines: order.lines.map((l) => ({
        name: l.name,
        unitAmount: l.unit_amount,
        quantity: l.quantity,
      })),
      currency: order.currency,
      email,
      successUrl: `${origin}/mes-achats?paiement=reussi&commande=${order.order_number}`,
      cancelUrl: `${origin}/boutique/panier?paiement=annule`,
      shippingCountries: order.countries,
    });
    if (!session) {
      // Commande abandonnée : le passage à « expired » rend son stock réservé.
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", order.payment_id);
      await supabaseAdmin
        .from("shop_orders")
        .update({ status: "expired" })
        .eq("id", order.order_id);
      throw new Error("Stripe n'a pas pu ouvrir la page de paiement. Réessayez dans un instant.");
    }
    // Sans rattachement, le webhook ne retrouverait pas ce paiement : le client ne part pas payer.
    const { error: attachError } = await supabaseAdmin.rpc("payment_attach_session", {
      _payment_id: order.payment_id,
      _session_id: session.id,
    });
    if (attachError) console.error(decrireErreurBase(attachError, "payment_attach_session"));
    const { data: attached, error: readError } = attachError
      ? { data: null, error: null }
      : await supabaseAdmin
          .from("payments")
          .select("stripe_session_id")
          .eq("id", order.payment_id)
          .maybeSingle();
    if (readError) console.error(decrireErreurBase(readError, "payments"));
    if (!isSessionAttached(attached, session.id)) {
      console.error(
        `[paiement] session ${session.id} non rattachée au paiement ${order.payment_id} : session expirée`,
      );
      await expireCheckoutSession(session.id).catch(() => "unknown");
      // Commande abandonnée : le passage à « expired » rend son stock réservé.
      await supabaseAdmin.from("payments").update({ status: "failed" }).eq("id", order.payment_id);
      await supabaseAdmin
        .from("shop_orders")
        .update({ status: "expired" })
        .eq("id", order.order_id);
      throw new Error("Le paiement n'a pas pu être préparé. Rien n'a été débité. Réessayez.");
    }
    return { url: session.url };
  });

/** Lien de téléchargement d'un fichier acheté, valable 5 minutes, pour l'acheteur seulement. */
export const downloadPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { itemId: string }) => {
    if (!UUID.test(String(input?.itemId ?? ""))) throw new Error("Achat introuvable.");
    return { itemId: String(input.itemId) };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Les refus de la base (limite de téléchargements, achat d'un autre membre) s'affichent au membre.
    const rows = check(
      await supabaseAdmin.rpc("shop_download", {
        _user_id: context.userId,
        _item_id: data.itemId,
      }),
      { contexte: "shop_download", metier: true },
    );
    const file = rows?.[0];
    if (!file) throw new Error("Achat introuvable.");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from("shop-files")
      .createSignedUrl(file.path, 300, { download: file.file_name });
    if (signError || !signed?.signedUrl) {
      throw new Error("Le fichier n'a pas pu être préparé. Réessayez dans un instant.");
    }
    return { url: signed.signedUrl, downloads: file.downloads };
  });
