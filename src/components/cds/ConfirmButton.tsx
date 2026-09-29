import { useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Bouton d'action irréversible (suppression) : ouvre une confirmation avant d'agir.
 * `onConfirm` peut être asynchrone ; la fenêtre reste ouverte pendant l'opération.
 */
export function ConfirmButton({
  label = "Supprimer",
  title,
  question,
  detail = "Cette action ne peut pas être annulée.",
  confirmLabel = "Supprimer",
  onConfirm,
  size = "sm",
  children,
}: {
  label?: string;
  title: string;
  question: string;
  detail?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<unknown> | void;
  size?: "sm" | "default";
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <AlertDialogTrigger asChild>
        <Button type="button" size={size} variant="outline" title={title}>
          {children ?? label}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{question}</AlertDialogTitle>
          <AlertDialogDescription>{detail}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirm()}>
            {busy ? "Suppression…" : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
