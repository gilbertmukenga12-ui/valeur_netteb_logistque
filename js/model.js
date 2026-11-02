/*
 * Moteur de calcul VNL-SAD. Fonctions pures, sans accès au DOM, testées avec Node.
 *
 *   VMB  = CA − CMV ;  τ = pertes / CA ;  Clog = somme des cinq postes
 *   Ψ    = α^wα × Ω^wΩ × γ^wγ
 *   E    = Xe × (1 − Rz) ;  Φ = e^(−θE)
 *   VNL  = VMB × (1 − τ) × Ψ × Φ − Clog
 *
 * Formules reprises du cahier des charges, annexe A.
 */
(function (root) {
  'use strict';

  var C = root.VNLConfig || (typeof require !== 'undefined' ? require('./config.js') : null);

  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function sum(a) { var s = 0; for (var i = 0; i < a.length; i++) s += a[i]; return s; }
  function mean(a) { return a.length ? sum(a) / a.length : NaN; }

  /* ---------- Étape 2 : normalisation ---------- */
  function normalize(I, cible, sens) {
    if (!isNum(I) || !isNum(cible) || cible <= 0) return null;
    if (sens === 'up') return Math.min(1, I / cible);
    if (sens === 'down') return I === 0 ? 1 : Math.min(1, cible / I);
    if (sens === 'host') return Math.min(1, Math.max(0, I) / cible);
    return null;
  }

  /* Poids effectifs d'une dimension : exclusions redistribuées au prorata (F3.5). */
  function dimWeights(params, dim) {
    var out = {};
    var tot = 0;
    C.SUB_INDICATORS.forEach(function (s) {
      if (s.dim !== dim) return;
      var p = params.sub[s.code];
      if (!p || p.exclu) return;
      out[s.code] = p.poids;
      tot += p.poids;
    });
    Object.keys(out).forEach(function (k) { out[k] = tot > 0 ? out[k] / tot : 0; });
    return out;
  }

  /* ---------- Calcul d'un mois ---------- */
  function computeMonth(v, params) {
    var r = { mois: v.mois, manquants: [] };

    // Étape 1
    var ca = v.ca, cmv = v.cmv;
    r.ca = ca; r.cmv = cmv; r.pertes = v.pertes;
    r.vmb = isNum(ca) && isNum(cmv) ? ca - cmv : NaN;
    r.tau = isNum(v.pertes) && ca > 0 ? v.pertes / ca : NaN;
    var clog = 0, clogOk = true;
    C.CLOG_KEYS.forEach(function (k) { if (isNum(v[k])) clog += v[k]; else clogOk = false; });
    r.clog = clog;
    if (!clogOk) r.manquants.push('Clog');

    // Étape 2 : sous-indicateurs bruts et normalisés
    r.brut = {}; r.norm = {};
    C.SUB_INDICATORS.forEach(function (s) {
      var I = s.mesure(v);
      r.brut[s.code] = I;
      var p = params.sub[s.code];
      r.norm[s.code] = p && !p.exclu ? normalize(I, p.cible, s.sens) : null;
    });

    // Étape 3 : indices de dimension (moyenne pondérée sur les sous-indicateurs disponibles)
    r.idx = {};
    C.DIMENSIONS.forEach(function (d) {
      var w = dimWeights(params, d.code);
      var sw = 0, s = 0;
      Object.keys(w).forEach(function (code) {
        var x = r.norm[code];
        if (isNum(x)) { s += w[code] * x; sw += w[code]; }
        else r.manquants.push(code);
      });
      r.idx[d.code] = sw > 0 ? s / sw : NaN;
    });

    finish(r, params);
    return r;
  }

  /* Étapes 4 à 6 et décomposition, à partir de vmb, tau, clog et idx. */
  function finish(r, params) {
    var w = params.wDim, i = r.idx;
    r.psi = Math.pow(i.alpha, w.alpha) * Math.pow(i.omega, w.omega) * Math.pow(i.gamma, w.gamma);
    r.E = i.xe * (1 - i.rz);
    r.phi = Math.exp(-params.theta * r.E);
    var base = r.vmb * (1 - r.tau);
    r.vnl = base * r.psi * r.phi - r.clog;
    r.ratio = r.vmb > 0 ? r.vnl / r.vmb : NaN;
    r.vnl0 = base * r.psi - r.clog;
    r.reductionHostilite = r.vnl0 !== 0 ? (r.vnl0 - r.vnl) / r.vnl0 : NaN;

    // Quatre retraits (F5.7) : leur somme avec la VNL redonne la VMB.
    r.retraits = {
      pertes: r.vmb * r.tau,
      inefficacite: base * (1 - r.psi),
      hostilite: base * r.psi * (1 - r.phi),
      couts: r.clog
    };

    // Contributions à la perte de conversion (F5.9)
    var parts = {
      alpha: -w.alpha * Math.log(i.alpha),
      omega: -w.omega * Math.log(i.omega),
      gamma: -w.gamma * Math.log(i.gamma),
      hostilite: params.theta * r.E
    };
    r.pertesConv = parts;
    var tot = parts.alpha + parts.omega + parts.gamma + parts.hostilite;
    r.contrib = {};
    Object.keys(parts).forEach(function (k) { r.contrib[k] = tot > 0 ? parts[k] / tot : 0; });
    r.dimEnCause = Object.keys(parts).reduce(function (a, b) { return parts[a] >= parts[b] ? a : b; });
    return r;
  }

  /* ---------- Agrégation par période (F5.10) ---------- */
  function aggregate(results) {
    var ok = results.filter(function (r) { return isNum(r.vnl); });
    var a = { n: ok.length };
    if (!ok.length) return a;
    ['ca', 'cmv', 'pertes', 'vmb', 'clog', 'vnl', 'vnl0'].forEach(function (k) {
      a[k] = sum(ok.map(function (r) { return r[k]; }));
    });
    a.retraits = {};
    ['pertes', 'inefficacite', 'hostilite', 'couts'].forEach(function (k) {
      a.retraits[k] = sum(ok.map(function (r) { return r.retraits[k]; }));
    });
    a.idx = {};
    C.DIMENSIONS.forEach(function (d) { a.idx[d.code] = mean(ok.map(function (r) { return r.idx[d.code]; })); });
    ['psi', 'phi', 'E'].forEach(function (k) { a[k] = mean(ok.map(function (r) { return r[k]; })); });
    a.ratio = a.vnl / a.vmb;
    a.tau = a.pertes / a.ca;
    a.reductionHostilite = (a.vnl0 - a.vnl) / a.vnl0;
    var parts = { alpha: 0, omega: 0, gamma: 0, hostilite: 0 };
    ok.forEach(function (r) { Object.keys(parts).forEach(function (k) { parts[k] += r.pertesConv[k]; }); });
    var tot = parts.alpha + parts.omega + parts.gamma + parts.hostilite;
    a.contrib = {};
    Object.keys(parts).forEach(function (k) { a.contrib[k] = tot > 0 ? parts[k] / tot : 0; });
    return a;
  }

  function byYear(results) {
    var ys = {};
    results.forEach(function (r) {
      var y = r.mois.slice(0, 4);
      (ys[y] = ys[y] || []).push(r);
    });
    return Object.keys(ys).sort().map(function (y) {
      var a = aggregate(ys[y]); a.annee = +y; return a;
    });
  }

  /* ---------- Alertes (F6.1 à F6.5, F6.7) ---------- */
  var DIM_LABEL = { alpha: 'l’efficacité opérationnelle (α)', omega: 'la tension sur les stocks (Ω)', gamma: 'la réactivité commerciale (γ)', hostilite: 'l’hostilité de l’environnement non absorbée' };
  var DIM_OF_TARGET = function (code) {
    if (code === 'tau') return 'tau';
    var s = C.SUB_INDICATORS.filter(function (x) { return x.code === code; })[0];
    if (!s) return null;
    return (s.dim === 'rz' || s.dim === 'xe') ? 'hostilite' : s.dim;
  };

  function alertsFor(results, params, actions) {
    var out = [];
    results.forEach(function (r, k) {
      if (!isNum(r.ratio)) return;
      var rules = [];
      if (r.ratio < params.seuilRatio) rules.push({ regle: 'niveau', label: 'Ratio VNL/VMB sous le seuil', valeur: r.ratio, seuil: params.seuilRatio });
      if (r.idx.omega < params.seuilOmega) rules.push({ regle: 'stocks', label: 'Tension sur les stocks (Ω)', valeur: r.idx.omega, seuil: params.seuilOmega });
      var prev = results[k - 1];
      if (prev && isNum(prev.ratio) && isNum(params.seuilBaisse) && prev.ratio - r.ratio > params.seuilBaisse) {
        rules.push({ regle: 'baisse', label: 'Baisse du ratio VNL/VMB', valeur: r.ratio - prev.ratio, seuil: -params.seuilBaisse });
      }
      r.alertes = rules;
      r.voyant = rules.some(function (x) { return x.regle !== 'baisse'; }) ? 'rouge' : (rules.length ? 'orange' : 'vert');
      r.action = bestActionFor(r.dimEnCause, actions);
      r.actionDirecte = !!r.action;
      if (!r.action) r.action = fallbackAction(r, actions);
      r.phrase = sentence(r);
      if (rules.length) out.push({ mois: r.mois, regles: rules, dim: r.dimEnCause, action: r.action ? r.action.n : null });
    });
    return out;
  }

  function bestActionFor(dim, actions) {
    if (!actions) return null;
    var cands = actions.filter(function (a) { return DIM_OF_TARGET(a.cible) === dim && isNum(a.van); });
    cands.sort(function (a, b) { return b.van - a.van; });
    return cands[0] || null;
  }

  /* À défaut d'action visant la dimension en cause : action de VAN positive dont le sous-indicateur
     visé est le plus éloigné de sa cible ce mois-ci. */
  function fallbackAction(r, actions) {
    if (!actions) return null;
    var c = actions.filter(function (a) { return isNum(a.van) && a.van > 0 && a.cible !== 'tau' && isNum(r.norm[a.cible]); });
    c.sort(function (a, b) { return r.norm[a.cible] - r.norm[b.cible] || b.van - a.van; });
    return c[0] || null;
  }

  function fmtPct(x) { return (x * 100).toFixed(1).replace('.', ',') + ' %'; }

  function sentence(r) {
    var dim = DIM_LABEL[r.dimEnCause];
    var share = fmtPct(r.contrib[r.dimEnCause]);
    var s;
    if (r.voyant === 'vert') {
      s = 'Situation sous contrôle : la logistique conserve ' + fmtPct(r.ratio) + ' de la marge brute. ';
      s += 'Le premier poste de perte reste ' + dim + ' (' + share + ' de la perte).';
    } else {
      s = (r.voyant === 'rouge' ? 'Alerte : ' : 'Vigilance : ') + 'la logistique ne conserve que ' + fmtPct(r.ratio) + ' de la marge brute. ';
      s += 'La perte vient d’abord de ' + dim + ' (' + share + '). ';
    }
    if (r.voyant !== 'vert') {
      if (r.action && r.actionDirecte) s += 'Action prioritaire : « ' + r.action.nom + ' » (action n° ' + r.action.n + ').';
      else if (r.action) s += 'Aucune action chiffrée ne vise directement cette dimension ; à défaut, engager « ' + r.action.nom + ' » (n° ' + r.action.n + '), qui vise ' + r.action.cible + ', loin de sa cible ce mois-ci, et proposer une action ciblée dans l’écran Actions.';
      else if (r.dimEnCause === 'hostilite') s += 'Aucune action chiffrée ne vise directement ce poste : renforcer la résilience (groupe électrogène, stock de sécurité, itinéraires).';
      else s += 'Aucune action chiffrée ne vise encore cette dimension : en proposer une dans l’écran Actions.';
    }
    return s;
  }

  /* ---------- Calcul complet de l'historique ---------- */
  function computeAll(months, params, actions) {
    var sorted = months.slice().sort(function (a, b) { return a.mois < b.mois ? -1 : 1; });
    var results = sorted.map(function (m) { return computeMonth(m, params); });
    var alertes = alertsFor(results, params, actions);
    return { mois: results, annees: byYear(results), alertes: alertes };
  }

  /* ---------- Contrôles de saisie (F1.5) ---------- */
  function checkValue(def, x) {
    if (x === null || x === undefined || x === '') return null;
    if (!isNum(x)) return 'Valeur non numérique';
    if (!def.signed && x < 0) return 'Valeur négative interdite';
    if (def.unit === 'score' && (x < 1 || x > 5 || Math.round(x) !== x)) return 'Le score doit être un entier de 1 à 5';
    if (def.unit === 'taux' && !def.signed && x > 1 && def.key !== 'prix') return 'Un taux doit être compris entre 0 et 1';
    return null;
  }

  function checkCoherence(v) {
    var e = [];
    function both(a, b) { return isNum(v[a]) && isNum(v[b]); }
    if (both('livraisons', 'commandes') && v.livraisons > v.commandes) e.push({ champs: ['livraisons'], msg: 'Les commandes servies dépassent les commandes reçues' });
    if (both('ruptures', 'jours') && v.ruptures > v.jours) e.push({ champs: ['ruptures'], msg: 'Les jours de rupture dépassent les jours travaillés' });
    if (both('couverture', 'coupures') && v.couverture > v.coupures) e.push({ champs: ['couverture'], msg: 'Les heures couvertes dépassent les heures de coupure' });
    if (both('production', 'capacite') && v.production > v.capacite) e.push({ champs: ['production'], msg: 'La production dépasse la capacité théorique' });
    if (both('retours', 'ventes') && v.retours >= v.ventes) e.push({ champs: ['retours'], msg: 'Les retours doivent rester inférieurs aux ventes' });
    if (both('cmv', 'ca') && v.cmv >= v.ca) e.push({ champs: ['cmv'], msg: 'Le coût des marchandises vendues doit rester inférieur au chiffre d’affaires' });
    return e;
  }

  /* ---------- Audit de la base (F2.1 à F2.3) ---------- */
  function quantile(sorted, q) {
    var pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  function audit(months) {
    var res = [];
    var keys = C.VARIABLES.map(function (d) { return d.key; });
    var list = months.map(function (m) { return m.mois; }).sort();
    // Couverture
    var gaps = [];
    for (var i = 1; i < list.length; i++) {
      var a = list[i - 1].split('-').map(Number), b = list[i].split('-').map(Number);
      var diff = (b[0] - a[0]) * 12 + (b[1] - a[1]);
      if (diff > 1) gaps.push(list[i - 1] + ' → ' + list[i]);
    }
    res.push({ controle: 'Couverture des mois', ok: gaps.length === 0, detail: list.length + ' mois' + (list.length ? ' (' + list[0] + ' à ' + list[list.length - 1] + ')' : '') + (gaps.length ? ' ; trous : ' + gaps.join(', ') : '') });
    // Doublons
    var seen = {}, dup = [];
    list.forEach(function (m) { if (seen[m]) dup.push(m); seen[m] = 1; });
    res.push({ controle: 'Doublons', ok: !dup.length, detail: dup.length ? dup.join(', ') : 'Aucun' });
    // Manquants
    var miss = [];
    months.forEach(function (m) { keys.forEach(function (k) { if (!isNum(m[k])) miss.push(m.mois + ' : ' + k); }); });
    res.push({ controle: 'Données manquantes', ok: !miss.length, detail: miss.length ? miss.length + ' valeur(s) : ' + miss.slice(0, 8).join(' ; ') + (miss.length > 8 ? '…' : '') : 'Aucune' });
    // Négatifs et valeurs hors domaine
    var neg = [];
    months.forEach(function (m) { C.VARIABLES.forEach(function (d) { var e = checkValue(d, m[d.key]); if (e) neg.push(m.mois + ' ' + d.key + ' (' + e + ')'); }); });
    res.push({ controle: 'Valeurs négatives ou hors domaine', ok: !neg.length, detail: neg.length ? neg.slice(0, 8).join(' ; ') : 'Aucune' });
    // Cohérence
    var coh = [];
    months.forEach(function (m) { checkCoherence(m).forEach(function (e) { coh.push(m.mois + ' : ' + e.msg); }); });
    res.push({ controle: 'Cohérence logique', ok: !coh.length, detail: coh.length ? coh.slice(0, 8).join(' ; ') : 'Toutes les règles respectées' });
    // Valeurs extrêmes (3 écarts interquartiles)
    var ext = [];
    keys.forEach(function (k) {
      var vals = months.map(function (m) { return m[k]; }).filter(isNum).sort(function (x, y) { return x - y; });
      if (vals.length < 8) return;
      var q1 = quantile(vals, 0.25), q3 = quantile(vals, 0.75), iqr = q3 - q1;
      if (iqr === 0) return;
      months.forEach(function (m) {
        if (isNum(m[k]) && (m[k] < q1 - 3 * iqr || m[k] > q3 + 3 * iqr)) ext.push({ mois: m.mois, champ: k, valeur: m[k] });
      });
    });
    res.push({ controle: 'Valeurs extrêmes (3 écarts interquartiles)', ok: !ext.length, detail: ext.length ? ext.length + ' valeur(s) à justifier ou corriger' : 'Aucune', extremes: ext });
    // Séries constantes
    var cst = [];
    keys.forEach(function (k) {
      var vals = months.map(function (m) { return m[k]; }).filter(isNum);
      if (vals.length > 2 && vals.every(function (x) { return x === vals[0]; })) cst.push(k + ' = ' + vals[0]);
    });
    res.push({ controle: 'Séries constantes ou saturées', ok: !cst.length, detail: cst.length ? cst.join(' ; ') : 'Aucune', avertissement: true });
    return res;
  }

  /* ---------- AHP (F4.4 à F4.7) ---------- */
  function ahpWeights(M) {
    var n = M.length;
    var g = M.map(function (row) { return Math.pow(row.reduce(function (p, x) { return p * x; }, 1), 1 / n); });
    var s = sum(g);
    return g.map(function (x) { return x / s; });
  }

  function ahpConsistency(M, w) {
    var n = M.length;
    w = w || ahpWeights(M);
    var lam = 0;
    for (var i = 0; i < n; i++) {
      var aw = 0;
      for (var j = 0; j < n; j++) aw += M[i][j] * w[j];
      lam += aw / w[i];
    }
    lam /= n;
    var ci = n > 2 ? (lam - n) / (n - 1) : 0;
    var ri = C.RI[n] || 1.59;
    var cr = ri > 0 ? ci / ri : 0;
    return { lambdaMax: lam, IC: ci, RC: cr, coherent: cr < 0.10 };
  }

  /* Comparaisons les plus incohérentes : écart entre a_ij et w_i / w_j. */
  function ahpWorstPairs(M, k) {
    var w = ahpWeights(M), out = [];
    for (var i = 0; i < M.length; i++) for (var j = i + 1; j < M.length; j++) {
      var e = M[i][j] * w[j] / w[i];
      out.push({ i: i, j: j, ecart: Math.max(e, 1 / e) });
    }
    out.sort(function (a, b) { return b.ecart - a.ecart; });
    return out.slice(0, k || 3);
  }

  function ahpAggregate(mats) {
    var n = mats[0].length, A = [];
    for (var i = 0; i < n; i++) {
      A.push([]);
      for (var j = 0; j < n; j++) {
        var p = 1;
        mats.forEach(function (M) { p *= M[i][j]; });
        A[i].push(Math.pow(p, 1 / mats.length));
      }
    }
    return A;
  }

  /* Matrice à partir des comparaisons du triangle supérieur : pairs[k] = a_ij (i < j). */
  function ahpMatrix(n, upper) {
    var M = [], k = 0;
    for (var i = 0; i < n; i++) { M.push([]); for (var j = 0; j < n; j++) M[i].push(1); }
    for (i = 0; i < n; i++) for (j = i + 1; j < n; j++) {
      var a = upper[k++];
      if (!isNum(a) || a <= 0) a = 1;
      M[i][j] = a; M[j][i] = 1 / a;
    }
    return M;
  }

  /* ---------- AMDEC (F7.4) ---------- */
  function amdecCriticite(notes, seuils) {
    // notes : [{F, G, D}] des évaluateurs
    var ok = notes.filter(function (x) { return isNum(x.F) && isNum(x.G) && isNum(x.D); });
    if (!ok.length) return null;
    var F = mean(ok.map(function (x) { return x.F; }));
    var G = mean(ok.map(function (x) { return x.G; }));
    var D = mean(ok.map(function (x) { return x.D; }));
    var c = F * G * D;
    return { F: F, G: G, D: D, C: c, classe: classeAmdec(c, seuils), gravite5: G >= 5 };
  }
  function classeAmdec(c, seuils) {
    seuils = seuils || { critique: 35, majeure: 20 };
    return c > seuils.critique ? 'Critique' : (c >= seuils.majeure ? 'Majeure' : 'Modérée');
  }

  /* ---------- Actions : gain, VAN, optimisation (F8.3 à F8.9) ---------- */

  /* Mois moyen d'une année : montants sommés, mesures brutes moyennées. */
  function referenceYear(months, params, annee) {
    var ms = months.filter(function (m) { return +m.mois.slice(0, 4) === annee; });
    if (!ms.length) return null;
    var res = ms.map(function (m) { return computeMonth(m, params); });
    var ref = { mois: annee + '-moy', manquants: [] };
    ref.ca = sum(res.map(function (r) { return r.ca; }));
    ref.cmv = sum(res.map(function (r) { return r.cmv; }));
    ref.vmb = sum(res.map(function (r) { return r.vmb; }));
    ref.pertes = sum(res.map(function (r) { return r.pertes; }));
    ref.tau = ref.pertes / ref.ca;
    ref.clog = sum(res.map(function (r) { return r.clog; }));
    ref.brut = {};
    C.SUB_INDICATORS.forEach(function (s) {
      var vals = res.map(function (r) { return r.brut[s.code]; }).filter(isNum);
      ref.brut[s.code] = vals.length ? mean(vals) : null;
    });
    return ref;
  }

  /* Recalcule une année de référence avec des valeurs brutes modifiées (overrides) — F8.6. */
  function evalReference(ref, params, overrides) {
    overrides = overrides || {};
    var r = { mois: ref.mois, vmb: ref.vmb, clog: ref.clog, tau: isNum(overrides.tau) ? overrides.tau : ref.tau, manquants: [] };
    r.norm = {};
    C.SUB_INDICATORS.forEach(function (s) {
      var I = isNum(overrides[s.code]) ? overrides[s.code] : ref.brut[s.code];
      var p = params.sub[s.code];
      r.norm[s.code] = p && !p.exclu ? normalize(I, p.cible, s.sens) : null;
    });
    r.idx = {};
    C.DIMENSIONS.forEach(function (d) {
      var w = dimWeights(params, d.code), sw = 0, s = 0;
      Object.keys(w).forEach(function (code) { var x = r.norm[code]; if (isNum(x)) { s += w[code] * x; sw += w[code]; } });
      r.idx[d.code] = sw > 0 ? s / sw : NaN;
    });
    return finish(r, params);
  }

  function van(I, G, T, i) {
    var v = -I;
    for (var t = 1; t <= T; t++) v += G / Math.pow(1 + i, t);
    return v;
  }

  /* Évalue chaque action : gain annuel et VAN si les estimations sont saisies, sinon VAN publiée. */
  function evaluateActions(actions, ref, params) {
    var base = ref ? evalReference(ref, params).vnl : NaN;
    return actions.map(function (a) {
      var x = Object.assign({}, a);
      var hasEst = isNum(a.attendue) && isNum(a.coutAnnuel) && isNum(a.duree) && ref;
      if (hasEst) {
        var ov = {}; ov[a.cible] = a.attendue;
        x.gain = evalReference(ref, params, ov).vnl - base - a.coutAnnuel;
        x.van = van(a.cout, x.gain, a.duree, params.taux);
        x.source = 'calculée';
      } else {
        x.van = a.vanRef;
        x.source = 'mémoire';
      }
      return x;
    });
  }

  /*
   * Sélection de VAN maximale sous budget. Exhaustive jusqu'à 20 actions,
   * programmation dynamique (pas de 0,1 M FC) au-delà. forced : n° d'actions imposées.
   */
  function optimize(actions, budget, forced) {
    forced = forced || [];
    var imposed = actions.filter(function (a) { return forced.indexOf(a.n) >= 0; });
    var free = actions.filter(function (a) { return forced.indexOf(a.n) < 0 && isNum(a.van) && isNum(a.cout); });
    var used = sum(imposed.map(function (a) { return a.cout; }));
    var rest = budget - used;
    var best = { van: 0, set: [] };
    if (rest >= 0) {
      if (free.length <= 20) {
        var n = free.length, total = 1 << n;
        for (var mask = 0; mask < total; mask++) {
          var c = 0, v = 0;
          for (var k = 0; k < n; k++) if (mask & (1 << k)) { c += free[k].cout; v += free[k].van; }
          if (c <= rest + 1e-6 && v > best.van + 1e-9) best = { van: v, set: free.filter(function (_, k) { return mask & (1 << k); }) };
        }
      } else {
        var step = 1e5, cap = Math.floor(rest / step);
        var dp = new Array(cap + 1).fill(0), keep = free.map(function () { return new Uint8Array(cap + 1); });
        free.forEach(function (a, k) {
          var w = Math.ceil(a.cout / step);
          for (var b = cap; b >= w; b--) if (a.van > 0 && dp[b - w] + a.van > dp[b]) { dp[b] = dp[b - w] + a.van; keep[k][b] = 1; }
        });
        var b = cap, set = [];
        for (var k2 = free.length - 1; k2 >= 0; k2--) if (keep[k2][b]) { set.push(free[k2]); b -= Math.ceil(free[k2].cout / step); }
        best = { van: dp[cap], set: set.reverse() };
      }
    }
    var all = imposed.concat(best.set).sort(function (a, b) { return a.n - b.n; });
    return {
      actions: all.map(function (a) { return a.n; }),
      imposees: imposed.map(function (a) { return a.n; }),
      cout: sum(all.map(function (a) { return a.cout; })),
      van: sum(all.map(function (a) { return a.van; })),
      reste: budget - sum(all.map(function (a) { return a.cout; })),
      depasse: rest < 0
    };
  }

  function budgetSeries(actions, budgets, forced) {
    var out = budgets.map(function (b) { var o = optimize(actions, b, forced); o.budget = b; return o; });
    var stable = null;
    for (var i = out.length - 1; i > 0; i--) {
      if (out[i].actions.join(',') === out[i - 1].actions.join(',')) stable = out[i - 1].budget; else break;
    }
    return { series: out, budgetStable: stable };
  }

  /* Effet combiné des actions retenues (F8.6). */
  function combinedEffect(selected, ref, params) {
    if (!ref) return null;
    var ov = {};
    selected.forEach(function (a) { if (isNum(a.attendue)) ov[a.cible] = a.attendue; });
    var base = evalReference(ref, params).vnl;
    var after = evalReference(ref, params, ov).vnl;
    return { avant: base, apres: after, gain: after - base, estime: Object.keys(ov).length > 0 };
  }

  /* Défaillances critiques ou de gravité 5 non couvertes (F8.9). */
  function uncovered(failures, selectedNums, actions) {
    return failures.filter(function (f) {
      var critical = f.classe === 'Critique' || f.gravite5;
      if (!critical) return false;
      return !actions.some(function (a) { return a.defaillance === f.id && selectedNums.indexOf(a.n) >= 0; });
    });
  }

  /* ---------- Sensibilité (F9.1 à F9.3) ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function yearVnl(months, params, annee) {
    var res = months.filter(function (m) { return +m.mois.slice(0, 4) === annee; }).map(function (m) { return computeMonth(m, params); });
    return aggregate(res);
  }

  function sensitivity(months, params, annee, tests) {
    var ref = yearVnl(months, params, annee).vnl;
    var rows = [];
    function push(param, valeur, p, monthsAlt) {
      var v = yearVnl(monthsAlt || months, p, annee).vnl;
      rows.push({ parametre: param, valeur: valeur, vnl: v, ecart: (v - ref) / Math.abs(ref), influent: Math.abs((v - ref) / ref) > params.seuilSensibilite });
    }
    (tests.theta || []).forEach(function (t) { var p = clone(params); p.theta = t; push('θ', t, p); });
    (tests.wAlpha || []).forEach(function (wa) {
      var p = clone(params), rest = p.wDim.omega + p.wDim.gamma;
      p.wDim = { alpha: wa, omega: p.wDim.omega / rest * (1 - wa), gamma: p.wDim.gamma / rest * (1 - wa) };
      push('Poids de α', wa, p);
    });
    (tests.cibleTRSS || []).forEach(function (c) { var p = clone(params); p.sub.TRSS.cible = c; push('Cible du taux de rupture', c, p); });
    (tests.clog || []).forEach(function (f) {
      var alt = months.map(function (m) { var x = Object.assign({}, m); C.CLOG_KEYS.forEach(function (k) { if (isNum(x[k])) x[k] *= (1 + f); }); return x; });
      push('Coûts logistiques', (f > 0 ? '+' : '') + Math.round(f * 100) + ' %', params, alt);
    });
    return { reference: ref, lignes: rows };
  }

  /* ---------- Statistiques (F10.1 à F10.3) ---------- */
  function ranks(a) {
    var idx = a.map(function (x, i) { return [x, i]; }).sort(function (p, q) { return p[0] - q[0]; });
    var r = new Array(a.length);
    for (var i = 0; i < idx.length;) {
      var j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      var rk = (i + j) / 2 + 1;
      for (var k = i; k <= j; k++) r[idx[k][1]] = rk;
      i = j + 1;
    }
    return r;
  }
  function pearson(x, y) {
    var mx = mean(x), my = mean(y), sxy = 0, sxx = 0, syy = 0;
    for (var i = 0; i < x.length; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += Math.pow(x[i] - mx, 2); syy += Math.pow(y[i] - my, 2); }
    return sxy / Math.sqrt(sxx * syy);
  }
  /* Fonction de répartition normale. */
  function pnorm(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }
  /* Fonction de répartition de Student (bilatérale) via la fonction bêta incomplète. */
  function betacf(a, b, x) {
    var qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
    d = 1 / d; var h = d;
    for (var m = 1; m <= 200; m++) {
      var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
      d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; h *= d * c;
      aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
      d = 1 + aa * d; c = 1 + aa / c; d = 1 / d; var del = d * c; h *= del;
      if (Math.abs(del - 1) < 1e-12) break;
    }
    return h;
  }
  function lgamma(x) {
    var c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    var y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
    var ser = 1.000000000190015; for (var j = 0; j < 6; j++) ser += c[j] / ++y;
    return -tmp + Math.log(2.5066282746310005 * ser / x);
  }
  function ibeta(a, b, x) {
    if (x <= 0) return 0; if (x >= 1) return 1;
    var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
    return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
  }
  function pStudent2(t, df) { return ibeta(df / 2, 0.5, df / (df + t * t)); }

  function spearman(x, y) {
    var pairs = x.map(function (v, i) { return [v, y[i]]; }).filter(function (p) { return isNum(p[0]) && isNum(p[1]); });
    var n = pairs.length;
    if (n < 4) return null;
    var rho = pearson(ranks(pairs.map(function (p) { return p[0]; })), ranks(pairs.map(function (p) { return p[1]; })));
    var t = rho * Math.sqrt((n - 2) / (1 - rho * rho));
    return { rho: rho, p: Math.abs(rho) >= 1 ? 0 : pStudent2(t, n - 2), n: n };
  }

  function detrend(a) {
    var n = a.length, xs = a.map(function (_, i) { return i; });
    var mx = mean(xs), my = mean(a), b = 0, d = 0;
    for (var i = 0; i < n; i++) { b += (xs[i] - mx) * (a[i] - my); d += Math.pow(xs[i] - mx, 2); }
    b /= d;
    return a.map(function (v, i) { return v - (my + b * (i - mx)); });
  }
  function diff(a) { return a.slice(1).map(function (v, i) { return v - a[i]; }); }

  function mannWhitney(a, b) {
    a = a.filter(isNum); b = b.filter(isNum);
    var n1 = a.length, n2 = b.length;
    if (!n1 || !n2) return null;
    var r = ranks(a.concat(b));
    var R1 = sum(r.slice(0, n1));
    var U1 = R1 - n1 * (n1 + 1) / 2, U2 = n1 * n2 - U1;
    var U = Math.min(U1, U2);
    var mu = n1 * n2 / 2;
    // correction des ex aequo
    var N = n1 + n2, counts = {};
    r.forEach(function (x) { counts[x] = (counts[x] || 0) + 1; });
    var tie = 0; Object.keys(counts).forEach(function (k) { var t = counts[k]; tie += t * t * t - t; });
    var sigma = Math.sqrt(n1 * n2 / 12 * ((N + 1) - tie / (N * (N - 1))));
    var z = (U - mu + 0.5) / sigma;
    return { U: U, z: z, p: Math.min(1, 2 * pnorm(-Math.abs(z))), n1: n1, n2: n2 };
  }

  /* Test de Shapiro-Wilk (algorithme de Royston, 1995), 3 ≤ n ≤ 5000. */
  function qnorm(p) {
    // Acklam
    var a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
    var b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
    var c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
    var d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
    var q, r;
    if (p < 0.02425) { q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    if (p > 1 - 0.02425) { q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
    q = p - 0.5; r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  function poly(cc, x) { var r = 0; for (var i = cc.length - 1; i >= 0; i--) r = r * x + cc[i]; return r; }

  function shapiroWilk(x) {
    x = x.filter(isNum).slice().sort(function (p, q) { return p - q; });
    var n = x.length;
    if (n < 3) return null;
    var nn2 = Math.floor(n / 2);
    var m = [];
    for (var i = 1; i <= n; i++) m.push(qnorm((i - 0.375) / (n + 0.25)));
    var summ2 = sum(m.map(function (v) { return v * v; }));
    var ssumm2 = Math.sqrt(summ2);
    var rsn = 1 / Math.sqrt(n);
    var a = new Array(n);
    if (n === 3) {
      a[0] = -Math.SQRT1_2; a[2] = Math.SQRT1_2; a[1] = 0;
    } else {
      var a1 = poly([0, 0.221157, -0.147981, -2.071190, 4.434685, -2.706056], rsn) - m[0] / ssumm2;
      var i1, fac;
      if (n > 5) {
        var a2 = -m[1] / ssumm2 + poly([0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633], rsn);
        fac = Math.sqrt((summ2 - 2 * m[0] * m[0] - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1 - 2 * a2 * a2));
        a[0] = a1; a[1] = a2; i1 = 2;
      } else {
        fac = Math.sqrt((summ2 - 2 * m[0] * m[0]) / (1 - 2 * a1 * a1));
        a[0] = a1; i1 = 1;
      }
      for (i = i1; i < nn2; i++) a[i] = -m[i] / fac;
      // antisymétrie
      for (i = 0; i < nn2; i++) a[n - 1 - i] = -a[i];
      if (n % 2 === 1) a[nn2] = 0;
      // a[0..nn2-1] doivent être négatifs (coefficients des plus petites valeurs)
      for (i = 0; i < nn2; i++) { a[i] = -Math.abs(a[i]); a[n - 1 - i] = Math.abs(a[i]); }
    }
    var mx = mean(x);
    var ssq = sum(x.map(function (v) { return (v - mx) * (v - mx); }));
    var num = 0; for (i = 0; i < n; i++) num += a[i] * x[i];
    var W = num * num / ssq;
    if (W > 1) W = 1;
    var p;
    if (n === 3) {
      p = Math.max(0, 6 / Math.PI * (Math.asin(Math.sqrt(W)) - Math.asin(Math.sqrt(0.75))));
    } else if (n <= 11) {
      var gamma = poly([-2.273, 0.459], n);
      var w1 = -Math.log(gamma - Math.log(1 - W));
      var mu = poly([0.5440, -0.39978, 0.025054, -6.714e-4], n);
      var s = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n));
      p = 1 - pnorm((w1 - mu) / s);
    } else {
      var xx = Math.log(n);
      var w2 = Math.log(1 - W);
      var mu2 = poly([-1.5861, -0.31082, -0.083751, 0.0038915], xx);
      var s2 = Math.exp(poly([-0.4803, -0.082676, 0.0030302], xx));
      p = 1 - pnorm((w2 - mu2) / s2);
    }
    return { W: W, p: p, n: n };
  }

  root.VNLModel = {
    normalize: normalize,
    dimWeights: dimWeights,
    computeMonth: computeMonth,
    computeAll: computeAll,
    aggregate: aggregate,
    byYear: byYear,
    alertsFor: alertsFor,
    checkValue: checkValue,
    checkCoherence: checkCoherence,
    audit: audit,
    ahpWeights: ahpWeights,
    ahpConsistency: ahpConsistency,
    ahpWorstPairs: ahpWorstPairs,
    ahpAggregate: ahpAggregate,
    ahpMatrix: ahpMatrix,
    amdecCriticite: amdecCriticite,
    classeAmdec: classeAmdec,
    referenceYear: referenceYear,
    evalReference: evalReference,
    van: van,
    evaluateActions: evaluateActions,
    optimize: optimize,
    budgetSeries: budgetSeries,
    combinedEffect: combinedEffect,
    uncovered: uncovered,
    sensitivity: sensitivity,
    spearman: spearman,
    detrend: detrend,
    diff: diff,
    mannWhitney: mannWhitney,
    shapiroWilk: shapiroWilk,
    DIM_LABEL: DIM_LABEL,
    DIM_OF_TARGET: DIM_OF_TARGET
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.VNLModel;
})(typeof window !== 'undefined' ? window : globalThis);
