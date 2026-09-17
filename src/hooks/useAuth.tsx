import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { session, user: (session?.user ?? null) as User | null, loading };
}

/** Crée le profil si besoin et renvoie le rôle ("admin" ou "user"). */
export async function bootstrapCurrentUser(fullName?: string) {
  const { data, error } = await supabase.rpc("bootstrap_current_user", {
    _full_name: fullName ?? null,
  });
  if (error) throw error;
  return data as "admin" | "user";
}
