/**
 * Boutique : la page de paiement Stripe, donc la réserve de stock, expire après 30 minutes.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BOUTIQUE_SESSION_SECONDES, createCheckoutSession } from "../../src/lib/stripe.server.ts";

const entree = {
  paymentId: "00000000-0000-0000-0000-000000000001",
  lines: [{ name: "Carnet", unitAmount: 1000, quantity: 1 }],
  currency: "eur",
  email: null,
  successUrl: "https://site.exemple/mes-achats",
  cancelUrl: "https://site.exemple/boutique/panier",
};

async function corpsEnvoye(extra: { expiresInSeconds?: number }) {
  const original = globalThis.fetch;
  let corps = "";
  globalThis.fetch = (async (_url: unknown, init?: { body?: unknown }) => {
    corps = String(init?.body ?? "");
    return new Response(JSON.stringify({ id: "cs_1", url: "https://checkout.stripe.com/x" }));
  }) as typeof fetch;
  try {
    await createCheckoutSession({ ...entree, ...extra });
  } finally {
    globalThis.fetch = original;
  }
  return new URLSearchParams(corps);
}

test("30 minutes, avec la marge exigée par Stripe (30 minutes au moins, 24 heures au plus)", () => {
  assert.ok(BOUTIQUE_SESSION_SECONDES >= 30 * 60);
  assert.ok(BOUTIQUE_SESSION_SECONDES <= 32 * 60);
});

test("la session de la boutique porte expires_at", async () => {
  const avant = Math.floor(Date.now() / 1000);
  const params = await corpsEnvoye({ expiresInSeconds: BOUTIQUE_SESSION_SECONDES });
  const expire = Number(params.get("expires_at"));
  assert.ok(expire >= avant + BOUTIQUE_SESSION_SECONDES);
  assert.ok(expire <= Math.floor(Date.now() / 1000) + BOUTIQUE_SESSION_SECONDES);
});

test("sans durée demandée, rien n'est envoyé (formations : durée Stripe inchangée)", async () => {
  const params = await corpsEnvoye({});
  assert.equal(params.get("expires_at"), null);
});

test("la commande de la boutique demande bien cette durée", () => {
  const texte = readFileSync(
    join(import.meta.dirname, "..", "..", "src", "lib", "shop.functions.ts"),
    "utf8",
  );
  assert.match(texte, /expiresInSeconds: BOUTIQUE_SESSION_SECONDES/);
});

test("le panier annonce la réserve de 30 minutes", () => {
  const texte = readFileSync(
    join(import.meta.dirname, "..", "..", "src", "routes", "boutique.panier.tsx"),
    "utf8",
  );
  assert.match(texte, /restent réservés 30 minutes/);
  assert.equal(BOUTIQUE_SESSION_SECONDES - 60, 30 * 60);
});
