import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { RecordEditor } from "@/components/cds/RecordEditor";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { requireFeature } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";

/** Champs que l'auteur ou le propriétaire d'une fiche modifie ici. */
type Contenu = {
  name: string;
  excerpt: string;
  description: string;
  category_id: string | null;
  address: string;
  postal_code: string;
  city: string;
  phone: string;
  email: string;
  website: string;
};
type Fiche = Contenu & { id: string; slug: string; status: string };
type Categorie = { id: string; name: string };

const CHAMPS =
  "id, slug, status, name, excerpt, description, category_id, address, postal_code, city, phone, email, website";

/** Pour le membre, une fiche hors ligne non archivée attend la relecture de l'équipe. */
const ETAT: Record<string, string> = {
  published: "En ligne",
  draft: "En attente de validation",
  archived: "Archivée",
};

export const Route = createFileRoute("/_authenticated/mes-fiches")({
  beforeLoad: () => requireFeature("directory"),
  head: () =>
    seo({
      title: "Mes fiches",
      description: "Suivez l'état de vos fiches de l'annuaire et mettez leur contenu à jour.",
      path: "/mes-fiches",
      noindex: true,
    }),
  component: MesFichesPage,
});

function MesFichesPage() {
  const { user } = useAuth();
  const [fiches, setFiches] = useState<Fiche[] | null>(null);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [echec, setEchec] = useState(false);
  const [ouverte, setOuverte] = useState<string | null>(null);

  const charger = useCallback(async () => {
    if (!user) return;
    const [f, c] = await Promise.all([
      supabase
        .from("directory_listings")
        .select(CHAMPS)
        .or(`created_by.eq.${user.id},claimed_by.eq.${user.id}`)
        .order("created_at", { ascending: false }),
      supabase.from("directory_categories").select("id, name").order("position"),
    ]);
    setEchec(Boolean(f.error));
    if (f.error) return;
    setFiches(f.data ?? []);
    setCategories(c.data ?? []);
  }, [user]);

  useEffect(() => {
    void charger();
  }, [charger]);

  /**
   * N'envoie que les valeurs changées. La base renvoie en attente de validation une fiche en ligne
   * dont le contenu visible change : l'état relu après l'enregistrement dit ce qu'il en est.
   */
  async function enregistrer(fiche: Fiche, saisie: Record<string, unknown>) {
    const changements = Object.fromEntries(
      Object.entries(saisie).filter(([cle, valeur]) => valeur !== fiche[cle as keyof Contenu]),
    ) as Partial<Contenu>;
    if (Object.keys(changements).length === 0) {
      toast.success("Aucun changement à enregistrer.");
      setOuverte(null);
      return true;
    }
    const { data, error } = await supabase
      .from("directory_listings")
      .update(changements)
      .eq("id", fiche.id)
      .select("status")
      .single();
    if (error) {
      toast.error("Modification non enregistrée.", { description: "Réessayez dans un instant." });
      return false;
    }
    if (fiche.status === "published" && data.status !== "published") {
      toast.success("Modification enregistrée.", {
        description:
          "Votre fiche attend une validation : elle reparaît dans l'annuaire après relecture.",
      });
    } else {
      toast.success("Modification enregistrée.");
    }
    setOuverte(null);
    void charger();
    return true;
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[900px]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Mes fiches</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Tenez vos coordonnées à jour : c'est là que vos clients vous trouvent. Chaque
              modification d'une fiche en ligne est relue par l'équipe avant de reparaître.
            </p>
          </div>
          <Button asChild variant="outline" title="Ajouter une fiche à l'annuaire">
            <Link to="/annuaire/soumettre">Ajouter une fiche</Link>
          </Button>
        </div>

        {echec ? (
          <p
            role="alert"
            className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-foreground"
          >
            Le chargement de vos fiches a échoué. Rechargez la page dans un instant.
          </p>
        ) : fiches === null ? (
          <div className="mt-6 space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : fiches.length === 0 ? (
          <p className="mt-6 rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Votre première fiche se crée en quelques minutes avec le bouton « Ajouter une fiche ».
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {fiches.map((fiche) => (
              <li key={fiche.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-foreground">
                      {fiche.status === "published" ? (
                        <Link
                          to="/annuaire/$slug"
                          params={{ slug: fiche.slug }}
                          title={`Voir la fiche ${fiche.name}`}
                          className="hover:underline"
                        >
                          {fiche.name}
                        </Link>
                      ) : (
                        fiche.name
                      )}
                    </h2>
                    {fiche.city ? (
                      <p className="mt-1 text-xs text-muted-foreground">{fiche.city}</p>
                    ) : null}
                  </div>
                  <span
                    className={`rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium ${
                      fiche.status === "published"
                        ? "text-success-text"
                        : fiche.status === "draft"
                          ? "text-warning-text"
                          : "text-muted-foreground"
                    }`}
                  >
                    {ETAT[fiche.status] ?? fiche.status}
                  </span>
                </div>

                {fiche.status === "draft" ? (
                  <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
                    Cette fiche attend une validation. Elle paraît dans l'annuaire dès que l'équipe
                    l'a relue ; vous pouvez encore la corriger d'ici là.
                  </p>
                ) : null}

                {ouverte === fiche.id ? (
                  <div className="mt-4 border-t border-border pt-4">
                    {fiche.status === "published" ? (
                      <p className="mb-3 text-sm text-muted-foreground">
                        Cette fiche est en ligne. Une fois modifiée, elle quitte l'annuaire le temps
                        de sa relecture, puis reparaît après validation.
                      </p>
                    ) : null}
                    <RecordEditor
                      idPrefix={`fiche-${fiche.id}`}
                      submitLabel="Enregistrer ma fiche"
                      fields={[
                        {
                          key: "name",
                          label: "Nom de l'établissement",
                          type: "text",
                          required: true,
                        },
                        {
                          key: "category_id",
                          label: "Activité",
                          type: "select",
                          nullable: true,
                          options: categories.map((c) => ({ value: c.id, label: c.name })),
                        },
                        { key: "excerpt", label: "Résumé", type: "text", wide: true },
                        { key: "description", label: "Description", type: "textarea" },
                        { key: "address", label: "Adresse", type: "text", wide: true },
                        { key: "postal_code", label: "Code postal", type: "text" },
                        { key: "city", label: "Ville", type: "text" },
                        { key: "phone", label: "Téléphone", type: "text" },
                        { key: "email", label: "E-mail", type: "email" },
                        { key: "website", label: "Site web", type: "url" },
                      ]}
                      values={fiche}
                      onCancel={() => setOuverte(null)}
                      onSave={(saisie) => enregistrer(fiche, saisie)}
                    />
                  </div>
                ) : fiche.status !== "archived" ? (
                  <Button
                    className="mt-4"
                    size="sm"
                    variant="outline"
                    onClick={() => setOuverte(fiche.id)}
                    title={`Modifier le contenu de la fiche ${fiche.name}`}
                  >
                    Modifier ma fiche
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
