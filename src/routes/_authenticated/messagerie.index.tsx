import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageShell } from "@/components/cds/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { seo } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/messagerie/")({
  head: () =>
    seo({
      title: "Ma messagerie",
      description: "Vos échanges privés avec les autres membres de la communauté.",
      path: "/messagerie",
      noindex: true,
    }),
  component: InboxPage,
});

type Row = {
  id: string;
  otherId: string;
  otherName: string;
  lastMessageAt: string;
  preview: string;
  unread: boolean;
};

function InboxPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!user) return;
    let active = true;

    (async () => {
      const { data: conversations } = await supabase
        .from("conversations")
        .select("id, user_a, user_b, last_message_at")
        .order("last_message_at", { ascending: false });

      const list = conversations ?? [];
      const otherIds = list.map((c) => (c.user_a === user.id ? c.user_b : c.user_a));

      const [{ data: profiles }, { data: messages }] = await Promise.all([
        otherIds.length
          ? supabase.from("member_profiles").select("user_id, display_name").in("user_id", otherIds)
          : Promise.resolve({ data: [] as { user_id: string; display_name: string }[] }),
        list.length
          ? supabase
              .from("messages")
              .select("id, conversation_id, sender_id, content, read_at, created_at")
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as never[] }),
      ]);

      if (!active) return;
      setRows(
        list.map((conversation) => {
          const otherId = conversation.user_a === user.id ? conversation.user_b : conversation.user_a;
          const last = (messages ?? []).find((m) => m.conversation_id === conversation.id);
          return {
            id: conversation.id,
            otherId,
            otherName:
              (profiles ?? []).find((p) => p.user_id === otherId)?.display_name ?? "Membre",
            lastMessageAt: conversation.last_message_at,
            preview: last?.content?.slice(0, 90) ?? "Conversation ouverte",
            unread: Boolean(last && last.sender_id !== user.id && !last.read_at),
          };
        }),
      );
    })();

    return () => {
      active = false;
    };
  }, [user]);

  return (
    <PageShell>
      <div className="mx-auto max-w-[820px]">
        <h1 className="text-2xl font-bold text-foreground">Ma messagerie</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Vos échanges privés, au calme. Personne d'autre que votre interlocuteur n'y a accès.
        </p>

        {rows === null ? (
          <p className="mt-8 text-sm text-muted-foreground">Chargement de vos conversations…</p>
        ) : rows.length === 0 ? (
          <p className="mt-8 rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            Aucune conversation.{" "}
            <Link to="/membres" title="Parcourir l'annuaire des membres" className="text-primary-text hover:underline">
              Parcourez l'annuaire
            </Link>{" "}
            pour en démarrer une.
          </p>
        ) : (
          <ul className="mt-6 space-y-2">
            {rows.map((row) => (
              <li key={row.id}>
                <Link
                  to="/messagerie/$conversationId"
                  params={{ conversationId: row.id }}
                  title={`Ouvrir la conversation avec ${row.otherName}`}
                  className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold text-foreground">
                    {row.otherName.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">{row.otherName}</span>
                    <span className="block truncate text-xs text-muted-foreground">{row.preview}</span>
                  </span>
                  {row.unread ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                      Nouveau
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
