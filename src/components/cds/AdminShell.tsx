import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/cds/SiteHeader";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const adminNav = [
  { to: "/admin", label: "Paramètres", title: "Identité du site, mentions légales et hébergeur" },
  { to: "/admin/contenus", label: "Contenus", title: "Gérer la FAQ, les offres et les articles" },
  { to: "/admin/moderation", label: "Modération", title: "Valider les avis, commentaires et discussions" },
  { to: "/admin/abonnes", label: "Abonnés", title: "Consulter et exporter la liste d'abonnés" },
  { to: "/compte", label: "Messages", title: "Consulter les messages du formulaire de contact" },
] as const;

/** Vérifie le rôle administrateur et affiche la navigation de l'espace d'administration. */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
      if (!cancelled) setIsAdmin(Boolean(data));
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return isAdmin;
}

export function AdminShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  const isAdmin = useIsAdmin();

  if (isAdmin === false) {
    return (
      <PageShell>
        <Alert variant="destructive" className="mx-auto max-w-[640px]">
          <AlertTitle>Accès réservé</AlertTitle>
          <AlertDescription>
            Cet espace est réservé aux administrateurs.{" "}
            <Link to="/tableau-de-bord" title="Revenir à mon tableau de bord" className="underline">
              Revenir à mon tableau de bord
            </Link>
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[900px]">
        <p className="text-xs font-medium uppercase tracking-wide text-primary-text">Administration</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{intro}</p>

        <nav aria-label="Sections d'administration" className="mt-6 flex flex-wrap gap-2">
          {adminNav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              title={item.title}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              activeProps={{ className: "border-primary bg-accent text-foreground" }}
              activeOptions={{ exact: true }}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        {isAdmin === null ? (
          <div className="mt-8 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="mt-8">{children}</div>
        )}
      </div>
    </PageShell>
  );
}
