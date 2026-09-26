# Amélioration tactile et légère du thème CDS

## Objectif
Donner davantage de relief aux cartes, formulaires et zones de contenu sans transformer l’identité CDS : thème clair, police Inter, bleu de marque, boutons à 6 px et cartes à 12 px restent inchangés.

## Direction retenue
- Fond de page légèrement distinct des surfaces de travail.
- Cartes blanches mieux détachées grâce à une bordure plus précise et une ombre douce multicouche.
- Champs légèrement creusés au repos, puis nettement éclaircis au focus.
- États actifs plus lisibles dans les onglets et navigations secondaires.
- Survol tactile très léger sur les éléments interactifs, sans mouvement permanent ni effet spectaculaire.
- Quelques accents latéraux ou surfaces teintées uniquement lorsqu’ils clarifient la nature ou l’état d’un contenu.

## Mise en œuvre
1. **Faire évoluer les tokens CDS**
   - Ajouter des tokens sémantiques pour les surfaces intermédiaires, les bordures renforcées et les ombres tactile/active.
   - Reporter les mêmes valeurs dans la documentation des tokens et leur version TypeScript.
   - Conserver les contrastes WCAG AA et le thème clair uniquement.

2. **Renforcer les composants partagés**
   - Harmoniser cartes, champs, zones de texte, listes déroulantes, onglets, boutons secondaires et squelettes.
   - Distinguer visuellement une carte informative, une zone de saisie et un élément sélectionné.
   - Respecter les tailles tactiles et les états clavier existants.

3. **Appliquer la hiérarchie aux écrans existants**
   - Commencer par l’administration, où le problème est clairement visible sur la page Contenus.
   - Étendre le même langage visuel aux pages publiques, membres, forum, tarifs et modules optionnels.
   - Éviter les cartes imbriquées et réserver l’élévation aux véritables unités de contenu.

4. **Contrôler la cohérence**
   - Vérifier les écrans principaux sur ordinateur et mobile, connecté et déconnecté.
   - Contrôler les contrastes, débordements, focus, survols et absence de surfaces blanc sur blanc ou gris sur gris.
   - Corriger toute régression d’affichage détectée pendant cette vérification.

## Limites
- Aucun changement de contenu, de navigation, de données ou de fonctionnalité.
- Aucun mode sombre, gradient décoratif, ombre lourde ou nouvelle couleur dominante.
- Les six briques optionnelles restent désactivées ; leurs écrans recevront néanmoins les styles partagés pour leur future activation.
