import { useState } from "react";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";

export function GoogleSignInButton({
  label = "Continuer avec Google",
  redirectTo,
}: {
  label?: string;
  redirectTo?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);
    const safe =
      redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//") ? redirectTo : null;
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: safe ? `${window.location.origin}${safe}` : window.location.origin,
    });
    if (result.error) {
      setError("La connexion avec Google n'a pas abouti. Réessayez dans un instant.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    window.location.href = safe ?? "/compte";
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-light">ou</span>
        <span className="h-px flex-1 bg-border" />
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={onClick}
        disabled={busy}
        title="Se connecter avec un compte Google"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-4 w-4">
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9z"
          />
          <path
            fill="#34A853"
            d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.3v3.1A12 12 0 0 0 12 24z"
          />
          <path
            fill="#FBBC05"
            d="M5.3 14.3a7.1 7.1 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1z"
          />
          <path
            fill="#EA4335"
            d="M12 4.8c1.8 0 3.4.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z"
          />
        </svg>
        {busy ? "Ouverture de Google…" : label}
      </Button>
      {error && <p className="text-center text-xs text-destructive">{error}</p>}
    </div>
  );
}
