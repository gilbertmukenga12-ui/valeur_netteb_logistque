# SAD-VNL — Valeur nette logistique

Outil de diagnostic issu du mémoire de Master 2 *« Valeur nette logistique et pilotage de la performance logistique : modélisation dans un environnement hostile »* (Université de Kinshasa, GEOT, 2025-2026). Il transforme le modèle du mémoire en un Système d'Aide à la Décision utilisable : calcul de la VNL, lecture des régimes de performance, AMDEC et choix des actions correctives sous contrainte de budget.

## Lancer l'outil

Aucune installation : ouvrir `index.html` dans un navigateur. Les données saisies sont enregistrées dans le navigateur. Le logiciel fonctionne sans connexion internet.

## Ce que fait chaque onglet

| Onglet | Rôle |
|---|---|
| Tableau de bord | VNL, VNL/VMB, Ψ, Φ et régime pour l'année choisie, graphiques, lecture automatique (maillon faible, effet de l'environnement), export CSV |
| Données | VMB, coûts logistiques, cinq indices par année, paramètres τ, θ et exposants |
| Sous-indicateurs | Normalisation au P90 des 33 sous-indicateurs, poids AHP modifiables, calcul des indices α, Ω, γ, Rz, Xe |
| AMDEC | Criticité = F × G × D, classement critique / majeur / modéré |
| Budget | Sélection exacte des actions qui maximisent le gain de VNL sous contrainte de budget |

## Le modèle

```
VNL = VMB × (1 − τ) × Ψ × Φ − Clog
Ψ   = α^0,40 × Ω^0,35 × γ^0,25        taux de conversion opérationnelle
Φ   = exp(θ × (Rz − Xe)),  θ = 0,35    modulateur environnemental
```

Les données chargées par défaut sont celles de la GAANA (2018-2022), tirées des tableaux III-2 à III-15 du mémoire.

## Structure

- `js/model.js` : noyau de calcul, sans dépendance, testable.
- `js/data.js` : dimensions, poids AHP et données de la GAANA.
- `js/app.js` : interface.
- `tests/model.test.js` : vérifie le noyau contre les tableaux du mémoire (`node tests/model.test.js`).

## Écarts constatés avec le mémoire

Le logiciel recalcule tout à partir des données ; il relève donc des écarts avec les tableaux publiés.

- **Arrondis.** Le mémoire arrondit Ψ et Φ avant de multiplier ; les VNL recalculées diffèrent d'environ 1 % (2 593,7 M FC en 2022 au lieu de 2 613,3).
- **Tableau III-16, budget de 200 M FC.** Les actions 1, 2, 3, 5, 7, 9 et 10 coûtent 230 M FC et dépassent le budget. La meilleure combinaison respectant 200 M FC est 1, 2, 3, 7, 9, pour un gain de 450 M FC (et non 510).
- **Tableau III-16, budget de 100 M FC.** Les actions 1, 3 et 5 donnent 250 M FC de gain contre 240 pour la combinaison retenue.
- **Indices recalculés depuis le détail 2022** : Ω = 0,66 (le mémoire retient 0,57 « après renormalisation »), Xe = 0,62 (le mémoire retient 0,68), α = 0,82 (0,84 publié).
- **Normalisation.** Les valeurs normalisées du tableau III-3 ne se retrouvent pas avec la règle valeur/P90 (TSP : 0,88 / 0,95 donne 0,93, le tableau indique 1,14). Le logiciel applique la règle valeur/P90 bornée entre 0,4 et 1,2, et permet d'imposer les valeurs publiées.
- **Sens de Xe.** Les sous-indicateurs de Xe sont normalisés en polarité inverse (plus haut = meilleur), alors que Xe entre ensuite dans Δ = Rz − Xe comme une mesure d'incertitude (plus haut = pire).
