# Boutique (module K) en blocs

Même contenu que `supabase/migrations/20260930210000_v0_boutique.sql`, sans commentaires,
découpé pour l'éditeur SQL de Lovable. Exécuter les fichiers **un par un, dans l'ordre (1 à 11)**,
chacun en entier. Tous sont rejouables. Si un bloc échoue, noter son numéro et le message.

Le bloc 11 est un contrôle : **6 lignes** attendues (4 tables, 5 fonctions, 1 espace de fichiers,
1 colonne, module `false`, réglages de livraison).

Le module reste **éteint** après ces blocs. Pour l'essayer : écran Modules → Boutique, avec les
secrets Stripe en mode test (`STRIPE_SECRET_KEY` = `sk_test_…`, `STRIPE_WEBHOOK_SECRET`).
