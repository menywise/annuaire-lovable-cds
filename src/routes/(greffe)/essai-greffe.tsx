import { createFileRoute } from "@tanstack/react-router";
import { ESSAI_MISE_A_NIVEAU } from "@/lib/essai-mise-a-niveau";

/** Essai : page de greffe dans un dossier de groupe, adresse publique /essai-greffe (à retirer). */
export const Route = createFileRoute("/(greffe)/essai-greffe")({
  head: () => ({ meta: [{ title: "Essai de greffe" }, { name: "robots", content: "noindex" }] }),
  component: () => (
    <main className="mx-auto max-w-[760px] px-6 py-10">
      <h1 className="text-2xl font-bold text-foreground">Essai de greffe</h1>
      <p className="mt-2 text-sm text-muted-foreground">Témoin du socle : {ESSAI_MISE_A_NIVEAU}</p>
    </main>
  ),
});
