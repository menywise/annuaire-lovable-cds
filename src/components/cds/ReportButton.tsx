import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isFeatureOn } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  REPORT_IMPROVEMENT_REASONS,
  REPORT_REASONS,
  reportErrorMessage,
  type ReportContentType,
} from "@/lib/reports";

const TRIGGER =
  "inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground";
const FIELD = "mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";
/** Délai minimal avant l'envoi : un humain lit la fenêtre, un robot envoie aussitôt. */
const DELAI_MS = 3000;

const improvements = REPORT_REASONS.filter((r) =>
  (REPORT_IMPROVEMENT_REASONS as readonly string[]).includes(r.value),
);
const moderation = REPORT_REASONS.filter(
  (r) => !(REPORT_IMPROVEMENT_REASONS as readonly string[]).includes(r.value),
);

/**
 * Bouton discret « Signaler » + fenêtre de signalement, ouvert aux visiteurs en 1.7.0.
 * Visiteur ou membre : erreur, oubli, correction proposée ou motif
 * de modération. Champ piège et délai de 3 secondes dans le navigateur ; bornes et plafonds en base
 * (report_submit). L'envoi rend un code de suivi, lisible sur /signalement.
 * Invisible si le module « Signalements » est éteint ou sur son propre contenu.
 */
export function ReportButton({
  contentType,
  contentId = null,
  authorId = null,
  label = "Signaler",
  className = "",
}: {
  contentType: ReportContentType;
  contentId?: string | null;
  /** Auteur du contenu : le bouton est masqué pour lui. */
  authorId?: string | null;
  label?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const pathname = useLocation({ select: (l) => l.pathname });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [proposed, setProposed] = useState("");
  const [email, setEmail] = useState("");
  const [trap, setTrap] = useState("");
  const [ready, setReady] = useState(false);
  const [sending, setSending] = useState(false);
  const [failure, setFailure] = useState("");
  const [code, setCode] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!isFeatureOn("reports")) return null;
  if (user && authorId && user.id === authorId) return null;

  const show = (value: boolean) => {
    setOpen(value);
    if (timer.current) clearTimeout(timer.current);
    if (value) {
      setReady(false);
      timer.current = setTimeout(() => setReady(true), DELAI_MS);
      return;
    }
    setReason("");
    setDetails("");
    setProposed("");
    setEmail("");
    setTrap("");
    setFailure("");
    setCode("");
  };

  const isCorrection = reason === "correction";
  const filled = (details.trim() + proposed.trim()).length >= (user ? 0 : 5);
  const canSend = ready && !!reason && filled && (!isCorrection || proposed.trim().length > 0);

  async function send() {
    if (!canSend) return;
    setSending(true);
    setFailure("");
    const text = details.trim().slice(0, 2000);
    const mail = user ? "" : email.trim();
    const { data, error } = await supabase.rpc("report_submit", {
      _content_type: contentType,
      _reason: reason,
      _reported_url: pathname.slice(0, 500),
      ...(text ? { _details: text } : {}),
      ...(contentId ? { _content_id: contentId } : {}),
      ...(isCorrection ? { _proposed_value: proposed.trim().slice(0, 2000) } : {}),
      ...(mail ? { _contact_email: mail } : {}),
      ...(trap ? { _trap: trap } : {}),
    });
    setSending(false);
    if (error) {
      setFailure(reportErrorMessage(error));
      return;
    }
    setCode(String(data ?? ""));
  }

  return (
    <>
      <button
        type="button"
        onClick={() => show(true)}
        title="Signaler une erreur ou proposer une correction à l'équipe"
        className={`${TRIGGER} ${className}`}
      >
        <Flag className="size-3.5" aria-hidden="true" />
        {label}
      </button>
      <Dialog open={open} onOpenChange={show}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Améliorer cette page</DialogTitle>
            <DialogDescription>
              Une erreur, un oubli, une correction à proposer : chaque retour est lu par l'équipe.
              Votre signalement reste confidentiel.
            </DialogDescription>
          </DialogHeader>
          {code ? (
            <div className="space-y-4">
              <p className="text-sm text-foreground">
                Merci ! Votre signalement est bien arrivé. Gardez ce code pour suivre son traitement
                :
              </p>
              <p className="rounded-md bg-muted px-3 py-2 text-center font-mono text-lg font-semibold tracking-widest text-foreground">
                {code}
              </p>
              <p className="text-sm text-muted-foreground">
                Suivez-le sur la page{" "}
                <Link
                  to="/signalement"
                  search={{ code }}
                  className="font-medium text-foreground underline"
                >
                  Suivre mon signalement
                </Link>
                . Les corrections apportées grâce à vous sont réunies sur{" "}
                <Link to="/ameliorations" className="font-medium text-foreground underline">
                  Le site s'améliore grâce à vous
                </Link>
                .
              </p>
              <Button onClick={() => show(false)} title="Fermer la fenêtre">
                Je ferme
              </Button>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Champ piège : invisible, jamais rempli par un humain. */}
              <div aria-hidden="true" className="absolute -left-[9999px] size-px overflow-hidden">
                <label htmlFor="report-company">Société</label>
                <input
                  id="report-company"
                  name="company"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={trap}
                  onChange={(e) => setTrap(e.target.value)}
                />
              </div>
              <fieldset>
                <legend className="text-sm font-semibold text-foreground">
                  Que voulez-vous nous signaler ?
                </legend>
                <div className="mt-3 space-y-2">
                  {improvements.map((r) => (
                    <ReasonChoice key={r.value} r={r} reason={reason} onPick={setReason} />
                  ))}
                </div>
                <p className="mt-4 text-xs font-medium text-muted-foreground">
                  Un contenu à modérer
                </p>
                <div className="mt-2 space-y-2">
                  {moderation.map((r) => (
                    <ReasonChoice key={r.value} r={r} reason={reason} onPick={setReason} />
                  ))}
                </div>
              </fieldset>
              {isCorrection ? (
                <div>
                  <label
                    htmlFor="report-proposed"
                    className="text-sm font-semibold text-foreground"
                  >
                    Votre correction
                  </label>
                  <textarea
                    id="report-proposed"
                    rows={3}
                    maxLength={2000}
                    value={proposed}
                    onChange={(e) => setProposed(e.target.value)}
                    placeholder="La bonne information, telle qu'elle devrait apparaître."
                    className={FIELD}
                  />
                </div>
              ) : null}
              <div>
                <label htmlFor="report-details" className="text-sm font-semibold text-foreground">
                  {isCorrection ? "Précisions (facultatif)" : "Ce que vous avez vu"}
                  {!user && !isCorrection ? " (5 caractères au moins)" : ""}
                </label>
                <textarea
                  id="report-details"
                  rows={4}
                  maxLength={2000}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Où exactement, et ce qui serait juste. Un seul lien au plus."
                  className={FIELD}
                />
              </div>
              {!user ? (
                <div>
                  <label htmlFor="report-email" className="text-sm font-semibold text-foreground">
                    Votre adresse e-mail (facultatif)
                  </label>
                  <input
                    id="report-email"
                    type="email"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Pour que l'équipe puisse vous répondre"
                    className={FIELD}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Utilisée seulement pour ce signalement, effacée 3 mois après son traitement.
                  </p>
                </div>
              ) : null}
              {failure ? (
                <p role="alert" className="text-sm text-destructive-text">
                  {failure}
                </p>
              ) : null}
              <Button
                disabled={sending || !canSend}
                onClick={send}
                title="Envoyer le signalement à l'équipe"
              >
                {sending ? "Envoi…" : ready ? "J'envoie mon signalement" : "Un instant…"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ReasonChoice({
  r,
  reason,
  onPick,
}: {
  r: { value: string; label: string };
  reason: string;
  onPick: (value: string) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-input px-3 py-2 text-sm hover:bg-accent">
      <input
        type="radio"
        name="report_reason"
        value={r.value}
        checked={reason === r.value}
        onChange={() => onPick(r.value)}
        className="accent-primary"
      />
      <span>{r.label}</span>
    </label>
  );
}
