// Règle R2 : numéro d'entreprise lu dans les mentions légales (page rendue par un navigateur, les sites
// Lovable étant affichés par le navigateur), puis registre public des entreprises (API de l'État).
// Lecture passive : page d'accueil puis page des mentions légales, agent identifié, une page à la fois,
// une seconde de pause entre deux requêtes, 20 secondes au plus par page.
// Usage : node r2.mjs <a_traiter.json> <resultats.json> <resultats.sql>
// a_traiter.json : [{ "listing_id": "…", "url": "…" }] (vue greffe_r2_a_traiter de l'annuaire).
// resultats.sql : à exécuter dans la base de l'annuaire (rejouable).
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";

const CHROME = process.env.CHROME_PATH;
const UA = "AnnuaireSitesLovable-R2/1.0 (lecture des mentions legales ; contact : manuel.rohaut@gmail.com)";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const ETIQUETTE = /(SIRE[NT]|RCS|R\.C\.S|immatricul|n[°o]\s*d'?entreprise)/gi;
const NOMBRE = /(?<!\d)(\d{3}[\s. ]?\d{3}[\s. ]?\d{3}(?:[\s. ]?\d{5})?)(?!\d)/g;

function luhn(n) {
  let t = 0;
  [...n].reverse().forEach((c, i) => {
    let d = Number(c);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    t += d;
  });
  return t % 10 === 0;
}

function sirens(texte) {
  const out = [];
  for (const m of texte.matchAll(ETIQUETTE)) {
    const fenetre = texte.slice(m.index, m.index + 120);
    for (const n of fenetre.matchAll(NOMBRE)) {
      const chiffres = n[1].replace(/\D/g, "");
      const siren = chiffres.slice(0, 9);
      if ((chiffres.length === 9 || chiffres.length === 14) && luhn(siren) && !out.includes(siren)) out.push(siren);
    }
  }
  return out;
}

async function registre(siren) {
  const r = await fetch(`https://recherche-entreprises.api.gouv.fr/search?q=${siren}&page=1&per_page=1`, {
    headers: { "User-Agent": UA, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`registre ${r.status}`);
  const d = await r.json();
  const e = (d.results ?? []).find((x) => x.siren === siren);
  if (!e) return null;
  const s = e.siege ?? {};
  return { siren, nom: e.nom_complet, naf: e.activite_principale, commune: s.commune,
    libelle_commune: s.libelle_commune, etat: e.etat_administratif };
}

async function texteDe(page, url) {
  await page.goto(url, { waitUntil: "networkidle", timeout: 20000 }).catch(() => {});
  return await page.evaluate(() => document.body?.innerText ?? "");
}

async function traiter(page, url) {
  const res = { url, pages_lues: [], siren: null, registre: null, statut: "sans_numero" };
  try {
    let texte = await texteDe(page, url);
    res.pages_lues.push(url);
    res.mots_accueil = texte.split(/\s+/).filter(Boolean).length;
    let trouves = sirens(texte);
    if (!trouves.length) {
      const lien = await page.evaluate(() => {
        const a = [...document.querySelectorAll("a[href]")].find((x) =>
          /mentions|l[ée]gal|cgu|cgv|confidentialit/i.test((x.textContent ?? "") + " " + x.getAttribute("href")));
        return a ? a.href : null;
      });
      if (lien) {
        await pause(1000);
        texte = await texteDe(page, lien);
        res.pages_lues.push(lien);
        trouves = sirens(texte);
      }
    }
    if (trouves.length) {
      res.siren = trouves[0];
      await pause(1000);
      res.registre = await registre(trouves[0]);
      res.statut = res.registre ? "trouve" : "inconnu_du_registre";
    }
  } catch (e) {
    res.statut = "erreur";
    res.erreur = String(e).slice(0, 200);
  }
  return res;
}

const VERSION = "R2-2026-10-07";

/** Chaîne SQL sûre pour l'éditeur de Lovable : « ? » et antislash écrits chr(63) et chr(92). */
function q(v) {
  if (v === null || v === undefined) return "NULL";
  const s = String(v).replace(/[\r\n]+/g, " ").replace(/'/g, "''");
  const parts = s.split(/([?\\])/).filter((p) => p !== "");
  if (!parts.length) return "''";
  return parts.map((p) => (p === "?" ? "chr(63)" : p === "\\" ? "chr(92)" : `'${p}'`)).join(" || ");
}

function sql(lid, r) {
  const detail = { pages_lues: r.pages_lues, siren: r.siren, registre: r.registre, erreur: r.erreur ?? null };
  const lignes = [
    `INSERT INTO public.greffe_taches (listing_id, tache, statut, detail) VALUES (${q(lid)}, 'R2', ${q(r.statut)}, (${q(JSON.stringify(detail))})::jsonb)
` +
      `ON CONFLICT (listing_id, tache) DO UPDATE SET statut = excluded.statut, detail = excluded.detail, fait_le = now();`,
  ];
  if (r.statut === "trouve") {
    const g = r.registre;
    const page = r.pages_lues[r.pages_lues.length - 1];
    const preuve = `SIREN ${g.siren} lu sur ${page} ; registre des entreprises : NAF ${g.naf}, siège ${g.libelle_commune ?? ""} (${g.commune ?? ""}), état ${g.etat ?? ""}`;
    lignes.push(
      `INSERT INTO public.greffe_classements (listing_id, axe, rang, valeur, regle, version_regle, preuve, confiance)
` +
        `SELECT ${q(lid)}, 'activite', 1, CASE WHEN EXISTS (SELECT 1 FROM public.activites WHERE code = ${q(g.naf)}) THEN ${q(g.naf)} ELSE 'NAF:' || ${q(g.naf)} END, 'A-NAF-SIREN', '${VERSION}', ${q(preuve)}, 'source'
` +
        `ON CONFLICT (listing_id, axe, rang, version_regle) DO UPDATE SET valeur = excluded.valeur, preuve = excluded.preuve, confiance = excluded.confiance, classe_le = now();`,
    );
    if (g.commune) {
      lignes.push(
        `INSERT INTO public.greffe_classements (listing_id, axe, rang, valeur, regle, version_regle, preuve, confiance)
` +
          `VALUES (${q(lid)}, 'geographie', 1, ${q("FR:commune:" + g.commune)}, 'G-SIEGE-SIREN', '${VERSION}', ${q(preuve)}, 'source')
` +
          `ON CONFLICT (listing_id, axe, rang, version_regle) DO UPDATE SET valeur = excluded.valeur, preuve = excluded.preuve, confiance = excluded.confiance, classe_le = now();`,
      );
    }
    lignes.push(
      `UPDATE public.greffe_sites SET siren = ${q(g.siren)}, pays = 'FR',
` +
        `  activite_code = (SELECT code FROM public.activites WHERE code = ${q(g.naf)}),
` +
        `  activite_categorie = coalesce((SELECT categorie FROM public.activites WHERE code = ${q(g.naf)}), activite_categorie)
` +
        `WHERE listing_id = ${q(lid)};`,
    );
  }
  return lignes.join("\n");
}

const lots = JSON.parse(readFileSync(process.argv[2], "utf8"));
const navigateur = await chromium.launch({ executablePath: CHROME, headless: true });
const contexte = await navigateur.newContext({ userAgent: UA });
const page = await contexte.newPage();
const resultats = [];
const blocs = [];
for (const { listing_id, url } of lots) {
  const r = await traiter(page, url);
  resultats.push({ listing_id, ...r });
  blocs.push(sql(listing_id, r));
  await pause(1000);
}
await navigateur.close();
writeFileSync(process.argv[3], JSON.stringify(resultats, null, 1));
writeFileSync(process.argv[4], `-- Règle R2, ${resultats.length} sites. Rejouable.\n` + blocs.join("\n") + "\n");
const bilan = {};
for (const r of resultats) bilan[r.statut] = (bilan[r.statut] ?? 0) + 1;
console.log(JSON.stringify(bilan));
