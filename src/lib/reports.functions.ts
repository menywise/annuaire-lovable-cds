import { createServerFn } from "@tanstack/react-start";
import { publicClient } from "@/lib/supabase-public";
import { check } from "@/lib/check";

/**
 * Page « Le site s'améliore grâce à vous » : signalements suivis d'une action et d'une réponse
 * publique de l'administrateur (report_improvements). Ni auteur, ni texte du signalement.
 */
export const listImprovements = createServerFn({ method: "GET" }).handler(async () => {
  const data = check(await publicClient().rpc("report_improvements", { _limit: 100 }), {
    contexte: "report_improvements",
  });
  return data ?? [];
});
