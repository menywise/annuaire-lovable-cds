import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/cds/ConfirmButton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { isFeatureOn } from "@/config/features";
import { supabase } from "@/integrations/supabase/client";
import {
  deleteMedia,
  formatBytes,
  isImage,
  listMedia,
  MEDIA_ACCEPT,
  MEDIA_IMAGE_ACCEPT,
  mediaUrl,
  uploadMedia,
  type MediaFile,
} from "@/lib/media";

/**
 * CDS — Médiathèque réutilisable (module « media »).
 * - `MediaLibrary` : dépôt, recherche, liste ; mode gestion (texte alternatif, suppression) ou choix.
 * - `ImageField` / `ImageListField` : champs d'image des formulaires d'administration.
 *   Médiathèque éteinte : le champ reste une simple adresse à coller, sans bouton ni trace.
 */

function canPreview(url: string) {
  return /^https:\/\//.test(url) || url.startsWith("/");
}

export function MediaLibrary({
  onPick,
  imagesOnly = false,
  manage = false,
}: {
  onPick?: (file: MediaFile, url: string) => void;
  imagesOnly?: boolean;
  manage?: boolean;
}) {
  const [files, setFiles] = useState<MediaFile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const uid = useId();

  const load = useCallback(async () => {
    try {
      setFiles(await listMedia());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    let sent = 0;
    for (const file of Array.from(list)) {
      try {
        await uploadMedia(file);
        sent += 1;
      } catch (error) {
        toast.error(`« ${file.name} » non envoyé.`, {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (sent) toast.success(sent > 1 ? `${sent} fichiers envoyés.` : "Fichier envoyé.");
    void load();
  }

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (files ?? []).filter(
      (f) =>
        (!imagesOnly || isImage(f)) &&
        (!q || f.name.toLowerCase().includes(q) || f.alt.toLowerCase().includes(q)),
    );
  }, [files, query, imagesOnly]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1 space-y-1.5">
          <Label htmlFor={`${uid}-search`}>Rechercher</Label>
          <Input
            id={`${uid}-search`}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nom ou texte alternatif"
          />
        </div>
        <input
          ref={input}
          type="file"
          multiple
          accept={imagesOnly ? MEDIA_IMAGE_ACCEPT : MEDIA_ACCEPT}
          className="sr-only"
          aria-label="Fichiers à envoyer"
          tabIndex={-1}
          onChange={(e) => void send(e.target.files)}
        />
        <Button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          title="Envoyer des fichiers depuis cet appareil (10 Mo maximum chacun)"
        >
          {busy ? "Envoi en cours…" : "Envoyer des fichiers"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        JPEG, PNG, WebP, GIF, AVIF{imagesOnly ? "" : " ou PDF"} · 10 Mo maximum par fichier.
      </p>

      {failed ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive"
        >
          Médiathèque indisponible.{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Réessayer
          </button>
        </p>
      ) : files === null ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-square w-full" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          {files.length === 0
            ? "Aucun fichier pour l'instant : envoyez le premier."
            : "Aucun fichier ne correspond."}
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {shown.map((file) => (
            <MediaTile key={file.id} file={file} onPick={onPick} manage={manage} reload={load} />
          ))}
        </ul>
      )}
    </div>
  );
}

function MediaTile({
  file,
  onPick,
  manage,
  reload,
}: {
  file: MediaFile;
  onPick?: ((file: MediaFile, url: string) => void) | undefined;
  manage: boolean;
  reload: () => Promise<void>;
}) {
  const url = mediaUrl(file.path);
  const [alt, setAlt] = useState(file.alt);

  async function saveAlt() {
    if (alt === file.alt) return;
    const { error } = await supabase
      .from("media_files")
      .update({ alt: alt.trim() })
      .eq("id", file.id);
    if (error) toast.error("Texte alternatif non enregistré.");
    else {
      toast.success("Texte alternatif enregistré.");
      void reload();
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Adresse copiée.");
    } catch {
      toast.error("Copie impossible : sélectionnez l'adresse à la main.", { description: url });
    }
  }

  async function remove() {
    try {
      await deleteMedia(file);
      toast.success("Fichier supprimé.");
      void reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Suppression impossible.");
    }
  }

  const preview = isImage(file) ? (
    <img
      src={url}
      alt={file.alt}
      loading="lazy"
      className="aspect-square w-full rounded-md border border-border bg-muted object-cover"
    />
  ) : (
    <span className="flex aspect-square w-full items-center justify-center rounded-md border border-border bg-muted text-sm font-semibold text-muted-foreground">
      PDF
    </span>
  );

  return (
    <li className="space-y-2 rounded-lg border border-border bg-card p-2">
      {onPick ? (
        <button
          type="button"
          onClick={() => onPick(file, url)}
          title={`Choisir « ${file.name} »`}
          className="block w-full rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {preview}
        </button>
      ) : (
        preview
      )}
      <p className="truncate text-xs text-foreground" title={file.name}>
        {file.name}
      </p>
      <p className="text-xs text-muted-foreground">
        {formatBytes(file.size_bytes)}
        {file.width && file.height ? ` · ${file.width}×${file.height}` : ""}
      </p>
      {manage ? (
        <div className="space-y-2">
          {isImage(file) ? (
            <div className="space-y-1">
              <Label htmlFor={`alt-${file.id}`} className="text-xs">
                Texte alternatif
              </Label>
              <Input
                id={`alt-${file.id}`}
                value={alt}
                maxLength={300}
                onChange={(e) => setAlt(e.target.value)}
                onBlur={() => void saveAlt()}
                placeholder="Décrire l'image"
              />
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copy()}
              title="Copier l'adresse publique"
            >
              Copier l'adresse
            </Button>
            <ConfirmButton
              title="Supprimer ce fichier"
              question={`Supprimer « ${file.name} » ?`}
              detail="Les pages qui l'affichent montreront une image manquante. Cette action ne peut pas être annulée."
              onConfirm={remove}
            />
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Bouton « Choisir dans la médiathèque » : rend `null` si le module est éteint. */
export function MediaPickerButton({
  onPick,
  label = "Médiathèque",
  imagesOnly = true,
}: {
  onPick: (url: string, file: MediaFile) => void;
  label?: string;
  imagesOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!isFeatureOn("media")) return null;
  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        title="Choisir un fichier dans la médiathèque ou en envoyer un"
      >
        {label}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Médiathèque</DialogTitle>
            <DialogDescription>
              Cliquez sur une image pour la choisir, ou envoyez-en une nouvelle.
            </DialogDescription>
          </DialogHeader>
          {open ? (
            <MediaLibrary
              imagesOnly={imagesOnly}
              onPick={(file, url) => {
                onPick(url, file);
                setOpen(false);
              }}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Champ image : adresse à coller, aperçu, choix dans la médiathèque.
 * Contrôlé (`value` + `onChange`) ou libre (`defaultValue`) ; `name` le rend lisible par FormData.
 */
export function ImageField({
  id,
  label,
  name,
  value,
  defaultValue = "",
  onChange,
}: {
  id: string;
  label: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (url: string) => void;
}) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const set = (next: string) => {
    if (value === undefined) setInner(next);
    onChange?.(next);
  };

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-start gap-3">
        {current && canPreview(current) ? (
          <img
            src={current}
            alt=""
            className="h-11 w-11 shrink-0 rounded-md border border-border bg-muted object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <Input
            id={id}
            name={name}
            type="url"
            value={current}
            onChange={(e) => set(e.target.value)}
            placeholder="https://…"
          />
          <div className="flex flex-wrap gap-2">
            <MediaPickerButton onPick={(url) => set(url)} label="Choisir dans la médiathèque" />
            {current ? (
              <Button type="button" size="sm" variant="ghost" onClick={() => set("")}>
                Retirer l'image
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Liste d'images (photos d'une fiche ou d'une annonce), `max` au plus. */
export function ImageListField({
  id,
  label,
  value,
  onChange,
  max = 10,
}: {
  id: string;
  label: string;
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}) {
  const [draft, setDraft] = useState("");
  const full = value.length >= max;

  function add(url: string) {
    const clean = url.trim();
    if (!clean || full || value.includes(clean)) return;
    onChange([...value, clean]);
    setDraft("");
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-foreground">
        {label} ({value.length}/{max})
      </legend>
      {value.length ? (
        <ul className="flex flex-wrap gap-2">
          {value.map((url, index) => (
            <li key={url} className="relative">
              {canPreview(url) ? (
                <img
                  src={url}
                  alt=""
                  className="h-20 w-20 rounded-md border border-border bg-muted object-cover"
                />
              ) : (
                <span className="flex h-20 w-20 items-center justify-center break-all rounded-md border border-border p-1 text-[10px] text-muted-foreground">
                  {url}
                </span>
              )}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, i) => i !== index))}
                className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-xs shadow-sm"
                title="Retirer cette image"
                aria-label={`Retirer l'image ${index + 1}`}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {!full ? (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id={id}
            type="url"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add(draft);
              }
            }}
            placeholder="https://… puis Ajouter"
            aria-label={`${label} : adresse d'une image`}
            className="min-w-[200px] flex-1"
          />
          <Button type="button" size="sm" variant="outline" onClick={() => add(draft)}>
            Ajouter
          </Button>
          <MediaPickerButton onPick={(url) => add(url)} label="Choisir dans la médiathèque" />
        </div>
      ) : null}
    </fieldset>
  );
}
