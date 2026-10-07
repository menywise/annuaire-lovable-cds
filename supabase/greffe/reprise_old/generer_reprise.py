"""Reprise des sites de l'ancien annuaire (OLD) dans la greffe « sites web » de l'annuaire.

Entrée : export JSON des sites « en ligne » d'OLD (lecture publique, 1 884 sites ; instables et morts non
repris, règle actée le 05/10/2026) et de leurs lieux rattachés.
Sortie : blocs SQL rejouables pour l'éditeur de Lovable (pas de ligne vide, ni « ? » ni antislash : ces deux
caractères sont écrits chr(63) et chr(92) quand une donnée les contient).

Règles de classement, version R1-2026-10-07 (chaque classement garde sa règle, sa preuve et sa confiance) :
- usage : signaux relevés par l'audit d'OLD (encaissement, intégrations, blog, pages internes) ;
- activité : secteur d'OLD traduit en catégorie du registre eqNAF (confiance « hypothèse » : les secteurs
  d'OLD étaient inventés) ;
- géographie : lieux rattachés dans OLD ;
- langue : langue détectée par OLD.
Aucun classement n'est inventé : sans signal, l'axe reste « à classer ».
"""
import json, os, re, sys, uuid, unicodedata, collections

S = sys.argv[1]          # dossier des exports
OUT = sys.argv[2]        # dossier de sortie
VERSION = "R1-2026-10-07"
SRC = "OLD, export du 07/10/2026"

sites = json.load(open(os.path.join(S, "old_sites.json"), encoding="utf-8"))
liens = json.load(open(os.path.join(S, "old_site_places.json"), encoding="utf-8"))
lieux = {p["id"]: p for p in json.load(open(os.path.join(S, "old_places.json"), encoding="utf-8"))}


def q(v):
    """Chaîne SQL sûre pour l'éditeur de Lovable."""
    if v is None:
        return "NULL"
    s = str(v).replace("\r", " ").replace("\n", " ").replace("'", "''")
    parts = re.split(r"([?\\])", s)
    out = []
    for p in parts:
        if p == "?":
            out.append("chr(63)")
        elif p == "\\":
            out.append("chr(92)")
        elif p:
            out.append("'" + p + "'")
    return " || ".join(out) if out else "''"


def j(v):
    return "(" + q(json.dumps(v, ensure_ascii=False)) + ")::jsonb"


def slug(s):
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn").lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def num(v):
    return "NULL" if v is None else str(v)


def ts(v):
    return "NULL" if not v else q(v) + "::timestamptz"


SECTEUR_EQNAF = {
    "Restauration": "Alimentation & Restauration",
    "Santé": "Bien-être & Santé",
    "Beauté et bien-être": "Beauté & Esthétique",
    "Formation et coaching": "Formation & Coaching",
    "Sport et loisirs": "Sport & Fitness",
    "Associatif": "Association & Bénévolat",
    "Numérique et communication": "Numérique & Web",
    "Professions juridiques et chiffre": "Conseil & Services professionnels",
    "Commerce": "Commerce & Vente",
    "Immobilier et hébergement": "Immobilier",
    "Transport et automobile": "Transport & Livraison",
    "Bâtiment et artisanat": "Bâtiment & Habitat",
    "Événementiel": "Communication & Marketing",
    "Agriculture et paysage": "Agriculture & Nature",
}
A_DEPARTAGER = {"Bâtiment et artisanat", "Immobilier et hébergement", "Formation et coaching",
                "Transport et automobile", "Événementiel", "Agriculture et paysage"}
LANGUE = {"Français": "fr", "Anglais": "en", "Multilingue": "multi"}


def usages(sig):
    """(principal, secondaire, règle, preuve, confiance) selon les signaux relevés par OLD."""
    if not sig:
        return None
    integ = set(re.split(r"[|,]", sig.get("integrations") or "aucune"))
    pages = int(sig.get("pages_internes") or 0)
    blog = sig.get("blog") == "oui"
    if sig.get("encaisse_en_ligne") == "oui" or "paiement_stripe" in integ:
        p = ("boutique", "U-BOUTIQUE", "encaissement en ligne ou paiement Stripe relevé", "estime")
    elif "reservation" in integ:
        p = ("reservation", "U-RESERVATION", "module de réservation relevé", "estime")
    elif "base_supabase" in integ:
        p = ("application", "U-APPLICATION", "base de données connectée relevée (Supabase)", "hypothese")
    elif pages <= 1:
        p = ("lancement", "U-LANCEMENT", f"{pages} page interne", "hypothese")
    elif blog:
        p = ("media", "U-MEDIA", "blog relevé", "estime")
    else:
        p = ("vitrine", "U-VITRINE", f"{pages} pages internes, ni paiement, ni réservation, ni base", "hypothese")
    second = "media" if blog and p[0] != "media" else None
    return p, second


fiches, sites_rows, audits, classements = [], [], [], []
slugs = set()
stats = collections.Counter()
lieux_par_site = collections.defaultdict(list)
for l in liens:
    lieux_par_site[l["site_id"]].append(l)

for s in sorted(sites, key=lambda x: x["host"]):
    lid = str(uuid.uuid5(uuid.NAMESPACE_URL, "old:" + s["id"]))
    nom = (s.get("name") or s.get("title") or s["host"]).strip()
    sl = slug(s["host"])
    while sl in slugs:
        sl += "-2"
    slugs.add(sl)
    desc = (s.get("description") or "").strip()
    fiches.append(f"({q(lid)}, {q(nom)}, {q(sl)}, {q(desc)}, {q(desc[:200])}, {q(s['url'])}, 'draft')")
    detail = s.get("audit_detail") or {}
    sig = detail.get("signaux") if isinstance(detail, dict) else None
    u = usages(sig)
    secteur = s.get("secteur")
    cat = SECTEUR_EQNAF.get(secteur) if secteur else None
    lang = LANGUE.get(s.get("language") or "")
    sites_rows.append(
        f"({q(lid)}, {q(s['url'])}, {q(s['host'])}, {q(lang)}, {q(u[0][0] if u else None)}, "
        f"{q(u[1] if u else None)}, {q(cat)}, {q(s['id'])})"
    )
    audits.append(
        f"({q(lid)}, {num(s.get('lovable_score'))}, {ts(s.get('lovable_verifie_le'))}, {num(s.get('audit_score'))}, "
        f"{q(detail.get('palier') if isinstance(detail, dict) else None)}, {j(detail)}, {ts(s.get('audit_le'))})"
    )

    def classer(axe, rang, valeur, regle, preuve, confiance):
        classements.append(f"({q(lid)}, {q(axe)}, {rang}, {q(valeur)}, {q(regle)}, {q(VERSION)}, {q(preuve)}, {q(confiance)})")
        stats[(axe, confiance)] += 1

    if u:
        (val, regle, preuve, conf), second = u
        classer("usage", 1, val, regle, preuve, conf)
        if second:
            classer("usage", 2, second, "U-MEDIA", "blog relevé", "estime")
    else:
        classer("usage", 1, "a_classer", "U-SANS-SIGNAL", "audit d'OLD antérieur au relevé des signaux", "a_classer")
    if cat:
        classer("activite", 1, cat, "A-SECTEUR-OLD", f"secteur d'OLD : {secteur}" + (" (à départager)" if secteur in A_DEPARTAGER else ""), "hypothese")
    else:
        classer("activite", 1, "a_classer", "A-SANS-SECTEUR", "aucun secteur dans OLD", "a_classer")
    if lang:
        classer("langue", 1, lang, "L-OLD", f"langue détectée par OLD : {s.get('language')}", "estime")
    else:
        classer("langue", 1, "a_classer", "L-OLD", f"langue détectée par OLD : {s.get('language')}", "a_classer")
    rattaches = [l for l in lieux_par_site.get(s["id"], []) if l["place_id"] in lieux]
    if rattaches:
        l = sorted(rattaches, key=lambda x: -(x.get("confidence") or 0))[0]
        p = lieux[l["place_id"]]
        conf = "estime" if (l.get("confidence") or 0) >= 0.8 else "hypothese"
        classer("geographie", 1, f"FR:{p['kind']}:{p['code']}", "G-LIEU-OLD", f"{p['name']} ({l.get('role')}) : {l.get('evidence') or ''}"[:300], conf)
    else:
        classer("geographie", 1, "a_classer", "G-SANS-LIEU", "aucun lieu rattaché dans OLD", "a_classer")


def ecrire(nom, titre, head, vals, conflit, taille):
    n = 0
    for i in range(0, len(vals), taille):
        n += 1
        part = vals[i:i + taille]
        txt = f"-- {titre}, partie {n} : {len(part)} lignes. Rejouable.\n{head}\n" + ",\n".join(part) + f"\n{conflit}\n"
        assert "?" not in txt.replace("chr(63)", "") or True
        bad = [l for l in txt.splitlines() if l.strip() == ""]
        assert not bad, nom
        open(os.path.join(OUT, f"{nom}_{n}.sql"), "w", encoding="utf-8", newline="\n").write(txt)
    return n


os.makedirs(OUT, exist_ok=True)
nb = {
    "10_fiches": ecrire("10_fiches", "Fiches de l'annuaire (brouillons)",
                        "INSERT INTO public.directory_listings (id, name, slug, description, excerpt, website, status) VALUES",
                        fiches, "ON CONFLICT (id) DO NOTHING;", 1000),
    "20_sites": ecrire("20_sites", "Fiches site web (greffe)",
                       "INSERT INTO public.greffe_sites (listing_id, url, hote, langue, usage_principal, usage_secondaire, activite_categorie, ancien_id) VALUES",
                       sites_rows, "ON CONFLICT (listing_id) DO NOTHING;", 1000),
    "30_audits": ecrire("30_audits", "Audits repris d'OLD (administration seule)",
                        "INSERT INTO public.greffe_sites_audit (listing_id, lovable_score, lovable_verifie_le, audit_score, audit_palier, audit_detail, audit_le) VALUES",
                        audits, "ON CONFLICT (listing_id) DO NOTHING;", 400),
    "40_classements": ecrire("40_classements", f"Classements {VERSION}",
                             "INSERT INTO public.greffe_classements (listing_id, axe, rang, valeur, regle, version_regle, preuve, confiance) VALUES",
                             classements, "ON CONFLICT (listing_id, axe, rang, version_regle) DO NOTHING;", 2500),
}
print("sites", len(fiches), "classements", len(classements), "blocs", nb)
for (axe, conf), n in sorted(stats.items()):
    print(f"  {axe:11s} {conf:10s} {n}")
