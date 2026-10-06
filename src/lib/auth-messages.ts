/**
 * Messages d'erreur de connexion et de mot de passe, en français, à partir du code renvoyé par
 * Supabase Auth. Un message générique cache la vraie raison (mot de passe identique à l'ancien,
 * trop faible, déjà divulgué…) : la personne ne sait pas quoi corriger.
 */

/** Forme minimale d'une erreur Supabase Auth (AuthError, AuthWeakPasswordError). */
export type AuthErreur = {
  code?: string | undefined;
  message?: string | undefined;
  reasons?: string[] | undefined;
};

/** Contexte de l'appel : le même code n'appelle pas le même conseil partout. */
export type AuthContexte = "connexion" | "inscription" | "mot-de-passe" | "reinitialisation";

function motDePasseFaible(reasons: string[] = []): string {
  if (reasons.includes("pwned"))
    return "Ce mot de passe figure dans une fuite de données connue. Choisissez-en un autre, propre à ce site.";
  if (reasons.includes("length")) return "Mot de passe trop court : 8 caractères minimum.";
  if (reasons.includes("characters"))
    return "Mot de passe trop simple : mélangez lettres minuscules, majuscules, chiffres et symboles.";
  return "Mot de passe trop faible. Choisissez-en un plus long et moins courant.";
}

export function messageAuth(erreur: AuthErreur, contexte: AuthContexte): string {
  const code = erreur.code ?? "";
  switch (code) {
    case "invalid_credentials":
      return "Adresse e-mail ou mot de passe incorrect.";
    case "email_not_confirmed":
      return "Adresse e-mail pas encore confirmée : ouvrez le lien reçu par e-mail, puis reconnectez-vous.";
    case "user_banned":
      return "Ce compte est suspendu. Contactez l'administrateur du site.";
    case "user_already_exists":
    case "email_exists":
      return "Un compte existe déjà avec cette adresse.";
    case "same_password":
      return "Le nouveau mot de passe doit être différent de l'actuel.";
    case "weak_password":
      return motDePasseFaible(erreur.reasons);
    case "reauthentication_needed":
      return "Par sécurité, déconnectez-vous puis reconnectez-vous avant de changer de mot de passe.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Trop de tentatives d'affilée. Patientez quelques minutes avant de réessayer.";
    case "signup_disabled":
      return "Les inscriptions sont fermées pour le moment.";
    case "email_address_invalid":
      return "Cette adresse e-mail n'est pas acceptée. Vérifiez-la ou utilisez-en une autre.";
    case "session_not_found":
    case "session_expired":
    case "otp_expired":
      return contexte === "reinitialisation"
        ? "Le lien de réinitialisation est invalide ou expiré. Demandez-en un nouveau depuis la page « Mot de passe oublié »."
        : "Votre session a expiré. Reconnectez-vous puis réessayez.";
  }
  if (contexte === "connexion") return "Adresse e-mail ou mot de passe incorrect.";
  const detail = erreur.message?.trim();
  const debut =
    contexte === "inscription"
      ? "La création du compte a échoué."
      : "Le mot de passe n'a pas pu être modifié.";
  return detail ? `${debut} Motif : ${detail}` : debut;
}
