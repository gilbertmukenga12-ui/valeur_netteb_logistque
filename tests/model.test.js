/*
 * Tests du moteur VNL-SAD (NF9). Lancer : node tests/model.test.js [dossier_des_fiches_CSV]
 *
 * 1. Tests de structure, toujours exécutés : formules de l'annexe A, appliquées aux indices
 *    de janvier 2018 publiés à l'annexe B du cahier des charges.
 * 2. Tests de recette R2 à R4, R7 à R10, exécutés si le dossier des 60 fiches mensuelles est fourni
 *    (variable VNL_DATA ou premier argument). Les données de la GAANA sont confidentielles et ne
 *    sont pas versionnées.
 */
'use strict';
var fs = require('fs'), path = require('path');
var C = require('../js/config.js');
var I = require('../js/importer.js');
var M = require('../js/model.js');

var n = 0, fail = 0;
function ok(cond, label) { n++; if (!cond) { fail++; console.log('ÉCHEC  ' + label); } else console.log('ok     ' + label); }
function near(a, b, tol, label) { ok(Math.abs(a - b) <= tol, label + ' : ' + (+a.toFixed(6)) + ' attendu ' + b); }

var P = JSON.parse(JSON.stringify(C.DEFAULT_PARAMS));

/* ---------- 1. Formules (annexe B, tableau B-1) ---------- */
near(M.normalize(256 / 318, 0.95, 'up'), 0.847, 0.0005, 'TSP normalisé');
near(M.normalize(2 / 24, 0.02, 'down'), 0.240, 0.0005, 'TRSS normalisé');
near(M.normalize(70.9, 100, 'host'), 0.709, 0.0005, 'Xe_T normalisé');
ok(M.normalize(0, 24, 'down') === 1, 'Indicateur à réduire nul = 1');

var r = { vmb: 89.71e6, tau: 4.31 / 200.11, clog: 13.63e6, idx: { alpha: 0.804, omega: 0.478, gamma: 0.716, rz: 0.540, xe: 0.434 } };
var fin = M.evalReference({ mois: 'x', vmb: r.vmb, clog: r.clog, tau: r.tau, brut: {} }, P); // structure seulement
ok(typeof fin.vnl === 'number', 'evalReference renvoie une VNL');
// Recalcul direct des étapes 4 à 6 à partir des indices publiés
var w = P.wDim, i = r.idx;
var psi = Math.pow(i.alpha, w.alpha) * Math.pow(i.omega, w.omega) * Math.pow(i.gamma, w.gamma);
var E = i.xe * (1 - i.rz), phi = Math.exp(-P.theta * E);
var vnl = r.vmb * (1 - r.tau) * psi * phi - r.clog;
near(psi, 0.697, 0.0005, 'Ψ janvier 2018');
near(E, 0.200, 0.0005, 'E janvier 2018');
near(phi, 0.932, 0.001, 'Φ janvier 2018 (annexe calculée sur E arrondi)');
near(vnl / 1e6, 43.38, 0.05, 'VNL janvier 2018 (M FC)');
near(vnl / r.vmb, 0.484, 0.0005, 'VNL/VMB janvier 2018');
var vnl0 = r.vmb * (1 - r.tau) * psi - r.clog;
near(vnl0 / 1e6, 47.51, 0.05, 'VNL₀ janvier 2018');
near((vnl0 - vnl) / vnl0, 0.087, 0.001, 'Réduction due à l’hostilité');
var parts = [-w.alpha * Math.log(i.alpha), -w.omega * Math.log(i.omega), -w.gamma * Math.log(i.gamma), P.theta * E];
var tot = parts.reduce(function (a, b) { return a + b; });
near(parts[2] / tot, 0.41, 0.005, 'Part de γ'); near(parts[1] / tot, 0.27, 0.005, 'Part de Ω');
near(parts[0] / tot, 0.16, 0.005, 'Part de α'); near(parts[3] / tot, 0.16, 0.005, 'Part de l’hostilité');

/* Exclusion et redistribution (F3.5) */
var dw = M.dimWeights(P, 'omega');
ok(!('TOD' in dw), 'TOD exclu de Ω');
near(dw.TRSS + dw.Align + dw.TRS, 1, 1e-9, 'Poids de Ω redistribués à 1');

/* Contrôles de saisie (R12) */
var def = function (k) { return C.VARIABLES.filter(function (v) { return v.key === k; })[0]; };
ok(M.checkValue(def('flexibilite'), 7) !== null, 'Score de 7 refusé');
ok(M.checkValue(def('ca'), -5) !== null, 'Montant négatif refusé');
ok(M.checkValue(def('prix'), -0.05) === null, 'Variation de prix négative acceptée');
ok(M.checkCoherence({ retours: 120, ventes: 100 }).length === 1, 'Retours supérieurs aux ventes refusés');

/* AHP : matrice cohérente et exemple classique */
var A = M.ahpMatrix(3, [2, 4, 2]);
var wa = M.ahpWeights(A);
near(wa[0], 4 / 7, 1e-9, 'AHP poids exact sur matrice cohérente');
near(M.ahpConsistency(A).RC, 0, 1e-9, 'AHP RC nul sur matrice cohérente');
var B = M.ahpMatrix(3, [9, 1 / 9, 1 / 9]);
ok(!M.ahpConsistency(B).coherent, 'AHP matrice incohérente signalée');
var agg = M.ahpAggregate([M.ahpMatrix(3, [2, 4, 2]), M.ahpMatrix(3, [8, 4, 0.5])]);
near(agg[0][1], 4, 1e-9, 'AHP agrégation par moyenne géométrique');

/* AMDEC */
var cr = M.amdecCriticite([{ F: 4, G: 5, D: 2 }, { F: 3, G: 5, D: 3 }]);
near(cr.C, 3.5 * 5 * 2.5, 1e-9, 'Criticité sur moyennes non arrondies');
ok(cr.classe === 'Critique' && cr.gravite5, 'Classe critique et gravité 5');

/* VAN et optimisation (R7, R8) avec les VAN publiées */
near(M.van(10, 5, 3, 0.15), -10 + 5 / 1.15 + 5 / 1.3225 + 5 / 1.520875, 1e-9, 'VAN');
var acts = M.evaluateActions(C.ACTIONS, null, P);
var o = M.optimize(acts, 25e6);
ok(o.actions.join(',') === '3,5,7,8,9', 'R7 actions retenues 3, 5, 7, 8, 9');
near(o.cout / 1e6, 15, 1e-9, 'R7 coût 15 M FC');
near(o.van / 1e6, 25.43, 0.005, 'R7 VAN cumulée 25,43 M FC');
ok(M.optimize(acts, 5e6).actions.join(',') === '3,7', 'R8 actions 3 et 7 pour 5 M FC');
var f = M.optimize(acts, 25e6, [12]);
ok(f.actions.indexOf(12) >= 0 && Math.abs(f.reste - (25e6 - f.cout)) < 1, 'R18 action imposée et budget restant');

/* ---------- 2. Recette sur les 60 mois ---------- */
var dir = process.argv[2] || process.env.VNL_DATA;
if (dir && fs.existsSync(dir)) {
  var months = fs.readdirSync(dir).filter(function (d) { return /^\d{4}-\d{2}$/.test(d); }).sort().map(function (d) {
    var m = { mois: d, recon: {} };
    fs.readdirSync(path.join(dir, d)).forEach(function (file) {
      var p = I.parseServiceCsv(fs.readFileSync(path.join(dir, d, file), 'utf8'));
      Object.assign(m, p.valeurs);
    });
    return m;
  });
  var res = M.computeAll(months, P, acts);
  var y = {}; res.annees.forEach(function (a) { y[a.annee] = a; });
  ok(months.length === 60, '60 mois chargés');
  near(res.mois[0].vnl / 1e6, 43.38, 0.005, 'R1 VNL janvier 2018');
  near(res.mois[0].ratio, 0.484, 0.0005, 'R1 VNL/VMB janvier 2018');
  near(y[2018].vnl / 1e6, 627.5, 0.05, 'R2 VNL 2018');
  near(y[2022].vnl / 1e6, 261.0, 0.05, 'R2 VNL 2022');
  var all = M.aggregate(res.mois);
  near(all.vnl / 1e6, 2039.1, 0.05, 'R3 VNL cumulée');
  near(all.ratio, 0.367, 0.0005, 'R3 ratio cumulé');
  var lvl = res.mois.filter(function (x) { return x.alertes.some(function (a) { return a.regle === 'niveau'; }); });
  ok(lvl[0].mois === '2020-01', 'R4 première alerte VNL/VMB en janvier 2020');
  ok(lvl.length === 36, 'R4 36 mois en alerte VNL/VMB (' + lvl.length + ')');
  var om = {}; res.mois.forEach(function (x) { if (x.alertes.some(function (a) { return a.regle === 'stocks'; })) om[x.mois.slice(0, 4)] = (om[x.mois.slice(0, 4)] || 0) + 1; });
  ok([2018, 2019, 2020, 2021, 2022].map(function (k) { return om[k] || 0; }).join(',') === '0,0,3,5,4', 'R4 alertes Ω 0, 0, 3, 5, 4');
  ok(res.mois.filter(function (x) { return x.idx.omega < 0.4; })[0].mois === '2020-04', 'R4 première alerte Ω en avril 2020');
  ok(res.mois.every(function (x) { var s = x.vnl + x.retraits.pertes + x.retraits.inefficacite + x.retraits.hostilite + x.retraits.couts; return Math.abs(s - x.vmb) < 1e-3; }), 'R9 retraits + VNL = VMB chaque mois');
  var psiS = res.mois.map(function (x) { return x.psi; });
  var rho = M.spearman(res.mois.map(function (x) { return x.idx.xe; }), psiS).rho;
  near(rho, -0.767, 0.01, 'R10 ρ hostilité / Ψ en niveaux');
  var mw = M.mannWhitney(res.mois.filter(function (x) { return x.mois.slice(0, 4) === '2020'; }).map(function (x) { return x.psi; }), res.mois.filter(function (x) { return x.mois < '2020'; }).map(function (x) { return x.psi; }));
  ok(mw.U === 0, 'R10 U = 0 pour Ψ 2020 contre 2018-2019');
  // F5.11 : un mois ajouté ne change pas les mois précédents
  var before = M.computeAll(months.slice(0, 59), P, acts).mois.map(function (x) { return x.vnl; });
  ok(before.every(function (v, k) { return v === res.mois[k].vnl; }), 'F5.11 un mois ajouté ne modifie pas les précédents');
} else {
  console.log('\n(Recette sur 60 mois non exécutée : indiquer le dossier des fiches CSV en argument.)');
}

console.log('\n' + (n - fail) + ' / ' + n + ' tests réussis');
process.exit(fail ? 1 : 0);
