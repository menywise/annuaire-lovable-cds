import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook Stripe (module D « Paiement ») : POST /api/stripe-webhook.
 * La signature est vérifiée AVANT tout traitement (STRIPE_WEBHOOK_SECRET).
 * Événements à cocher dans Stripe : checkout.session.completed,
 * checkout.session.async_payment_succeeded, checkout.session.async_payment_failed,
 * checkout.session.expired, charge.refunded.
 * Chaque traitement est idempotent en base : Stripe peut renvoyer un événement sans risque.
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

        switch (event.type) {
          case "checkout.session.completed":
          case "checkout.session.async_payment_succeeded": {
            // Paiement différé (virement, SEPA) : « completed » arrive non payé, on attend « succeeded ».
            if (str(obj["payment_status"]) !== "paid")
              return json({ received: true, pending: true });
            // Boutique : coordonnées de livraison (sans effet pour une formation).
            const customer = customerOf(obj);
            await supabaseAdmin.rpc("shop_set_customer", {
              _session_id: str(obj["id"]),
              _email: customer.email,
              _name: customer.name,
              _address: customer.address,
            });
            const { data, error } = await supabaseAdmin.rpc("payment_mark_paid", {
              _session_id: str(obj["id"]),
              _intent: str(obj["payment_intent"]),
              _amount: Number(obj["amount_total"] ?? 0),
              _currency: str(obj["currency"]),
            });
            // Erreur de base : Stripe réessaiera.
            if (error) return json({ error: "Enregistrement impossible" }, 500);
            return json({ received: true, applied: data === true });
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
