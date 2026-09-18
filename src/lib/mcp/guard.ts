import type { ToolContext } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "./supabase";

/** Vérifie que l'appelant est authentifié et administrateur du site. */
export async function requireAdmin(ctx: ToolContext) {
  if (!ctx.isAuthenticated()) throw new Error("Authentification requise.");
  const supabase = supabaseForUser(ctx);
  const { data, error } = await supabase.rpc("has_role", {
    _user_id: ctx.getUserId() as string,
    _role: "admin",
  });
  if (error) throw new Error(`Vérification du rôle impossible : ${error.message}`);
  if (!data) throw new Error("Accès réservé aux comptes administrateurs.");
  return supabase;
}
