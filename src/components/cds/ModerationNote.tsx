import { ShieldCheck } from "lucide-react";

/** Note publique laissée par l'équipe sur un contenu modéré (texte corrigé, lien retiré…). */
export function ModerationNote({
  note,
  at,
  className = "",
}: {
  note: string | null | undefined;
  at?: string | null;
  className?: string;
}) {
  if (!note) return null;
  return (
    <p
      className={`mt-2 inline-flex items-start gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1.5 text-xs text-muted-foreground ${className}`}
    >
      <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium text-foreground">Modéré par l'équipe</span>
        {at ? ` le ${new Date(at).toLocaleDateString("fr-FR")}` : ""} : {note}
      </span>
    </p>
  );
}
