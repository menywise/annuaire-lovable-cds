// Contrôle de forme des blocs SQL de supabase/seed/, destinés à l'éditeur SQL de Lovable.
// L'éditeur coupe le script à chaque ligne vide, refuse l'antislash et le caractère « ? ».
// Vérifié, pour chaque fichier .sql du dossier (sous-dossiers compris) :
//   - aucune ligne vide à l'intérieur d'une instruction (entre son premier caractère et son « ; »,
//     chaînes '…' et $$…$$, identifiants "…" et commentaires compris) ;
//   - aucun antislash, aucun « ? », où que ce soit dans le fichier.
// Usage : node tests/db/blocs_forme.ts [dossier]   (dossier par défaut : supabase/seed)
// Sortie : une ligne par défaut (fichier:ligne : message) ; code de retour 1 s'il y en a.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type Defaut = { fichier: string; ligne: number; message: string };

function fichiersSql(dossier: string): string[] {
  const resultat: string[] = [];
  for (const nom of readdirSync(dossier).sort()) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) resultat.push(...fichiersSql(chemin));
    else if (nom.endsWith(".sql")) resultat.push(chemin);
  }
  return resultat;
}

const estBlanc = (c: string | undefined) => c === " " || c === "\t" || c === "\r";

// Vrai si le saut de ligne en `pos` ouvre une ligne vide (espaces seuls jusqu'au saut suivant).
function ouvreLigneVide(sql: string, pos: number): boolean {
  let k = pos + 1;
  while (k < sql.length && estBlanc(sql[k])) k++;
  return k < sql.length && sql[k] === "\n";
}

// Position juste après la fermeture d'une chaîne ouverte en `debut` par `delim` (délimiteur doublé
// = délimiteur dans la chaîne). Fin du texte si la chaîne n'est pas fermée.
function finDeChaine(sql: string, debut: number, delim: string): number {
  let j = debut + 1;
  while (j < sql.length) {
    if (sql[j] === delim) {
      if (sql[j + 1] === delim) {
        j += 2;
        continue;
      }
      return j + 1;
    }
    j++;
  }
  return sql.length;
}

// Position juste après la fermeture du commentaire /* … */ ouvert en `debut` (imbrication comprise).
function finDeCommentaire(sql: string, debut: number): number {
  let profondeur = 1;
  let j = debut + 2;
  while (j < sql.length && profondeur > 0) {
    if (sql[j] === "/" && sql[j + 1] === "*") {
      profondeur++;
      j += 2;
    } else if (sql[j] === "*" && sql[j + 1] === "/") {
      profondeur--;
      j += 2;
    } else {
      j++;
    }
  }
  return j;
}

// Numéros (à partir de 1) des lignes vides situées à l'intérieur d'une instruction. Une instruction
// commence à son premier caractère utile (hors espaces et commentaires) et finit à son « ; ».
export function lignesVidesDansInstruction(sql: string): number[] {
  const fautives = new Set<number>();
  let ligne = 1;
  let enInstruction = false;
  // Avance de `debut` à `fin` en comptant les lignes ; si une instruction est ouverte, note les
  // lignes vides rencontrées.
  const avancer = (debut: number, fin: number) => {
    for (let j = debut; j < fin; j++) {
      if (sql[j] !== "\n") continue;
      ligne++;
      if (enInstruction && ouvreLigneVide(sql, j)) fautives.add(ligne);
    }
  };
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const c = sql[i];
    if (c === "\n" || estBlanc(c)) {
      avancer(i, i + 1);
      i++;
    } else if (c === "-" && sql[i + 1] === "-") {
      const fin = sql.indexOf("\n", i);
      i = fin === -1 ? n : fin; // le saut de ligne est traité au tour suivant
    } else if (c === "/" && sql[i + 1] === "*") {
      const fin = finDeCommentaire(sql, i);
      avancer(i, fin);
      i = fin;
    } else if (c === ";") {
      enInstruction = false;
      i++;
    } else {
      enInstruction = true;
      if (c === "'" || c === '"') {
        const fin = finDeChaine(sql, i, c);
        avancer(i, fin);
        i = fin;
      } else if (c === "$" && /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.test(sql.slice(i, i + 64))) {
        const balise = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i, i + 64))![0];
        const fermeture = sql.indexOf(balise, i + balise.length);
        const fin = fermeture === -1 ? n : fermeture + balise.length;
        avancer(i, fin);
        i = fin;
      } else {
        i++;
      }
    }
  }
  return [...fautives].sort((a, b) => a - b);
}

export function controlerBloc(fichier: string, sql: string): Defaut[] {
  const defauts: Defaut[] = [];
  sql.split("\n").forEach((l, idx) => {
    if (l.includes("\\"))
      defauts.push({ fichier, ligne: idx + 1, message: "antislash refusé par l'éditeur" });
    if (l.includes("?"))
      defauts.push({ fichier, ligne: idx + 1, message: "caractère « ? » refusé par l'éditeur" });
  });
  for (const ligne of lignesVidesDansInstruction(sql)) {
    defauts.push({
      fichier,
      ligne,
      message: "ligne vide à l'intérieur d'une instruction (l'éditeur coupe ici)",
    });
  }
  return defauts.sort((a, b) => a.ligne - b.ligne);
}

function principal(): number {
  const dossier = process.argv[2] ?? "supabase/seed";
  const fichiers = fichiersSql(dossier);
  const defauts: Defaut[] = [];
  for (const f of fichiers)
    defauts.push(...controlerBloc(relative(process.cwd(), f), readFileSync(f, "utf8")));
  for (const d of defauts) console.log(`${d.fichier}:${d.ligne} : ${d.message}`);
  if (defauts.length > 0) {
    console.log(`ÉCHEC forme des blocs : ${defauts.length} défaut(s) dans ${dossier}`);
    return 1;
  }
  console.log(`Forme des blocs OK (${fichiers.length} fichiers dans ${dossier})`);
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  process.exit(principal());
}
