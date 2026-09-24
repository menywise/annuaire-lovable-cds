# Audit de correction des bugs d'interface

## Constat initial (vérifié)
- Toutes les pages publiques répondent (code 200) ; modules éteints redirigent bien vers l'accueil.
- Une erreur réelle relevée dans votre aperçu : décalage entre la page envoyée par le serveur et celle affichée par le navigateur, dans le formulaire newsletter du pied de page (présent sur toutes les pages). Ce type d'erreur peut provoquer des écrans figés ou blancs.
- Les pages blanches ne sont donc pas visibles par un simple chargement : il faut un test navigateur réel, page par page, connecté et déconnecté.

## Étape 1 — Recette automatisée complète
Un robot navigateur parcourt chaque page (publique, membre, administration), en ordinateur et en mobile, déconnecté puis connecté avec un compte admin, et relève pour chacune :
- page blanche ou contenu vide ;
- erreurs affichées dans la console ;
- appels au serveur en échec ;
- capture d'écran.
Parcours testés aussi : connexion, inscription, contact, newsletter, sujet de forum, messagerie, profil, découverte, onglets admin.

## Étape 2 — Rapport classé
Liste des anomalies : page + élément visible, gravité bloquant / majeur / mineur.

## Étape 3 — Corrections
Correction de toutes les anomalies, en commençant par les bloquantes :
- décalage serveur/navigateur du formulaire newsletter (et vérification des autres éléments lus depuis le navigateur : bannière cookies, menu connecté, année du pied de page) ;
- ajout d'un écran d'erreur propre partout pour qu'aucune erreur ne produise plus jamais une page blanche ;
- chaque page avec chargement de données reçoit un message « introuvable » et « erreur, réessayer ».

## Étape 4 — Contre-recette
Le robot repasse sur toutes les pages ; livraison seulement quand zéro page blanche et zéro erreur console. Mise à jour de la grille de conformité et de roadmap.md.

## Détails techniques
- Playwright (1280 et 390 px), session admin injectée ; relevé console/pageerror/réponses 4xx-5xx.
- Hydratation : lectures localStorage/session déplacées dans useEffect, suppressHydrationWarning là où une extension (LastPass) injecte du DOM.
- defaultErrorComponent + defaultNotFoundComponent sur le routeur ; errorComponent/notFoundComponent sur chaque route à loader.
