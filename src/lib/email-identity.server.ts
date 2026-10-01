/**
 * CDS — Identité d'envoi des e-mails, lue dans les réglages du site (clé « brand »).
 * Aucune valeur propre à un projet dans le code : chaque clone règle son nom, son adresse et
 * son domaine d'envoi dans Administration → Paramètres (bloc « Envoi des e-mails »).
 */
export type EmailIdentity = {
  siteName: string;
  siteUrl: string;
  /** Sous-domaine délégué au service d'envoi de Lovable (ex. notify.exemple.fr). */
  senderDomain: string;
  /** Domaine affiché dans l'expéditeur (ex. exemple.fr). */
  fromDomain: string;
};

export class EmailNotConfiguredError extends Error {
  constructor() {
    super(
      "Domaine d'envoi des e-mails non réglé : Administration → Paramètres → Envoi des e-mails.",
    );
    this.name = "EmailNotConfiguredError";
  }
}

export async function emailIdentity(request?: Request): Promise<EmailIdentity> {
  const { loadSiteConfig } = await import("@/lib/site-config.functions");
  const site = await loadSiteConfig();
  const { brand } = site;
  if (!brand.email.senderDomain) throw new EmailNotConfiguredError();
  const origin = request ? new URL(request.url).origin : "";
  return {
    siteName: brand.name,
    siteUrl: brand.url || origin,
    senderDomain: brand.email.senderDomain,
    fromDomain: brand.email.fromDomain || brand.email.senderDomain,
  };
}
