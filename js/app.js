/*
 * Interface du VNL-SAD : navigation, connexion, calcul en cache et écrans 1 à 4
 * (tableau de bord du mois, évolution, diagnostic, alertes).
 * Les autres écrans sont dans app-saisie.js, app-actions.js, app-params.js et app-admin.js.
 */
(function (root) {
  'use strict';

  var C = root.VNLConfig, M = root.VNLModel, S = root.VNLStore, I = root.VNLImporter;
  var App = root.App = { views: {}, charts: [] };

  var ROLES = [
    { code: 'pdg', label: 'PDG' },
    { code: 'admin', label: 'Administrateur' },
    { code: 'direction', label: 'Direction (P1)' },
    { code: 'achat', label: 'Achat (P2)' },
    { code: 'production', label: 'Production (P3)' },
    { code: 'commercial', label: 'Commercial (P4)' },
    { code: 'comptabilite', label: 'Comptabilité (P5)' },
    { code: 'operateur', label: 'Opérateur de saisie' }
  ];
  App.ROLES = ROLES;

  /* ---------- Formats (F11.1) ---------- */
  function isNum(x) { return typeof x === 'number' && isFinite(x); }
  function esc(s) { return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function mfc(x, unit) { return isNum(x) ? I.formatNumber(x / 1e6, 2) + (unit === false ? '' : ' M FC') : '—'; }
  function idx(x) { return isNum(x) ? I.formatNumber(x, 3) : '—'; }
  function pct(x, d) { return isNum(x) ? I.formatNumber(x * 100, d === undefined ? 1 : d) + ' %' : '—'; }
  function num(x, d) { return isNum(x) ? I.formatNumber(x, d) : '—'; }
  var MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
  function moisLabel(m) { if (!m) return ''; var p = m.split('-'); return MOIS[+p[1] - 1] + ' ' + p[0]; }
  App.fmt = { isNum: isNum, esc: esc, mfc: mfc, idx: idx, pct: pct, num: num, moisLabel: moisLabel };

  /* ---------- Calcul en cache ---------- */
  var cache = null;
  S.onChange(function () { cache = null; });
  App.calc = function () {
    if (cache) return cache;
    var p = S.params();
    var months = S.months().filter(function (m) { return isNum(m.ca) && isNum(m.cmv); });
    var ref = M.referenceYear(months, p, p.anneeReference);
    var actions = M.evaluateActions(S.base.actions, ref, p);
    var res = M.computeAll(months, p, actions);
    res.mois.forEach(function (r) { r.versionParams = S.base.parametres.active; });
    cache = { params: p, months: months, ref: ref, actions: actions, res: res };
    return cache;
  };
  App.invalidate = function () { cache = null; };

  /* ---------- Navigation ---------- */
  var NAV = [
    { v: 'mois', label: 'Tableau de bord' },
    { v: 'evolution', label: 'Évolution' },
    { v: 'diagnostic', label: 'Diagnostic' },
    { v: 'alertes', label: 'Alertes' },
    { v: 'actions', label: 'Actions' },
    { v: 'saisie', label: 'Saisie et import' },
    { v: 'parametres', label: 'Paramètres et méthode' },
    { v: 'analyses', label: 'Analyses' },
    { v: 'admin', label: 'Administration' }
  ];

  App.state = { view: 'mois', mois: null };

  App.go = function (view, extra) {
    App.state.view = view;
    if (extra) Object.keys(extra).forEach(function (k) { App.state[k] = extra[k]; });
    try { root.sessionStorage.setItem('vnlsad.vue', view); } catch (e) { /* stockage indisponible */ }
    App.render();
  };

  App.toast = function (msg, kind) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(App._t);
    App._t = setTimeout(function () { t.className = 'toast'; }, 3500);
  };

  function destroyCharts() { App.charts.forEach(function (c) { c.destroy(); }); App.charts = []; }

  App.render = function () {
    destroyCharts();
    var main = document.getElementById('view');
    var nav = document.getElementById('nav');
    var u = S.user();
    document.getElementById('who').innerHTML = u ? esc(u.nom) + ' · <button class="link" data-act="logout">Se déconnecter</button>' : '';
    if (!S.base.utilisateurs.length) { nav.innerHTML = ''; main.innerHTML = firstRun(); bind(main); return; }
    if (!u) { nav.innerHTML = ''; main.innerHTML = loginView(); bind(main); return; }
    nav.innerHTML = NAV.map(function (n) {
      return '<button data-go="' + n.v + '"' + (App.state.view === n.v ? ' aria-current="page"' : '') + '>' + n.label + '</button>';
    }).join('');
    var view = App.views[App.state.view] || App.views.mois;
    main.innerHTML = view.html();
    bind(main);
    if (view.after) view.after(main);
    main.focus({ preventScroll: true });
  };

  /* Délégation d'événements : data-go (navigation), data-act (actions déclarées par les vues). */
  App.actions = {};
  function bind(el) {
    el.querySelectorAll('[data-help]').forEach(function (x) { x.title = x.getAttribute('data-help'); });
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-go]');
    if (g) { App.go(g.getAttribute('data-go'), g.dataset.mois ? { mois: g.dataset.mois } : null); return; }
    var a = e.target.closest('[data-act]');
    if (a && App.actions[a.getAttribute('data-act')]) { e.preventDefault(); App.actions[a.getAttribute('data-act')](a, e); }
  });
  document.addEventListener('change', function (e) {
    var a = e.target.closest('[data-change]');
    if (a && App.actions[a.getAttribute('data-change')]) App.actions[a.getAttribute('data-change')](a, e);
  });

  /* ---------- Premier lancement et connexion ---------- */
  function firstRun() {
    return '<section class="card narrow"><h2>Premier lancement</h2>' +
      '<p>Créez le compte de l’administrateur. Il pourra ensuite créer les comptes des responsables, du PDG et de l’opérateur de saisie.</p>' +
      '<form id="first" class="form">' +
      '<label>Nom<input name="nom" required autocomplete="name"></label>' +
      '<label>Mot de passe<input name="pw" type="password" required minlength="4" autocomplete="new-password"></label>' +
      '<fieldset><legend>Rôles de ce compte</legend>' + ROLES.map(function (r) {
        return '<label class="check"><input type="checkbox" name="roles" value="' + r.code + '"' + (r.code === 'admin' ? ' checked' : '') + '> ' + r.label + '</label>';
      }).join('') + '</fieldset>' +
      '<p class="hint">Pour une démonstration sur un seul poste, cochez tous les rôles.</p>' +
      '<button class="primary" data-act="first">Créer le compte</button></form></section>';
  }
  App.actions.first = function () {
    var f = document.getElementById('first');
    if (!f.reportValidity()) return;
    var roles = Array.prototype.map.call(f.querySelectorAll('[name=roles]:checked'), function (x) { return x.value; });
    if (roles.indexOf('admin') < 0) roles.push('admin');
    var u = S.addUser(f.nom.value.trim(), roles, f.pw.value, 'A1');
    S.setUser(u);
    App.go(S.months().length ? 'mois' : 'saisie');
  };

  function loginView() {
    var users = S.base.utilisateurs.filter(function (u) { return u.actif; });
    return '<section class="card narrow"><h2>Connexion</h2><form id="login" class="form">' +
      '<label>Utilisateur<select name="id">' + users.map(function (u) { return '<option value="' + u.id + '">' + esc(u.nom) + '</option>'; }).join('') + '</select></label>' +
      '<label>Mot de passe<input name="pw" type="password" required autocomplete="current-password"></label>' +
      '<button class="primary" data-act="login">Entrer</button></form></section>';
  }
  App.actions.login = function () {
    var f = document.getElementById('login');
    var u = S.login(f.id.value, f.pw.value);
    if (!u) { App.toast('Mot de passe incorrect.', 'err'); return; }
    var v = 'mois';
    try { v = root.sessionStorage.getItem('vnlsad.vue') || v; } catch (e) { /* rien */ }
    App.go(S.months().length ? v : 'saisie');
  };
  App.actions.logout = function () { S.setUser(null); App.render(); };

  /* ---------- Outils communs ---------- */
  App.monthSelect = function (current, act) {
    var r = App.calc().res.mois;
    return '<label class="inline">Mois <select data-change="' + (act || 'pickMonth') + '">' + r.slice().reverse().map(function (x) {
      return '<option value="' + x.mois + '"' + (x.mois === current ? ' selected' : '') + '>' + moisLabel(x.mois) + '</option>';
    }).join('') + '</select></label>';
  };
  App.actions.pickMonth = function (el) { App.state.mois = el.value; App.render(); };

  App.currentMonth = function () {
    var r = App.calc().res.mois;
    if (!r.length) return null;
    var m = App.state.mois;
    var found = r.filter(function (x) { return x.mois === m; })[0];
    return found || r[r.length - 1];
  };

  App.empty = function () {
    return '<section class="card"><h2>Aucun mois calculé</h2><p>Saisissez ou importez au moins un mois (chiffre d’affaires et coût des marchandises vendues compris) pour voir les résultats.</p>' +
      '<button class="primary" data-go="saisie">Aller à la saisie</button></section>';
  };

  var DIMS = { alpha: 'α efficacité', omega: 'Ω stocks', gamma: 'γ réactivité', hostilite: 'Hostilité' };
  App.DIMS = DIMS;

  function voyant(v) {
    var t = { vert: 'Situation normale', orange: 'Vigilance', rouge: 'Alerte' }[v] || '';
    return '<span class="voyant ' + v + '" role="img" aria-label="' + t + '"></span><span class="voyant-label">' + t + '</span>';
  }
  App.voyant = voyant;

  function delta(cur, prev, f, inverse) {
    if (!isNum(cur) || !isNum(prev)) return '';
    var d = cur - prev;
    var good = inverse ? d < 0 : d > 0;
    var s = (d > 0 ? '+' : '') + f(d);
    return '<span class="delta ' + (Math.abs(d) < 1e-9 ? '' : (good ? 'up' : 'down')) + '">' + s + ' sur un mois</span>';
  }

  App.chart = function (canvas, cfg) {
    if (!root.Chart) return null;
    var css = getComputedStyle(document.documentElement);
    root.Chart.defaults.color = css.getPropertyValue('--muted').trim();
    root.Chart.defaults.borderColor = css.getPropertyValue('--grid').trim();
    root.Chart.defaults.font.family = css.getPropertyValue('--font').trim();
    var c = new root.Chart(canvas, cfg);
    App.charts.push(c);
    return c;
  };
  App.color = function (name) { return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim(); };

  /* ---------- 1. Tableau de bord du mois ---------- */
  App.views.mois = {
    html: function () {
      var c = App.calc();
      var r = App.currentMonth();
      if (!r) return App.empty();
      var all = c.res.mois, k = all.indexOf(r), prev = all[k - 1];
      var rec = S.getMonth(r.mois);
      var h = '<div class="head-row"><h2>Tableau de bord du mois</h2>' + App.monthSelect(r.mois) + '</div>';
      h += '<section class="card hero ' + r.voyant + '">' +
        '<div class="hero-top">' + voyant(r.voyant) + '<span class="muted">' + moisLabel(r.mois) + (rec && rec.cloture ? ' · mois clôturé' : ' · mois non clôturé') + ' · paramètres ' + esc(r.versionParams) + '</span></div>' +
        '<p class="phrase"><strong>Que faire ce mois-ci ?</strong> ' + esc(r.phrase) + '</p></section>';
      h += '<div class="tiles">' +
        tile('VNL', mfc(r.vnl), delta(r.vnl, prev && prev.vnl, function (d) { return mfc(d); }), 'Valeur que la logistique laisse à l’entreprise après pertes, inefficacités, hostilité et coûts.') +
        tile('VNL / VMB', pct(r.ratio), delta(r.ratio, prev && prev.ratio, function (d) { return I.formatNumber(d * 100, 1) + ' pt'; }), 'Part de la marge brute que la logistique préserve. Seuil d’alerte : ' + pct(c.params.seuilRatio, 2) + '.') +
        tile('Ψ conversion', idx(r.psi), delta(r.psi, prev && prev.psi, idx), 'Taux de conversion opérationnelle : 1 si α, Ω et γ atteignent leurs cibles.') +
        tile('Φ environnement', idx(r.phi), delta(r.phi, prev && prev.phi, idx), 'Part de la valeur qui résiste à l’hostilité non absorbée par la résilience.') +
        '</div>';
      if (r.alertes.length) {
        h += '<section class="card"><h3>Alertes du mois</h3><ul class="alerts">' + r.alertes.map(function (a) {
          return '<li><strong>' + esc(a.label) + '</strong> : ' + (a.regle === 'baisse' ? I.formatNumber(a.valeur * 100, 1) + ' pt (seuil ' + I.formatNumber(a.seuil * 100, 1) + ' pt)' : idx(a.valeur) + ' (seuil ' + idx(a.seuil) + ')') + '</li>';
        }).join('') + '</ul><p>Dimension en cause : <strong>' + DIMS[r.dimEnCause] + '</strong> (' + pct(r.contrib[r.dimEnCause]) + ' de la perte de conversion).' +
          (r.action ? (r.actionDirecte ? ' Action prioritaire' : ' À défaut d’action ciblée') + ' : <strong>n° ' + r.action.n + ' ' + esc(r.action.nom) + '</strong>, VAN ' + mfc(r.action.van) + '.' : '') + '</p></section>';
      }
      if (r.manquants.length) h += '<p class="warn">Données manquantes ce mois-ci, moyenne calculée sur les sous-indicateurs disponibles : ' + esc(r.manquants.join(', ')) + '.</p>';
      h += '<div class="btns"><button data-go="diagnostic" data-mois="' + r.mois + '">Voir le diagnostic</button><button data-act="printMonth" data-mois="' + r.mois + '">Imprimer le bilan du mois</button></div>';
      return h;
    }
  };
  function tile(label, value, d, help) {
    return '<div class="tile" data-help="' + esc(help) + '"><div class="tile-label">' + label + '</div><div class="tile-value">' + value + '</div>' + (d || '') + '</div>';
  }

  /* ---------- 2. Évolution ---------- */
  App.views.evolution = {
    html: function () {
      var c = App.calc();
      if (!c.res.mois.length) return App.empty();
      var ms = c.res.mois.map(function (r) { return r.mois; });
      var from = App.state.evoFrom || ms[0], to = App.state.evoTo || ms[ms.length - 1];
      function sel(name, v) { return '<select data-change="evoRange" name="' + name + '">' + ms.map(function (m) { return '<option' + (m === v ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>'; }
      var h = '<div class="head-row"><h2>Évolution</h2><div class="inline">Du ' + sel('evoFrom', from) + ' au ' + sel('evoTo', to) + '</div></div>';
      h += '<section class="card"><h3>Ratio VNL/VMB et seuil d’alerte</h3><div class="chart"><canvas id="chRatio"></canvas></div></section>';
      h += '<section class="card"><h3>Conversion Ψ et ses trois dimensions</h3><div class="chart"><canvas id="chPsi"></canvas></div></section>';
      h += '<section class="card"><h3>Vue annuelle</h3>' + annualTable(c.res.annees) + '</section>';
      return h;
    },
    after: function () {
      var c = App.calc();
      var ms = c.res.mois.map(function (r) { return r.mois; });
      var from = App.state.evoFrom || ms[0], to = App.state.evoTo || ms[ms.length - 1];
      var rs = c.res.mois.filter(function (r) { return r.mois >= from && r.mois <= to; });
      var labels = rs.map(function (r) { return r.mois; });
      App.chart(document.getElementById('chRatio'), {
        type: 'line',
        data: { labels: labels, datasets: [
          { label: 'VNL/VMB', data: rs.map(function (r) { return r.ratio; }), borderColor: App.color('c1'), backgroundColor: App.color('c1'), pointRadius: rs.map(function (r) { return r.voyant === 'vert' ? 0 : 3; }), pointBackgroundColor: rs.map(function (r) { return App.color(r.voyant === 'rouge' ? 'bad' : r.voyant === 'orange' ? 'warn' : 'c1'); }), tension: 0.2 },
          { label: 'Seuil', data: rs.map(function () { return c.params.seuilRatio; }), borderColor: App.color('bad'), borderDash: [6, 4], pointRadius: 0, borderWidth: 1.5 }
        ] },
        options: lineOpts(function (v) { return pct(v, 0); })
      });
      App.chart(document.getElementById('chPsi'), {
        type: 'line',
        data: { labels: labels, datasets: [
          { label: 'Ψ', data: rs.map(function (r) { return r.psi; }), borderColor: App.color('fg'), borderWidth: 2.5, pointRadius: 0 },
          { label: 'α', data: rs.map(function (r) { return r.idx.alpha; }), borderColor: App.color('c1'), pointRadius: 0, borderWidth: 1.5 },
          { label: 'Ω', data: rs.map(function (r) { return r.idx.omega; }), borderColor: App.color('c2'), pointRadius: 0, borderWidth: 1.5 },
          { label: 'γ', data: rs.map(function (r) { return r.idx.gamma; }), borderColor: App.color('c3'), pointRadius: 0, borderWidth: 1.5 }
        ] },
        options: lineOpts(function (v) { return idx(v); })
      });
    }
  };
  App.actions.evoRange = function (el) { App.state[el.name] = el.value; App.render(); };

  function lineOpts(fy) {
    return {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } }, tooltip: { callbacks: { label: function (x) { return x.dataset.label + ' : ' + fy(x.parsed.y); } } } },
      scales: { y: { ticks: { callback: fy } }, x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } } }
    };
  }
  App.lineOpts = lineOpts;

  function annualTable(years) {
    var h = '<div class="scroll"><table class="num"><thead><tr><th>Année</th><th>VMB</th><th>Pertes physiques</th><th>Inefficacité de conversion</th><th>Effet de l’hostilité</th><th>Coûts logistiques</th><th>VNL</th><th>VNL/VMB</th></tr></thead><tbody>';
    years.forEach(function (a) {
      h += '<tr><th>' + a.annee + (a.n < 12 ? ' <small>(' + a.n + ' mois)</small>' : '') + '</th><td>' + mfc(a.vmb, false) + '</td><td>' + mfc(a.retraits.pertes, false) + '</td><td>' + mfc(a.retraits.inefficacite, false) + '</td><td>' + mfc(a.retraits.hostilite, false) + '</td><td>' + mfc(a.retraits.couts, false) + '</td><td><strong>' + mfc(a.vnl, false) + '</strong></td><td>' + pct(a.ratio) + '</td></tr>';
    });
    var t = M.aggregate(App.calc().res.mois);
    if (years.length > 1) h += '<tr class="total"><th>Total</th><td>' + mfc(t.vmb, false) + '</td><td>' + mfc(t.retraits.pertes, false) + '</td><td>' + mfc(t.retraits.inefficacite, false) + '</td><td>' + mfc(t.retraits.hostilite, false) + '</td><td>' + mfc(t.retraits.couts, false) + '</td><td><strong>' + mfc(t.vnl, false) + '</strong></td><td>' + pct(t.ratio) + '</td></tr>';
    return h + '</tbody></table></div><p class="hint">Montants en M FC. Le ratio annuel est calculé sur les sommes (Σ VNL / Σ VMB).</p>';
  }
  App.annualTable = annualTable;

  /* ---------- 3. Diagnostic ---------- */
  App.views.diagnostic = {
    html: function () {
      var r = App.currentMonth();
      if (!r) return App.empty();
      var p = App.calc().params;
      var h = '<div class="head-row"><h2>Diagnostic</h2>' + App.monthSelect(r.mois) + '</div>';
      h += '<section class="card"><h3>De la marge brute à la VNL, ' + moisLabel(r.mois) + '</h3><div class="chart"><canvas id="chCascade"></canvas></div>' +
        '<p class="hint">VMB ' + mfc(r.vmb) + ' = pertes ' + mfc(r.retraits.pertes) + ' + inefficacité ' + mfc(r.retraits.inefficacite) + ' + hostilité ' + mfc(r.retraits.hostilite) + ' + coûts ' + mfc(r.retraits.couts) + ' + VNL ' + mfc(r.vnl) + '. Sans hostilité, la VNL aurait été de ' + mfc(r.vnl0) + ' (réduction de ' + pct(r.reductionHostilite) + ').</p></section>';
      h += '<section class="card"><h3>Qui fait baisser la conversion ?</h3><div class="chart short"><canvas id="chContrib"></canvas></div></section>';
      // sous-indicateurs les plus éloignés de leur cible
      var rows = C.SUB_INDICATORS.filter(function (s) { return !p.sub[s.code].exclu && s.dim !== 'xe'; }).map(function (s) {
        var w = M.dimWeights(p, s.dim)[s.code];
        return { s: s, brut: r.brut[s.code], norm: r.norm[s.code], cible: p.sub[s.code].cible, w: w };
      }).sort(function (a, b) { return (isNum(a.norm) ? a.norm : 2) - (isNum(b.norm) ? b.norm : 2); });
      h += '<section class="card"><h3>Sous-indicateurs les plus éloignés de leur cible</h3><div class="scroll"><table class="num"><thead><tr><th>Code</th><th class="txt">Mesure</th><th>Dimension</th><th>Valeur du mois</th><th>Cible</th><th>Taux d’atteinte</th><th>Poids</th></tr></thead><tbody>' +
        rows.map(function (x, k) {
          return '<tr' + (k < 5 ? ' class="hl"' : '') + '><th>' + x.s.code + '</th><td class="txt">' + esc(x.s.label) + '</td><td>' + C.DIMENSIONS.filter(function (d) { return d.code === x.s.dim; })[0].sym + '</td><td>' + num(x.brut, 3) + '</td><td>' + num(x.cible) + '</td><td>' + bar(x.norm) + '</td><td>' + idx(x.w) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
      h += '<section class="card"><h3>Hostilité du mois</h3><div class="scroll"><table class="num"><thead><tr><th>Code</th><th class="txt">Mesure</th><th>Valeur</th><th>Seuil d’hostilité maximale</th><th>Intensité</th></tr></thead><tbody>' +
        C.SUB_INDICATORS.filter(function (s) { return s.dim === 'xe'; }).map(function (s) {
          return '<tr><th>' + s.code + '</th><td class="txt">' + esc(s.label) + '</td><td>' + num(r.brut[s.code], 3) + '</td><td>' + num(p.sub[s.code].cible) + '</td><td>' + bar(r.norm[s.code], true) + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="hint">Xe = ' + idx(r.idx.xe) + ' ; résilience Rz = ' + idx(r.idx.rz) + ' ; exposition non absorbée E = Xe × (1 − Rz) = ' + idx(r.E) + ' ; Φ = e^(−θE) = ' + idx(r.phi) + '.</p></section>';
      h += '<section class="card"><h3>Chiffres saisis du mois</h3>' + App.monthInputsTable(r.mois) + '</section>';
      return h;
    },
    after: function () {
      var r = App.currentMonth();
      if (!r) return;
      var steps = [
        ['VMB', 0, r.vmb], ['Pertes physiques', r.vmb - r.retraits.pertes, r.vmb],
        ['Inefficacité', r.vmb - r.retraits.pertes - r.retraits.inefficacite, r.vmb - r.retraits.pertes],
        ['Hostilité', r.vnl + r.clog, r.vnl + r.clog + r.retraits.hostilite],
        ['Coûts logistiques', r.vnl, r.vnl + r.clog], ['VNL', 0, r.vnl]
      ];
      App.chart(document.getElementById('chCascade'), {
        type: 'bar',
        data: { labels: steps.map(function (s) { return s[0]; }), datasets: [{ data: steps.map(function (s) { return [s[1] / 1e6, s[2] / 1e6]; }), backgroundColor: [App.color('c1'), App.color('bad'), App.color('bad'), App.color('warn'), App.color('muted'), App.color('good')], borderRadius: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (x) { var v = x.raw; return I.formatNumber(v[1] - v[0], 2) + ' M FC'; } } } }, scales: { y: { ticks: { callback: function (v) { return I.formatNumber(v, 0); } }, title: { display: true, text: 'M FC' } } } }
      });
      var keys = ['alpha', 'omega', 'gamma', 'hostilite'];
      App.chart(document.getElementById('chContrib'), {
        type: 'bar',
        data: { labels: keys.map(function (k) { return DIMS[k]; }), datasets: [{ data: keys.map(function (k) { return r.contrib[k]; }), backgroundColor: [App.color('c1'), App.color('c2'), App.color('c3'), App.color('warn')], borderRadius: 3 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (x) { return pct(x.raw); } } } }, scales: { x: { min: 0, ticks: { callback: function (v) { return pct(v, 0); } } } } }
      });
    }
  };
  function bar(v, host) {
    if (!isNum(v)) return '—';
    var cls = host ? (v > 0.66 ? 'bad' : v > 0.33 ? 'warn' : 'good') : (v < 0.5 ? 'bad' : v < 0.85 ? 'warn' : 'good');
    return '<span class="bar"><span class="fill ' + cls + '" style="width:' + Math.round(v * 100) + '%"></span></span> ' + idx(v);
  }

  App.monthInputsTable = function (m) {
    var rec = S.getMonth(m) || {};
    return '<details><summary>Voir les ' + C.VARIABLES.length + ' valeurs saisies</summary><div class="scroll"><table class="num"><thead><tr><th>N°</th><th class="txt">Variable</th><th>Valeur</th><th>Service</th></tr></thead><tbody>' +
      C.VARIABLES.map(function (v) {
        return '<tr><td>' + v.n + '</td><td class="txt">' + esc(v.label) + (rec.recon && rec.recon[v.key] ? ' <span class="tag" title="' + esc(rec.recon[v.key]) + '">reconstituée</span>' : '') + '</td><td>' + (v.unit === 'fc' ? mfc(rec[v.key]) : num(rec[v.key], 3)) + '</td><td class="txt">' + v.svc + '</td></tr>';
      }).join('') + '</tbody></table></div>' + (rec.remarque ? '<p><strong>Remarques du mois :</strong> ' + esc(rec.remarque) + '</p>' : '') + '</details>';
  };

  /* ---------- 4. Alertes ---------- */
  App.views.alertes = {
    html: function () {
      var c = App.calc();
      if (!c.res.mois.length) return App.empty();
      var al = c.res.alertes;
      var first = al.filter(function (a) { return a.regles.some(function (x) { return x.regle === 'niveau'; }); })[0];
      var h = '<div class="head-row"><h2>Alertes</h2></div>';
      h += '<section class="card"><p>' + al.length + ' mois en alerte sur ' + c.res.mois.length + ' calculés.' + (first ? ' Première alerte sur le ratio VNL/VMB : <strong>' + moisLabel(first.mois) + '</strong>.' : '') + ' Les règles sont appliquées à tout l’historique, comme si le logiciel avait existé dès le premier mois.</p></section>';
      var canDecide = S.can('pdg') || S.can('admin');
      h += '<section class="card"><div class="scroll"><table><thead><tr><th>Mois</th><th>Règle déclenchée</th><th>Dimension en cause</th><th>Action proposée</th><th>Décision de la direction</th></tr></thead><tbody>' +
        al.slice().reverse().map(function (a) {
          var act = c.actions.filter(function (x) { return x.n === a.action; })[0];
          var dec = S.base.decisionsAlertes[a.mois] || '';
          return '<tr><th><button class="link" data-go="mois" data-mois="' + a.mois + '">' + moisLabel(a.mois) + '</button></th><td>' + a.regles.map(function (x) { return esc(x.label); }).join('<br>') + '</td><td>' + DIMS[a.dim] + '</td><td>' + (act ? 'n° ' + act.n + ' ' + esc(act.nom) : '—') + '</td><td>' +
            (canDecide ? '<input class="wide" data-change="decision" data-mois="' + a.mois + '" value="' + esc(dec) + '" placeholder="Décision prise…">' : esc(dec)) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
      return h;
    }
  };
  App.actions.decision = function (el) {
    var m = el.dataset.mois, old = S.base.decisionsAlertes[m] || '';
    S.base.decisionsAlertes[m] = el.value;
    S.touch('Décision sur l’alerte de ' + m, old, el.value);
    App.toast('Décision enregistrée.');
  };

  /* ---------- Démarrage ---------- */
  App.start = function () {
    S.load();
    if (!S.saveOk()) App.toast('Le navigateur refuse l’enregistrement local : les saisies ne seront pas conservées.', 'err');
    App.render();
    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* hors ligne déjà assuré par le stockage local */ });
    }
    root.addEventListener('online', function () { document.body.classList.remove('offline'); });
    root.addEventListener('offline', function () { document.body.classList.add('offline'); });
    if (!navigator.onLine) document.body.classList.add('offline');
    // Version Windows : le petit serveur local s'arrête quand plus aucune fenêtre ne le signale.
    if (location.hostname === '127.0.0.1' && location.port === '47831') {
      setInterval(function () { fetch('/ping', { cache: 'no-store' }).catch(function () {}); }, 20000);
      fetch('/ping', { cache: 'no-store' }).catch(function () {});
    }
  };
})(window);
