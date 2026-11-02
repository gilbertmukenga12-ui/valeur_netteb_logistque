/*
 * Interface du VNL-SAD : mise en page (menu latéral, en-têtes), connexion, calcul en cache
 * et écrans 1 à 4 (tableau de bord du mois, évolution avec simulateur, diagnostic, alertes).
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

  /* ---------- Icônes (traits simples, couleur du texte) ---------- */
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    trend: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
    pulse: '<polyline points="3 12 7 12 10 5 14 19 17 12 21 12"/>',
    alert: '<path d="M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    check: '<rect x="3" y="3" width="18" height="18" rx="2"/><polyline points="8 12 11 15 16 9"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="14 3 14 9 20 9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
    sliders: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2" fill="var(--surface)"/><circle cx="15" cy="12" r="2" fill="var(--surface)"/><circle cx="7" cy="18" r="2" fill="var(--surface)"/>',
    chart: '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="7"/><rect x="11" y="6" width="3" height="12"/><rect x="16" y="13" width="3" height="5"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7"/><path d="M18 14.5a6 6 0 0 1 3.5 5.5"/>',
    layers: '<polygon points="12 3 21 8 12 13 3 8"/><polyline points="3 13 12 18 21 13"/>',
    gauge: '<path d="M4 18a8 8 0 1 1 16 0"/><line x1="12" y1="18" x2="16" y2="11"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 8.5a4.5 4.5 0 0 1 .5 9.5z"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><polyline points="9 12 11 14 15 10"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    printer: '<polyline points="6 9 6 3 18 3 18 9"/><rect x="3" y="9" width="18" height="8" rx="2"/><rect x="6" y="14" width="12" height="7"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="13 6 19 12 13 18"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
    calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><rect x="8" y="6" width="8" height="3"/><line x1="8" y1="13" x2="8.01" y2="13"/><line x1="12" y1="13" x2="12.01" y2="13"/><line x1="16" y1="13" x2="16.01" y2="13"/><line x1="8" y1="17" x2="8.01" y2="17"/><line x1="12" y1="17" x2="12.01" y2="17"/><line x1="16" y1="17" x2="16.01" y2="17"/>',
    menu: '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    zap: '<polygon points="13 2 4 14 12 14 11 22 20 10 12 10"/>'
  };
  function icon(name, cls) {
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || '') + '</svg>';
  }
  App.icon = icon;

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
    var opt = M.optimize(actions, p.budget, S.base.forcees.map(function (f) { return f.n; }));
    cache = { params: p, months: months, ref: ref, actions: actions, res: res, opt: opt };
    return cache;
  };
  App.invalidate = function () { cache = null; };

  /* ---------- Navigation ---------- */
  var NAV = [
    { group: 'Pilotage' },
    { v: 'mois', label: 'Tableau de bord', icon: 'dashboard' },
    { v: 'evolution', label: 'Évolution', icon: 'trend' },
    { v: 'diagnostic', label: 'Diagnostic', icon: 'pulse' },
    { v: 'alertes', label: 'Alertes', icon: 'alert', badge: 'alertes' },
    { v: 'actions', label: 'Actions', icon: 'check', badge: 'actions' },
    { group: 'Données et méthode' },
    { v: 'saisie', label: 'Saisie et import', icon: 'file' },
    { v: 'parametres', label: 'Paramètres et méthode', icon: 'sliders' },
    { v: 'analyses', label: 'Analyses', icon: 'chart' },
    { v: 'admin', label: 'Administration', icon: 'users' }
  ];

  App.state = { view: 'mois', mois: null };

  App.go = function (view, extra) {
    App.state.view = view;
    if (extra) Object.keys(extra).forEach(function (k) { App.state[k] = extra[k]; });
    try { root.sessionStorage.setItem('vnlsad.vue', view); } catch (e) { /* stockage indisponible */ }
    document.body.classList.remove('nav-open');
    App.render();
    root.scrollTo(0, 0);
  };

  App.toast = function (msg, kind) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + (kind || '');
    clearTimeout(App._t);
    App._t = setTimeout(function () { t.className = 'toast'; }, 3500);
  };

  function destroyCharts() { App.charts.forEach(function (c) { c.destroy(); }); App.charts = []; }

  function badges() {
    var c = App.calc();
    var last = c.res.mois[c.res.mois.length - 1];
    var lastYear = last ? last.mois.slice(0, 4) : '';
    return {
      alertes: c.res.alertes.filter(function (a) { return a.mois.slice(0, 4) === lastYear; }).length,
      actions: c.opt.actions.length
    };
  }

  function sidebar() {
    var u = S.user();
    var b = u ? badges() : {};
    var h = '<div class="side-brand"><span class="logo">VNL</span><div><strong>VNL-SAD · GAANA</strong><small>Aide à la décision logistique</small></div></div>';
    if (u) {
      h += '<nav class="side-nav" aria-label="Écrans">' + NAV.map(function (n) {
        if (n.group) return '<div class="side-group">' + n.group + '</div>';
        var cnt = n.badge && b[n.badge] ? '<span class="badge' + (n.badge === 'alertes' ? ' warn' : '') + '">' + b[n.badge] + '</span>' : '';
        return '<button data-go="' + n.v + '"' + (App.state.view === n.v ? ' aria-current="page"' : '') + '>' + icon(n.icon) + '<span>' + n.label + '</span>' + cnt + '</button>';
      }).join('') + '</nav>';
    }
    h += '<div class="side-foot">';
    if (u) h += '<div class="side-user"><span class="avatar">' + esc(u.nom.slice(0, 1).toUpperCase()) + '</span><div><strong>' + esc(u.nom) + '</strong><small>' + esc(u.roles.map(function (r) { return (ROLES.filter(function (x) { return x.code === r; })[0] || {}).label; }).slice(0, 2).join(', ') + (u.roles.length > 2 ? '…' : '')) + '</small></div><button class="icon-btn" data-act="logout" title="Se déconnecter" aria-label="Se déconnecter">' + icon('logout') + '</button></div>';
    h += '<div class="side-store">' + icon('db') + '<div><strong>Stockage local actif</strong><small>Les données restent sur cet appareil. <span class="net-on">Fonctionne aussi sans connexion.</span><span class="net-off">Hors connexion : tout fonctionne.</span></small></div></div>';
    return h + '</div>';
  }

  App.render = function () {
    destroyCharts();
    var main = document.getElementById('view');
    var u = S.user();
    document.getElementById('side').innerHTML = sidebar();
    document.body.classList.toggle('no-user', !u);
    if (!S.base.utilisateurs.length) { main.innerHTML = firstRun(); bind(main); return; }
    if (!u) { main.innerHTML = loginView(); bind(main); return; }
    var view = App.views[App.state.view] || App.views.mois;
    var cur = NAV.filter(function (n) { return n.v === App.state.view; })[0];
    document.getElementById('topTitle').textContent = cur ? cur.label : '';
    main.innerHTML = view.html();
    bind(main);
    if (view.after) view.after(main);
    main.focus({ preventScroll: true });
  };

  /* En-tête de page : titre, étiquette, question de la direction, commandes à droite. */
  App.pageHead = function (title, tag, sub, right) {
    return '<header class="page-head"><div><h1>' + title + (tag ? ' <span class="chip">' + tag + '</span>' : '') + '</h1>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' +
      '<div class="page-tools">' + (right || '') + '<span class="local-badge" title="Aucune donnée ne quitte cet appareil">' + icon('shield') + 'Navigateur 100 % local</span></div></header>';
  };

  /* Tuile de synthèse (chiffre + libellé), utilisée par les écrans Alertes et Actions. */
  App.stat = function (label, value, cls) {
    return '<div class="stat ' + (cls || '') + '"><span>' + label + '</span><strong>' + value + '</strong></div>';
  };

  /* Délégation d'événements : data-go (navigation), data-act, data-change, data-input. */
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
  document.addEventListener('input', function (e) {
    var a = e.target.closest('[data-input]');
    if (a && App.actions[a.getAttribute('data-input')]) App.actions[a.getAttribute('data-input')](a, e);
  });
  App.actions.menu = function () { document.body.classList.toggle('nav-open'); };

  /* ---------- Premier lancement et connexion ---------- */
  function firstRun() {
    return '<section class="card narrow"><div class="login-logo"><span class="logo big">VNL</span></div><h2>Premier lancement</h2>' +
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
    return '<section class="card narrow"><div class="login-logo"><span class="logo big">VNL</span></div><h2>Connexion</h2><p class="hint">Pilotage de la valeur nette logistique de la GAANA.</p><form id="login" class="form">' +
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
    return '<label class="period">Mois <select data-change="' + (act || 'pickMonth') + '">' + r.slice().reverse().map(function (x) {
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
    return App.pageHead('Bienvenue', '', 'Aucun mois n’est encore calculé.') +
      '<section class="card"><h2>Commencez par les données</h2><p>Saisissez ou importez au moins un mois (chiffre d’affaires et coût des marchandises vendues compris) pour voir les résultats.</p>' +
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
    if (!root.Chart || !canvas) return null;
    var css = getComputedStyle(document.documentElement);
    root.Chart.defaults.color = css.getPropertyValue('--muted').trim();
    root.Chart.defaults.borderColor = css.getPropertyValue('--grid').trim();
    root.Chart.defaults.font.family = css.getPropertyValue('--font').trim();
    var c = new root.Chart(canvas, cfg);
    App.charts.push(c);
    return c;
  };
  App.color = function (name) { return getComputedStyle(document.documentElement).getPropertyValue('--' + name).trim(); };

  /* Classe de gravité d'un mois en alerte : haute (niveau et stocks), moyenne, faible (baisse seule). */
  function gravite(regles) {
    var n = regles.filter(function (x) { return x.regle !== 'baisse'; }).length;
    return n >= 2 ? 'haute' : (n === 1 ? 'moyenne' : 'faible');
  }
  App.gravite = gravite;
  var GRAV = { haute: 'Haute', moyenne: 'Moyenne', faible: 'Faible' };

  /* ---------- 1. Tableau de bord du mois ---------- */
  App.views.mois = {
    html: function () {
      var c = App.calc();
      var r = App.currentMonth();
      if (!r) return App.empty();
      var all = c.res.mois, k = all.indexOf(r), prev = all[k - 1];
      var rec = S.getMonth(r.mois);
      var p = c.params;
      var h = App.pageHead('Tableau de bord', 'Montants en M FC', 'Où en sommes-nous ce mois-ci ? Synthèse de la valeur nette logistique et des seuils.',
        App.monthSelect(r.mois));
      h += '<section class="card hero ' + r.voyant + '">' +
        '<div class="hero-top">' + voyant(r.voyant) + '<span class="muted">' + moisLabel(r.mois) + (rec && rec.cloture ? ' · mois clôturé' : ' · mois non clôturé') + ' · paramètres ' + esc(r.versionParams) + '</span>' +
        '<span class="hero-btns"><button data-go="diagnostic" data-mois="' + r.mois + '">' + icon('pulse') + 'Consulter le diagnostic</button><button class="primary" data-go="actions">' + icon('check') + 'Plan d’actions (' + c.opt.actions.length + ')</button></span></div>' +
        '<p class="phrase"><strong>Que faire ce mois-ci ?</strong> ' + esc(r.phrase) + '</p></section>';
      var above = r.ratio >= p.seuilRatio;
      h += '<div class="kpis">' +
        kpi('Valeur nette logistique', mfc(r.vnl), 'layers', delta(r.vnl, prev && prev.vnl, function (d) { return mfc(d); }),
          'Sans hostilité : ' + mfc(r.vnl0), 'Ce que la logistique laisse à l’entreprise après pertes, inefficacités, hostilité et coûts.') +
        kpi('Part de la marge préservée', pct(r.ratio), 'shield', delta(r.ratio, prev && prev.ratio, function (d) { return I.formatNumber(d * 100, 1) + ' pt'; }),
          'Seuil : ' + pct(p.seuilRatio, 1) + ' <span class="pill ' + (above ? 'good' : 'bad') + '">' + (above ? 'Au-dessus' : 'Sous le seuil') + '</span>', 'Ratio VNL/VMB : part de la marge brute que la logistique préserve.') +
        kpi('Conversion opérationnelle Ψ', idx(r.psi), 'gauge', delta(r.psi, prev && prev.psi, idx),
          meter(r.psi) + '<small>α ' + idx(r.idx.alpha) + ' · Ω ' + idx(r.idx.omega) + ' · γ ' + idx(r.idx.gamma) + '</small>', '1 si α, Ω et γ atteignent leurs cibles.') +
        kpi('Résistance à l’environnement Φ', idx(r.phi), 'cloud', delta(r.phi, prev && prev.phi, idx),
          meter(r.phi) + '<small>Hostilité Xe ' + idx(r.idx.xe) + ' · résilience Rz ' + idx(r.idx.rz) + '</small>', 'Part de la valeur qui résiste à l’hostilité non absorbée par la résilience.') +
        '</div>';

      h += '<div class="split"><div>';
      h += '<section class="card"><div class="card-head"><div><h3>De la marge brute à la VNL</h3><p>Ce que chaque fuite retire de la marge du mois (en M FC).</p></div><span class="chip strong">VNL : ' + mfc(r.vnl) + '</span></div><div class="chart"><canvas id="chCascadeD"></canvas></div>' +
        '<div class="mini-stats">' +
        mini('Taux de pertes τ', pct(r.tau, 2), 'Cible : le plus bas possible') +
        mini('Coûts logistiques', pct(r.clog / r.vmb), 'de la marge brute') +
        mini('Exposition E', idx(r.E), 'hostilité non absorbée') +
        mini('Effet de l’hostilité', pct(r.reductionHostilite), 'de VNL perdue') + '</div></section>';
      h += '<section class="card"><div class="card-head"><div><h3>Douze derniers mois</h3><p>Ratio VNL/VMB et seuil d’alerte.</p></div><button class="link-btn" data-go="evolution">Voir l’évolution ' + icon('arrow') + '</button></div><div class="chart short"><canvas id="chSpark"></canvas></div></section>';
      h += '</div><aside>';
      // Panneau alertes actives
      h += '<section class="card side-panel"><div class="card-head"><h3>' + icon('alert', 'warn') + 'Alertes actives (' + r.alertes.length + ')</h3><button class="link-btn" data-go="alertes">Tout voir ' + icon('arrow') + '</button></div>';
      if (r.alertes.length) {
        var g = gravite(r.alertes);
        h += r.alertes.map(function (a) {
          var val = a.regle === 'baisse' ? I.formatNumber(a.valeur * 100, 1) + ' pt' : idx(a.valeur);
          var seuil = a.regle === 'baisse' ? I.formatNumber(a.seuil * 100, 1) + ' pt' : idx(a.seuil);
          return '<div class="alert-item"><div class="alert-title"><strong>' + esc(a.label) + '</strong><span class="sev ' + g + '">' + GRAV[g] + '</span></div><div class="alert-vals"><span>Valeur : <b>' + val + '</b></span><span>Seuil : ' + seuil + '</span></div></div>';
        }).join('') + '<p class="hint">Dimension en cause : <strong>' + DIMS[r.dimEnCause] + '</strong> (' + pct(r.contrib[r.dimEnCause]) + ' de la perte).</p>';
      } else h += '<p class="ok-line">' + icon('shield') + 'Aucune règle d’alerte déclenchée ce mois-ci.</p>';
      h += '</section>';
      // Panneau plan d'actions
      var sel = c.actions.filter(function (a) { return c.opt.actions.indexOf(a.n) >= 0; }).sort(function (a, b) { return b.van - a.van; });
      h += '<section class="card side-panel"><div class="card-head"><h3>' + icon('clock') + 'Plan d’actions prioritaires</h3><button class="link-btn" data-go="actions">Gérer ' + icon('arrow') + '</button></div>' +
        '<p class="hint">Programme de VAN maximale sous un budget de ' + mfc(p.budget) + '.</p>' +
        (sel.length ? sel.map(function (a) {
          return '<div class="action-item"><div><strong>' + esc(a.nom) + '</strong><small>Action n° ' + a.n + ' · coût ' + mfc(a.cout) + '</small></div><span class="pill good">+' + I.formatNumber(a.van / 1e6, 2) + ' M FC</span></div>';
        }).join('') : '<p class="hint">Aucune action retenue.</p>') +
        (r.action && sel.every(function (a) { return a.n !== r.action.n; }) ? '<p class="hint">Action visée par l’alerte du mois : n° ' + r.action.n + ' ' + esc(r.action.nom) + '.</p>' : '') +
        '</section>';
      h += '</aside></div>';
      if (r.manquants.length) h += '<p class="warn">Données manquantes ce mois-ci, moyenne calculée sur les sous-indicateurs disponibles : ' + esc(r.manquants.join(', ')) + '.</p>';
      h += '<div class="btns"><button data-act="printMonth" data-mois="' + r.mois + '">' + icon('printer') + 'Imprimer le bilan du mois</button></div>';
      return h;
    },
    after: function () {
      var r = App.currentMonth();
      if (!r) return;
      cascadeChart(document.getElementById('chCascadeD'), r);
      var all = App.calc().res.mois, k = all.indexOf(r);
      var rs = all.slice(Math.max(0, k - 11), k + 1);
      App.chart(document.getElementById('chSpark'), {
        type: 'line',
        data: { labels: rs.map(function (x) { return x.mois; }), datasets: [
          { label: 'VNL/VMB', data: rs.map(function (x) { return x.ratio; }), borderColor: App.color('accent'), backgroundColor: App.color('accent-fill'), fill: true, tension: 0.3, pointRadius: 2 },
          { label: 'Seuil', data: rs.map(function () { return App.calc().params.seuilRatio; }), borderColor: App.color('bad'), borderDash: [5, 4], pointRadius: 0, borderWidth: 1.5 }
        ] },
        options: lineOpts(function (v) { return pct(v, 0); })
      });
    }
  };
  function kpi(label, value, ic, d, foot, help) {
    return '<div class="kpi" data-help="' + esc(help) + '"><div class="kpi-top"><span class="kpi-label">' + label + '</span><span class="kpi-ic">' + icon(ic) + '</span></div><div class="kpi-value">' + value + '</div>' + (d || '') + '<div class="kpi-foot">' + foot + '</div></div>';
  }
  function meter(v) { return '<span class="meter"><span style="width:' + Math.max(0, Math.min(100, Math.round(v * 100))) + '%"></span></span>'; }
  App.meter = meter;
  function mini(label, value, sub) { return '<div class="mini"><span>' + label + '</span><strong>' + value + '</strong><small>' + sub + '</small></div>'; }
  App.mini = mini;

  function cascadeChart(canvas, r) {
    var steps = [
      ['VMB', 0, r.vmb], ['Pertes', r.vmb - r.retraits.pertes, r.vmb],
      ['Inefficacité', r.vmb - r.retraits.pertes - r.retraits.inefficacite, r.vmb - r.retraits.pertes],
      ['Hostilité', r.vnl + r.clog, r.vnl + r.clog + r.retraits.hostilite],
      ['Coûts', r.vnl, r.vnl + r.clog], ['VNL', 0, r.vnl]
    ];
    App.chart(canvas, {
      type: 'bar',
      data: { labels: steps.map(function (s) { return s[0]; }), datasets: [{ data: steps.map(function (s) { return [s[1] / 1e6, s[2] / 1e6]; }), backgroundColor: [App.color('accent'), App.color('bad'), App.color('bad-2'), App.color('warn'), App.color('muted'), App.color('good')], borderRadius: 4, maxBarThickness: 64 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: function (x) { var v = x.raw; return I.formatNumber(v[1] - v[0], 2) + ' M FC'; } } } }, scales: { y: { ticks: { callback: function (v) { return I.formatNumber(v, 0); } } }, x: { grid: { display: false } } } }
    });
  }
  App.cascadeChart = cascadeChart;

  /* ---------- 2. Évolution et simulateur ---------- */
  App.views.evolution = {
    html: function () {
      var c = App.calc();
      if (!c.res.mois.length) return App.empty();
      var ms = c.res.mois.map(function (r) { return r.mois; });
      var from = App.state.evoFrom || ms[0], to = App.state.evoTo || ms[ms.length - 1];
      function sel(name, v) { return '<select data-change="evoRange" name="' + name + '">' + ms.map(function (m) { return '<option' + (m === v ? ' selected' : '') + '>' + m + '</option>'; }).join('') + '</select>'; }
      var h = App.pageHead('Évolution', 'Analyses et simulation', 'La situation s’améliore-t-elle ? Trajectoire de la VNL et simulation des leviers.',
        '<span class="period">Du ' + sel('evoFrom', from) + ' au ' + sel('evoTo', to) + '</span>');
      h += '<section class="card"><div class="card-head"><div><h3>Trajectoire du ratio VNL/VMB</h3><p>Ratio mensuel comparé au seuil d’alerte (' + pct(c.params.seuilRatio, 1) + '). Les points rouges signalent les mois en alerte.</p></div></div><div class="chart"><canvas id="chRatio"></canvas></div></section>';
      h += '<section class="card"><div class="card-head"><div><h3>Conversion Ψ et ses trois dimensions</h3><p>α efficacité, Ω stocks, γ réactivité : 1 = cible atteinte.</p></div></div><div class="chart"><canvas id="chPsi"></canvas></div></section>';
      h += compareYears(c.res.annees);
      h += simulator(c);
      h += '<section class="card"><div class="card-head"><div><h3>Vue annuelle</h3><p>De la marge brute à la VNL, année par année.</p></div></div>' + annualTable(c.res.annees) + '</section>';
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
          { label: 'VNL/VMB', data: rs.map(function (r) { return r.ratio; }), borderColor: App.color('accent'), backgroundColor: App.color('accent-fill'), fill: true, pointRadius: rs.map(function (r) { return r.voyant === 'vert' ? 0 : 3; }), pointBackgroundColor: rs.map(function (r) { return App.color(r.voyant === 'rouge' ? 'bad' : r.voyant === 'orange' ? 'warn' : 'accent'); }), tension: 0.3 },
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
      App.actions.sim();
    }
  };
  App.actions.evoRange = function (el) { App.state[el.name] = el.value; App.render(); };

  function compareYears(years) {
    if (years.length < 2) return '';
    var a = years[years.length - 1], b = years[years.length - 2];
    var rows = [
      ['Valeur nette logistique (VNL)', a.vnl, b.vnl, 'mfc', true, 'Ce que la logistique laisse à l’entreprise'],
      ['Marge brute (VMB)', a.vmb, b.vmb, 'mfc', true, 'Chiffre d’affaires moins coût des marchandises'],
      ['Ratio VNL/VMB', a.ratio, b.ratio, 'pct', true, 'Part de la marge préservée'],
      ['Conversion Ψ (moyenne)', a.psi, b.psi, 'idx', true, 'Efficacité, stocks et réactivité'],
      ['Résistance Φ (moyenne)', a.phi, b.phi, 'idx', true, 'Effet de l’environnement'],
      ['Pertes physiques', a.retraits.pertes, b.retraits.pertes, 'mfc', false, 'Produits détruits, périmés ou volés'],
      ['Coûts logistiques', a.clog, b.clog, 'mfc', false, 'Transport, énergie, maintenance, salaires']
    ];
    function f(v, t) { return t === 'mfc' ? mfc(v) : t === 'pct' ? pct(v) : idx(v); }
    return '<section class="card"><div class="card-head"><div><h3>' + a.annee + ' comparé à ' + b.annee + '</h3><p>Variation des principaux agrégats d’une année sur l’autre.</p></div></div><div class="scroll"><table class="num cmp"><thead><tr><th class="txt">Indicateur</th><th>' + a.annee + (a.n < 12 ? ' (' + a.n + ' mois)' : '') + '</th><th>' + b.annee + '</th><th>Écart</th><th class="txt">Lecture</th></tr></thead><tbody>' +
      rows.map(function (x) {
        var d = x[1] - x[2], rel = x[2] !== 0 ? d / Math.abs(x[2]) : 0, good = x[4] ? d >= 0 : d <= 0;
        return '<tr><th class="txt">' + x[0] + '</th><td><strong>' + f(x[1], x[3]) + '</strong></td><td>' + f(x[2], x[3]) + '</td><td><span class="pill ' + (good ? 'good' : 'bad') + '">' + (rel > 0 ? '+' : '') + I.formatNumber(rel * 100, 1) + ' %</span></td><td class="txt muted">' + x[5] + '</td></tr>';
      }).join('') + '</tbody></table></div></section>';
  }

  /* Simulateur : effet de quatre leviers sur la VNL de l'année de référence (modèle complet, non additif). */
  var LEVERS = [
    { k: 'rupture', label: 'Réduction des jours de rupture', max: 80, step: 5, unit: '%', help: 'Moins de ruptures : Ω et la satisfaction des clients remontent.' },
    { k: 'service', label: 'Hausse du taux de service', max: 15, step: 1, unit: ' pt', help: 'Plus de commandes livrées complètes et à temps (α).' },
    { k: 'retours', label: 'Réduction des retours', max: 80, step: 5, unit: '%', help: 'Moins de produits retournés (γ).' },
    { k: 'couverture', label: 'Couverture des coupures par le groupe', max: 50, step: 5, unit: ' pt', help: 'Plus d’heures de coupure couvertes : la résilience protège Φ.' },
    { k: 'couts', label: 'Réduction des coûts logistiques', max: 30, step: 1, unit: '%', help: 'Transport, énergie, maintenance, salaires, autres.' }
  ];
  function simulator(c) {
    if (!c.ref) return '';
    var v = App.state.sim || {};
    return '<section class="card sim"><div class="card-head"><div><h3>' + icon('sliders') + 'Simulateur de leviers</h3><p>Ajustez les hypothèses de gestion pour voir leur effet sur la VNL de ' + c.params.anneeReference + ' (moyennes de l’année, modèle recalculé en entier).</p></div></div>' +
      '<div class="levers">' + LEVERS.map(function (l) {
        var x = v[l.k] || 0;
        return '<label class="lever" data-help="' + esc(l.help) + '"><span class="lever-top"><span>' + l.label + '</span><b id="lv-' + l.k + '">+' + x + l.unit + '</b></span>' +
          '<input type="range" min="0" max="' + l.max + '" step="' + l.step + '" value="' + x + '" data-input="sim" name="' + l.k + '"><small>' + l.help + '</small></label>';
      }).join('') + '</div>' +
      '<div class="sim-result"><div><span class="eyebrow">Résultat projeté simulé</span><p>Sur la base de ' + c.params.anneeReference + ' avec les leviers activés.</p></div>' +
      '<div class="sim-figs"><div><small>VNL projetée</small><strong id="simVnl">—</strong></div><div><small>Gain estimé</small><strong id="simGain" class="pos">—</strong></div><div><small>Ratio VNL/VMB</small><strong id="simRatio">—</strong></div></div></div></section>';
  }
  App.actions.sim = function (el) {
    var c = App.calc();
    if (!c.ref) return;
    var v = App.state.sim = App.state.sim || {};
    if (el) v[el.name] = +el.value;
    LEVERS.forEach(function (l) { var b = document.getElementById('lv-' + l.k); if (b) b.textContent = '+' + (v[l.k] || 0) + l.unit; });
    var ref = c.ref, ov = {};
    if (v.rupture) ov.TRSS = ref.brut.TRSS * (1 - v.rupture / 100);
    if (v.service) ov.TSP = Math.min(1, ref.brut.TSP + v.service / 100);
    if (v.retours) ov.TSCL = ref.brut.TSCL * (1 - v.retours / 100);
    if (v.couverture) ov.CT = Math.min(1, ref.brut.CT + v.couverture / 100);
    var base = M.evalReference(ref, c.params).vnl;
    var alt = Object.assign({}, ref, { clog: ref.clog * (1 - (v.couts || 0) / 100) });
    var r = M.evalReference(alt, c.params, ov);
    var g = r.vnl - base;
    var e1 = document.getElementById('simVnl'), e2 = document.getElementById('simGain'), e3 = document.getElementById('simRatio');
    if (!e1) return;
    e1.textContent = mfc(r.vnl);
    e2.textContent = (g >= 0 ? '+' : '') + mfc(g);
    e2.className = g >= 0 ? 'pos' : 'neg';
    e3.textContent = pct(r.ratio);
  };

  function lineOpts(fy) {
    return {
      responsive: true, maintainAspectRatio: false, animation: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, usePointStyle: true } }, tooltip: { callbacks: { label: function (x) { return x.dataset.label + ' : ' + fy(x.parsed.y); } } } },
      scales: { y: { ticks: { callback: fy } }, x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } } }
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
  var DIM_CARDS = [
    { code: 'alpha', letter: 'α', title: 'Efficacité opérationnelle', sub: 'Véhicules, livraisons, production' },
    { code: 'omega', letter: 'Ω', title: 'Tension sur les stocks', sub: 'Ruptures, alignement, rotation' },
    { code: 'gamma', letter: 'γ', title: 'Réactivité commerciale', sub: 'Délais, élasticité, clients, retours' },
    { code: 'rz', letter: 'Rz', title: 'Résilience', sub: 'Ce qui absorbe les chocs' },
    { code: 'xe', letter: 'Xe', title: 'Hostilité de l’environnement', sub: 'Coupures, contrôles, climat, prix' }
  ];
  function conversionLabel(psi) {
    return psi >= 0.8 ? 'Conversion solide' : psi >= 0.6 ? 'Conversion moyenne' : 'Conversion faible';
  }

  App.views.diagnostic = {
    html: function () {
      var r = App.currentMonth();
      if (!r) return App.empty();
      var p = App.calc().params;
      var h = App.pageHead('Diagnostic', 'Cinq dimensions', 'Qu’est-ce qui fait baisser la valeur ? Décomposition de la VNL et points de vigilance.', App.monthSelect(r.mois));
      var score = Math.round(r.psi * 100);
      h += '<section class="card score-card"><div><span class="eyebrow">' + icon('shield') + 'Indice de conversion opérationnelle</span><h2>' + conversionLabel(r.psi) + '</h2>' +
        '<p>Le modèle combine l’efficacité (α), les stocks (Ω) et la réactivité (γ) en un seul indice Ψ, puis tient compte de l’environnement (Φ). En ' + moisLabel(r.mois) + ', la logistique convertit ' + pct(r.psi, 0) + ' de son potentiel ; l’environnement en retire encore ' + pct(1 - r.phi, 1) + '.</p></div>' +
        '<div class="score-box"><div><small>Score Ψ</small><strong class="score">' + score + '</strong><small>/ 100</small></div><div><small>VNL du mois</small><strong>' + mfc(r.vnl) + '</strong><small>Ratio ' + pct(r.ratio) + ' · seuil ' + pct(p.seuilRatio, 1) + '</small></div></div></section>';

      // Cinq cartes de dimension
      h += '<div class="dims">' + DIM_CARDS.map(function (d) {
        var v = r.idx[d.code];
        var w = d.code === 'alpha' || d.code === 'omega' || d.code === 'gamma' ? 'Poids ' + I.formatNumber(p.wDim[d.code] * 100, 1) + ' %' : 'dans Φ';
        var host = d.code === 'xe';
        var weights = M.dimWeights(p, d.code);
        var subs = Object.keys(weights).map(function (code) { return { code: code, n: r.norm[code], b: r.brut[code] }; })
          .filter(function (x) { return isNum(x.n); })
          .sort(function (a, b) { return host ? b.n - a.n : a.n - b.n; }).slice(0, 3);
        return '<div class="dim-card"><div class="dim-top"><span class="letter">' + d.letter + '</span><span class="muted">' + w + '</span></div><h4>' + d.title + '</h4><p class="muted">' + d.sub + '</p>' +
          '<div class="dim-note"><span>' + (host ? 'Intensité :' : 'Note :') + '</span><strong>' + Math.round(v * 100) + '<small> / 100</small></strong></div>' +
          '<span class="meter ' + (host ? (v > 0.5 ? 'bad' : 'warn') : (v < 0.5 ? 'bad' : v < 0.8 ? 'warn' : 'good')) + '"><span style="width:' + Math.round(v * 100) + '%"></span></span>' +
          '<ul class="dim-subs">' + subs.map(function (x) {
            var s = C.SUB_INDICATORS.filter(function (y) { return y.code === x.code; })[0];
            return '<li title="' + esc(s.label) + '"><span>' + esc(shortLabel(s.label)) + '</span><b>' + idx(x.n) + '</b></li>';
          }).join('') + '</ul></div>';
      }).join('') + '</div>';

      // Graphique dimensions vs cible et contributions
      h += '<div class="split even"><section class="card"><div class="card-head"><div><h3>Dimensions et cible</h3><p>Note sur 100 de chaque dimension ; la cible vaut 100.</p></div></div><div class="chart"><canvas id="chDims"></canvas></div></section>' +
        '<section class="card"><div class="card-head"><div><h3>Qui fait baisser la conversion ?</h3><p>Part de chaque dimension dans la perte de conversion du mois.</p></div></div><div class="chart"><canvas id="chContrib"></canvas></div></section></div>';

      // Points forts et vigilance
      var forts = [], faibles = [];
      if (r.ratio >= p.seuilRatio) forts.push('La logistique préserve ' + pct(r.ratio) + ' de la marge brute, au-dessus du seuil de ' + pct(p.seuilRatio, 1) + '.');
      else faibles.push('Le ratio VNL/VMB (' + pct(r.ratio) + ') est sous le seuil d’alerte de ' + pct(p.seuilRatio, 1) + '.');
      if (r.idx.omega < p.seuilOmega) faibles.push('Tension sur les stocks : Ω = ' + idx(r.idx.omega) + ', sous le seuil de ' + idx(p.seuilOmega) + '.');
      if (r.reductionHostilite > 0.1) faibles.push('L’hostilité non absorbée retire ' + pct(r.reductionHostilite) + ' de la VNL.');
      else forts.push('L’environnement ne retire que ' + pct(r.reductionHostilite) + ' de la VNL.');
      C.SUB_INDICATORS.forEach(function (s) {
        if (p.sub[s.code].exclu || s.dim === 'xe' || !isNum(r.norm[s.code])) return;
        if (r.norm[s.code] >= 0.95) forts.push(s.label + ' : cible atteinte (' + idx(r.norm[s.code]) + ').');
        else if (r.norm[s.code] < 0.35) faibles.push(s.label + ' : très loin de la cible (' + idx(r.norm[s.code]) + ').');
      });
      h += '<div class="split even"><section class="card pf good"><h3>' + icon('shield') + 'Points forts</h3><ul>' + (forts.length ? forts.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '<li class="muted">Aucun point fort marqué ce mois-ci.</li>') + '</ul></section>' +
        '<section class="card pf bad"><h3>' + icon('alert') + 'Points de vigilance</h3><ul>' + (faibles.length ? faibles.slice(0, 8).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') : '<li class="muted">Aucun point de vigilance ce mois-ci.</li>') + '</ul></section></div>';

      // Cascade en cartes
      h += '<section class="card"><div class="card-head"><div><h3>Cascade de formation de la VNL</h3><p>Cheminement pas à pas de la marge brute à la valeur nette logistique (en M FC).</p></div></div><div class="cascade">' +
        casc('1. Marge brute (VMB)', r.vmb, '') + casc('2. Pertes physiques', -r.retraits.pertes, 'neg') + casc('3. Inefficacité de conversion', -r.retraits.inefficacite, 'neg') + casc('4. Effet de l’hostilité', -r.retraits.hostilite, 'neg') +
        casc('5. Coûts logistiques', -r.retraits.couts, 'neg') + casc('6. VNL sans hostilité', r.vnl0, 'mid') + casc('7. Réduction due à l’hostilité', null, 'neg', pct(r.reductionHostilite)) + casc('8. VNL du mois', r.vnl, 'final') +
        '</div><div class="chart"><canvas id="chCascade"></canvas></div></section>';

      // Tableaux détaillés
      var rows = C.SUB_INDICATORS.filter(function (s) { return !p.sub[s.code].exclu && s.dim !== 'xe'; }).map(function (s) {
        var w = M.dimWeights(p, s.dim)[s.code];
        return { s: s, brut: r.brut[s.code], norm: r.norm[s.code], cible: p.sub[s.code].cible, w: w };
      }).sort(function (a, b) { return (isNum(a.norm) ? a.norm : 2) - (isNum(b.norm) ? b.norm : 2); });
      h += '<section class="card"><details><summary>Détail des sous-indicateurs, du plus éloigné au plus proche de sa cible</summary><div class="scroll"><table class="num"><thead><tr><th>Code</th><th class="txt">Mesure</th><th>Dim.</th><th>Valeur du mois</th><th>Cible</th><th>Taux d’atteinte</th><th>Poids</th></tr></thead><tbody>' +
        rows.map(function (x, k) {
          return '<tr' + (k < 5 ? ' class="hl"' : '') + '><th>' + x.s.code + '</th><td class="txt">' + esc(x.s.label) + '</td><td>' + C.DIMENSIONS.filter(function (d) { return d.code === x.s.dim; })[0].sym + '</td><td>' + num(x.brut, 3) + '</td><td>' + num(x.cible) + '</td><td>' + bar(x.norm) + '</td><td>' + idx(x.w) + '</td></tr>';
        }).join('') + '</tbody></table></div></details>' +
        '<details><summary>Détail de l’hostilité du mois</summary><div class="scroll"><table class="num"><thead><tr><th>Code</th><th class="txt">Mesure</th><th>Valeur</th><th>Seuil d’hostilité maximale</th><th>Intensité</th></tr></thead><tbody>' +
        C.SUB_INDICATORS.filter(function (s) { return s.dim === 'xe'; }).map(function (s) {
          return '<tr><th>' + s.code + '</th><td class="txt">' + esc(s.label) + '</td><td>' + num(r.brut[s.code], 3) + '</td><td>' + num(p.sub[s.code].cible) + '</td><td>' + bar(r.norm[s.code], true) + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="hint">Xe = ' + idx(r.idx.xe) + ' ; résilience Rz = ' + idx(r.idx.rz) + ' ; exposition non absorbée E = Xe × (1 − Rz) = ' + idx(r.E) + ' ; Φ = e^(−θE) = ' + idx(r.phi) + '.</p></details>' +
        App.monthInputsTable(r.mois) + '</section>';
      return h;
    },
    after: function () {
      var r = App.currentMonth();
      if (!r) return;
      cascadeChart(document.getElementById('chCascade'), r);
      var keys = ['alpha', 'omega', 'gamma', 'hostilite'];
      App.chart(document.getElementById('chContrib'), {
        type: 'doughnut',
        data: { labels: keys.map(function (k) { return DIMS[k]; }), datasets: [{ data: keys.map(function (k) { return r.contrib[k]; }), backgroundColor: [App.color('c1'), App.color('c2'), App.color('c3'), App.color('warn')], borderColor: App.color('surface'), borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, cutout: '58%', plugins: { legend: { position: 'right', labels: { usePointStyle: true } }, tooltip: { callbacks: { label: function (x) { return x.label + ' : ' + pct(x.raw); } } } } }
      });
      var d = ['alpha', 'omega', 'gamma', 'rz'];
      App.chart(document.getElementById('chDims'), {
        type: 'bar',
        data: { labels: ['α efficacité', 'Ω stocks', 'γ réactivité', 'Rz résilience'], datasets: [
          { label: 'Note', data: d.map(function (k) { return Math.round(r.idx[k] * 100); }), backgroundColor: App.color('accent'), borderRadius: 4, maxBarThickness: 46 },
          { label: 'Cible', data: d.map(function () { return 100; }), backgroundColor: App.color('grid-strong'), borderRadius: 4, maxBarThickness: 46 }
        ] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } }, scales: { y: { min: 0, max: 100 }, x: { grid: { display: false } } } }
      });
    }
  };
  function shortLabel(s) { return s.replace(/ \(.*\)$/, '').replace(/^(.{0,30}).*$/, function (m, a) { return s.length > 32 ? a + '…' : s; }); }
  function casc(label, v, cls, txt) {
    return '<div class="casc ' + cls + '"><small>' + label + '</small><strong>' + (txt || ((v < 0 ? '−' : '') + mfc(Math.abs(v)))) + '</strong></div>';
  }
  function bar(v, host) {
    if (!isNum(v)) return '—';
    var cls = host ? (v > 0.66 ? 'bad' : v > 0.33 ? 'warn' : 'good') : (v < 0.5 ? 'bad' : v < 0.85 ? 'warn' : 'good');
    return '<span class="bar"><span class="fill ' + cls + '" style="width:' + Math.round(v * 100) + '%"></span></span> ' + idx(v);
  }

  App.monthInputsTable = function (m) {
    var rec = S.getMonth(m) || {};
    return '<details><summary>Voir les ' + C.VARIABLES.length + ' valeurs saisies du mois</summary><div class="scroll"><table class="num"><thead><tr><th>N°</th><th class="txt">Variable</th><th>Valeur</th><th class="txt">Service</th></tr></thead><tbody>' +
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
      var years = []; c.res.annees.forEach(function (a) { years.push(String(a.annee)); });
      var fy = App.state.alY || 'tous', fr = App.state.alR || 'toutes', fg = App.state.alG || 'toutes', q = (App.state.alQ || '').toLowerCase();
      var count = function (rule) { return al.filter(function (a) { return a.regles.some(function (x) { return x.regle === rule; }); }).length; };
      var first = al.filter(function (a) { return a.regles.some(function (x) { return x.regle === 'niveau'; }); })[0];
      var decided = al.filter(function (a) { return (S.base.decisionsAlertes[a.mois] || '').trim(); }).length;
      var h = App.pageHead('Alertes', 'Détection automatique', 'Depuis quand et pourquoi ? Les règles sont appliquées à tout l’historique, comme si le logiciel existait depuis le premier mois.');
      h += '<div class="stats">' +
        App.stat('Mois en alerte', al.length + ' / ' + c.res.mois.length) +
        App.stat('Ratio sous le seuil', count('niveau'), 'bad') +
        App.stat('Tension sur les stocks', count('stocks'), 'warn') +
        App.stat('Baisse brutale', count('baisse'), 'info') +
        App.stat('Décisions inscrites', decided, 'good') +
        App.stat('Première alerte', first ? moisLabel(first.mois) : '—') + '</div>';
      h += '<section class="card filters"><input type="search" placeholder="Rechercher une dimension, une action, un mois…" data-change="alQ" value="' + esc(App.state.alQ || '') + '">' +
        '<select data-change="alY"><option value="tous">Toutes les années</option>' + years.map(function (y) { return '<option' + (y === fy ? ' selected' : '') + '>' + y + '</option>'; }).join('') + '</select>' +
        '<select data-change="alR"><option value="toutes">Toutes les règles</option>' + [['niveau', 'Ratio sous le seuil'], ['stocks', 'Tension sur les stocks'], ['baisse', 'Baisse brutale']].map(function (x) { return '<option value="' + x[0] + '"' + (x[0] === fr ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select>' +
        '<select data-change="alG"><option value="toutes">Toutes les gravités</option>' + ['haute', 'moyenne', 'faible'].map(function (x) { return '<option value="' + x + '"' + (x === fg ? ' selected' : '') + '>' + GRAV[x] + '</option>'; }).join('') + '</select></section>';
      var list = al.slice().reverse().filter(function (a) {
        if (fy !== 'tous' && a.mois.slice(0, 4) !== fy) return false;
        if (fr !== 'toutes' && !a.regles.some(function (x) { return x.regle === fr; })) return false;
        if (fg !== 'toutes' && gravite(a.regles) !== fg) return false;
        if (q) {
          var act = c.actions.filter(function (x) { return x.n === a.action; })[0];
          var txt = (moisLabel(a.mois) + ' ' + a.mois + ' ' + DIMS[a.dim] + ' ' + (act ? act.nom : '') + ' ' + a.regles.map(function (x) { return x.label; }).join(' ')).toLowerCase();
          if (txt.indexOf(q) < 0) return false;
        }
        return true;
      });
      var canDecide = S.can('pdg') || S.can('admin');
      h += '<section class="card"><div class="card-head"><div><h3>Registre des alertes</h3><p>' + list.length + ' mois affichés. La direction inscrit la décision prise pour chaque alerte.</p></div></div><div class="scroll"><table class="reg"><thead><tr><th>Gravité</th><th>Mois</th><th>Règle déclenchée</th><th>Valeur constatée</th><th>Dimension en cause</th><th>Action proposée</th><th>Décision de la direction</th></tr></thead><tbody>' +
        list.map(function (a) {
          var act = c.actions.filter(function (x) { return x.n === a.action; })[0];
          var dec = S.base.decisionsAlertes[a.mois] || '';
          var g = gravite(a.regles);
          var r = c.res.mois.filter(function (x) { return x.mois === a.mois; })[0];
          return '<tr><td><span class="sev ' + g + '">' + GRAV[g] + '</span></td><th><button class="link" data-go="mois" data-mois="' + a.mois + '">' + moisLabel(a.mois) + '</button></th><td>' + a.regles.map(function (x) { return esc(x.label); }).join('<br>') + '</td>' +
            '<td class="num">' + pct(r.ratio) + '<br><small class="muted">Ω ' + idx(r.idx.omega) + '</small></td><td>' + DIMS[a.dim] + '</td><td>' + (act ? 'n° ' + act.n + ' ' + esc(act.nom) : '—') + '</td><td>' +
            (canDecide ? '<input class="wide" data-change="decision" data-mois="' + a.mois + '" value="' + esc(dec) + '" placeholder="Décision prise…">' : esc(dec)) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>';
      return h;
    }
  };
  ['alY', 'alR', 'alG', 'alQ'].forEach(function (k) { App.actions[k] = function (el) { App.state[k] = el.value; App.render(); }; });
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
