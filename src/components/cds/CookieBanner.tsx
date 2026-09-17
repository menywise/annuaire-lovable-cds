import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "cds.cookie-consent";

export type CookieConsent = "accepted" | "refused";

export function getCookieConsent(): CookieConsent | null {
  if (typeof window === "undefined") return null;
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "accepted" || value === "refused" ? value : null;
}

/**
 * Bandeau de consentement aux cookies de mesure d'audience.
 * Aucun traceur n'est déposé tant que le choix n'est pas « accepté ».
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsent() === null);
  }, []);

  function choose(value: CookieConsent) {
    window.localStorage.setItem(STORAGE_KEY, value);
    window.dispatchEvent(new CustomEvent("cds:cookie-consent", { detail: value }));
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Consentement aux cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card p-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]"
    >
      <div className="mx-auto flex max-w-[1200px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Nous utilisons uniquement des cookies de mesure d'audience, déposés après votre accord.{" "}
          <Link
            to="/legal/cookies"
            title="Lire la politique de gestion des cookies"
            className="font-medium text-primary underline underline-offset-2"
          >
            En savoir plus
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => choose("refused")}>
            Refuser
          </Button>
          <Button size="sm" onClick={() => choose("accepted")}>
            Accepter
          </Button>
        </div>
      </div>
    </div>
  );
}
