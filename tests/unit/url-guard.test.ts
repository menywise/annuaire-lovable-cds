import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPublicUrl, isPublicHost } from "../../src/lib/url-guard.ts";

test("domaines publics acceptés", () => {
  for (const h of ["exemple.fr", "www.exemple.fr", "mon-site.lovable.app", "xn--caf-dma.fr"]) {
    assert.ok(isPublicHost(h), h);
  }
});

test("adresses internes refusées", () => {
  for (const h of [
    "localhost",
    "127.0.0.1",
    "10.0.0.5",
    "169.254.169.254",
    "192.168.1.1",
    "[::1]",
    "::1",
    "intranet",
    "serveur.local",
    "api.internal",
    "x.localhost",
    "",
  ]) {
    assert.equal(isPublicHost(h), false, h);
  }
});

test("URL complète : schéma, identifiants, port", () => {
  assert.doesNotThrow(() => assertPublicUrl(new URL("https://exemple.fr/page")));
  for (const u of [
    "ftp://exemple.fr",
    "file:///etc/passwd",
    "https://user:pass@exemple.fr",
    "https://exemple.fr:8080",
    "http://169.254.169.254/latest/meta-data",
    "http://0x7f000001",
    "http://2130706433",
  ]) {
    assert.throws(() => assertPublicUrl(new URL(u)), u);
  }
});
