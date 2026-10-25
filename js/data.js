/*
 * Données de référence : cas de la GAANA, tirées du mémoire
 * « Valeur nette logistique et pilotage de la performance logistique » (UNIKIN, 2025-2026).
 * Montants en millions de francs congolais (M FC).
 */
(function (root) {
  'use strict';

  var DIMENSIONS = [
    {
      id: 'alpha', sym: 'α', label: 'Efficacité opérationnelle',
      subs: [
        { code: 'TSP', label: 'Taux de service parfait', w: 0.348, pol: 'direct' },
        { code: 'TRP', label: 'Temps de réponse aux perturbations', w: 0.203, pol: 'inverse' },
        { code: 'FR', label: 'Flexibilité des ressources', w: 0.156, pol: 'direct' },
        { code: 'PI', label: 'Précision des inventaires', w: 0.138, pol: 'inverse' },
        { code: 'PE', label: "Productivité de l'entrepôt", w: 0.097, pol: 'direct' },
        { code: 'TUT', label: 'Taux d’utilisation du transport', w: 0.058, pol: 'direct' }
      ]
    },
    {
      id: 'omega', sym: 'Ω', label: 'Gestion des stocks',
      subs: [
        { code: 'TRSS', label: 'Taux de rupture de stock', w: 0.537, pol: 'inverse' },
        { code: 'TRS', label: 'Rotation des stocks', w: 0.187, pol: 'direct' },
        { code: 'Align', label: 'Alignement stock-demande', w: 0.171, pol: 'direct' },
        { code: 'TOD', label: "Taux d'obsolescence", w: 0.105, pol: 'inverse' }
      ]
    },
    {
      id: 'gamma', sym: 'γ', label: 'Conversion marchande',
      subs: [
        { code: 'TSCL', label: 'Satisfaction client logistique', w: 0.455, pol: 'inverse' },
        { code: 'EDRS', label: 'Élasticité demande/ruptures', w: 0.284, pol: 'inverse' },
        { code: 'MBM', label: 'Marge brute moyenne', w: 0.131, pol: 'direct' },
        { code: 'TPM', label: 'Taux de pénétration du marché', w: 0.071, pol: 'direct' },
        { code: 'TMMP', label: 'Délai de mise sur le marché', w: 0.060, pol: 'inverse' }
      ]
    },
    {
      id: 'rz', sym: 'Rz', label: 'Résilience organisationnelle',
      subs: [
        { code: 'DCF', label: 'Délai de changement de fournisseur', w: 0.232, pol: 'inverse' },
        { code: 'INT', label: 'Intelligence terrain', w: 0.128, pol: 'direct' },
        { code: 'ANT', label: 'Anticipation', w: 0.127, pol: 'direct' },
        { code: 'SS', label: 'Stock de sécurité', w: 0.110, pol: 'direct' },
        { code: 'MS', label: 'Multi-sourcing', w: 0.087, pol: 'direct' },
        { code: 'VD', label: 'Véhicules disponibles', w: 0.077, pol: 'direct' },
        { code: 'LL', label: 'Liquidité logistique', w: 0.066, pol: 'direct' },
        { code: 'CF', label: 'Contrats flexibles', w: 0.049, pol: 'direct' },
        { code: 'IA', label: 'Itinéraires alternatifs', w: 0.047, pol: 'direct' },
        { code: 'TR', label: 'Traçabilité', w: 0.037, pol: 'direct' },
        { code: 'ERP', label: 'ERP / TMS', w: 0.022, pol: 'direct' },
        { code: 'CT', label: 'Capacité tampon', w: 0.020, pol: 'direct' }
      ]
    },
    {
      id: 'xe', sym: 'Xe', label: 'Incertitude environnementale',
      subs: [
        { code: 'Xe_Ec', label: 'Dimension écologique', w: 0.350, pol: 'inverse' },
        { code: 'Xe_E', label: 'Dimension économique', w: 0.295, pol: 'inverse' },
        { code: 'Xe_T', label: 'Dimension technologique', w: 0.136, pol: 'inverse' },
        { code: 'Xe_P', label: 'Dimension politique', w: 0.111, pol: 'inverse' },
        { code: 'Xe_L', label: 'Dimension légale', w: 0.056, pol: 'inverse' },
        { code: 'Xe_S', label: 'Dimension socioculturelle', w: 0.053, pol: 'inverse' }
      ]
    }
  ];

  // Tableau III-3 (2022) : code → [valeur brute, P90, valeur normalisée publiée]
  var DETAIL_2022 = {
    TSP: [0.88, 0.95, 1.14], TRP: [6.8, 24, 0.40], PI: [0.09, 0.05, 0.40],
    FR: [3, 5, 0.88], PE: [55, 80, 0.95], TUT: [0.72, 0.90, 1.04],
    TRSS: [0.12, 0.10, 0.40], TRS: [5.2, 6, 1.09], Align: [3, 5, 0.88], TOD: [0.03, 0.05, 0.88],
    TSCL: [0.22, 0.20, 0.40], EDRS: [3, 5, 0.72], MBM: [0.28, 0.40, 0.96],
    TPM: [0.90, 1.30, 0.95], TMMP: [15, 14, 0.40],
    DCF: [12, 10, 0.40], INT: [3, 5, 0.88], ANT: [3, 5, 0.88], SS: [5, 14, 0.69],
    MS: [10, 5, 1.20], VD: [2, 5, 0.72], LL: [2, 5, 0.72], CF: [1, 5, 0.56],
    IA: [2, 5, 0.72], TR: [3, 5, 0.88], ERP: [1, 5, 0.56], CT: [2, 5, 0.72],
    Xe_Ec: [0.55, 0.60, 0.67], Xe_E: [0.62, 0.60, 0.40], Xe_T: [0.58, 0.60, 0.67],
    Xe_P: [0.45, 0.60, 0.80], Xe_L: [0.50, 0.60, 0.73], Xe_S: [0.40, 0.60, 0.87]
  };

  function buildDetail2022() {
    var d = {};
    Object.keys(DETAIL_2022).forEach(function (code) {
      var r = DETAIL_2022[code];
      d[code] = { raw: r[0], p90: r[1], ovr: r[2] };
    });
    return d;
  }

  function gaana() {
    return {
      params: { tau: 0.16, theta: 0.35, expo: { alpha: 0.40, omega: 0.35, gamma: 0.25 } },
      // Tableaux III-9 (indices) et III-12 (VMB, Clog)
      years: [
        { year: 2018, vmb: 3902.3, clog: 162.0, idx: { alpha: 0.93, omega: 0.87, gamma: 0.86, rz: 0.78, xe: 0.52 } },
        { year: 2019, vmb: 4206.1, clog: 170.0, idx: { alpha: 0.97, omega: 0.92, gamma: 0.90, rz: 0.82, xe: 0.48 } },
        { year: 2020, vmb: 3639.0, clog: 150.0, idx: { alpha: 0.69, omega: 0.48, gamma: 0.54, rz: 0.58, xe: 0.72 } },
        { year: 2021, vmb: 4310.2, clog: 180.0, idx: { alpha: 0.80, omega: 0.63, gamma: 0.65, rz: 0.68, xe: 0.65 } },
        { year: 2022, vmb: 4858.3, clog: 242.0, idx: { alpha: 0.84, omega: 0.57, gamma: 0.64, rz: 0.72, xe: 0.68 }, detail: buildDetail2022() }
      ],
      weights: (function () {
        var w = {};
        DIMENSIONS.forEach(function (d) { d.subs.forEach(function (s) { w[s.code] = s.w; }); });
        return w;
      })(),
      // Tableau III-14
      amdec: [
        { name: "Rupture d'approvisionnement", f: 4, g: 5, d: 3, dim: 'Ω, Rz' },
        { name: "Coupure d'électricité", f: 5, g: 4, d: 2, dim: 'Xe, Ω' },
        { name: 'Retard de livraison', f: 4, g: 3, d: 3, dim: 'α, γ' },
        { name: 'Panne de véhicule', f: 3, g: 4, d: 3, dim: 'α, Rz' },
        { name: 'Produits périmés', f: 4, g: 4, d: 2, dim: 'Ω, Xe' },
        { name: 'Embouteillage', f: 5, g: 3, d: 2, dim: 'Xe, α' },
        { name: 'Vol de produits', f: 2, g: 4, d: 3, dim: 'Xe, Ω' },
        { name: 'Inondation', f: 2, g: 4, d: 3, dim: 'Xe, α' },
        { name: 'Tracasseries administratives', f: 3, g: 3, d: 2, dim: 'Xe' },
        { name: 'Erreur de commande', f: 2, g: 3, d: 2, dim: 'α, γ' }
      ],
      // Tableau III-15
      actions: [
        { id: 1, name: 'Diversification des fournisseurs', cost: 50, gain: 120, risk: 'Rupture appro.' },
        { id: 2, name: 'Groupe électrogène supplémentaire', cost: 80, gain: 150, risk: 'Coupure élec.' },
        { id: 3, name: 'Optimisation des tournées', cost: 30, gain: 90, risk: 'Embouteillage' },
        { id: 4, name: 'Stock de sécurité renforcé', cost: 40, gain: 70, risk: 'Rupture appro.' },
        { id: 5, name: 'Formation du personnel', cost: 20, gain: 40, risk: 'Erreur commande' },
        { id: 6, name: 'Maintenance préventive', cost: 35, gain: 65, risk: 'Panne véhicule' },
        { id: 7, name: 'Contrats flexibles', cost: 25, gain: 55, risk: 'Rupture appro.' },
        { id: 8, name: 'Système de traçabilité', cost: 45, gain: 50, risk: 'Produits périmés' },
        { id: 9, name: 'Itinéraires alternatifs', cost: 15, gain: 35, risk: 'Embouteillage' },
        { id: 10, name: 'Assurance contre le vol', cost: 10, gain: 20, risk: 'Vol' }
      ],
      budget: 200
    };
  }

  var api = { DIMENSIONS: DIMENSIONS, gaana: gaana };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VNLData = api;
})(typeof window !== 'undefined' ? window : this);
