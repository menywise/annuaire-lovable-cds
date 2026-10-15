#!/usr/bin/env bash
# Égalité entre migrations et blocs SQL. Chaque version du socle existe deux fois : la migration
# (supabase/migrations/) et ses blocs pour l'éditeur SQL de Lovable (supabase/seed/vX_Y_Z/), reçus
# par les clones. Ce script rejoue sur deux bases neuves :
#   - base « migrations » : la fausse couche Supabase, puis les migrations ;
#   - base « blocs » : la fausse couche Supabase, les migrations jusqu'à la 1.0.0, puis les blocs de
#     chaque version suivante dans l'ordre (blocs « installation seulement » exclus ; blocs de
#     contrôle passés en dernier, sans effet sur le schéma) ;
# puis compare les deux schémas (tests/db/schema_empreinte.sql) par diff.
# Une version dont la migration existe mais dont les blocs ne sont pas encore écrits est une version
# en cours : avertissement, et la comparaison s'arrête à la version précédente (sa migration n'est
# pas passée dans la base « migrations »). Un écart déjà listé dans tests/db/blocs_ecarts_connus.txt
# est un avertissement ; tout autre écart est un échec.
# Usage : PGHOST=/var/tmp PGPORT=54329 PGUSER=postgres tests/db/blocs_egalite.sh
set -euo pipefail
cd "$(dirname "$0")/../.."

DERNIERE_MIGRATION_1_0_0=20261002090000_v0_identite_neutre.sql # migration_reference de la 1.0.0
DB_MIG=cds_test_migrations
DB_BLOCS=cds_test_blocs
ECARTS_CONNUS=tests/db/blocs_ecarts_connus.txt
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

psql_q() { psql -q -v ON_ERROR_STOP=1 "$@"; }
echec() { echo "ÉCHEC égalité migrations/blocs : $*"; exit 1; }
numero() { local v=${1#v}; echo "${v//_/.}"; } # v1_6_0 -> 1.6.0

# 1. Tri des migrations : jusqu'à la 1.0.0, puis une version par migration.
avant=()
versions=()
migrations_versions=()
avertissements=()
en_cours=""
for f in supabase/migrations/*.sql; do
  nom=$(basename "$f")
  if [[ "$nom" < "$DERNIERE_MIGRATION_1_0_0" || "$nom" == "$DERNIERE_MIGRATION_1_0_0" ]]; then
    avant+=("$f")
    continue
  fi
  [[ "$nom" =~ _(v[0-9]+_[0-9]+_[0-9]+)_ ]] || echec "migration sans numéro de version dans son nom : $f"
  v=${BASH_REMATCH[1]}
  if [ -n "$en_cours" ]; then
    avertissements+=("version $(numero "$v") non comparée : les blocs de la $(numero "$en_cours") manquent")
    continue
  fi
  if [ ! -d "supabase/seed/$v" ]; then
    en_cours=$v
    avertissements+=("version $(numero "$v") en cours : migration $nom présente, blocs supabase/seed/$v/ absents ; comparaison arrêtée à la version précédente")
    continue
  fi
  versions+=("$v")
  migrations_versions+=("$f")
done
[ ${#avant[@]} -gt 0 ] || echec "aucune migration jusqu'à $DERNIERE_MIGRATION_1_0_0"

# 2. Blocs de chaque version, dans l'ordre numérique, triés d'après le tableau du LISEZMOI.md
#    (avant-dernière colonne « Socle » : non = installation seulement). Un bloc absent du tableau
#    est un échec.
blocs_socle=()
blocs_controle=()
blocs_exclus=()
for v in "${versions[@]}"; do
  lisezmoi="supabase/seed/$v/LISEZMOI.md"
  [ -f "$lisezmoi" ] || echec "$lisezmoi absent"
  while IFS= read -r bloc; do
    nom=$(basename "$bloc")
    ligne=$(grep -E "^\| *\`$nom\` *\|" "$lisezmoi" || true)
    [ -n "$ligne" ] || echec "bloc $bloc absent du tableau de $lisezmoi"
    socle=$(echo "$ligne" | awk -F'|' '{ gsub(/ /, "", $(NF-2)); print $(NF-2) }')
    case "$socle" in
      oui) ;;
      non) blocs_exclus+=("$v/$nom"); continue ;;
      *) echec "colonne « Socle » illisible pour $bloc dans $lisezmoi : « $socle »" ;;
    esac
    if [[ "$nom" =~ ^[0-9]+_controle\.sql$ ]]; then blocs_controle+=("$bloc"); else blocs_socle+=("$bloc"); fi
  done < <(ls "supabase/seed/$v"/*.sql | LC_ALL=C sort -t/ -k4,4n)
done

# 3. Deux bases neuves.
for db in $DB_MIG $DB_BLOCS; do
  psql_q -d postgres -c "DROP DATABASE IF EXISTS $db" -c "CREATE DATABASE $db"
  psql_q -d $db -f tests/db/supabase-stub.sql
done
passer() { # passer <base> <fichier> <libellé>
  psql_q -d "$1" -f "$2" >/dev/null 2>"$TMP/err" || { cat "$TMP/err"; echec "$3 $2"; }
}
for f in "${avant[@]}" "${migrations_versions[@]}"; do passer $DB_MIG "$f" migration; done
for f in "${avant[@]}"; do passer $DB_BLOCS "$f" "migration (base des blocs)"; done
for b in "${blocs_socle[@]}"; do passer $DB_BLOCS "$b" bloc; done
for b in "${blocs_controle[@]}"; do passer $DB_BLOCS "$b" "bloc de contrôle"; done

# 4. Comparaison des schémas.
psql -At -v ON_ERROR_STOP=1 -d $DB_MIG -f tests/db/schema_empreinte.sql >"$TMP/migrations.txt"
psql -At -v ON_ERROR_STOP=1 -d $DB_BLOCS -f tests/db/schema_empreinte.sql >"$TMP/blocs.txt"
diff "$TMP/migrations.txt" "$TMP/blocs.txt" | grep -E '^[<>]' >"$TMP/ecarts.txt" || true

nouveaux=0
connus=0
if [ -s "$TMP/ecarts.txt" ]; then
  while IFS= read -r ecart; do
    if [ -f "$ECARTS_CONNUS" ] && grep -qxF -- "$ecart" "$ECARTS_CONNUS"; then
      connus=$((connus + 1))
      echo "AVERTISSEMENT écart connu : $ecart"
    else
      nouveaux=$((nouveaux + 1))
      echo "ÉCART $ecart"
    fi
  done <"$TMP/ecarts.txt"
  echo "(« < » : dans le schéma des migrations seulement ; « > » : dans celui des blocs seulement)"
fi
for a in "${avertissements[@]}"; do echo "AVERTISSEMENT $a"; done

numeros=()
for v in "${versions[@]}"; do numeros+=("$(numero "$v")"); done
echo "Versions comparées : ${numeros[*]:-aucune} ; ${#blocs_socle[@]} blocs du socle, ${#blocs_controle[@]} blocs de contrôle, ${#blocs_exclus[@]} blocs « installation seulement » exclus (${blocs_exclus[*]:-aucun})"
[ "$nouveaux" -eq 0 ] || echec "$nouveaux écart(s) nouveau(x) entre le schéma des migrations et celui des blocs"
if [ "$connus" -gt 0 ]; then
  echo "Égalité migrations/blocs OK à $connus écart(s) connu(s) près ($ECARTS_CONNUS)"
else
  echo "Égalité migrations/blocs OK"
fi
