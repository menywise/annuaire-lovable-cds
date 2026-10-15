/**
 * Plan du site (sitemap.xml) : la date de modification vient de la base, jamais du jour courant,
 * et une adresse sans date connue n'a pas de balise <lastmod>.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { lastmodLine, laterOf, latestDay, toDay } from "../../src/lib/sitemap.ts";

test("toDay : jour d'une date ISO de la base, rien si absente ou illisible", () => {
  assert.equal(toDay("2026-03-05T14:22:10.123+00:00"), "2026-03-05");
  assert.equal(toDay("2026-03-05T23:59:59Z"), "2026-03-05");
  assert.equal(toDay(null), undefined);
  assert.equal(toDay(undefined), undefined);
  assert.equal(toDay(""), undefined);
  assert.equal(toDay("pas une date"), undefined);
});

test("latestDay : le jour le plus récent, les dates illisibles ignorées", () => {
  assert.equal(
    latestDay(["2026-01-10T00:00:00Z", null, "2026-04-01T08:00:00Z", "2025-12-31T00:00:00Z"]),
    "2026-04-01",
  );
  assert.equal(latestDay([]), undefined);
  assert.equal(latestDay([null, undefined, "x"]), undefined);
});

test("laterOf : la plus récente de deux dates, null si aucune", () => {
  assert.equal(laterOf("2026-01-01T00:00:00Z", "2026-02-01T00:00:00Z"), "2026-02-01T00:00:00Z");
  assert.equal(laterOf("2026-03-01T00:00:00Z", "2026-02-01T00:00:00Z"), "2026-03-01T00:00:00Z");
  assert.equal(laterOf(null, "2026-02-01T00:00:00Z"), "2026-02-01T00:00:00Z");
  assert.equal(laterOf("2026-02-01T00:00:00Z", undefined), "2026-02-01T00:00:00Z");
  assert.equal(laterOf(null, undefined), null);
});

test("lastmodLine : balise seulement quand la date est connue", () => {
  assert.equal(lastmodLine("2026-03-05"), "    <lastmod>2026-03-05</lastmod>\n");
  assert.equal(lastmodLine(undefined), "");
});
