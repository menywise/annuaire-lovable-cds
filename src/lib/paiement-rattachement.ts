/**
 * CDS — Module D « Paiement » : lien entre une session Stripe Checkout et sa ligne `payments`.
 * Fonctions pures (aucun accès à la base ni à Stripe) : testées dans
 * tests/unit/paiement-rattachement.test.ts.
 *
 * Règle : un paiement encaissé ouvre toujours l'accès. Si la session n'a pas pu être rattachée
 * au départ, le client ne part pas payer ; si un événement payé arrive pour une session inconnue,
 * le paiement est retrouvé par `metadata.payment_id` (posé par createCheckoutSession).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** États depuis lesquels un paiement peut encore passer à « payé » (comme payment_mark_paid). */
const PAYABLE = ["pending", "expired", "failed"];

const str = (v: unknown) => (typeof v === "string" ? v : "");
const asObject = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

/** Ce que le serveur relit d'une ligne `payments`. */
export type PaymentRow = {
  id: string;
  status: string;
  amount_cents: number;
  currency: string;
  stripe_session_id: string | null;
};

/** Ce que l'événement Stripe dit de la session payée. */
export type PaidSession = {
  sessionId: string;
  intent: string;
  amount: number;
  currency: string;
  /** `metadata.payment_id`, vide s'il manque ou n'a pas la forme d'un identifiant. */
  paymentId: string;
};

/** Lit la session d'un événement `checkout.session.*` sans rien supposer de sa forme. */
export function paidSessionOf(session: Record<string, unknown>): PaidSession {
  const paymentId = str(asObject(session["metadata"])["payment_id"]);
  const amount = Number(session["amount_total"] ?? 0);
  return {
    sessionId: str(session["id"]),
    intent: str(session["payment_intent"]),
    amount: Number.isSafeInteger(amount) ? amount : 0,
    currency: str(session["currency"]).toLowerCase(),
    paymentId: UUID.test(paymentId) ? paymentId.toLowerCase() : "",
  };
}

/**
 * Après payment_attach_session : la ligne relue porte-t-elle bien la session créée ?
 * Faux si la lecture a échoué, si la ligne manque ou si elle porte une autre session.
 */
export function isSessionAttached(
  row: { stripe_session_id: string | null } | null | undefined,
  sessionId: string,
) {
  return Boolean(sessionId) && row?.stripe_session_id === sessionId;
}

const sameMoney = (row: PaymentRow, session: PaidSession) =>
  row.amount_cents === session.amount && row.currency.toLowerCase() === session.currency;

export type PaidEventDecision =
  /** Événement renvoyé par Stripe : le paiement est déjà enregistré, rien à faire. */
  | { action: "already_applied" }
  /** Session inconnue, paiement retrouvé par ses métadonnées : rattacher puis confirmer. */
  | { action: "attach"; paymentId: string }
  /** Paiement encaissé mais impossible à appliquer : à journaliser, Stripe doit réessayer. */
  | { action: "reject"; reason: string };

/**
 * Décide quoi faire d'un événement payé que payment_mark_paid n'a pas appliqué.
 * `bySession` : ligne dont `stripe_session_id` est la session de l'événement, si elle existe.
 * `byMetadata` : ligne dont l'identifiant est `metadata.payment_id`, si elle existe.
 */
export function decidePaidEvent(
  session: PaidSession,
  bySession: PaymentRow | null,
  byMetadata: PaymentRow | null,
): PaidEventDecision {
  if (!session.sessionId) return { action: "reject", reason: "session sans identifiant" };

  if (bySession) {
    if (bySession.status === "paid" || bySession.status === "refunded") {
      return { action: "already_applied" };
    }
    if (!sameMoney(bySession, session)) {
      return { action: "reject", reason: "montant ou devise différents du paiement attendu" };
    }
    return { action: "reject", reason: `paiement à l'état « ${bySession.status} »` };
  }

  if (!session.paymentId) {
    return { action: "reject", reason: "session inconnue, sans metadata.payment_id" };
  }
  if (!byMetadata || byMetadata.id.toLowerCase() !== session.paymentId) {
    return { action: "reject", reason: "session inconnue, paiement des métadonnées introuvable" };
  }
  if (byMetadata.stripe_session_id) {
    return { action: "reject", reason: "paiement déjà rattaché à une autre session" };
  }
  if (!PAYABLE.includes(byMetadata.status)) {
    return { action: "reject", reason: `paiement à l'état « ${byMetadata.status} »` };
  }
  if (!sameMoney(byMetadata, session)) {
    return { action: "reject", reason: "montant ou devise différents du paiement attendu" };
  }
  return { action: "attach", paymentId: byMetadata.id };
}
