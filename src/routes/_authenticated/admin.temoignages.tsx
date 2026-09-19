import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/temoignages")({
  head: () =>
    seo({
      title: "Administration — Témoignages",
      description: "Valider, mettre en avant ou retirer les témoignages reçus.",
      path: "/admin/temoignages",
      noindex: true,
    }),
  component: AdminTestimonialsPage,
});

type Testimonial = {
  id: string;
  author_name: string;
  role_title: string;
  company: string;
  content: string;
  outcome: string;
  approved: boolean;
  featured: boolean;
  created_at: string;
};

function AdminTestimonialsPage() {
  const [items, setItems] = useState<Testimonial[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("testimonials")
      .select(
        "id, author_name, role_title, company, content, outcome, approved, featured, created_at",
      )
      .order("created_at", { ascending: false });
    setItems(data ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(id: string, changes: Partial<Testimonial>) {
    const { error } = await supabase.from("testimonials").update(changes).eq("id", id);
    if (error) toast.error("Modification non enregistrée.");
    else {
      toast.success("Témoignage mis à jour.");
      void load();
    }
  }

  async function remove(id: string) {
    const { error } = await supabase.from("testimonials").delete().eq("id", id);
    if (error) toast.error("Suppression impossible.");
    else {
      toast.success("Témoignage supprimé.");
      void load();
    }
  }

  return (
    <AdminShell
      title="Témoignages"
      intro="Rien n'est publié sans votre relecture : validez, mettez en avant, ou écartez."
    >
      {items === null ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun témoignage reçu pour l'instant.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">{item.author_name}</p>
                <p className="text-xs text-muted-foreground">
                  {[item.role_title, item.company].filter(Boolean).join(" — ")}
                </p>
                <span
                  className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    item.approved ? "bg-muted text-success-text" : "bg-muted text-warning-text"
                  }`}
                >
                  {item.approved ? "Publié" : "En attente"}
                </span>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{item.content}</p>
              {item.outcome ? (
                <p className="mt-2 text-xs font-medium text-success-text">
                  Résultat : {item.outcome}
                </p>
              ) : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant={item.approved ? "outline" : "default"}
                  onClick={() => update(item.id, { approved: !item.approved })}
                  title={
                    item.approved
                      ? "Retirer ce témoignage de la page publique"
                      : "Publier ce témoignage"
                  }
                >
                  {item.approved ? "Dépublier" : "Publier"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => update(item.id, { featured: !item.featured })}
                  title={
                    item.featured ? "Retirer de la mise en avant" : "Mettre en avant ce témoignage"
                  }
                >
                  {item.featured ? "Ne plus mettre en avant" : "Mettre en avant"}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => remove(item.id)}
                  title="Supprimer définitivement ce témoignage"
                >
                  Supprimer
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminShell>
  );
}
