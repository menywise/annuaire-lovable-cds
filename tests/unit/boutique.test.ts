import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addToCart,
  cartTotals,
  formatAddress,
  normalizeCart,
  normalizeShopSettings,
  parseCountries,
  setCartQuantity,
} from "../../src/lib/shop.ts";

const A = "00000000-0000-0000-0000-0000000000b1";
const B = "00000000-0000-0000-0000-0000000000b2";

test("panier relu : lignes invalides écartées, doublons fusionnés, bornes appliquées", () => {
  assert.deepEqual(normalizeCart("pas un tableau"), []);
  assert.deepEqual(
    normalizeCart([
      { productId: A, quantity: 2 },
      { productId: "pas-un-uuid", quantity: 1 },
      { productId: B, quantity: 0 },
      { productId: A, quantity: 9 },
      null,
    ]),
    [{ productId: A, quantity: 10 }],
  );
  const many = Array.from({ length: 30 }, (_, i) => ({
    productId: `00000000-0000-0000-0000-${String(i).padStart(12, "0")}`,
    quantity: 1,
  }));
  assert.equal(normalizeCart(many).length, 20);
});

test("un fichier numérique ne s'ajoute qu'une fois", () => {
  let cart = addToCart([], B, "pdf");
  cart = addToCart(cart, B, "pdf");
  assert.deepEqual(cart, [{ productId: B, quantity: 1 }]);
  cart = addToCart(cart, A, "physique", 3);
  assert.deepEqual(setCartQuantity(cart, A, 0), [{ productId: B, quantity: 1 }]);
  assert.equal(setCartQuantity(cart, A, 50).find((l) => l.productId === A)?.quantity, 10);
});

test("totaux : même règle de livraison que la base", () => {
  const settings = normalizeShopSettings({
    shipping_cents: 590,
    free_shipping_from_cents: 5000,
    countries: ["FR"],
  });
  const mug = { price_cents: 1500, quantity: 2, kind: "physique" };
  const pdf = { price_cents: 900, quantity: 5, kind: "pdf" };
  assert.deepEqual(cartTotals([mug], settings), {
    subtotal: 3000,
    shipping: 590,
    total: 3590,
    physical: true,
    digital: false,
  });
  // PDF compté une fois ; fichiers seuls : pas de livraison.
  assert.equal(cartTotals([pdf], settings).total, 900);
  assert.equal(cartTotals([pdf], settings).shipping, 0);
  // 3 × 15 € + 9 € = 54 € : livraison offerte dès 50 €.
  assert.equal(cartTotals([{ ...mug, quantity: 3 }, pdf], settings).shipping, 0);
});

test("réglages : valeurs hors bornes ramenées, pays nettoyés", () => {
  assert.deepEqual(normalizeShopSettings(null), {
    shipping_cents: 0,
    free_shipping_from_cents: 0,
    countries: ["FR"],
  });
  assert.deepEqual(
    normalizeShopSettings({ shipping_cents: -5, free_shipping_from_cents: 1.5, countries: "FR" }),
    { shipping_cents: 0, free_shipping_from_cents: 0, countries: ["FR"] },
  );
  assert.deepEqual(parseCountries(" be, fr ;ch  FRA x"), ["BE", "CH", "FR"]);
});

test("adresse de livraison en lignes lisibles", () => {
  assert.deepEqual(
    formatAddress({ line1: "1 rue de la Paix", postal_code: "75002", city: "Paris", country: "FR" }),
    ["1 rue de la Paix", "75002 Paris", "FR"],
  );
  assert.deepEqual(formatAddress("x"), []);
});
