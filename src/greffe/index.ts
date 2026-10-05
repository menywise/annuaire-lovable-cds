/**
 * Prise des greffes.
 *
 * Le socle livre ce fichier vide et ne le modifie plus jamais : une mise à niveau du socle ne crée
 * donc pas de conflit ici. Un projet (clone du socle) y déclare ce qu'il ajoute : modules
 * `greffe_<nom>`, liens de menu, pages protégées, pages publiques, pages de recette.
 * Ce qui est permis : `src/config/greffe.ts`. Mode d'emploi : docs/CLONER.md, « Écrire une greffe ».
 *
 * Fichier sans alias « @/ » : lu aussi par Node (tests unitaires, robot de recette).
 */
import type { GreffeDeclaration } from "../config/greffe.ts";

export const GREFFE: GreffeDeclaration = {};
