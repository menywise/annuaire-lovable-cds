/**
 * Messages d'erreur de connexion et de mot de passe : la vraie raison, en français.
 * Lancer : node --test tests/unit/*.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { messageAuth } from "../../src/lib/auth-messages.ts";

test("mot de passe identique à l'ancien", () => {
  assert.match(messageAuth({ code: "same_password" }, "mot-de-passe"), /différent de l'actuel/);
});

test("mot de passe trop faible : la raison précise est donnée", () => {
  assert.match(messageAuth({ code: "weak_password", reasons: ["pwned"] }, "inscription"), /fuite/);
  assert.match(
    messageAuth({ code: "weak_password", reasons: ["length"] }, "mot-de-passe"),
    /8 caractères/,
  );
  assert.match(messageAuth({ code: "weak_password" }, "mot-de-passe"), /trop faible/);
});

test("lien expiré : conseil propre à la réinitialisation", () => {
  assert.match(messageAuth({ code: "otp_expired" }, "reinitialisation"), /Mot de passe oublié/);
  assert.match(messageAuth({ code: "session_not_found" }, "mot-de-passe"), /Reconnectez-vous/);
});

test("connexion : un code inconnu ne dévoile rien", () => {
  assert.equal(
    messageAuth({ code: "unexpected", message: "boom" }, "connexion"),
    "Adresse e-mail ou mot de passe incorrect.",
  );
});

test("code inconnu ailleurs : le motif du serveur est montré", () => {
  assert.equal(
    messageAuth({ message: "Password should contain x" }, "mot-de-passe"),
    "Le mot de passe n'a pas pu être modifié. Motif : Password should contain x",
  );
  assert.equal(messageAuth({}, "inscription"), "La création du compte a échoué.");
});
