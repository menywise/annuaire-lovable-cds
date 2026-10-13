/**
 * Paiement : une session Stripe encaissée ouvre toujours l'accès.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  decidePaidEvent,
  isSessionAttached,
  paidSessionOf,
  type PaidSession,
  type PaymentRow,
} from "../../src/lib/paiement-rattachement.ts";

const ID = "00000000-0000-4000-8000-0000000000a1";
const session: PaidSession = {
  sessionId: "cs_test_1",
  intent: "pi_1",
  amount: 4900,
  currency: "eur",
  paymentId: ID,
};
const row = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: ID,
  status: "pending",
  amount_cents: 4900,
  currency: "eur",
  stripe_session_id: null,
  ...over,
});

test("rattachement vérifié : seule la session créée, relue en base, compte", () => {
  assert.equal(isSessionAttached({ stripe_session_id: "cs_test_1" }, "cs_test_1"), true);
  assert.equal(isSessionAttached({ stripe_session_id: null }, "cs_test_1"), false);
  assert.equal(isSessionAttached({ stripe_session_id: "cs_autre" }, "cs_test_1"), false);
  assert.equal(isSessionAttached(null, "cs_test_1"), false);
  assert.equal(isSessionAttached(undefined, "cs_test_1"), false);
  assert.equal(isSessionAttached({ stripe_session_id: "" }, ""), false);
});

test("lecture de la session : montant, devise en minuscules, identifiant des métadonnées", () => {
  assert.deepEqual(
    paidSessionOf({
      id: "cs_test_1",
      payment_intent: "pi_1",
      amount_total: 4900,
      currency: "EUR",
      metadata: { payment_id: ID.toUpperCase() },
    }),
    session,
  );
});

test("lecture de la session : valeurs absentes ou mal formées neutralisées", () => {
  assert.deepEqual(paidSessionOf({}), {
    sessionId: "",
    intent: "",
    amount: 0,
    currency: "",
    paymentId: "",
  });
  assert.equal(paidSessionOf({ metadata: { payment_id: "1 OR 1=1" } }).paymentId, "");
  assert.equal(paidSessionOf({ metadata: "payment_id" }).paymentId, "");
  assert.equal(paidSessionOf({ metadata: { payment_id: 42 } }).paymentId, "");
  assert.equal(paidSessionOf({ amount_total: 49.5 }).amount, 0);
  assert.equal(paidSessionOf({ amount_total: "abc" }).amount, 0);
  assert.equal(paidSessionOf({ payment_intent: { id: "pi_1" } }).intent, "");
});

test("événement renvoyé par Stripe : paiement déjà enregistré, rien à refaire", () => {
  const known = row({ status: "paid", stripe_session_id: "cs_test_1" });
  assert.deepEqual(decidePaidEvent(session, known, null), { action: "already_applied" });
  assert.deepEqual(decidePaidEvent(session, { ...known, status: "refunded" }, null), {
    action: "already_applied",
  });
});

test("session connue mais montant ou devise différents : refus, jamais de rattachement", () => {
  const known = row({ stripe_session_id: "cs_test_1" });
  for (const bad of [{ amount_cents: 100 }, { currency: "usd" }]) {
    const d = decidePaidEvent(session, { ...known, ...bad }, row());
    assert.equal(d.action, "reject");
    assert.match(d.action === "reject" ? d.reason : "", /montant ou devise/);
  }
});

test("session inconnue : paiement retrouvé par metadata.payment_id", () => {
  for (const status of ["pending", "expired", "failed"]) {
    assert.deepEqual(decidePaidEvent(session, null, row({ status })), {
      action: "attach",
      paymentId: ID,
    });
  }
  // Devise stockée ou identifiant en majuscules : même paiement.
  assert.equal(decidePaidEvent(session, null, row({ currency: "EUR" })).action, "attach");
  assert.equal(decidePaidEvent(session, null, row({ id: ID.toUpperCase() })).action, "attach");
});

test("session inconnue : mêmes contrôles de montant et de devise", () => {
  assert.equal(decidePaidEvent(session, null, row({ amount_cents: 4899 })).action, "reject");
  assert.equal(decidePaidEvent(session, null, row({ currency: "usd" })).action, "reject");
  assert.equal(decidePaidEvent({ ...session, amount: 0 }, null, row()).action, "reject");
});

test("session inconnue : refus quand le paiement ne peut pas être celui de la session", () => {
  const reason = (d: ReturnType<typeof decidePaidEvent>) => (d.action === "reject" ? d.reason : "");
  assert.match(reason(decidePaidEvent({ ...session, paymentId: "" }, null, null)), /sans metadata/);
  assert.match(reason(decidePaidEvent(session, null, null)), /introuvable/);
  // Ligne lue qui n'est pas celle des métadonnées.
  const other = row({ id: "00000000-0000-4000-8000-0000000000b2" });
  assert.match(reason(decidePaidEvent(session, null, other)), /introuvable/);
  assert.match(
    reason(decidePaidEvent(session, null, row({ stripe_session_id: "cs_autre" }))),
    /autre session/,
  );
  for (const status of ["paid", "refunded"]) {
    assert.match(reason(decidePaidEvent(session, null, row({ status }))), /état/);
  }
  assert.match(reason(decidePaidEvent({ ...session, sessionId: "" }, null, row())), /identifiant/);
});

test("aucune décision ne laisse un paiement encaissé sans suite", () => {
  const actions = new Set(["already_applied", "attach", "reject"]);
  for (const bySession of [null, row({ stripe_session_id: "cs_test_1" })]) {
    for (const byMetadata of [null, row(), row({ status: "paid" })]) {
      assert.ok(actions.has(decidePaidEvent(session, bySession, byMetadata).action));
    }
  }
});

// Garde-fous sur le câblage : la logique pure ne sert à rien si le serveur ne la suit pas.
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("départ vers Stripe : rattachement vérifié, session expirée sinon", () => {
  for (const file of ["src/lib/payments.functions.ts", "src/lib/shop.functions.ts"]) {
    const src = read(file);
    const attach = src.indexOf('rpc("payment_attach_session"');
    const check = src.indexOf("isSessionAttached(attached, session.id)", attach);
    const expire = src.indexOf("expireCheckoutSession(session.id)", check);
    const url = src.indexOf("return { url: session.url }", expire);
    assert.ok(attach > 0 && check > attach && expire > check && url > expire, file);
    // L'erreur du rattachement est lue, jamais ignorée.
    assert.match(src, /error: attachError \} = await supabaseAdmin\.rpc\("payment_attach_session"/);
  }
});

test("webhook : un événement payé non appliqué est journalisé et répond 500", () => {
  const src = read("src/routes/api.stripe-webhook.ts");
  assert.match(src, /console\.error\(\s*`[^`]*\$\{session\.sessionId\}/);
  assert.match(src, /json\(\{ error: "Paiement non appliqué" \}, 500\)/);
  assert.doesNotMatch(src, /applied: data === true/);
  assert.match(src, /decidePaidEvent\(session, bySession\.data, byMetadata\)/);
});
