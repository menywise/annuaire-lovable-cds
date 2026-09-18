import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listTemplateChecks from "./tools/list-template-checks";
import updateTemplateCheck from "./tools/update-template-check";
import recordAudit from "./tools/record-audit";
import listAudits from "./tools/list-audits";
import siteOverview from "./tools/site-overview";
import listPublicPages from "./tools/list-public-pages";
import auditPage from "./tools/audit-page";
import listRoadmap from "./tools/list-roadmap";
import upsertRoadmapItem from "./tools/upsert-roadmap-item";

const projectRef = import.meta.env['VITE_SUPABASE_PROJECT_ID'] ?? "project-ref-unset";

export default defineMcp({
  name: "cds-framework",
  title: "CDS Framework",
  version: "1.0.0",
  instructions:
    "Outils d'audit du design system CDS. L'appelant doit être connecté avec un compte administrateur du site. " +
    "Utilisez `list_template_checks` pour la grille de conformité et le score, `site_overview` pour le volume de contenus par module, " +
    "`list_public_pages` puis `audit_page` pour auditer chaque page publique (SEO, accessibilité, thème sombre, anglais résiduel), " +
    "`list_roadmap` et `upsert_roadmap_item` pour la feuille de route, `update_template_check` pour consigner un constat, " +
    "et `record_audit` pour figer un audit daté avec ses anomalies (mémoire entre deux audits). Répondez en français.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listTemplateChecks,
    updateTemplateCheck,
    siteOverview,
    listPublicPages,
    auditPage,
    listRoadmap,
    upsertRoadmapItem,
    recordAudit,
    listAudits,
  ],
});
