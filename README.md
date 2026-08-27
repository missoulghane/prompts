# DocFlow — maquette dynamique (gestion d'activités manuelles)

Maquette HTML/CSS/JS **sans dépendance ni build**. Trois fichiers : `index.html`, `styles.css`, `app.js`.

## Lancer
Double-cliquer `index.html`, ou :
```
python3 -m http.server 8777 --directory .
```

## Parcours couvert
1. **Connexion** — 4 comptes de démo, chacun rattaché à un groupe (`OPS-IDENT-1/2`, `OPS-SAISIE`, `SUPERVISEUR`).
   Le groupe définit le périmètre clients visible.
2. **Accueil** — KPI + file des activités (Identification / Saisie / Validation) avec le nombre de documents
   en attente. Filtres : recherche, client, type de flux, type d'activité, plage de dépôt, SLA
   (en retard / < 2 h / aujourd'hui / dans les temps), priorité, restriction « mon groupe ».
   Tri par colonne, filtres actifs affichés en pastilles.
3. **Poste d'identification** (clic sur « Traiter ») — file de documents à gauche, visionneuse au centre
   (zoom, rotation, panoramique à la souris, multi-pages), panneau de classement à droite :
   pré-classement automatique avec score de confiance, liste des classes du référentiel du flux,
   **Valider / Rejeter (motif) / Demander un complément (motif + destinataire + commentaire)**, annulation.
   Progression sauvegardée dans le `localStorage`, récapitulatif de session à la clôture.

## Raccourcis clavier (navigation sans les boutons)
`←` `→` document précédent / suivant · `Origine` `Fin` premier / dernier · `↑` `↓` page précédente / suivante ·
`1`…`9` classe cible · `Entrée` valider · `R` rejeter · `C` complément · `S` reprendre la proposition ·
`F` filtrer les classes · `U` annuler · `+` `−` `0` zoom · `Maj+R` rotation · `Échap` fermer · `?` aide.

## Données
Entièrement simulées et déterministes (générateur pseudo-aléatoire à graine) : flux, activités, SLA,
documents et pages « scannées » rendues en SVG. Aucune donnée réelle, aucun appel réseau.
