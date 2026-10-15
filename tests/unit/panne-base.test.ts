/**
 * Panne de base : une lecture qui échoue lève une erreur, elle ne s'affiche jamais comme une
 * liste vide. Le visiteur reçoit un message fixe ; le détail reste dans le journal du serveur.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  MESSAGE_PANNE_BASE,
  check,
  decrireErreurBase,
  estMessageMetier,
} from "../../src/lib/check.ts";

const REPO = join(import.meta.dirname, "..", "..");
const LIB = join(REPO, "src", "lib");

/** Capture ce que check() écrit dans le journal pendant `fn`. */
function journal(fn: () => void): string[] {
  const lignes: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    lignes.push(args.map(String).join(" "));
  };
  try {
    fn();
  } finally {
    console.error = original;
  }
  return lignes;
}

test("check : rend data quand la requête a réussi, sans rien journaliser", () => {
  const lignes = journal(() => {
    assert.deepEqual(check({ data: [1, 2], error: null }), [1, 2]);
    assert.equal(check({ data: null, error: null }), null);
  });
  assert.deepEqual(lignes, []);
});

test("check : une panne lève le message fixe et journalise le détail", () => {
  const error = {
    message: 'relation "public.blog_posts" does not exist',
    code: "42P01",
    details: null,
    hint: null,
  };
  const lignes = journal(() => {
    assert.throws(() => check({ data: null, error }, { contexte: "blog_posts" }), {
      message: MESSAGE_PANNE_BASE,
    });
  });
  assert.equal(lignes.length, 1);
  assert.match(lignes[0]!, /\[base\] blog_posts/);
  assert.match(lignes[0]!, /42P01/);
  assert.match(lignes[0]!, /blog_posts" does not exist/);
});

test("check : le message brut de la base n'atteint jamais le visiteur", () => {
  for (const error of [
    { message: "TypeError: fetch failed", code: "", details: "", hint: "" },
    { message: "canceling statement due to statement timeout", code: "57014" },
    { message: "permission denied for table forum_topics", code: "42501" },
    { message: 'new row for relation "payments" violates check constraint "x"', code: "23514" },
    { message: "JWT expired", code: "PGRST301" },
  ]) {
    journal(() => {
      assert.throws(() => check({ data: null, error }), { message: MESSAGE_PANNE_BASE });
      assert.throws(() => check({ data: null, error }, { metier: true }), {
        message: MESSAGE_PANNE_BASE,
      });
    });
  }
  assert.doesNotMatch(MESSAGE_PANNE_BASE, /erreur|table|relation|sql|postgres/i);
});

test("check : un message métier du socle reste lisible quand la fonction l'annonce", () => {
  for (const [message, code] of [
    ["Panier vide", "22023"],
    ["Formation déjà réglée", "23505"],
    ["Le paiement en ligne est désactivé", "42501"],
    ["Renonciation au droit de rétractation requise", "23514"],
    ["Formation introuvable", "P0002"],
    ["Limite de 20 téléchargements atteinte : écrivez-nous pour la relever", "P0001"],
    ["Trop de signalements aujourd'hui : réessayez demain", "54000"],
  ]) {
    const error = { message: message!, code: code!, details: null, hint: null };
    assert.equal(estMessageMetier(error), true, message);
    journal(() => {
      assert.throws(() => check({ data: null, error }, { metier: true }), { message });
      // Sans l'annonce, même un message métier est traité comme une panne.
      assert.throws(() => check({ data: null, error }), { message: MESSAGE_PANNE_BASE });
    });
  }
});

test("decrireErreurBase : une ligne, avec code, détail et indice quand ils existent", () => {
  assert.equal(
    decrireErreurBase({ message: "fetch failed" }, "faq_items"),
    "[base] faq_items : fetch failed",
  );
  assert.equal(
    decrireErreurBase({ message: "m", code: "P0001", details: "d", hint: "h" }),
    "[base] : m — code P0001 — détail : d — indice : h",
  );
});

/* Garde : aucune fonction serveur ne lit `data` sans lire `error`. */

/** Retire chaînes, gabarits et commentaires, où « data » pourrait apparaître librement. */
function sansBruit(code: string) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\])\/\/.*$/gm, "$1")
    .replace(/`(?:\\.|[^`\\])*`/g, '""')
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''");
}

/** Motifs d'objet `{ … }` d'un motif de déstructuration, y compris dans un tableau. */
function motifsObjet(motif: string): string[] {
  const trouves: string[] = [];
  let profondeur = 0;
  let debut = -1;
  for (let i = 0; i < motif.length; i++) {
    const c = motif[i];
    if (c === "{") {
      if (profondeur === 0) debut = i;
      profondeur++;
    } else if (c === "}") {
      profondeur--;
      if (profondeur === 0 && debut >= 0) trouves.push(motif.slice(debut, i + 1));
    }
  }
  return trouves;
}

function clesDe(objet: string): string[] {
  return objet
    .slice(1, -1)
    .split(",")
    .map((part) => part.trim().split(":")[0]!.trim())
    .filter(Boolean);
}

/** Déstructurations assignées (`const { data } = …`, `const [{ data: x }] = await …`). */
const DESTRUCTURATION = /\b(?:const|let|var)\s+([{[][\s\S]*?[}\]])\s*=/g;

function lecturesSansErreur(code: string): string[] {
  const fautes: string[] = [];
  for (const match of sansBruit(code).matchAll(DESTRUCTURATION)) {
    for (const objet of motifsObjet(match[1]!)) {
      const cles = clesDe(objet);
      if (cles.includes("data") && !cles.includes("error")) fautes.push(objet.replace(/\s+/g, " "));
    }
  }
  return fautes;
}

test("garde : la détection repère une lecture de data sans error", () => {
  assert.deepEqual(lecturesSansErreur("const { data } = await q;"), ["{ data }"]);
  assert.deepEqual(lecturesSansErreur("const { data: rows } = await q;"), ["{ data: rows }"]);
  assert.deepEqual(lecturesSansErreur("const [{ data: a }, { data: b, error }] = await P;"), [
    "{ data: a }",
  ]);
  assert.deepEqual(lecturesSansErreur("const { data, error } = await q;"), []);
  assert.deepEqual(lecturesSansErreur("const data = check(await q);"), []);
  // Paramètre d'un gestionnaire (`{ data: input }`) : ce n'est pas une lecture de la base.
  assert.deepEqual(lecturesSansErreur(".handler(async ({ data: input }) => input)"), []);
  assert.deepEqual(lecturesSansErreur('const s = "const { data } = x";'), []);
});

test("garde : aucun src/lib/*.functions.ts ne lit data sans lire error", () => {
  const fichiers = readdirSync(LIB).filter((f) => f.endsWith(".functions.ts"));
  assert.ok(fichiers.length >= 10, "les fonctions serveur sont bien dans src/lib");
  const fautes: string[] = [];
  for (const fichier of fichiers) {
    const code = readFileSync(join(LIB, fichier), "utf8");
    for (const faute of lecturesSansErreur(code)) fautes.push(`${fichier} : ${faute}`);
    // Lecture directe de la propriété (`res.data ?? []`) : même contournement.
    const propre = sansBruit(code);
    if (/[\w)\]]\.data\b/.test(propre)) fautes.push(`${fichier} : accès direct à .data`);
  }
  assert.deepEqual(fautes, []);
});

test("garde : les quatre fichiers de l'audit passent chaque requête par check()", () => {
  for (const fichier of [
    "content.functions.ts",
    "community.functions.ts",
    "lms.functions.ts",
    "marketplace.functions.ts",
  ]) {
    const brut = readFileSync(join(LIB, fichier), "utf8");
    assert.match(brut, /import \{ check \} from "@\/lib\/check"/, fichier);
    const code = sansBruit(brut);
    // Chaque `await` d'une requête (client/publicClient) est enveloppé dans check(…) ou
    // attend un lot Promise.all dont chaque résultat passe ensuite par check().
    const attentes = code.match(/await (?:client|publicClient\(\))\s*\n?\s*\.(?:from|rpc)/g) ?? [];
    const enveloppees = code.match(/check\(\s*await (?:client|publicClient\(\))/g) ?? [];
    assert.equal(enveloppees.length, attentes.length, `${fichier} : await sans check()`);
  }
});
