import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageShell } from "@/components/cds/SiteHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";
import { requireFeature } from "@/config/features";

export const Route = createFileRoute("/_authenticated/messagerie/$conversationId")({
  beforeLoad: () => requireFeature("messaging"),
  head: () =>
    seo({
      title: "Conversation",
      description: "Échange privé entre membres de la communauté.",
      path: "/messagerie",
      noindex: true,
    }),
  component: ConversationPage,
});

type Message = {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
};

function ConversationPage() {
  const { conversationId } = Route.useParams();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [otherName, setOtherName] = useState("Membre");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, user_a, user_b")
      .eq("id", conversationId)
      .maybeSingle();

    if (conversation) {
      const otherId = conversation.user_a === user.id ? conversation.user_b : conversation.user_a;
      const { data: profile } = await supabase
        .from("member_profiles")
        .select("display_name")
        .eq("user_id", otherId)
        .maybeSingle();
      if (profile?.display_name) setOtherName(profile.display_name);
    }

    const { data } = await supabase
      .from("messages")
      .select("id, sender_id, content, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);

    await supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .neq("sender_id", user.id)
      .is("read_at", null);
  }, [conversationId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const form = e.currentTarget;
    const content = String(new FormData(form).get("content") ?? "").trim();
    if (!content) return;
    setBusy(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content,
    });
    setBusy(false);
    if (error) {
      toast.error("Message non envoyé.", { description: "Réessayez dans un instant." });
      return;
    }
    form.reset();
    await load();
  }

  return (
    <PageShell>
      <div className="mx-auto max-w-[760px]">
        <Link
          to="/messagerie"
          title="Revenir à toutes mes conversations"
          className="text-xs font-medium text-primary-text hover:underline"
        >
          ← Ma messagerie
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-foreground">{otherName}</h1>

        {messages === null ? (
          <p className="mt-6 text-sm text-muted-foreground">Chargement de la conversation…</p>
        ) : messages.length === 0 ? (
          <p className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucun message. Lancez-vous : une phrase claire suffit.
          </p>
        ) : (
          <ul className="mt-6 space-y-3">
            {messages.map((message) => {
              const mine = message.sender_id === user?.id;
              return (
                <li
                  key={message.id}
                  className={`max-w-[85%] rounded-xl border p-3 text-sm ${
                    mine
                      ? "ml-auto border-primary bg-accent text-foreground"
                      : "border-border bg-card text-muted-foreground"
                  }`}
                >
                  <p className="whitespace-pre-line">{message.content}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {new Date(message.created_at).toLocaleString("fr-FR")}
                  </p>
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={send} className="mt-6 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="message">Votre message</Label>
            <Textarea
              id="message"
              name="content"
              rows={3}
              required
              placeholder="Écrivez votre message…"
            />
          </div>
          <Button type="submit" disabled={busy} title="Envoyer votre message">
            {busy ? "Envoi…" : "Envoyer"}
          </Button>
        </form>
      </div>
    </PageShell>
  );
}
