/**
 * CDS — Module K « Boutique » : règles partagées par le serveur, le navigateur et les tests.
 * Fichier sans dépendance. Le prix, la livraison et le stock font foi en base
 * (`shop_start_checkout`) : ce qui est calculé ici ne sert qu'à l'affichage.
 */

export type ShopKind = "physique" | "pdf" | "ebook";

export const SHOP_KINDS: ReadonlyArray<{ value: ShopKind; label: string; hint: string }> = [
  { value: "physique", label: "Objet", hint: "Expédié par la poste" },
  { value: "pdf", label: "PDF", hint: "Téléchargement immédiat" },
  { value: "ebook", label: "Livre numérique", hint: "Téléchargement immédiat (EPUB)" },
];

export function shopKindLabel(kind: string) {
  return SHOP_KINDS.find((k) => k.value === kind)?.label ?? "Produit";
}

export function isDigital(kind: string) {
  return kind === "pdf" || kind === "ebook";
}

export const ORDER_STATUS: Record<string, { label: string; tone: "ok" | "wait" | "off" }> = {
  pending: { label: "En attente de paiement", tone: "wait" },
  paid: { label: "Payée", tone: "ok" },
  shipped: { label: "Expédiée", tone: "ok" },
  delivered: { label: "Livrée", tone: "ok" },
  expired: { label: "Abandonnée", tone: "off" },
  refunded: { label: "Remboursée", tone: "off" },
};

export function orderStatusLabel(status: string) {
  return ORDER_STATUS[status]?.label ?? status;
}

/** Une commande dont les fichiers se téléchargent et dont les objets partent. */
export function isOrderPaid(status: string) {
  return status === "paid" || status === "shipped" || status === "delivered";
}

// Réglages -----------------------------------------------------------------------------------------

export const SHOP_SETTINGS_KEY = "shop";

export type ShopSettings = {
  shipping_cents: number;
  free_shipping_from_cents: number;
  countries: string[];
};

export const defaultShopSettings: ShopSettings = {
  shipping_cents: 590,
  free_shipping_from_cents: 0,
  countries: ["FR"],
};

function cents(value: unknown, max: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

/** Réglages lus en base : valeurs hors bornes ramenées aux valeurs par défaut (même règle qu'en SQL). */
export function normalizeShopSettings(value: unknown): ShopSettings {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const countries = Array.isArray(raw["countries"])
    ? [
        ...new Set(
          raw["countries"]
            .filter((c): c is string => typeof c === "string")
            .map((c) => c.trim().toUpperCase())
            .filter((c) => /^[A-Z]{2}$/.test(c)),
        ),
      ].sort()
    : [];
  return {
    shipping_cents: cents(raw["shipping_cents"], 999999) ?? 0,
    free_shipping_from_cents: cents(raw["free_shipping_from_cents"], 99999999) ?? 0,
    countries: countries.length ? countries : ["FR"],
  };
}

/** Lecture de « FR, be ,Ch » saisi en admin. */
export function parseCountries(text: string) {
  return normalizeShopSettings({ countries: text.split(/[\s,;]+/) }).countries;
}

// Panier -------------------------------------------------------------------------------------------

export const CART_STORAGE_KEY = "cds-panier";
export const CART_MAX_LINES = 20;
export const CART_MAX_QUANTITY = 10;

export type CartLine = { productId: string; quantity: number };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Panier relu depuis le navigateur : lignes invalides écartées, doublons fusionnés, bornes appliquées. */
export function normalizeCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const out: CartLine[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const productId = String((raw as Record<string, unknown>)["productId"] ?? "");
    const quantity = Math.floor(Number((raw as Record<string, unknown>)["quantity"]));
    if (!UUID.test(productId) || !Number.isFinite(quantity) || quantity < 1) continue;
    const existing = out.find((l) => l.productId === productId);
    if (existing) existing.quantity = Math.min(CART_MAX_QUANTITY, existing.quantity + quantity);
    else if (out.length < CART_MAX_LINES)
      out.push({ productId, quantity: Math.min(CART_MAX_QUANTITY, quantity) });
  }
  return out;
}

/** Ajoute un produit ; un fichier numérique ne s'achète qu'une fois. */
export function addToCart(cart: CartLine[], productId: string, kind: string, quantity = 1) {
  const next = normalizeCart([...cart, { productId, quantity }]);
  return isDigital(kind)
    ? next.map((l) => (l.productId === productId ? { ...l, quantity: 1 } : l))
    : next;
}

export function setCartQuantity(cart: CartLine[], productId: string, quantity: number) {
  if (quantity < 1) return cart.filter((l) => l.productId !== productId);
  return cart.map((l) =>
    l.productId === productId
      ? { ...l, quantity: Math.min(CART_MAX_QUANTITY, Math.floor(quantity)) }
      : l,
  );
}

export type PricedLine = { price_cents: number; quantity: number; kind: string };

/** Estimation affichée dans le panier (même règle que la base). */
export function cartTotals(lines: ReadonlyArray<PricedLine>, settings: ShopSettings) {
  const subtotal = lines.reduce(
    (sum, l) => sum + l.price_cents * (isDigital(l.kind) ? 1 : l.quantity),
    0,
  );
  const physical = lines.some((l) => !isDigital(l.kind));
  const free =
    settings.free_shipping_from_cents > 0 && subtotal >= settings.free_shipping_from_cents;
  const shipping = physical && !free ? settings.shipping_cents : 0;
  return {
    subtotal,
    shipping,
    total: subtotal + shipping,
    physical,
    digital: lines.some((l) => isDigital(l.kind)),
  };
}

/** Adresse de livraison relevée par Stripe, en lignes lisibles. */
export function formatAddress(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  const a = value as Record<string, unknown>;
  const s = (k: string) => (typeof a[k] === "string" ? (a[k] as string).trim() : "");
  return [
    s("line1"),
    s("line2"),
    [s("postal_code"), s("city")].filter(Boolean).join(" "),
    [s("state"), s("country")].filter(Boolean).join(" "),
  ].filter(Boolean);
}
