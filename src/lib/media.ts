import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { slugify } from "@/lib/format";

/**
 * CDS — Médiathèque (module « media », V0.md §3 A).
 *
 * Les fichiers vont dans l'espace de stockage public « media » (Supabase Storage) :
 * l'admin dépose, tout le monde lit par l'adresse publique. La table `media_files`
 * garde le nom d'origine, le texte alternatif et les dimensions. Règles d'accès :
 * migration `20260929180000_v0_lot5a_media.sql`, test `tests/db/test_07_media.sql`.
 */

export const MEDIA_BUCKET = "media";
export const MEDIA_MAX_BYTES = 10 * 1024 * 1024;
/** Même liste que l'espace de stockage en base. Pas de SVG : il peut contenir du script. */
export const MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
  "application/pdf",
] as const;
export const MEDIA_IMAGE_ACCEPT = MEDIA_TYPES.filter((t) => t.startsWith("image/")).join(",");
export const MEDIA_ACCEPT = MEDIA_TYPES.join(",");

export type MediaFile = Tables<"media_files">;

export function isImage(file: Pick<MediaFile, "mime_type">) {
  return file.mime_type.startsWith("image/");
}

export function mediaUrl(path: string) {
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} Mo`;
}

/** Message lisible si le fichier est refusé avant envoi, sinon `null`. */
export function rejectReason(file: File): string | null {
  if (!(MEDIA_TYPES as readonly string[]).includes(file.type)) {
    return "Format non accepté (JPEG, PNG, WebP, GIF, AVIF ou PDF).";
  }
  if (file.size > MEDIA_MAX_BYTES)
    return `Fichier trop lourd (${formatBytes(file.size)}, 10 Mo maximum).`;
  return null;
}

/** Chemin rangé par mois, unique, sans caractère spécial : 2026/09/a1b2c3d4-mon-image.png */
function buildPath(file: File) {
  const dot = file.name.lastIndexOf(".");
  const base = slugify(dot > 0 ? file.name.slice(0, dot) : file.name).slice(0, 60) || "fichier";
  const ext =
    (dot > 0 ? file.name.slice(dot + 1) : "").toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const id = crypto.randomUUID().slice(0, 8);
  return `${now.getFullYear()}/${month}/${id}-${base}.${ext}`;
}

async function imageSize(file: File): Promise<{ width: number; height: number } | null> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return null;
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size.width > 0 && size.height > 0 ? size : null;
  } catch {
    return null;
  }
}

/** Envoie un fichier et l'inscrit dans la médiathèque. Lève une erreur lisible en cas d'échec. */
export async function uploadMedia(file: File, alt = ""): Promise<MediaFile> {
  const reason = rejectReason(file);
  if (reason) throw new Error(reason);
  const path = buildPath(file);
  const storage = supabase.storage.from(MEDIA_BUCKET);
  const { error: upError } = await storage.upload(path, file, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (upError) throw new Error("Envoi refusé. Vérifiez que la médiathèque est allumée.");
  const size = await imageSize(file);
  const { data, error } = await supabase
    .from("media_files")
    .insert({
      path,
      name: file.name.slice(0, 200),
      alt: alt.slice(0, 300),
      mime_type: file.type,
      size_bytes: file.size,
      width: size?.width ?? null,
      height: size?.height ?? null,
    })
    .select()
    .single();
  if (error || !data) {
    await storage.remove([path]);
    throw new Error("Fichier envoyé mais non inscrit : réessayez.");
  }
  return data;
}

export async function listMedia(): Promise<MediaFile[]> {
  const { data, error } = await supabase
    .from("media_files")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw new Error("Médiathèque indisponible.");
  return data ?? [];
}

/** Supprime le fichier puis sa fiche. Les pages qui l'affichaient montreront une image manquante. */
export async function deleteMedia(file: MediaFile) {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).remove([file.path]);
  if (error) throw new Error("Fichier non supprimé.");
  const { error: rowError } = await supabase.from("media_files").delete().eq("id", file.id);
  if (rowError) throw new Error("Fiche non supprimée.");
}
