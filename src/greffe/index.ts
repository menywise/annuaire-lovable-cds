/**
 * Prise des greffes de l'annuaire des sites Lovable.
 *
 * Le socle livre ce fichier vide et ne le modifie plus jamais. L'annuaire y déclare ce qu'il ajoute.
 * Ce qui est permis : `src/config/greffe.ts`. Mode d'emploi : docs/CLONER.md, « Écrire une greffe ».
 * SQL de la greffe : supabase/greffe/ (tables greffe_sites, greffe_sites_audit, greffe_classements).
 *
 * Fichier sans alias « @/ » : lu aussi par Node (tests unitaires, robot de recette).
 */
import type { GreffeDeclaration } from "../config/greffe.ts";

export const GREFFE: GreffeDeclaration = {
  modules: [
    {
      key: "greffe_sites",
      label: "Fiches site web",
      definition:
        "Chaque fiche de l'annuaire décrit un site web : son adresse, son usage, son activité et sa langue.",
      requires: ["directory"],
    },
  ],
};
