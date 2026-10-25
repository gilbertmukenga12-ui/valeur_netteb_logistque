/* Interface du SAD-VNL : tableau de bord, saisie des données, sous-indicateurs, AMDEC, budget. */
(function () {
  'use strict';

  var M = window.VNLModel;
  var D = window.VNLData;
  var KEY = 'sad-vnl-v1';
  var DIMS = D.DIMENSIONS;
  var COLORS = { alpha: 'var(--c-alpha)', omega: 'var(--c-omega)', gamma: 'var(--c-gamma)', rz: 'var(--c-rz)', xe: 'var(--c-xe)' };

  var state = load();
  var ui = { view: 'dashboard', sel: null, detail: null };
  var viewEl = document.getElementById('view');

  /* ---------- utilitaires ---------- */

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && s.params && s.params.expo && Array.isArray(s.years) && s.years.length && Array.isArray(s.amdec) && Array.isArray(s.actions) && s.weights) return s;
      }
    } catch (e) { /* stockage indisponible : on repart des données par défaut */ }
    return D.gaana();
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignoré */ }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmt(n, d) {
    if (typeof n !== 'number' || !isFinite(n)) return '—';
    return n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  }

  function val(x) {
    return typeof x === 'number' && isFinite(x) ? String(x).replace('.', ',') : '';
  }

  function parseNum(s) {
    var t = String(s).trim().replace(/\s/g, '').replace(',', '.');
    if (t === '') return null;
    var n = Number(t);
    return isFinite(n) ? n : null;
  }

  function setOut(id, html) {
    var el = viewEl.querySelector('[data-out="' + id + '"]');
    if (el) el.innerHTML = html;
  }

  function statusClass(s) {
    if (s === 'Création élevée') return 'b-good';
    if (s === 'Création moyenne' || s === 'Reprise fragile') return 'b-warn';
    return 'b-bad';
  }

  function levelClass(l) {
    return l === 'Critique' ? 'b-bad' : l === 'Majeur' ? 'b-warn' : 'b-good';
  }

  function badge(text, cls) {
    return '<span class="badge ' + cls + '">' + esc(text) + '</span>';
  }

  function results() {
    return M.computeAll(state.years, state.params);
  }

  function numInput(attrs, v) {
    return '<input type="text" inputmode="decimal" ' + attrs + ' value="' + esc(val(v)) + '">';
  }

  /* ---------- graphiques SVG ---------- */

  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var m = v / p;
    var n = m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10;
    return n * p;
  }

  function barChart(res, sel) {
    var W = 640, H = 290, L = 56, R = 12, T = 24, B = 30;
    var top = niceMax(Math.max.apply(null, res.map(function (r) { return r.vnl; }).concat([1])));
    var pw = W - L - R, ph = H - T - B;
    var slot = pw / res.length, bw = Math.min(70, slot * 0.6);
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="VNL par année">';
    for (var t = 0; t <= 4; t++) {
      var y = T + ph - (ph * t) / 4;
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)"/>';
      s += '<text x="' + (L - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt((top * t) / 4, 0) + '</text>';
    }
    res.forEach(function (r, i) {
      var h = Math.max(0, (r.vnl / top) * ph);
      var x = L + slot * i + (slot - bw) / 2;
      s += '<rect x="' + x + '" y="' + (T + ph - h) + '" width="' + bw + '" height="' + h + '" rx="3" fill="var(--accent)" opacity="' + (i === sel ? 1 : 0.5) + '"/>';
      s += '<text class="val" x="' + (x + bw / 2) + '" y="' + (T + ph - h - 6) + '" text-anchor="middle">' + fmt(r.vnl, 0) + '</text>';
      s += '<text x="' + (x + bw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(r.year) + '</text>';
    });
    return s + '</svg>';
  }

  function lineChart(sel) {
    var W = 640, H = 290, L = 40, R = 16, T = 16, B = 30;
    var ys = state.years;
    var keys = ['alpha', 'omega', 'gamma', 'rz', 'xe'];
    var max = 1;
    ys.forEach(function (y) { keys.forEach(function (k) { if (y.idx[k] > max) max = y.idx[k]; }); });
    var top = Math.ceil(max * 4) / 4;
    var pw = W - L - R, ph = H - T - B;
    var xAt = function (i) { return ys.length === 1 ? L + pw / 2 : L + (pw * i) / (ys.length - 1); };
    var yAt = function (v) { return T + ph - (v / top) * ph; };
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Évolution des cinq indices">';
    for (var v = 0; v <= top + 1e-9; v += 0.25) {
      s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + yAt(v) + '" y2="' + yAt(v) + '" stroke="var(--line)"/>';
      s += '<text x="' + (L - 6) + '" y="' + (yAt(v) + 4) + '" text-anchor="end">' + fmt(v, 2) + '</text>';
    }
    if (sel !== null) s += '<line x1="' + xAt(sel) + '" x2="' + xAt(sel) + '" y1="' + T + '" y2="' + (T + ph) + '" stroke="var(--muted)" stroke-dasharray="3 3"/>';
    keys.forEach(function (k) {
      var pts = ys.map(function (y, i) { return xAt(i) + ',' + yAt(y.idx[k]); }).join(' ');
      s += '<polyline points="' + pts + '" fill="none" style="stroke:' + COLORS[k] + '" stroke-width="2.2" stroke-linejoin="round"/>';
      ys.forEach(function (y, i) { s += '<circle cx="' + xAt(i) + '" cy="' + yAt(y.idx[k]) + '" r="3" style="fill:' + COLORS[k] + '"/>'; });
    });
    ys.forEach(function (y, i) { s += '<text x="' + xAt(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(y.year) + '</text>'; });
    return s + '</svg>';
  }

  /* ---------- tableau de bord ---------- */

  function diagnostic(res, k) {
    var r = res[k], y = state.years[k], i = y.idx, p = state.params, out = [];
    if (k > 0) {
      var prev = res[k - 1];
      if (prev.vnl !== 0) {
        var v = ((r.vnl - prev.vnl) / Math.abs(prev.vnl)) * 100;
        out.push('La VNL ' + (v >= 0 ? 'progresse' : 'recule') + ' de ' + fmt(Math.abs(v), 1) + ' % par rapport à ' + prev.year + '.');
      }
    }
    var names = { alpha: 'α (efficacité opérationnelle)', omega: 'Ω (gestion des stocks)', gamma: 'γ (conversion marchande)', rz: 'Rz (résilience)' };
    var weak = Object.keys(names).reduce(function (a, b) { return i[b] < i[a] ? b : a; });
    out.push('Maillon faible : ' + names[weak] + ', à ' + fmt(i[weak], 2) + '. Comme l’agrégation est multiplicative, c’est là qu’un effort rapporte le plus.');
    if (r.delta < -0.005) out.push('L’incertitude (Xe = ' + fmt(i.xe, 2) + ') dépasse la résilience (Rz = ' + fmt(i.rz, 2) + ') : l’environnement atténue la valeur créée (Φ = ' + fmt(r.phi, 3) + ').');
    else if (r.delta > 0.1) out.push('La résilience (Rz = ' + fmt(i.rz, 2) + ') dépasse nettement l’incertitude (Xe = ' + fmt(i.xe, 2) + ') : l’environnement amplifie la valeur créée (Φ = ' + fmt(r.phi, 3) + ').');
    else out.push('Résilience et incertitude s’équilibrent (Rz = ' + fmt(i.rz, 2) + ', Xe = ' + fmt(i.xe, 2) + ') : l’environnement est à peu près neutre (Φ = ' + fmt(r.phi, 3) + ').');
    var vnl0 = y.vmb * (1 - p.tau) * r.psi * Math.exp(p.theta * i.rz) - y.clog;
    if (vnl0 - r.vnl > 0.5 && vnl0 > 0) {
      out.push('Sans incertitude environnementale (Xe = 0), la VNL serait de ' + fmt(vnl0, 1) + ' M FC : l’environnement coûte ' + fmt(vnl0 - r.vnl, 1) + ' M FC, soit ' + fmt(((vnl0 - r.vnl) / vnl0) * 100, 0) + ' % de la valeur potentielle.');
    }
    return out;
  }

  function renderDashboard() {
    var res = results();
    if (ui.sel === null || ui.sel >= res.length) ui.sel = res.length - 1;
    var r = res[ui.sel];
    var opts = res.map(function (x, i) { return '<option value="' + i + '"' + (i === ui.sel ? ' selected' : '') + '>' + esc(x.year) + '</option>'; }).join('');
    var legend = [['alpha', 'α Efficacité'], ['omega', 'Ω Stocks'], ['gamma', 'γ Conversion'], ['rz', 'Rz Résilience'], ['xe', 'Xe Incertitude']]
      .map(function (a) { return '<span><i style="background:' + COLORS[a[0]] + '"></i>' + a[1] + '</span>'; }).join('');
    var rows = res.map(function (x, i) {
      return '<tr><td>' + esc(x.year) + '</td><td>' + fmt(x.vmb, 1) + '</td><td>' + fmt(x.clog, 1) + '</td><td>' + fmt(x.psi, 3) + '</td><td>' + fmt(x.phi, 3) +
        '</td><td>' + fmt(x.delta, 2) + '</td><td><b>' + fmt(x.vnl, 1) + '</b></td><td>' + fmt(x.ratio * 100, 1) + ' %</td><td class="left">' + badge(x.status, statusClass(x.status)) + '</td></tr>';
    }).join('');
    viewEl.innerHTML =
      '<h2>Tableau de bord</h2>' +
      '<p class="lead">La logistique crée-t-elle ou détruit-elle de la valeur ? La VNL répond en francs congolais, après coûts logistiques et effet de l’environnement.</p>' +
      '<div class="row"><label>Année analysée<select data-a="sel">' + opts + '</select></label>' +
      (canDownload() ? '<button class="btn" data-do="csv">Exporter les résultats (CSV)</button>' : '') + '</div>' +
      '<div class="kpis">' +
      '<div class="kpi"><div class="l">VNL</div><div class="v">' + fmt(r.vnl, 1) + '</div><div class="s">M FC</div></div>' +
      '<div class="kpi"><div class="l">VNL / VMB</div><div class="v">' + fmt(r.ratio * 100, 1) + ' %</div><div class="s">part de valeur conservée</div></div>' +
      '<div class="kpi"><div class="l">Ψ conversion</div><div class="v">' + fmt(r.psi, 3) + '</div><div class="s">α · Ω · γ</div></div>' +
      '<div class="kpi"><div class="l">Φ environnement</div><div class="v">' + fmt(r.phi, 3) + '</div><div class="s">Δ = Rz − Xe = ' + fmt(r.delta, 2) + '</div></div>' +
      '<div class="kpi"><div class="l">Régime</div><div class="v" style="font-size:16px;padding-top:6px">' + badge(r.status, statusClass(r.status)) + '</div></div>' +
      '</div>' +
      '<div class="card diag"><h3>Lecture automatique, ' + esc(r.year) + '</h3>' + diagnostic(res, ui.sel).map(function (t) { return '<p>' + esc(t) + '</p>'; }).join('') + '</div>' +
      '<div class="charts">' +
      '<div class="card chart"><h3>VNL par année (M FC)</h3>' + barChart(res, ui.sel) + '</div>' +
      '<div class="card chart"><h3>Les cinq indices</h3>' + lineChart(ui.sel) + '<div class="legend">' + legend + '</div></div>' +
      '</div>' +
      '<div class="card"><h3>Résultats par année</h3><div class="tablewrap"><table><thead><tr><th>Année</th><th>VMB</th><th>Clog</th><th>Ψ</th><th>Φ</th><th>Δ</th><th>VNL</th><th>VNL/VMB</th><th class="left">Régime</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<p class="note">VNL = VMB × (1 − τ) × Ψ × Φ − Clog, avec τ = ' + fmt(state.params.tau * 100, 0) + ' % et θ = ' + fmt(state.params.theta, 2) + '. Les montants sont en M FC. Le mémoire arrondit Ψ et Φ avant de multiplier, d’où des écarts de l’ordre de 1 % avec ses tableaux.</p></div>';
  }

  function canDownload() {
    try { return window.top === window.self; } catch (e) { return false; }
  }

  function exportCsv() {
    var res = results();
    var lines = [['Année', 'VMB (M FC)', 'Clog (M FC)', 'α', 'Ω', 'γ', 'Rz', 'Xe', 'Ψ', 'Φ', 'VNL (M FC)', 'VNL/VMB', 'Régime']];
    res.forEach(function (r, i) {
      var x = state.years[i].idx;
      lines.push([r.year, r.vmb, r.clog, x.alpha, x.omega, x.gamma, x.rz, x.xe, r.psi.toFixed(4), r.phi.toFixed(4), r.vnl.toFixed(1), (r.ratio * 100).toFixed(1) + ' %', r.status]);
    });
    var csv = '﻿' + lines.map(function (l) { return l.map(function (c) { return String(c).replace('.', ','); }).join(';'); }).join('\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'vnl-resultats.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /* ---------- données ---------- */

  function renderData() {
    var p = state.params;
    var rows = state.years.map(function (y, i) {
      var f = function (field, v) { return '<td class="num-in">' + numInput('data-a="yf" data-i="' + i + '" data-f="' + field + '"', v) + '</td>'; };
      return '<tr>' + f('year', y.year) + f('vmb', y.vmb) + f('clog', y.clog) +
        f('idx.alpha', y.idx.alpha) + f('idx.omega', y.idx.omega) + f('idx.gamma', y.idx.gamma) + f('idx.rz', y.idx.rz) + f('idx.xe', y.idx.xe) +
        '<td data-out="psi:' + i + '"></td><td data-out="phi:' + i + '"></td><td data-out="vnl:' + i + '"></td>' +
        '<td><button class="x" title="Supprimer cette année" data-do="delyear" data-i="' + i + '">×</button></td></tr>';
    }).join('');
    viewEl.innerHTML =
      '<h2>Données</h2>' +
      '<p class="lead">Saisissez, pour chaque année, la valeur marchande brute (VMB), les coûts logistiques (Clog) et les cinq indices. Les indices peuvent aussi être calculés depuis l’onglet « Sous-indicateurs ».</p>' +
      '<div class="card"><h3>Paramètres du modèle</h3><div class="row">' +
      '<label>Taux τ (taxes et prélèvements)' + numInput('data-a="param" data-k="tau"', p.tau) + '</label>' +
      '<label>Sensibilité θ (Φ)' + numInput('data-a="param" data-k="theta"', p.theta) + '</label>' +
      '<label>Exposant de α' + numInput('data-a="expo" data-k="alpha"', p.expo.alpha) + '</label>' +
      '<label>Exposant de Ω' + numInput('data-a="expo" data-k="omega"', p.expo.omega) + '</label>' +
      '<label>Exposant de γ' + numInput('data-a="expo" data-k="gamma"', p.expo.gamma) + '</label>' +
      '</div><p class="hint">Valeurs du mémoire : τ = 0,16 ; θ = 0,35 ; exposants 0,40 / 0,35 / 0,25 (poids AHP des trois dimensions).</p></div>' +
      '<div class="card"><h3>Données annuelles</h3><div class="tablewrap"><table><thead><tr><th>Année</th><th>VMB</th><th>Clog</th><th>α</th><th>Ω</th><th>γ</th><th>Rz</th><th>Xe</th><th>Ψ</th><th>Φ</th><th>VNL</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" data-do="addyear">Ajouter une année</button><button class="btn danger" data-do="reset">Recharger les données de la GAANA</button></div>' +
      '<p class="hint">Les modifications sont enregistrées automatiquement dans ce navigateur.</p></div>';
    fillData();
  }

  function fillData() {
    results().forEach(function (r, i) {
      setOut('psi:' + i, fmt(r.psi, 3));
      setOut('phi:' + i, fmt(r.phi, 3));
      setOut('vnl:' + i, '<b>' + fmt(r.vnl, 1) + '</b>');
    });
  }

  /* ---------- sous-indicateurs ---------- */

  function entry(rec, code) {
    return (rec.detail && rec.detail[code]) || {};
  }

  function normOf(rec, sub) {
    var e = entry(rec, sub.code);
    if (typeof e.ovr === 'number') return e.ovr;
    return M.normalize(e.raw, e.p90, e.pol || sub.pol);
  }

  function renderDetail() {
    if (ui.detail === null || ui.detail >= state.years.length) ui.detail = state.years.length - 1;
    var rec = state.years[ui.detail];
    var opts = state.years.map(function (y, i) { return '<option value="' + i + '"' + (i === ui.detail ? ' selected' : '') + '>' + esc(y.year) + '</option>'; }).join('');
    var cards = DIMS.map(function (d) {
      var rows = d.subs.map(function (s) {
        var e = entry(rec, s.code);
        var pol = e.pol || s.pol;
        return '<tr><td class="left"><b>' + esc(s.code) + '</b></td><td class="left">' + esc(s.label) + '</td>' +
          '<td class="num-in">' + numInput('data-a="w" data-code="' + esc(s.code) + '"', state.weights[s.code]) + '</td>' +
          '<td class="num-in">' + numInput('data-a="det" data-f="raw" data-code="' + esc(s.code) + '"', e.raw) + '</td>' +
          '<td class="num-in">' + numInput('data-a="det" data-f="p90" data-code="' + esc(s.code) + '"', e.p90) + '</td>' +
          '<td><select data-a="pol" data-code="' + esc(s.code) + '"><option value="direct"' + (pol === 'direct' ? ' selected' : '') + '>Directe</option><option value="inverse"' + (pol === 'inverse' ? ' selected' : '') + '>Inverse</option></select></td>' +
          '<td class="num-in">' + numInput('data-a="det" data-f="ovr" data-code="' + esc(s.code) + '"', e.ovr) + '</td>' +
          '<td data-out="norm:' + esc(s.code) + '"></td></tr>';
      }).join('');
      return '<div class="card"><h3>' + d.sym + ' — ' + esc(d.label) + '</h3><div class="tablewrap"><table><thead><tr><th>Code</th><th class="left">Sous-indicateur</th><th>Poids</th><th>Valeur brute</th><th>P90</th><th>Polarité</th><th>Normalisée imposée</th><th>Normalisée retenue</th></tr></thead><tbody>' + rows +
        '<tr class="sum"><td></td><td class="left">Indice ' + d.sym + '</td><td data-out="sum:' + d.id + '"></td><td colspan="4" class="left hint" data-out="cnt:' + d.id + '"></td><td data-out="idx:' + d.id + '"></td></tr></tbody></table></div></div>';
    }).join('');
    viewEl.innerHTML =
      '<h2>Sous-indicateurs</h2>' +
      '<p class="lead">Chaque sous-indicateur brut est ramené au P90 local : valeur / P90 pour une polarité directe, P90 / valeur pour une polarité inverse, bornée entre ' + M.NORM_MIN + ' et ' + M.NORM_MAX + '. L’indice d’une dimension est la moyenne pondérée des valeurs normalisées.</p>' +
      '<div class="row"><label>Année<select data-a="detailyear">' + opts + '</select></label>' +
      '<button class="btn primary" data-do="apply">Appliquer les indices à l’année ' + esc(rec.year) + '</button><span class="hint" id="applymsg"></span></div>' +
      '<p class="note">Une valeur « normalisée imposée » remplace le calcul : elle permet de reprendre telles quelles les valeurs normalisées publiées dans le mémoire (tableau III-3, année 2022).</p>' +
      cards;
    fillDetail();
  }

  function fillDetail() {
    var rec = state.years[ui.detail];
    DIMS.forEach(function (d) {
      var items = [], filled = 0, sum = 0;
      d.subs.forEach(function (s) {
        var n = normOf(rec, s);
        setOut('norm:' + s.code, fmt(n, 2));
        sum += state.weights[s.code] || 0;
        if (isFinite(n)) { filled++; items.push({ w: state.weights[s.code] || 0, v: n }); }
      });
      setOut('sum:' + d.id, '<span style="' + (Math.abs(sum - 1) > 0.01 ? 'color:var(--warn)' : '') + '">' + fmt(sum, 3) + '</span>');
      setOut('cnt:' + d.id, filled + ' / ' + d.subs.length + ' renseignés');
      setOut('idx:' + d.id, filled ? fmt(M.weightedIndex(items), 3) : '—');
    });
  }

  function applyDetail() {
    var rec = state.years[ui.detail], done = [], skipped = [];
    DIMS.forEach(function (d) {
      var items = [];
      d.subs.forEach(function (s) {
        var n = normOf(rec, s);
        if (isFinite(n)) items.push({ w: state.weights[s.code] || 0, v: n });
      });
      if (items.length === d.subs.length) {
        rec.idx[d.id] = Math.round(M.weightedIndex(items) * 10000) / 10000;
        done.push(d.sym);
      } else {
        skipped.push(d.sym);
      }
    });
    save();
    var msg = document.getElementById('applymsg');
    if (msg) msg.textContent = (done.length ? 'Appliqué : ' + done.join(', ') + '. ' : '') + (skipped.length ? 'Incomplet, non modifié : ' + skipped.join(', ') + '.' : '');
  }

  /* ---------- AMDEC ---------- */

  function renderAmdec() {
    var rows = state.amdec.map(function (a, i) {
      var f = function (field, v) { return '<td class="num-in">' + numInput('data-a="am" data-i="' + i + '" data-f="' + field + '"', v) + '</td>'; };
      return '<tr><td class="left"><input type="text" data-a="am" data-i="' + i + '" data-f="name" value="' + esc(a.name) + '"></td>' + f('f', a.f) + f('g', a.g) + f('d', a.d) +
        '<td data-out="crit:' + i + '"></td><td data-out="lvl:' + i + '"></td>' +
        '<td class="num-in" style="text-align:left"><input type="text" data-a="am" data-i="' + i + '" data-f="dim" value="' + esc(a.dim) + '" style="width:90px;text-align:left"></td>' +
        '<td><button class="x" title="Supprimer" data-do="delam" data-i="' + i + '">×</button></td></tr>';
    }).join('');
    viewEl.innerHTML =
      '<h2>AMDEC</h2>' +
      '<p class="lead">Analyse des modes de défaillance, de leurs effets et de leur criticité. Criticité = fréquence (F) × gravité (G) × détectabilité (D).</p>' +
      '<div class="card"><div class="tablewrap"><table><thead><tr><th class="left">Défaillance</th><th>F</th><th>G</th><th>D</th><th>Criticité</th><th>Niveau</th><th class="left">Dimensions VNL</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" data-do="addam">Ajouter une défaillance</button><button class="btn" data-do="sortam">Trier par criticité</button></div>' +
      '<p class="note">Seuils du mémoire : critique au-delà de 35, majeur de 20 à 35, modéré en dessous de 20.</p><div data-out="amsum"></div></div>';
    fillAmdec();
  }

  function fillAmdec() {
    var counts = { Critique: 0, Majeur: 0, 'Modéré': 0 };
    state.amdec.forEach(function (a, i) {
      var c = M.criticality(a.f, a.g, a.d), l = M.criticalityLevel(c);
      counts[l]++;
      setOut('crit:' + i, '<b>' + fmt(c, 0) + '</b>');
      setOut('lvl:' + i, badge(l, levelClass(l)));
    });
    setOut('amsum', '<p class="hint">' + counts.Critique + ' critique(s), ' + counts.Majeur + ' majeur(s), ' + counts['Modéré'] + ' modéré(s).</p>');
  }

  /* ---------- budget ---------- */

  function renderBudget() {
    var rows = state.actions.map(function (a, i) {
      var f = function (field, v) { return '<td class="num-in">' + numInput('data-a="act" data-i="' + i + '" data-f="' + field + '"', v) + '</td>'; };
      return '<tr id="act' + i + '"><td>' + esc(a.id) + '</td><td class="left"><input type="text" data-a="act" data-i="' + i + '" data-f="name" value="' + esc(a.name) + '"></td>' + f('cost', a.cost) + f('gain', a.gain) +
        '<td data-out="ratio:' + i + '"></td><td class="left"><input type="text" data-a="act" data-i="' + i + '" data-f="risk" value="' + esc(a.risk) + '" style="min-width:120px"></td>' +
        '<td data-out="pick:' + i + '"></td><td><button class="x" title="Supprimer" data-do="delact" data-i="' + i + '">×</button></td></tr>';
    }).join('');
    viewEl.innerHTML =
      '<h2>Budget d’actions correctives</h2>' +
      '<p class="lead">Quelles actions financer pour gagner le plus de VNL avec un budget donné ? Le calcul est exact : il teste toutes les combinaisons possibles sans dépasser le budget.</p>' +
      '<div class="card"><div class="row"><label>Budget disponible (M FC)' + numInput('data-a="budget"', state.budget) + '</label></div><div data-out="bsum"></div></div>' +
      '<div class="card"><h3>Actions candidates</h3><div class="tablewrap"><table><thead><tr><th>N°</th><th class="left">Action</th><th>Coût (M FC)</th><th>Gain VNL (M FC)</th><th>Gain / coût</th><th class="left">Risque ciblé</th><th>Retenue</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="row" style="margin-top:12px"><button class="btn" data-do="addact">Ajouter une action</button></div></div>' +
      '<div class="card"><h3>Comparaison de scénarios</h3><div class="tablewrap" data-out="scen"></div></div>';
    fillBudget();
  }

  function usableActions() {
    return state.actions.filter(function (a) { return typeof a.cost === 'number' && a.cost >= 0 && typeof a.gain === 'number'; });
  }

  function fillBudget() {
    var res = results(), ref = res[res.length - 1];
    var acts = usableActions();
    var o = M.optimize(acts, state.budget);
    state.actions.forEach(function (a, i) {
      setOut('ratio:' + i, a.cost > 0 ? fmt(a.gain / a.cost, 2) : '—');
      var on = o.selected.indexOf(a.id) !== -1;
      setOut('pick:' + i, on ? '✓' : '');
      var tr = document.getElementById('act' + i);
      if (tr) tr.classList.toggle('picked', on);
    });
    setOut('bsum',
      '<div class="kpis" style="margin:0">' +
      '<div class="kpi"><div class="l">Coût des actions retenues</div><div class="v">' + fmt(o.cost, 1) + '</div><div class="s">sur ' + fmt(state.budget, 1) + ' M FC</div></div>' +
      '<div class="kpi"><div class="l">Gain de VNL</div><div class="v">' + fmt(o.gain, 1) + '</div><div class="s">M FC</div></div>' +
      '<div class="kpi"><div class="l">Gain / coût</div><div class="v">' + (o.cost > 0 ? fmt(o.gain / o.cost, 2) : '—') + '</div><div class="s">ratio global</div></div>' +
      '<div class="kpi"><div class="l">VNL ' + esc(ref.year) + ' après actions</div><div class="v">' + fmt(ref.vnl + o.gain, 1) + '</div><div class="s">au lieu de ' + fmt(ref.vnl, 1) + ' M FC</div></div></div>' +
      '<p class="hint" style="margin-top:10px">Actions retenues : ' + (o.selected.length ? o.selected.join(', ') : 'aucune') + '.</p>');
    var budgets = [100, 150, 200];
    if (budgets.indexOf(state.budget) === -1 && state.budget > 0) budgets.push(state.budget);
    budgets.sort(function (a, b) { return a - b; });
    var srows = budgets.map(function (b) {
      var s = M.optimize(acts, b);
      return '<tr><td>' + fmt(b, 0) + '</td><td class="left">' + (s.selected.join(', ') || '—') + '</td><td>' + fmt(s.cost, 1) + '</td><td>' + fmt(s.gain, 1) + '</td><td>' + fmt(ref.vnl + s.gain, 1) + '</td><td>' + (s.cost > 0 ? fmt(s.gain / s.cost, 2) : '—') + '</td></tr>';
    }).join('');
    setOut('scen', '<table><thead><tr><th>Budget</th><th class="left">Actions retenues</th><th>Coût</th><th>Gain</th><th>VNL après</th><th>Gain / coût</th></tr></thead><tbody>' + srows + '</tbody></table>');
  }

  /* ---------- navigation et événements ---------- */

  function render() {
    Array.prototype.forEach.call(document.querySelectorAll('#nav button'), function (b) {
      b.classList.toggle('on', b.dataset.view === ui.view);
    });
    ({ dashboard: renderDashboard, data: renderData, detail: renderDetail, amdec: renderAmdec, budget: renderBudget })[ui.view]();
  }

  document.getElementById('nav').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-view]');
    if (!b) return;
    ui.view = b.dataset.view;
    render();
    window.scrollTo(0, 0);
  });

  function setPath(obj, path, v) {
    var parts = path.split('.');
    while (parts.length > 1) obj = obj[parts.shift()];
    obj[parts[0]] = v;
  }

  viewEl.addEventListener('input', function (e) {
    var t = e.target, a = t.dataset.a;
    if (!a) return;
    var n = t.type === 'text' && t.inputMode === 'decimal' ? parseNum(t.value) : null;
    var i = Number(t.dataset.i);
    if (a === 'param') { state.params[t.dataset.k] = n === null ? 0 : n; fillData(); }
    else if (a === 'expo') { state.params.expo[t.dataset.k] = n === null ? 0 : n; fillData(); }
    else if (a === 'yf') { setPath(state.years[i], t.dataset.f, n === null ? 0 : n); fillData(); }
    else if (a === 'w') { state.weights[t.dataset.code] = n === null ? 0 : n; fillDetail(); }
    else if (a === 'det') {
      var rec = state.years[ui.detail];
      rec.detail = rec.detail || {};
      rec.detail[t.dataset.code] = rec.detail[t.dataset.code] || {};
      rec.detail[t.dataset.code][t.dataset.f] = n;
      fillDetail();
    }
    else if (a === 'am') { state.amdec[i][t.dataset.f] = t.inputMode === 'decimal' ? (n === null ? 0 : n) : t.value; fillAmdec(); }
    else if (a === 'act') { state.actions[i][t.dataset.f] = t.inputMode === 'decimal' ? n : t.value; fillBudget(); }
    else if (a === 'budget') { state.budget = n === null ? 0 : n; fillBudget(); }
    else return;
    save();
  });

  viewEl.addEventListener('change', function (e) {
    var t = e.target, a = t.dataset.a;
    if (a === 'sel') { ui.sel = Number(t.value); renderDashboard(); }
    else if (a === 'detailyear') { ui.detail = Number(t.value); renderDetail(); }
    else if (a === 'pol') {
      var rec = state.years[ui.detail];
      rec.detail = rec.detail || {};
      rec.detail[t.dataset.code] = rec.detail[t.dataset.code] || {};
      rec.detail[t.dataset.code].pol = t.value;
      save();
      fillDetail();
    }
  });

  viewEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-do]');
    if (!b) return;
    var i = Number(b.dataset.i), act = b.dataset.do;
    if (act === 'csv') return exportCsv();
    if (act === 'apply') return applyDetail();
    if (act === 'addyear') {
      var last = state.years[state.years.length - 1];
      state.years.push({ year: last.year + 1, vmb: last.vmb, clog: last.clog, idx: Object.assign({}, last.idx) });
    } else if (act === 'delyear') {
      if (state.years.length <= 1) return;
      state.years.splice(i, 1);
      ui.sel = null;
      ui.detail = null;
    } else if (act === 'reset') {
      if (!ui.armed) {
        ui.armed = true;
        b.textContent = 'Cliquer à nouveau : vos modifications seront perdues';
        return;
      }
      state = D.gaana();
      ui.sel = null;
      ui.detail = null;
    } else if (act === 'addam') {
      state.amdec.push({ name: 'Nouvelle défaillance', f: 1, g: 1, d: 1, dim: '' });
    } else if (act === 'delam') {
      state.amdec.splice(i, 1);
    } else if (act === 'sortam') {
      state.amdec.sort(function (a, c) { return M.criticality(c.f, c.g, c.d) - M.criticality(a.f, a.g, a.d); });
    } else if (act === 'addact') {
      var id = state.actions.reduce(function (m, a) { return Math.max(m, a.id); }, 0) + 1;
      state.actions.push({ id: id, name: 'Nouvelle action', cost: 10, gain: 10, risk: '' });
    } else if (act === 'delact') {
      state.actions.splice(i, 1);
    } else {
      return;
    }
    ui.armed = false;
    save();
    render();
  });

  render();
})();
