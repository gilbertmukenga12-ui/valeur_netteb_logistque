/*
 * Noyau de calcul du modèle VNL (Valeur Nette Logistique).
 * Fonctions pures, sans accès au DOM, pour pouvoir les tester avec Node.
 *
 *   VNL = VMB × (1 − τ) × Ψ × Φ − Clog
 *   Ψ   = α^a × Ω^b × γ^c            (taux de conversion opérationnelle)
 *   Φ   = exp(θ × (Rz − Xe))          (modulateur environnemental)
 */
(function (root) {
  'use strict';

  var NORM_MIN = 0.4;
  var NORM_MAX = 1.2;

  function isNum(x) {
    return typeof x === 'number' && isFinite(x);
  }

  /** Normalisation par rapport au P90 local, bornée entre NORM_MIN et NORM_MAX. */
  function normalize(value, p90, polarity) {
    if (!isNum(value) || !isNum(p90) || p90 <= 0) return NaN;
    var r;
    if (polarity === 'inverse') {
      r = value <= 0 ? NORM_MAX : p90 / value;
    } else {
      r = value / p90;
    }
    return Math.min(NORM_MAX, Math.max(NORM_MIN, r));
  }

  /** Moyenne pondérée Σ w·v / Σ w (les poids AHP ne totalisent pas toujours exactement 1). */
  function weightedIndex(items) {
    var sw = 0;
    var s = 0;
    items.forEach(function (it) {
      if (isNum(it.v) && isNum(it.w)) {
        sw += it.w;
        s += it.w * it.v;
      }
    });
    return sw > 0 ? s / sw : NaN;
  }

  function psi(alpha, omega, gamma, expo) {
    if (!(alpha > 0 && omega > 0 && gamma > 0)) return 0;
    return Math.pow(alpha, expo.alpha) * Math.pow(omega, expo.omega) * Math.pow(gamma, expo.gamma);
  }

  function phi(rz, xe, theta) {
    return Math.exp(theta * (rz - xe));
  }

  /** Calcule tous les résultats d'une année à partir des cinq indices. */
  function computeYear(rec, params) {
    var i = rec.idx;
    var p = psi(i.alpha, i.omega, i.gamma, params.expo);
    var delta = i.rz - i.xe;
    var f = phi(i.rz, i.xe, params.theta);
    var vnl = rec.vmb * (1 - params.tau) * p * f - rec.clog;
    return {
      year: rec.year,
      vmb: rec.vmb,
      clog: rec.clog,
      psi: p,
      delta: delta,
      phi: f,
      vnl: vnl,
      ratio: rec.vmb > 0 ? vnl / rec.vmb : NaN
    };
  }

  /**
   * Libellé de régime de performance (cf. section 2.7 du mémoire).
   * Seuils : ≥ 70 % création élevée ; < 50 % création réduite ;
   * entre les deux, « reprise fragile » si la VNL remonte sans retrouver son pic.
   */
  function computeAll(years, params) {
    var results = years.map(function (y) { return computeYear(y, params); });
    results.forEach(function (r, k) {
      if (r.vnl < 0) { r.status = 'Destruction de valeur'; return; }
      if (r.ratio >= 0.7) { r.status = 'Création élevée'; return; }
      if (r.ratio < 0.5) { r.status = 'Création réduite'; return; }
      var prev = k > 0 ? results[k - 1].vnl : null;
      var peak = -Infinity;
      for (var j = 0; j < k; j++) peak = Math.max(peak, results[j].vnl);
      r.status = prev !== null && r.vnl > prev && r.vnl < peak ? 'Reprise fragile' : 'Création moyenne';
    });
    return results;
  }

  /** Criticité AMDEC = fréquence × gravité × détectabilité. */
  function criticality(f, g, d) {
    return f * g * d;
  }

  function criticalityLevel(c) {
    if (c > 35) return 'Critique';
    if (c >= 20) return 'Majeur';
    return 'Modéré';
  }

  /**
   * Sac à dos 0/1 exact : maximise le gain total sous contrainte de budget.
   * Les coûts sont ramenés à des entiers (dixièmes de million) pour la programmation dynamique.
   * À gain égal, la combinaison la moins chère est préférée.
   */
  function optimize(actions, budget) {
    var S = 10;
    var B = Math.max(0, Math.floor(budget * S + 1e-9));
    var n = actions.length;
    var cost = actions.map(function (a) { return Math.round(a.cost * S); });
    var best = [];
    var take = [];
    var c, i;
    for (c = 0; c <= B; c++) best.push({ gain: 0, spent: 0 });
    for (i = 0; i < n; i++) {
      take.push(new Array(B + 1).fill(false));
      for (c = B; c >= cost[i]; c--) {
        var cand = best[c - cost[i]].gain + actions[i].gain;
        var candSpent = best[c - cost[i]].spent + cost[i];
        var cur = best[c];
        if (cand > cur.gain + 1e-9 || (Math.abs(cand - cur.gain) <= 1e-9 && candSpent < cur.spent && cand > 0)) {
          best[c] = { gain: cand, spent: candSpent };
          take[i][c] = true;
        }
      }
    }
    var selected = [];
    c = B;
    for (i = n - 1; i >= 0; i--) {
      if (take[i][c]) {
        selected.unshift(actions[i].id);
        c -= cost[i];
      }
    }
    var totalCost = 0;
    var totalGain = 0;
    actions.forEach(function (a) {
      if (selected.indexOf(a.id) !== -1) {
        totalCost += a.cost;
        totalGain += a.gain;
      }
    });
    return { selected: selected, cost: totalCost, gain: totalGain };
  }

  var api = {
    NORM_MIN: NORM_MIN,
    NORM_MAX: NORM_MAX,
    normalize: normalize,
    weightedIndex: weightedIndex,
    psi: psi,
    phi: phi,
    computeYear: computeYear,
    computeAll: computeAll,
    criticality: criticality,
    criticalityLevel: criticalityLevel,
    optimize: optimize
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.VNLModel = api;
})(typeof window !== 'undefined' ? window : this);
