# VNL-SAD : pilotage de la valeur nette logistique

Système d'aide à la décision construit pour la Charcuterie GAANA (Kinshasa), à partir du mémoire de Master 2 de G. Mukenga Kantambwa, *Valeur nette logistique et pilotage de la performance logistique d'une PME en environnement hostile* (UNIKIN, 2026), et du cahier des charges VNL-SAD v1.0 (novembre 2026).

Cette version 2 remplace le prototype annuel. Elle travaille mois par mois, applique le modèle du cahier des charges (annexe A) et fonctionne entièrement hors connexion sur un ordinateur ou un téléphone.

## Lancer le logiciel

Aucune installation : ouvrir `index.html` dans Chrome, Edge ou Firefox. Les données restent dans le navigateur de l'appareil et sont enregistrées dès la saisie, ce qui les protège des coupures de courant.

Pour l'installer comme une application (icône sur le bureau ou l'écran d'accueil du téléphone, fonctionnement hors ligne garanti), publier le dossier sur un serveur web, par exemple GitHub Pages, l'ouvrir une fois avec une connexion, puis choisir « Installer l'application » dans le menu du navigateur.

Au premier lancement, le logiciel demande de créer le compte administrateur. Pour reprendre l'historique, aller dans **Saisie et import**, cocher « Clôturer les mois importés », puis choisir le fichier Excel de l'historique ou le dossier des fiches CSV des services.

## Les écrans

| Écran | Question de la direction | Contenu |
|---|---|---|
| Tableau de bord | Où en sommes-nous ? | VNL, VNL/VMB, Ψ, Φ et leur variation, voyant, phrase « que faire ce mois-ci », bilan imprimable |
| Évolution | La situation s'améliore-t-elle ? | Courbes de VNL/VMB avec le seuil, de Ψ, α, Ω, γ ; vue annuelle (VMB, quatre retraits, VNL) |
| Diagnostic | Qu'est-ce qui fait baisser la valeur ? | Cascade VMB → VNL, part de chaque dimension, sous-indicateurs les plus loin de leur cible, hostilité |
| Alertes | Depuis quand et pourquoi ? | Mois en alerte, règle, dimension en cause, action proposée, décision de la direction |
| Actions | Que financer en premier ? | Programme de VAN maximale sous budget, série de budgets, actions imposées, risques non couverts, AMDEC |
| Saisie et import | Comment ajouter le mois écoulé ? | Fiche par service, contrôles, avancement, clôture, import CSV/Excel, audit de la base |
| Paramètres et méthode | D'où viennent les chiffres ? | Cibles, poids, seuils, θ, versions datées, validation du PDG, module AHP, formules expliquées |
| Analyses | | Sensibilité, Spearman, Mann-Whitney, Shapiro-Wilk |
| Administration | | Comptes et rôles, sauvegarde sur clé USB, exports Excel/CSV, rapport annuel, questionnaire, journal |

Les rôles suivent le tableau 3 du cahier des charges : PDG, administrateur, Direction (P1), Achat (P2), Production (P3), Commercial (P4), Comptabilité (P5) et opérateur de saisie. Un compte peut cumuler plusieurs rôles ; pour une démonstration sur un seul poste, cocher tous les rôles.

## Structure du code

- `js/config.js` : 45 variables, 34 sous-indicateurs, paramètres de départ, défaillances et actions du mémoire.
- `js/model.js` : moteur de calcul, sans dépendance (VNL, décomposition, alertes, AHP, AMDEC, VAN, optimisation, sensibilité, statistiques).
- `js/importer.js` : lecture des fiches CSV des services et du modèle de fiche complète.
- `js/store.js` : stockage local, versions de paramètres, journal, comptes, sauvegarde.
- `js/app*.js` : écrans.
- `vendor/` : Chart.js 4.4.1 et SheetJS 0.18.5, embarqués pour fonctionner sans internet.
- `tests/model.test.js` : tests du moteur.

## Tests

```
node tests/model.test.js                      # formules et jeu d'essai de l'annexe B (34 tests)
node tests/model.test.js chemin/CSV_services  # + recette sur les 60 mois (49 tests)
```

Résultats sur les 60 fiches mensuelles 2018-2022 : VNL de janvier 2018 = 43,38 M FC (48,4 %), VNL 2018 = 627,5 M FC, VNL 2022 = 261,0 M FC, cumul = 2 039,1 M FC (36,7 %), première alerte VNL/VMB en janvier 2020, 36 mois en alerte, alertes Ω 0/0/3/5/4, programme optimal sous 25 M FC = actions 3, 5, 7, 8, 9 (15 M FC, VAN 25,43 M FC), ρ = −0,771 entre hostilité et Ψ, U = 0 pour Ψ 2020 contre 2018-2019. Les tests statistiques ont été vérifiés contre SciPy.

Les données de la GAANA sont confidentielles (section 6.4 du cahier des charges) : elles ne sont pas versionnées dans ce dépôt.

## Choix et hypothèses à confirmer

- **Rattachement des actions aux sous-indicateurs.** Le tableau B-2 relie chaque action à une défaillance, pas à un sous-indicateur. Le rattachement retenu (par exemple contrats flexibles → TRSS, traçabilité → τ) est modifiable dans l'écran Actions.
- **VAN des actions.** Tant que la valeur attendue, le coût annuel et la durée d'effet de chaque action ne sont pas saisis, la VAN publiée dans le mémoire est utilisée. Dès qu'ils le sont, la VAN est recalculée sur l'année de référence.
- **Action proposée avec une alerte.** Si aucune action ne vise la dimension en cause (cas fréquent de γ), le logiciel propose l'action de VAN positive dont le sous-indicateur visé est le plus éloigné de sa cible ce mois-là, en le disant.
- **Seuil de baisse mensuelle.** Le cahier des charges le laisse à la direction ; il est fixé à 5 points de ratio par défaut.
- **Répartition des variables entre services.** Elle suit le nom des fichiers CSV fournis (la variation des prix est saisie par la comptabilité, les événements d'environnement par la direction).
- **Données de janvier 2018.** La VNL et le ratio retrouvent l'annexe B, mais les indices intermédiaires diffèrent (γ 0,697 au lieu de 0,716, Xe 0,345 au lieu de 0,434) : la plupart des variables des fiches CSV sont des reconstitutions calibrées sur la VNL. Le moteur, lui, retrouve exactement l'annexe B quand on lui donne les indices publiés (test automatique).

## Ce qui n'est pas couvert dans cette version

La synchronisation entre plusieurs appareils (NF1) et les notifications par courriel (F6.8) supposent un serveur ; elles sont hors du périmètre de cette version à poste unique. Le transfert d'un appareil à l'autre se fait par sauvegarde et restauration d'un fichier.
