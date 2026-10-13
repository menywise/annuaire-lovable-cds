import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { check } from "@/lib/check";

/**
 * CDS — Kit de démarrage (lot 13 a) : présence des secrets d'environnement, pour l'écran
 * Démarrage. Ne renvoie jamais un secret, seulement s'il est réglé.
 */
export const starterEnvironment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const isAdmin = check(
      await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      { contexte: "has_role" },
    );
    if (!isAdmin) throw new Error("Réservé aux administrateurs.");
    const { stripeMode, stripeWebhookSecret } = await import("@/lib/stripe.server");
    return {
      emailService: Boolean(process.env["LOVABLE_API_KEY"]),
      cronSecret: Boolean(process.env["LOVABLE_CRON_SECRET"]),
      stripe: stripeMode(),
      stripeWebhook: Boolean(stripeWebhookSecret()),
    };
  });
