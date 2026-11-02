/*
 * Configuration du modèle VNL-SAD : variables de la fiche mensuelle,
 * sous-indicateurs, paramètres de départ, défaillances et actions.
 * Source : cahier des charges VNL-SAD GAANA (v1.0, nov. 2026), sections 4, 6.1, 6.2,
 * tableau 6 et annexe B. Tout ce qui figure ici est modifiable par paramétrage.
 */
(function (root) {
  'use strict';

  /* Services (rôles de saisie). Le code du service correspond au nom du fichier CSV. */
  var SERVICES = [
    { code: 'comptabilite', label: 'Comptabilité (P5)' },
    { code: 'production', label: 'Production (P3)' },
    { code: 'commercial', label: 'Commercial (P4)' },
    { code: 'achat', label: 'Achat (P2)' },
    { code: 'direction', label: 'Direction (P1)' }
  ];

  /*
   * Les 45 variables de la fiche. fam : A montants, B opérations, C scores, D environnement.
   * unit : 'fc' (francs congolais), 'nb', 'kg', 'h', 'j' (jours), 'taux' (0-1), 'score' (1-5).
   * recon : grandeur reconstituée selon le cahier des charges (F1.6).
   */
  var VARIABLES = [
    // A. Montants (comptabilité)
    { key: 'ca', n: 1, fam: 'A', svc: 'comptabilite', unit: 'fc', label: "Chiffre d'affaires" },
    { key: 'cmv', n: 2, fam: 'A', svc: 'comptabilite', unit: 'fc', label: 'Coût des marchandises vendues' },
    { key: 'pertes', n: 3, fam: 'A', svc: 'comptabilite', unit: 'fc', label: 'Valeur des pertes et produits détruits', recon: true },
    { key: 'transport', n: 4, fam: 'A', svc: 'comptabilite', unit: 'fc', label: 'Transport et carburant des véhicules' },
    { key: 'energie', n: 5, fam: 'A', svc: 'comptabilite', unit: 'fc', label: 'Électricité et carburant du groupe' },
    { key: 'maintenance', n: 6, fam: 'A', svc: 'comptabilite', unit: 'fc', label: 'Maintenance des véhicules et du froid' },
    { key: 'salaires', n: 7, fam: 'A', svc: 'comptabilite', unit: 'fc', label: 'Salaires du personnel logistique' },
    { key: 'autres', n: 8, fam: 'A', svc: 'comptabilite', unit: 'fc', label: 'Autres coûts logistiques (hors pertes)' },
    // B. Opérations
    { key: 'commandes', n: 9, fam: 'B', svc: 'commercial', unit: 'nb', label: 'Commandes reçues' },
    { key: 'livraisons', n: 10, fam: 'B', svc: 'commercial', unit: 'nb', label: 'Commandes livrées complètes et à temps', recon: true },
    { key: 'jours', n: 11, fam: 'B', svc: 'production', unit: 'j', label: 'Jours travaillés' },
    { key: 'ruptures', n: 12, fam: 'B', svc: 'production', unit: 'j', label: 'Jours de rupture' },
    { key: 'coupures', n: 13, fam: 'B', svc: 'production', unit: 'h', label: 'Heures de coupure d’électricité' },
    { key: 'couverture', n: 14, fam: 'B', svc: 'production', unit: 'h', label: 'Heures couvertes par le groupe' },
    { key: 'production', n: 15, fam: 'B', svc: 'production', unit: 'kg', label: 'Production' },
    { key: 'capacite', n: 16, fam: 'B', svc: 'production', unit: 'kg', label: 'Capacité théorique' },
    { key: 'utilisation', n: 17, fam: 'B', svc: 'production', unit: 'taux', label: 'Taux d’utilisation des véhicules' },
    { key: 'disponibilite', n: 18, fam: 'B', svc: 'production', unit: 'taux', label: 'Disponibilité des véhicules' },
    { key: 'ventes', n: 19, fam: 'B', svc: 'commercial', unit: 'kg', label: 'Quantités vendues' },
    { key: 'retours', n: 20, fam: 'B', svc: 'commercial', unit: 'kg', label: 'Quantités retournées' },
    { key: 'clients', n: 21, fam: 'B', svc: 'commercial', unit: 'nb', label: 'Clients actifs' },
    { key: 'securite', n: 22, fam: 'B', svc: 'production', unit: 'j', label: 'Stock de sécurité (jours de vente)' },
    { key: 'fournisseurs', n: 23, fam: 'B', svc: 'achat', unit: 'nb', label: 'Fournisseurs actifs' },
    { key: 'contrats', n: 24, fam: 'B', svc: 'achat', unit: 'nb', label: 'Contrats formels actifs' },
    { key: 'inventaire', n: 25, fam: 'B', svc: 'production', unit: 'taux', label: 'Écart d’inventaire (fiche / comptage)', recon: true },
    { key: 'rotation', n: 26, fam: 'B', svc: 'production', unit: 'nb', label: 'Rotation des stocks (fois par mois)' },
    { key: 'obsolescence', n: 27, fam: 'B', svc: 'production', unit: 'taux', label: 'Taux d’obsolescence' },
    { key: 'marge', n: 28, fam: 'B', svc: 'commercial', unit: 'taux', label: 'Marge brute moyenne' },
    { key: 'marche', n: 29, fam: 'B', svc: 'commercial', unit: 'j', label: 'Délai de mise sur le marché', recon: true },
    { key: 'changement', n: 30, fam: 'B', svc: 'achat', unit: 'j', label: 'Délai de changement de fournisseur' },
    { key: 'elasticite', n: 31, fam: 'B', svc: 'commercial', unit: 'nb', label: 'Élasticité de la demande aux ruptures', recon: true },
    { key: 'reponse', n: 32, fam: 'B', svc: 'production', unit: 'h', label: 'Temps de réponse à une perturbation', recon: true },
    { key: 'itineraires', n: 33, fam: 'B', svc: 'commercial', unit: 'nb', label: 'Itinéraires alternatifs documentés' },
    // C. Scores
    { key: 'flexibilite', n: 34, fam: 'C', svc: 'direction', unit: 'score', label: 'Flexibilité des ressources' },
    { key: 'intelligence', n: 35, fam: 'C', svc: 'direction', unit: 'score', label: 'Intelligence terrain' },
    { key: 'anticipation', n: 36, fam: 'C', svc: 'direction', unit: 'score', label: 'Anticipation' },
    { key: 'liquidite', n: 37, fam: 'C', svc: 'direction', unit: 'score', label: 'Liquidité logistique' },
    { key: 'tracabilite', n: 38, fam: 'C', svc: 'direction', unit: 'score', label: 'Traçabilité' },
    { key: 'informatique', n: 39, fam: 'C', svc: 'direction', unit: 'score', label: 'Outil informatique' },
    // D. Environnement
    { key: 'prix', n: 40, fam: 'D', svc: 'comptabilite', unit: 'taux', label: 'Variation du prix des matières premières', signed: true },
    { key: 'perturbation_appro', n: 41, fam: 'D', svc: 'direction', unit: 'j', label: 'Jours de perturbation de l’approvisionnement' },
    { key: 'perturbation_transport', n: 42, fam: 'D', svc: 'direction', unit: 'j', label: 'Jours de perturbation du transport' },
    { key: 'sanitaire', n: 43, fam: 'D', svc: 'direction', unit: 'nb', label: 'Incidents sanitaires ou restrictions' },
    { key: 'climat', n: 44, fam: 'D', svc: 'direction', unit: 'j', label: 'Jours d’événements climatiques' },
    { key: 'legal', n: 45, fam: 'D', svc: 'direction', unit: 'nb', label: 'Contrôles et contraintes légales' }
  ];

  var CLOG_KEYS = ['transport', 'energie', 'maintenance', 'salaires', 'autres'];

  /*
   * Sous-indicateurs (tableau 20). sens : 'up' à élever, 'down' à réduire, 'host' hostilité.
   * mesure(v) retourne la valeur brute du mois à partir des variables saisies.
   */
  function ratio(a, b) {
    return (typeof a === 'number' && typeof b === 'number' && b > 0) ? a / b : null;
  }
  function val(v, k) { return typeof v[k] === 'number' ? v[k] : null; }

  var DIMENSIONS = [
    { code: 'alpha', sym: 'α', label: 'Efficacité opérationnelle' },
    { code: 'omega', sym: 'Ω', label: 'Tension sur les stocks' },
    { code: 'gamma', sym: 'γ', label: 'Réactivité commerciale' },
    { code: 'rz', sym: 'Rz', label: 'Résilience' },
    { code: 'xe', sym: 'Xe', label: 'Hostilité de l’environnement' }
  ];

  var SUB_INDICATORS = [
    { code: 'TUT', dim: 'alpha', sens: 'up', cible: 0.90, poids: 0.195, label: 'Taux d’utilisation des véhicules', mesure: function (v) { return val(v, 'utilisation'); } },
    { code: 'TSP', dim: 'alpha', sens: 'up', cible: 0.95, poids: 0.174, label: 'Commandes livrées complètes et à temps / reçues', mesure: function (v) { return ratio(v.livraisons, v.commandes); } },
    { code: 'PE', dim: 'alpha', sens: 'up', cible: 0.85, poids: 0.170, label: 'Production / capacité théorique', mesure: function (v) { return ratio(v.production, v.capacite); } },
    { code: 'TRP', dim: 'alpha', sens: 'down', cible: 24, poids: 0.166, label: 'Temps de réponse à une perturbation (h)', mesure: function (v) { return val(v, 'reponse'); } },
    { code: 'PI', dim: 'alpha', sens: 'down', cible: 0.01, poids: 0.158, label: 'Écart d’inventaire', mesure: function (v) { return val(v, 'inventaire'); } },
    { code: 'FR', dim: 'alpha', sens: 'up', cible: 5, poids: 0.138, label: 'Flexibilité des ressources (score)', mesure: function (v) { return val(v, 'flexibilite'); } },

    { code: 'TRSS', dim: 'omega', sens: 'down', cible: 0.02, poids: 0.685, label: 'Jours de rupture / jours travaillés', mesure: function (v) { return ratio(v.ruptures, v.jours); } },
    { code: 'Align', dim: 'omega', sens: 'up', cible: 0.95, poids: 0.181, label: 'Quantités vendues / produites', mesure: function (v) { return ratio(v.ventes, v.production); } },
    { code: 'TRS', dim: 'omega', sens: 'up', cible: 6, poids: 0.134, label: 'Rotation des stocks', mesure: function (v) { return val(v, 'rotation'); } },
    { code: 'TOD', dim: 'omega', sens: 'down', cible: null, poids: 0, exclu: true, label: 'Taux d’obsolescence (exclu : déjà dans τ)', mesure: function (v) { return val(v, 'obsolescence'); } },

    { code: 'TMMP', dim: 'gamma', sens: 'down', cible: 14, poids: 0.410, label: 'Délai de mise sur le marché (j)', mesure: function (v) { return val(v, 'marche'); } },
    { code: 'EDRS', dim: 'gamma', sens: 'down', cible: 0.30, poids: 0.378, label: 'Élasticité de la demande aux ruptures', mesure: function (v) { return val(v, 'elasticite'); } },
    { code: 'TPM', dim: 'gamma', sens: 'up', cible: 120, poids: 0.122, label: 'Clients actifs', mesure: function (v) { return val(v, 'clients'); } },
    { code: 'TSCL', dim: 'gamma', sens: 'down', cible: 0.01, poids: 0.089, label: 'Quantités retournées / vendues', mesure: function (v) { return ratio(v.retours, v.ventes); } },
    { code: 'MBM', dim: 'gamma', sens: 'up', cible: null, poids: 0, exclu: true, label: 'Marge brute moyenne (exclue : déjà dans la VMB)', mesure: function (v) { return val(v, 'marge'); } },

    { code: 'ANT', dim: 'rz', sens: 'up', cible: 5, poids: 0.155, label: 'Anticipation (score)', mesure: function (v) { return val(v, 'anticipation'); } },
    { code: 'SS', dim: 'rz', sens: 'up', cible: 7, poids: 0.134, label: 'Stock de sécurité (jours)', mesure: function (v) { return val(v, 'securite'); } },
    { code: 'LL', dim: 'rz', sens: 'up', cible: 5, poids: 0.108, label: 'Liquidité logistique (score)', mesure: function (v) { return val(v, 'liquidite'); } },
    { code: 'DCF', dim: 'rz', sens: 'down', cible: 10, poids: 0.103, label: 'Délai de changement de fournisseur (j)', mesure: function (v) { return val(v, 'changement'); } },
    { code: 'IA', dim: 'rz', sens: 'up', cible: 5, poids: 0.092, label: 'Itinéraires alternatifs documentés', mesure: function (v) { return val(v, 'itineraires'); } },
    { code: 'MS', dim: 'rz', sens: 'up', cible: 5, poids: 0.071, label: 'Fournisseurs actifs', mesure: function (v) { return val(v, 'fournisseurs'); } },
    { code: 'CF', dim: 'rz', sens: 'up', cible: 1, poids: 0.069, label: 'Contrats formels actifs', mesure: function (v) { return val(v, 'contrats'); } },
    { code: 'INT', dim: 'rz', sens: 'up', cible: 5, poids: 0.068, label: 'Intelligence terrain (score)', mesure: function (v) { return val(v, 'intelligence'); } },
    { code: 'VD', dim: 'rz', sens: 'up', cible: 0.95, poids: 0.063, label: 'Disponibilité des véhicules', mesure: function (v) { return val(v, 'disponibilite'); } },
    { code: 'ERP', dim: 'rz', sens: 'up', cible: 5, poids: 0.058, label: 'Outil informatique (score)', mesure: function (v) { return val(v, 'informatique'); } },
    { code: 'CT', dim: 'rz', sens: 'up', cible: 1, poids: 0.055, label: 'Heures de coupure couvertes / heures de coupure', mesure: function (v) {
      if (typeof v.coupures !== 'number') return null;
      if (v.coupures === 0) return 1;
      return ratio(v.couverture, v.coupures);
    } },
    { code: 'TR', dim: 'rz', sens: 'up', cible: 5, poids: 0.023, label: 'Traçabilité (score)', mesure: function (v) { return val(v, 'tracabilite'); } },

    { code: 'Xe_L', dim: 'xe', sens: 'host', cible: 5, poids: 0.268, label: 'Contrôles et contraintes légales', mesure: function (v) { return val(v, 'legal'); } },
    { code: 'Xe_S', dim: 'xe', sens: 'host', cible: 4, poids: 0.209, label: 'Incidents sanitaires ou restrictions', mesure: function (v) { return val(v, 'sanitaire'); } },
    { code: 'Xe_T', dim: 'xe', sens: 'host', cible: 100, poids: 0.165, label: 'Heures de coupure d’électricité', mesure: function (v) { return val(v, 'coupures'); } },
    { code: 'Xe_Ec', dim: 'xe', sens: 'host', cible: 5, poids: 0.142, label: 'Jours d’événements climatiques', mesure: function (v) { return val(v, 'climat'); } },
    { code: 'Xe_E1', dim: 'xe', sens: 'host', cible: 0.15, poids: 0.077, label: 'Variation absolue du prix des matières', mesure: function (v) { return typeof v.prix === 'number' ? Math.abs(v.prix) : null; } },
    { code: 'Xe_E2', dim: 'xe', sens: 'host', cible: 10, poids: 0.077, label: 'Jours de perturbation de l’approvisionnement', mesure: function (v) { return val(v, 'perturbation_appro'); } },
    { code: 'Xe_P', dim: 'xe', sens: 'host', cible: 10, poids: 0.063, label: 'Jours de perturbation du transport', mesure: function (v) { return val(v, 'perturbation_transport'); } }
  ];

  /* Paramètres de départ (tableau 6). */
  var DEFAULT_PARAMS = {
    wDim: { alpha: 0.310, omega: 0.157, gamma: 0.533 },
    theta: 0.35,
    seuilRatio: 0.3998,
    seuilOmega: 0.40,
    seuilBaisse: 0.05, // baisse du ratio VNL/VMB d'un mois à l'autre, en points (à fixer par la direction)
    amdec: { critique: 35, majeure: 20 },
    budget: 25e6,
    taux: 0.15,
    seuilSensibilite: 0.05,
    anneeReference: 2022,
    sub: {} // cibles, poids et exclusions par sous-indicateur, rempli à l'initialisation
  };
  SUB_INDICATORS.forEach(function (s) {
    DEFAULT_PARAMS.sub[s.code] = { cible: s.cible, poids: s.poids, exclu: !!s.exclu };
  });

  /* Explications courtes des paramètres (F3.7). */
  var PARAM_HELP = {
    wDim: 'Poids de α, Ω et γ dans Ψ. Issus de la pondération AHP des cinq responsables.',
    theta: 'Sensibilité de la valeur à l’exposition non absorbée. Plus θ est grand, plus l’hostilité pèse. Hypothèse de travail du mémoire.',
    seuilRatio: 'Seuil d’alerte du ratio VNL/VMB : plus bas ratio mensuel observé en 2018-2019.',
    seuilOmega: 'Seuil d’alerte de l’indice Ω (tension sur les stocks). Convention de pilotage.',
    seuilBaisse: 'Baisse du ratio VNL/VMB d’un mois à l’autre qui déclenche une alerte (en points de ratio). À fixer par la direction.',
    budget: 'Budget disponible pour les actions correctives (en FC). Fixé par la direction.',
    taux: 'Taux d’actualisation utilisé pour la VAN des actions.',
    seuilSensibilite: 'Écart de VNL au-delà duquel un paramètre est jugé influent.',
    anneeReference: 'Année sur laquelle on mesure le gain des actions correctives.'
  };

  /* Défaillances AMDEC de départ (tableau B-2). crit : criticité publiée dans le mémoire. */
  var FAILURES = [
    { id: 'F01', nom: "Coupure d'électricité", maillon: 'Production / stockage', crit: 43.3, gravite5: false },
    { id: 'F02', nom: "Rupture d'approvisionnement", maillon: 'Approvisionnement', crit: 35.6 },
    { id: 'F03', nom: 'Produits périmés ou avariés', maillon: 'Stockage', crit: 32.0 },
    { id: 'F04', nom: 'Panne du compresseur de la chambre froide', maillon: 'Stockage', crit: 27.2, gravite5: true },
    { id: 'F05', nom: 'Flambée du prix des surgelés importés', maillon: 'Approvisionnement', crit: 24.0 },
    { id: 'F06', nom: 'Retard de livraison', maillon: 'Distribution', crit: 22.0 },
    { id: 'F07', nom: 'Tracasseries administratives', maillon: 'Distribution', crit: 22.0 },
    { id: 'F08', nom: 'Panne de véhicule', maillon: 'Distribution', crit: 17.8 },
    { id: 'F09', nom: 'Vol de produits', maillon: 'Stockage', crit: 14.0 },
    { id: 'F10', nom: 'Erreur de commande', maillon: 'Commercial', crit: 14.0 },
    { id: 'F11', nom: 'Embouteillage', maillon: 'Distribution', crit: 9.3 },
    { id: 'F12', nom: 'Inondation', maillon: 'Distribution', crit: 8.7 }
  ];

  /*
   * Actions correctives de départ (tableau B-2). cible : sous-indicateur visé ('tau' pour le taux de pertes).
   * cout et vanRef en FC. La valeur attendue, le coût annuel et la durée d'effet figurent dans le classeur
   * du mémoire ; tant qu'ils ne sont pas saisis, la VAN publiée (vanRef) est utilisée.
   * Le rattachement au sous-indicateur est une proposition à confirmer avec le mémoire.
   */
  var ACTIONS = [
    { n: 1, nom: 'Diversification des fournisseurs', defaillance: 'F02', cible: 'MS', cout: 4.0e6, vanRef: -1.78e6 },
    { n: 2, nom: 'Groupe électrogène supplémentaire', defaillance: 'F01', cible: 'CT', cout: 36.0e6, vanRef: -39.87e6 },
    { n: 3, nom: 'Optimisation des tournées', defaillance: 'F06', cible: 'TSP', cout: 3.0e6, vanRef: 5.24e6 },
    { n: 4, nom: 'Stock de sécurité renforcé', defaillance: 'F02', cible: 'SS', cout: 12.0e6, vanRef: -7.63e6 },
    { n: 5, nom: 'Formation du personnel', defaillance: 'F10', cible: 'PI', cout: 2.5e6, vanRef: 1.27e6 },
    { n: 6, nom: 'Maintenance préventive des véhicules', defaillance: 'F08', cible: 'VD', cout: 6.0e6, vanRef: -7.43e6 },
    { n: 7, nom: 'Contrats flexibles', defaillance: 'F02', cible: 'TRSS', cout: 1.0e6, vanRef: 9.85e6 },
    { n: 8, nom: 'Système de traçabilité', defaillance: 'F03', cible: 'tau', cout: 7.0e6, vanRef: 6.25e6 },
    { n: 9, nom: 'Itinéraires alternatifs', defaillance: 'F11', cible: 'IA', cout: 1.5e6, vanRef: 2.82e6 },
    { n: 10, nom: 'Assurance contre le vol', defaillance: 'F09', cible: 'tau', cout: 1.0e6, vanRef: -0.11e6 },
    { n: 11, nom: 'Logiciel simple de gestion des stocks', defaillance: 'F10', cible: 'PI', cout: 5.0e6, vanRef: -2.72e6 },
    { n: 12, nom: 'Révision ou remplacement du compresseur', defaillance: 'F04', cible: 'tau', cout: 9.0e6, vanRef: -0.31e6 }
  ];

  /* Échelle AMDEC (tableau II-19, libellés simplifiés). */
  var AMDEC_SCALE = {
    F: ['Très rare', 'Rare', 'Occasionnelle', 'Fréquente', 'Très fréquente'],
    G: ['Négligeable', 'Mineure', 'Moyenne', 'Grave', 'Très grave (arrêt, perte du stock)'],
    D: ['Évidente', 'Facile', 'Moyenne', 'Difficile', 'Presque impossible']
  };

  /* Indices aléatoires de Saaty (tableau II-16). */
  var RI = { 1: 0, 2: 0, 3: 0.58, 4: 0.90, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49, 11: 1.51, 12: 1.48, 13: 1.56, 14: 1.57, 15: 1.59 };

  /* Questionnaire d'appréciation (F12.4). */
  var QUESTIONNAIRE = [
    { code: 'U1', construit: 'Utilité', texte: 'Le SAD m’aide à comprendre la performance logistique.' },
    { code: 'U2', construit: 'Utilité', texte: 'Le SAD m’indique où agir en priorité.' },
    { code: 'U3', construit: 'Utilité', texte: 'Le SAD m’aide à décider plus vite.' },
    { code: 'U4', construit: 'Utilité', texte: 'Le SAD améliore la qualité de mes décisions.' },
    { code: 'F1', construit: 'Facilité', texte: 'Le SAD est facile à prendre en main.' },
    { code: 'F2', construit: 'Facilité', texte: 'Les écrans sont clairs.' },
    { code: 'F3', construit: 'Facilité', texte: 'Je peux utiliser le SAD sans aide technique.' },
    { code: 'I1', construit: 'Intention', texte: 'J’ai l’intention d’utiliser le SAD chaque mois.' }
  ];

  root.VNLConfig = {
    SERVICES: SERVICES,
    VARIABLES: VARIABLES,
    CLOG_KEYS: CLOG_KEYS,
    DIMENSIONS: DIMENSIONS,
    SUB_INDICATORS: SUB_INDICATORS,
    DEFAULT_PARAMS: DEFAULT_PARAMS,
    PARAM_HELP: PARAM_HELP,
    FAILURES: FAILURES,
    ACTIONS: ACTIONS,
    AMDEC_SCALE: AMDEC_SCALE,
    RI: RI,
    QUESTIONNAIRE: QUESTIONNAIRE
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.VNLConfig;
})(typeof window !== 'undefined' ? window : globalThis);
