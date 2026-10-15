/**
 * Forme des blocs SQL pour l'éditeur de Lovable : lignes vides à l'intérieur d'une instruction,
 * antislash et « ? » détectés ; lignes vides entre deux instructions tolérées.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { controlerBloc, lignesVidesDansInstruction } from "../db/blocs_forme.ts";

test("une ligne vide entre deux instructions est tolérée", () => {
  const sql = "CREATE TABLE a (id int);\n\n-- commentaire\n\nCREATE TABLE b (id int);\n";
  assert.deepEqual(lignesVidesDansInstruction(sql), []);
  assert.deepEqual(controlerBloc("x.sql", sql), []);
});

test("une ligne vide dans un corps $$ est signalée à sa ligne", () => {
  const sql = [
    "CREATE FUNCTION f() RETURNS void LANGUAGE plpgsql AS $$",
    "BEGIN",
    "",
    "  NULL;",
    "END $$;",
  ].join("\n");
  assert.deepEqual(lignesVidesDansInstruction(sql), [3]);
});

test("une ligne vide dans une instruction simple ou un INSERT multi-lignes est signalée", () => {
  assert.deepEqual(lignesVidesDansInstruction("INSERT INTO t (a)\n\nVALUES (1);"), [2]);
  assert.deepEqual(lignesVidesDansInstruction("SELECT 1\n   \nFROM t;\n"), [2]);
});

test("une ligne vide dans une chaîne ou un commentaire bloc à l'intérieur d'une instruction est signalée", () => {
  assert.deepEqual(lignesVidesDansInstruction("INSERT INTO t VALUES ('a\n\nb');"), [2]);
  assert.deepEqual(lignesVidesDansInstruction("SELECT /* a\n\nb */ 1;"), [2]);
});

test("un « ; » dans une chaîne ou un commentaire ne termine pas l'instruction", () => {
  assert.deepEqual(lignesVidesDansInstruction("SELECT 'a;'\n\nFROM t;"), [2]);
  assert.deepEqual(lignesVidesDansInstruction("SELECT 1 -- fin ;\n\nFROM t;"), [2]);
  assert.deepEqual(lignesVidesDansInstruction("DO $x$ BEGIN NULL; $$ $x$\n\n;"), [2]);
});

test("une ligne vide dans un commentaire entre deux instructions est tolérée", () => {
  assert.deepEqual(lignesVidesDansInstruction("SELECT 1;\n/* a\n\nb */\nSELECT 2;"), []);
});

test("antislash et « ? » sont refusés, même dans une chaîne", () => {
  const defauts = controlerBloc("x.sql", "SELECT 'a\\.b';\nSELECT 'pourquoi ?';\n");
  assert.deepEqual(
    defauts.map((d) => [d.ligne, d.message.split(" ")[0]]),
    [
      [1, "antislash"],
      [2, "caractère"],
    ],
  );
});
