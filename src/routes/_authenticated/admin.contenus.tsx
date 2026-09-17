import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminShell, useIsAdmin } from "@/components/cds/AdminShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/admin/contenus")({
  head: () =>
    seo({
      title: "Contenus",
      description: "Gestion de la FAQ, des offres tarifaires et des articles du blog.",
      path: "/admin/contenus",
      noindex: true,
    }),
  component: AdminContenusPage,
});

type Faq = {
  id: string;
  question: string;
  answer: string;
  category: string;
  position: number;
  published: boolean;
};

type Plan = {
  id: string;
  name: string;
  tagline: string;
  price_cents: number;
  currency: string;
  period: string;
  features: unknown;
  cta_label: string;
  highlighted: boolean;
  active: boolean;
  position: number;
};

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  published: boolean;
  published_at: string | null;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function AdminContenusPage() {
  const isAdmin = useIsAdmin();
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);

  const reload = useCallback(async () => {
    const [faqRes, planRes, postRes] = await Promise.all([
      supabase.from("faq_items").select("*").order("position"),
      supabase.from("pricing_plans").select("*").order("position"),
      supabase.from("blog_posts").select("*").order("created_at", { ascending: false }),
    ]);
    setFaqs((faqRes.data ?? []) as Faq[]);
    setPlans((planRes.data ?? []) as Plan[]);
    setPosts((postRes.data ?? []) as Post[]);
  }, []);

  useEffect(() => {
    if (isAdmin) void reload();
  }, [isAdmin, reload]);

  function notifyResult(error: unknown, message: string) {
    if (error) {
      toast.error("Enregistrement impossible.", { description: "Réessayez dans un instant." });
      return false;
    }
    toast.success(message);
    void reload();
    return true;
  }

  /* ---------------- FAQ ---------------- */
  async function addFaq(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const { error } = await supabase.from("faq_items").insert({
      question: String(data.get("question") ?? "").trim(),
      answer: String(data.get("answer") ?? "").trim(),
      category: String(data.get("category") ?? "Général").trim() || "Général",
      position: faqs.length + 1,
    });
    if (notifyResult(error, "Question ajoutée.")) form.reset();
  }

  async function toggleFaq(item: Faq) {
    const { error } = await supabase
      .from("faq_items")
      .update({ published: !item.published })
      .eq("id", item.id);
    notifyResult(error, item.published ? "Question masquée." : "Question publiée.");
  }

  async function deleteFaq(item: Faq) {
    const { error } = await supabase.from("faq_items").delete().eq("id", item.id);
    notifyResult(error, "Question supprimée.");
  }

  /* ---------------- Offres ---------------- */
  async function savePlan(plan: Plan, patch: Partial<Plan>) {
    const { error } = await supabase.from("pricing_plans").update(patch).eq("id", plan.id);
    notifyResult(error, "Offre mise à jour.");
  }

  /* ---------------- Articles ---------------- */
  async function addPost(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const { error } = await supabase.from("blog_posts").insert({
      title,
      slug: slugify(title),
      excerpt: String(data.get("excerpt") ?? "").trim(),
      content: String(data.get("content") ?? "").trim(),
      published: false,
    });
    if (notifyResult(error, "Article créé en brouillon.")) form.reset();
  }

  async function togglePost(post: Post) {
    const publishing = !post.published;
    const { error } = await supabase
      .from("blog_posts")
      .update({
        published: publishing,
        published_at: publishing ? (post.published_at ?? new Date().toISOString()) : post.published_at,
      })
      .eq("id", post.id);
    notifyResult(error, publishing ? "Article publié." : "Article repassé en brouillon.");
  }

  async function deletePost(post: Post) {
    const { error } = await supabase.from("blog_posts").delete().eq("id", post.id);
    notifyResult(error, "Article supprimé.");
  }

  return (
    <AdminShell
      title="Contenus"
      intro="Vos pages publiques se remplissent ici : questions fréquentes, offres et articles. Aucune ligne de code à toucher."
    >
      <Tabs defaultValue="faq">
        <TabsList>
          <TabsTrigger value="faq">FAQ</TabsTrigger>
          <TabsTrigger value="offres">Offres</TabsTrigger>
          <TabsTrigger value="articles">Articles</TabsTrigger>
        </TabsList>

        <TabsContent value="faq" className="space-y-4 pt-6">
          <form onSubmit={addFaq} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Ajouter une question</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="faq-question">Question</Label>
                <Input id="faq-question" name="question" required placeholder="Combien de temps pour démarrer ?" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="faq-category">Catégorie</Label>
                <Input id="faq-category" name="category" placeholder="Général" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="faq-answer">Réponse</Label>
              <Textarea id="faq-answer" name="answer" rows={3} required />
            </div>
            <Button type="submit" title="Ajouter cette question à la FAQ">Ajouter</Button>
          </form>

          {faqs.map((item) => (
            <div key={item.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{item.question}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{item.category}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={item.published}
                      onCheckedChange={() => toggleFaq(item)}
                      aria-label="Publier cette question"
                    />
                    {item.published ? "Publiée" : "Masquée"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => deleteFaq(item)}
                    title="Supprimer cette question"
                  >
                    Supprimer
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{item.answer}</p>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="offres" className="space-y-4 pt-6">
          {plans.map((plan) => (
            <div key={plan.id} className="space-y-3 rounded-xl border border-border bg-card p-5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`plan-name-${plan.id}`}>Nom de l'offre</Label>
                  <Input
                    id={`plan-name-${plan.id}`}
                    defaultValue={plan.name}
                    onBlur={(e) => e.target.value !== plan.name && savePlan(plan, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`plan-price-${plan.id}`}>Prix en centimes</Label>
                  <Input
                    id={`plan-price-${plan.id}`}
                    type="number"
                    defaultValue={plan.price_cents}
                    onBlur={(e) =>
                      Number(e.target.value) !== plan.price_cents &&
                      savePlan(plan, { price_cents: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`plan-tagline-${plan.id}`}>Accroche</Label>
                <Input
                  id={`plan-tagline-${plan.id}`}
                  defaultValue={plan.tagline}
                  onBlur={(e) => e.target.value !== plan.tagline && savePlan(plan, { tagline: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap items-center gap-5 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <Switch
                    checked={plan.active}
                    onCheckedChange={(v) => savePlan(plan, { active: v })}
                    aria-label="Afficher cette offre"
                  />
                  {plan.active ? "Affichée" : "Masquée"}
                </span>
                <span className="flex items-center gap-2">
                  <Switch
                    checked={plan.highlighted}
                    onCheckedChange={(v) => savePlan(plan, { highlighted: v })}
                    aria-label="Mettre cette offre en avant"
                  />
                  Mise en avant
                </span>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="articles" className="space-y-4 pt-6">
          <form onSubmit={addPost} className="space-y-3 rounded-xl border border-border bg-card p-5">
            <h2 className="text-base font-semibold text-foreground">Écrire un article</h2>
            <div className="space-y-1.5">
              <Label htmlFor="post-title">Titre</Label>
              <Input id="post-title" name="title" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-excerpt">Résumé</Label>
              <Textarea id="post-excerpt" name="excerpt" rows={2} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="post-content">Contenu</Label>
              <Textarea id="post-content" name="content" rows={8} required />
            </div>
            <Button type="submit" title="Créer cet article en brouillon">Créer le brouillon</Button>
          </form>

          {posts.map((post) => (
            <div key={post.id} className="rounded-xl border border-border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-foreground">{post.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">/blog/{post.slug}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Switch
                      checked={post.published}
                      onCheckedChange={() => togglePost(post)}
                      aria-label="Publier cet article"
                    />
                    {post.published ? "Publié" : "Brouillon"}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => deletePost(post)} title="Supprimer cet article">
                    Supprimer
                  </Button>
                </div>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{post.excerpt}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}
