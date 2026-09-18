/** Temps de lecture estimé, base 200 mots par minute, minimum 1 minute. */
export function readingMinutes(content: string) {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
