import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook Stripe (module D « Paiement ») : POST /api/stripe-webhook.
 * La signature est vérifiée AVANT tout traitement (STRIPE_WEBHOOK_SECRET).
 * Événements à cocher dans Stripe : checkout.session.completed,
 * checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
 * checkout.session.expired, charge.refunded.
 * Chaque traitement est idempotent en base : Stripe peut renvoyer un événement sans risque.
 * Un paiement encaissé qui n'a pas pu être appliqué est journalisé et répond 500 : Stripe réessaie.
 * Session inconnue : le paiement est retrouvé par `metadata.payment_id` (voir paiement-rattachement.ts).
 */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type StripeObject = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" ? v : "");
const asObject = (v: unknown): StripeObject =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as StripeObject) : {};

/**
 * Coordonnées relevées par Stripe pour une commande de la boutique : e-mail, nom et adresse
 * de livraison (`collected_information` dans les versions récentes de l'API, `shipping_details` avant).
 */
function customerOf(session: StripeObject) {
  const shipping = asObject(asObject(session["collected_information"])["shipping_details"]);
  const legacy = asObject(session["shipping_details"]);
  const details = Object.keys(shipping).length ? shipping : legacy;
  const customer = asObject(session["customer_details"]);
  const address = asObject(details["address"]);
  const clean = Object.fromEntries(
    ["line1", "line2", "postal_code", "city", "state", "country"]
      .map((k) => [k, str(address[k]).slice(0, 200)])
      .filter(([, v]) => v),
  );
  return {
    email: str(customer["email"]).slice(0, 320),
    name: str(details["name"] ?? customer["name"]).slice(0, 200),
    address: Object.keys(clean).length ? clean : null,
  };
}

export const Route = createFileRoute("/api/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { stripeWebhookSecret, verifyStripeSignature } = await import("@/lib/stripe.server");
        const secret = stripeWebhookSecret();
        if (!secret) return json({ error: "Webhook non configuré" }, 500);

        const header = request.headers.get("stripe-signature");
        if (!header) return json({ error: "Signature manquante" }, 400);
        const payload = await request.text();
        if (!(await verifyStripeSignature(payload, header, secret))) {
          return json({ error: "Signature invalide" }, 400);
        }

        let event: { type?: string; data?: { object?: StripeObject } };
        try {
          event = JSON.parse(payload);
        } catch {
          return json({ error: "Corps invalide" }, 400);
        }
        const obj = event.data?.object ?? {};
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { decidePaidEvent, paidSessionOf } = await import("@/lib/paiement-rattachement");

        switch (event.type) {
          case "checkout.session.completed":
          case "checkout.session.async_payment_succeeded": {
            // Paiement différé (virement, SEPA) : « completed » arrive non payé, on attend « succeeded ».
            if (str(obj["payment_status"]) !== "paid")
              return json({ received: true, pending: true });
            const session = paidSessionOf(obj);
            // Boutique : coordonnées de livraison (sans effet pour une formation).
            const customer = customerOf(obj);
            const confirm = async () => {
              await supabaseAdmin.rpc("shop_set_customer", {
                _session_id: session.sessionId,
                _email: customer.email,
                _name: customer.name,
                _address: customer.address,
              });
              return supabaseAdmin.rpc("payment_mark_paid", {
                _session_id: session.sessionId,
                _intent: session.intent,
                _amount: session.amount,
                _currency: session.currency,
              });
            };
            // Paiement encaissé mais non appliqué : trace, et code d'erreur pour que Stripe réessaie.
            const notApplied = (reason: string) => {
              console.error(
                `[stripe-webhook] paiement encaissé non appliqué, session ${session.sessionId} : ${reason}`,
              );
              return json({ error: "Paiement non appliqué" }, 500);
            };

            const first = await confirm();
            if (first.error) return notApplied("enregistrement impossible");
            if (first.data === true) return json({ received: true, applied: true });

            // Rien d'appliqué : événement déjà traité, ou session jamais rattachée au paiement.
            const columns = "id, status, amount_cents, currency, stripe_session_id";
            const bySession = await supabaseAdmin
              .from("payments")
              .select(columns)
              .eq("stripe_session_id", session.sessionId)
              .maybeSingle();
            if (bySession.error) return notApplied("lecture du paiement impossible");
            let byMetadata = null;
            if (!bySession.data && session.paymentId) {
              const found = await supabaseAdmin
                .from("payments")
                .select(columns)
                .eq("id", session.paymentId)
                .maybeSingle();
              if (found.error) return notApplied("lecture du paiement impossible");
              byMetadata = found.data;
            }
            const decision = decidePaidEvent(session, bySession.data, byMetadata);
            if (decision.action === "already_applied") {
              return json({ received: true, applied: false, already: true });
            }
            if (decision.action === "reject") return notApplied(decision.reason);

            // Session inconnue : rattachée au paiement des métadonnées, mêmes contrôles de montant
            // et de devise, puis confirmation habituelle.
            const attach = await supabaseAdmin
              .from("payments")
              .update({ stripe_session_id: session.sessionId })
              .eq("id", decision.paymentId)
              .is("stripe_session_id", null)
              .in("status", ["pending", "expired", "failed"])
              .eq("amount_cents", session.amount)
              .eq("currency", session.currency)
              .select("id");
            if (attach.error || !attach.data?.length) {
              return notApplied("rattachement par metadata.payment_id impossible");
            }
            const second = await confirm();
            if (second.error || second.data !== true) {
              return notApplied("confirmation refusée après rattachement");
            }
            console.warn(
              `[stripe-webhook] session ${session.sessionId} rattachée au paiement ${decision.paymentId} par ses métadonnées`,
            );
            return json({ received: true, applied: true, recovered: true });
          }
          case "checkout.session.async_payment_failed":
          case "checkout.session.expired": {
            const status = event.type === "checkout.session.expired" ? "expired" : "failed";
            const { error } = await supabaseAdmin.rpc("payment_mark_status", {
              _session_id: str(obj["id"]),
              _status: status,
            });
            if (error) return json({ error: "Enregistrement impossible" }, 500);
            return json({ received: true });
          }
          case "charge.refunded": {
            // Remboursement partiel : l'accès reste ouvert. Total : l'accès se ferme.
            if (obj["refunded"] !== true) return json({ received: true, partial: true });
            const { error } = await supabaseAdmin.rpc("payment_mark_refunded", {
              _intent: str(obj["payment_intent"]),
            });
            if (error) return json({ error: "Enregistrement impossible" }, 500);
            return json({ received: true });
          }
          default:
            return json({ received: true, ignored: true });
        }
      },
    },
  },
});
