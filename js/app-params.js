/*
 * Écran 7 (paramètres et méthode, pondération AHP) et écran Analyses (sensibilité, statistiques).
 */
(function (root) {
  'use strict';

  var C = root.VNLConfig, M = root.VNLModel, S = root.VNLStore, I = root.VNLImporter, App = root.App;
  var F = App.fmt, esc = F.esc;

  /* ---------- Paramètres ---------- */
  var GENERAL = [
    { k: 'theta', label: 'Coefficient θ du modulateur Φ', dec: 3 },
    { k: 'seuilRatio', label: 'Seuil d’alerte VNL/VMB', dec: 4 },
    { k: 'seuilOmega', label: 'Seuil d’alerte Ω', dec: 3 },
    { k: 'seuilBaisse', label: 'Seuil de baisse mensuelle de VNL/VMB', dec: 3 },
    { k: 'budget', label: 'Budget des actions correctives (M FC)', scale: 1e6, dec: 2 },
    { k: 'taux', label: 'Taux d’actualisation', dec: 3 },
    { k: 'seuilSensibilite', label: 'Seuil de lecture de la sensibilité', dec: 3 },
    { k: 'anneeReference', label: 'Année de référence des actions', dec: 0 }
  ];

  App.views.parametres = {
    html: function () {
      var v = S.paramVersion(), p = v.params;
      var canEdit = S.can('admin') || S.can('pdg');
      var tab = App.state.ptab || 'guide';
      var h = App.pageHead('Paramètres et méthode', 'Version ' + esc(v.id), 'Comment la VNL est calculée, avec quels seuils et quelles pondérations.');
      h += '<div class="tabs" role="tablist">' + [['guide', 'book', 'Guide méthodologique'], ['config', 'sliders', 'Configuration'], ['ahp', 'users', 'Pondération AHP']].map(function (t) {
        return '<button role="tab" data-act="ptab" data-t="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + App.icon(t[1]) + t[2] + '</button>';
      }).join('') + '</div>';
      if (tab === 'guide') return h + guide(p) + methode();
      if (tab === 'ahp') return h + App.ahpCard();
      h += '<section class="card"><p>Version active : <strong>' + v.id + '</strong> du ' + esc(v.date.slice(0, 10)) + ' (' + esc(v.auteur) + (v.validePar ? ', validée par ' + esc(v.validePar) : '') + '). ' + esc(v.justification) + '</p>';
      var props = S.base.parametres.propositions;
      if (props.length) {
        h += '<h4>Propositions en attente de validation du PDG</h4><ul>' + props.map(function (pr) {
          return '<li>' + esc(pr.date.slice(0, 10)) + ', ' + esc(pr.auteur) + ' : ' + esc(pr.justification) + '<br><small>' + esc(S.diffParams(p, pr.params) || 'aucun changement') + '</small>' +
            (S.can('pdg') ? ' <button data-act="adopt" data-id="' + pr.id + '">Valider</button> <button data-act="reject" data-id="' + pr.id + '">Refuser</button>' : '') + '</li>';
        }).join('') + '</ul>';
      }
      h += '</section>';

      h += '<form id="pform"><section class="card"><h3>Paramètres généraux</h3><div class="grid3">' + GENERAL.map(function (g) {
        var val = g.scale ? p[g.k] / g.scale : p[g.k];
        return '<label data-help="' + esc(C.PARAM_HELP[g.k] || '') + '">' + g.label + '<input name="' + g.k + '" inputmode="decimal" value="' + esc(I.formatNumber(val)) + '"' + (canEdit ? '' : ' disabled') + '><small>' + esc(C.PARAM_HELP[g.k] || '') + '</small></label>';
      }).join('') +
        ['alpha', 'omega', 'gamma'].map(function (d) { return '<label>Poids de ' + { alpha: 'α', omega: 'Ω', gamma: 'γ' }[d] + ' dans Ψ<input name="w_' + d + '" inputmode="decimal" value="' + I.formatNumber(p.wDim[d]) + '"' + (canEdit ? '' : ' disabled') + '><small>' + esc(C.PARAM_HELP.wDim) + '</small></label>'; }).join('') +
        '<label>Seuil AMDEC « critique » (au-delà de)<input name="amdecC" inputmode="decimal" value="' + p.amdec.critique + '"' + (canEdit ? '' : ' disabled') + '></label>' +
        '<label>Seuil AMDEC « majeure » (à partir de)<input name="amdecM" inputmode="decimal" value="' + p.amdec.majeure + '"' + (canEdit ? '' : ' disabled') + '></label></div>' +
        '<div class="inline">Recalculer le seuil VNL/VMB sur la période de référence du <input name="refFrom" value="2018-01" size="7"> au <input name="refTo" value="2019-12" size="7"> <button data-act="seuilRef">Recalculer</button></div></section>';

      h += '<section class="card"><h3>Sous-indicateurs : cibles et poids</h3><div class="scroll"><table class="num"><thead><tr><th>Dim.</th><th>Code</th><th class="txt">Mesure</th><th>Sens</th><th>Cible ou seuil</th><th>Poids AHP</th><th>Poids utilisé</th><th>Exclu</th></tr></thead><tbody>' +
        C.SUB_INDICATORS.map(function (s) {
          var sp = p.sub[s.code], w = M.dimWeights(p, s.dim)[s.code];
          return '<tr><td>' + C.DIMENSIONS.filter(function (d) { return d.code === s.dim; })[0].sym + '</td><th>' + s.code + '</th><td class="txt">' + esc(s.label) + '</td><td>' + { up: '↑', down: '↓', host: 'hostilité' }[s.sens] + '</td>' +
            '<td><input class="sm" name="c_' + s.code + '" value="' + (sp.cible === null ? '' : I.formatNumber(sp.cible)) + '"' + (canEdit ? '' : ' disabled') + '></td>' +
            '<td><input class="sm" name="p_' + s.code + '" value="' + I.formatNumber(sp.poids) + '"' + (canEdit ? '' : ' disabled') + '></td><td>' + (F.isNum(w) ? F.idx(w) : 'exclu') + '</td>' +
            '<td><input type="checkbox" name="x_' + s.code + '"' + (sp.exclu ? ' checked' : '') + (canEdit ? '' : ' disabled') + '></td></tr>';
        }).join('') + '</tbody></table></div><p class="hint">Un sous-indicateur exclu voit son poids redistribué au prorata entre les autres sous-indicateurs de sa dimension. TOD et MBM sont exclus pour éviter un double comptage (pertes déjà dans τ, marge déjà dans la VMB).</p></section>';
      if (canEdit) h += '<section class="card"><label>Justification de la modification (obligatoire)<textarea name="justif" rows="2"></textarea></label><button class="primary" data-act="propose">' + (S.can('pdg') ? 'Adopter ces paramètres' : 'Soumettre au PDG') + '</button></section>';
      h += '</form>';

      // versions (F3.3, F3.4)
      var vs = S.base.parametres.versions;
      var cmpId = App.state.cmpVersion;
      h += '<section class="card"><h3>Versions de paramètres</h3><div class="scroll"><table><thead><tr><th>Version</th><th>Date</th><th>Auteur</th><th>Justification</th><th></th></tr></thead><tbody>' +
        vs.slice().reverse().map(function (x) {
          return '<tr><th>' + x.id + (x.id === S.base.parametres.active ? ' <span class="tag">active</span>' : '') + '</th><td>' + esc(x.date.slice(0, 10)) + '</td><td class="txt">' + esc(x.auteur) + '</td><td class="txt">' + esc(x.justification) + '</td><td><button class="link" data-act="cmp" data-id="' + x.id + '">Comparer</button>' +
            (S.can('pdg') && x.id !== S.base.parametres.active ? ' · <button class="link" data-act="activate" data-id="' + x.id + '">Rendre active</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      if (cmpId && cmpId !== S.base.parametres.active) {
        var months = App.calc().months;
        var ya = M.byYear(months.map(function (m) { return M.computeMonth(m, p); }));
        var yb = M.byYear(months.map(function (m) { return M.computeMonth(m, S.paramVersion(cmpId).params); }));
        h += '<h4>Historique recalculé : ' + S.base.parametres.active + ' (active) et ' + cmpId + '</h4><div class="scroll"><table class="num"><thead><tr><th>Année</th><th>VNL ' + S.base.parametres.active + '</th><th>VNL ' + cmpId + '</th><th>Écart</th></tr></thead><tbody>' +
          ya.map(function (a, k) { var b = yb[k]; return '<tr><th>' + a.annee + '</th><td>' + F.mfc(a.vnl, false) + '</td><td>' + F.mfc(b.vnl, false) + '</td><td>' + F.pct((b.vnl - a.vnl) / Math.abs(a.vnl)) + '</td></tr>'; }).join('') +
          '</tbody></table></div><p class="hint">Les résultats de la version active ne sont pas modifiés par cette comparaison.</p>';
      }
      h += '</section>';

      return h;
    }
  };
  App.actions.ptab = function (el) { App.state.ptab = el.dataset.t; App.render(); };

  /* Onglet « Guide méthodologique » : la VNL expliquée à la direction. */
  var GUIDE_DIMS = [
    { code: 'alpha', l: 'α', t: 'Efficacité opérationnelle', d: 'Utilisation des capacités, service, productivité et fiabilité des tournées.' },
    { code: 'omega', l: 'Ω', t: 'Tension sur les stocks', d: 'Couverture, rotation et alignement des stocks sur la demande.' },
    { code: 'gamma', l: 'γ', t: 'Réactivité commerciale', d: 'Délais de réponse, retours, fidélité et adaptation de l’offre.' },
    { code: 'rz', l: 'Rz', t: 'Résilience', d: 'Capacité à absorber les chocs : anticipation, stocks de sécurité, liquidité, outils.' },
    { code: 'xe', l: 'Xe', t: 'Hostilité de l’environnement', d: 'Perturbations subies : prix, transport, coupures, climat, cadre légal.' }
  ];
  function guide(p) {
    var w = function (d) { return d === 'rz' || d === 'xe' ? 'agit sur Φ' : 'poids ' + I.formatNumber(p.wDim[d] * 100, 1) + ' %'; };
    return '<section class="card"><div class="card-head"><div><h3>' + App.icon('book') + ' Qu’est-ce que la valeur nette logistique ?</h3></div><span class="chip">θ = ' + I.formatNumber(p.theta, 2) + '</span></div>' +
      '<p>La VNL mesure ce que la chaîne logistique laisse réellement à l’entreprise. On part de la marge brute du mois, on retire les pertes physiques, puis on applique deux coefficients : Ψ, qui traduit la qualité de la conversion opérationnelle (efficacité, stocks, réactivité), et Φ, qui traduit la part de valeur qui résiste à un environnement hostile. Les coûts logistiques sont déduits en dernier.</p>' +
      '<p>Le ratio VNL/VMB dit quelle part de la marge brute la logistique préserve. Sous ' + F.pct(p.seuilRatio, 1) + ', le mois passe en alerte.</p>' +
      '<div class="guide-dims">' + GUIDE_DIMS.map(function (d) {
        return '<div class="dim-card"><div class="dim-top"><span class="letter">' + d.l + '</span><span class="muted">' + w(d.code) + '</span></div><h4>' + d.t + '</h4><p class="muted">' + d.d + '</p></div>';
      }).join('') + '</div>' +
      '<div class="formula"><span class="c">// Valeur nette logistique du mois</span>\n<span class="k">VNL</span> = VMB × (1 − τ) × Ψ × Φ − Clog\n\n<span class="k">Ψ</span>   = α^' + I.formatNumber(p.wDim.alpha, 3) + ' × Ω^' + I.formatNumber(p.wDim.omega, 3) + ' × γ^' + I.formatNumber(p.wDim.gamma, 3) + '\n<span class="k">E</span>   = Xe × (1 − Rz)\n<span class="k">Φ</span>   = e^(−θ·E),  θ = ' + I.formatNumber(p.theta, 2) + '</div>' +
      '<h4>Conventions</h4><div class="conv">' +
      '<div><strong>Montants</strong>Francs congolais ; M FC = millions de FC.</div>' +
      '<div><strong>Indices</strong>De 0 à 1 ; 1 signifie que la cible est atteinte. Notes sur 100 dans le diagnostic.</div>' +
      '<div><strong>Alertes</strong>Ratio sous ' + F.pct(p.seuilRatio, 1) + ', Ω sous ' + F.idx(p.seuilOmega) + ' ou baisse mensuelle de plus de ' + I.formatNumber(p.seuilBaisse * 100, 0) + ' points.</div>' +
      '<div><strong>Données</strong>Saisies par service, stockées sur cet appareil uniquement.</div></div></section>';
  }

  function readForm() {
    var f = document.getElementById('pform');
    var p = S.clone(S.params());
    var errs = [];
    function n(name) { var x = I.parseNumber(f.elements[name].value); if (!F.isNum(x)) errs.push(name); return x; }
    GENERAL.forEach(function (g) { var x = n(g.k); p[g.k] = g.scale ? x * g.scale : x; });
    ['alpha', 'omega', 'gamma'].forEach(function (d) { p.wDim[d] = n('w_' + d); });
    p.amdec = { critique: n('amdecC'), majeure: n('amdecM') };
    C.SUB_INDICATORS.forEach(function (s) {
      var c = f.elements['c_' + s.code].value.trim();
      p.sub[s.code] = { cible: c === '' ? null : I.parseNumber(c), poids: I.parseNumber(f.elements['p_' + s.code].value), exclu: f.elements['x_' + s.code].checked };
      if (!p.sub[s.code].exclu && !(p.sub[s.code].cible > 0)) errs.push('cible ' + s.code);
    });
    var sw = p.wDim.alpha + p.wDim.omega + p.wDim.gamma;
    if (Math.abs(sw - 1) > 0.01) errs.push('la somme des poids α, Ω, γ vaut ' + I.formatNumber(sw, 3) + ' au lieu de 1');
    return { p: p, errs: errs, justif: f.justif ? f.justif.value.trim() : '' };
  }
  App.actions.propose = function () {
    var r = readForm();
    if (r.errs.length) { root.alert('Paramètres invalides : ' + r.errs.join(', ')); return; }
    if (!r.justif) { App.toast('La justification est obligatoire.', 'err'); return; }
    if (!S.diffParams(S.params(), r.p)) { App.toast('Aucun paramètre n’a changé.'); return; }
    var res = S.proposeParams(r.p, r.justif, S.can('pdg'));
    App.toast(S.can('pdg') ? 'Nouvelle version ' + res.id + ' adoptée.' : 'Proposition transmise au PDG.');
    App.render();
  };
  App.actions.adopt = function (el) {
    var pr = S.base.parametres.propositions.filter(function (x) { return x.id === el.dataset.id; })[0];
    S.adoptParams(pr); App.render();
  };
  App.actions.reject = function (el) { S.rejectParams(el.dataset.id, root.prompt('Motif du refus :') || ''); App.render(); };
  App.actions.activate = function (el) {
    var motif = root.prompt('Motif du changement de version active :');
    if (!motif) return;
    S.activateVersion(el.dataset.id, motif); App.render();
  };
  App.actions.cmp = function (el) { App.state.cmpVersion = el.dataset.id; App.render(); };
  App.actions.seuilRef = function () {
    var f = document.getElementById('pform');
    var a = f.refFrom.value.trim(), b = f.refTo.value.trim();
    var rs = App.calc().res.mois.filter(function (r) { return r.mois >= a && r.mois <= b; });
    if (!rs.length) { App.toast('Aucun mois calculé sur cette période.', 'err'); return; }
    var min = Math.min.apply(null, rs.map(function (r) { return r.ratio; }));
    f.seuilRatio.value = I.formatNumber(+min.toFixed(4));
    App.toast('Plus bas ratio mensuel de la période : ' + F.pct(min, 2) + '. Ajoutez une justification puis adoptez.');
  };

  function methode() {
    var rows = [
      ['Marge brute', 'VMB = CA − CMV', 'Ce que la vente laisse après le coût des marchandises.'],
      ['Taux de pertes', 'τ = pertes / CA', 'Part du chiffre d’affaires détruite (produits périmés, avariés, volés).'],
      ['Coût logistique', 'Clog = transport + énergie + maintenance + salaires + autres', 'Les pertes ne sont pas comptées ici, elles sont déjà dans τ.'],
      ['Normalisation', 'MIN(1 ; I / I*) à élever ; MIN(1 ; I* / I) à réduire ; MIN(1 ; I / s) pour l’hostilité', 'Chaque mesure devient un taux d’atteinte de sa cible, plafonné à 1.'],
      ['Indices α, Ω, γ, Rz, Xe', 'Moyenne pondérée des sous-indicateurs (poids AHP)', 'Une donnée manquante est écartée et signalée.'],
      ['Conversion', 'Ψ = α^wα × Ω^wΩ × γ^wγ', 'Une seule dimension très faible suffit à faire chuter Ψ.'],
      ['Exposition', 'E = Xe × (1 − Rz)', 'L’hostilité que la résilience n’absorbe pas.'],
      ['Modulateur', 'Φ = e^(−θE)', 'Part de la valeur qui résiste à l’environnement.'],
      ['Valeur nette logistique', 'VNL = VMB × (1 − τ) × Ψ × Φ − Clog', 'Ce que la logistique laisse effectivement à l’entreprise.'],
      ['Sans hostilité', 'VNL₀ = VMB × (1 − τ) × Ψ − Clog', 'Mesure ce que coûte l’environnement : (VNL₀ − VNL) / VNL₀.'],
      ['Contributions', '−ln(ΨΦ) = wα(−ln α) + wΩ(−ln Ω) + wγ(−ln γ) + θE', 'Part de chaque dimension dans la perte de conversion.'],
      ['VAN d’une action', 'VAN = −I + Σ G / (1 + i)^t', 'Gain annuel actualisé sur la durée d’effet.'],
      ['Criticité AMDEC', 'C = F × G × D', 'Moyennes des évaluateurs, de 1 à 125.']
    ];
    return '<section class="card"><h3>D’où viennent les chiffres ?</h3><div class="scroll"><table><thead><tr><th>Élément</th><th>Formule</th><th>En clair</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><th class="txt">' + r[0] + '</th><td class="fx">' + esc(r[1]) + '</td><td class="txt">' + esc(r[2]) + '</td></tr>'; }).join('') + '</tbody></table></div></section>';
  }

  /* ---------- AHP (F4.1 à F4.9) ---------- */
  var BLOCKS = [
    { code: 'dims', label: 'Dimensions α, Ω, γ', items: ['alpha', 'omega', 'gamma'], names: { alpha: 'Efficacité opérationnelle (α)', omega: 'Tension sur les stocks (Ω)', gamma: 'Réactivité commerciale (γ)' } },
    { code: 'alpha', label: 'Sous-indicateurs de α', items: ['TUT', 'TSP', 'PE', 'TRP', 'PI', 'FR'] },
    { code: 'omega', label: 'Sous-indicateurs de Ω', items: ['TRSS', 'Align', 'TRS', 'TOD'] },
    { code: 'gamma', label: 'Sous-indicateurs de γ', items: ['TMMP', 'EDRS', 'TPM', 'TSCL', 'MBM'] },
    { code: 'rz', label: 'Sous-indicateurs de la résilience Rz', items: ['ANT', 'SS', 'LL', 'DCF', 'IA', 'MS', 'CF', 'INT', 'VD', 'ERP', 'CT', 'TR'] },
    { code: 'xe', label: 'Composantes de l’hostilité Xe', items: ['Xe_L', 'Xe_S', 'Xe_T', 'Xe_Ec', 'Xe_E', 'Xe_P'], names: { Xe_E: 'Hostilité économique (prix et approvisionnement)' } }
  ];
  function itemName(b, code) {
    if (b.names && b.names[code]) return b.names[code];
    var s = C.SUB_INDICATORS.filter(function (x) { return x.code === code; })[0];
    return s ? s.label + ' (' + code + ')' : code;
  }
  function nPairs(n) { return n * (n - 1) / 2; }
  var SCALE = [9, 7, 5, 3, 1, 1 / 3, 1 / 5, 1 / 7, 1 / 9];
  var SCALE_TXT = { 1: 'autant', 3: 'un peu plus', 5: 'nettement plus', 7: 'beaucoup plus', 9: 'extrêmement plus' };

  function blockResult(sessions, b) {
    var mats = [], rows = [];
    sessions.forEach(function (s) {
      var up = s.blocs[b.code];
      if (!up || up.filter(F.isNum).length !== nPairs(b.items.length)) return;
      var Mx = M.ahpMatrix(b.items.length, up);
      var w = M.ahpWeights(Mx), cons = M.ahpConsistency(Mx, w);
      mats.push(Mx);
      rows.push({ s: s, w: w, cons: cons, worst: cons.coherent ? [] : M.ahpWorstPairs(Mx, 3) });
    });
    var agg = null;
    if (mats.length) { var A = M.ahpAggregate(mats), wa = M.ahpWeights(A); agg = { w: wa, cons: M.ahpConsistency(A, wa) }; }
    return { rows: rows, agg: agg };
  }

  App.ahpCard = function () {
    var sessions = S.base.ahp;
    var h = '<section class="card" id="ahp"><h3>Pondération par l’AHP</h3><p>Chaque responsable compare les éléments deux à deux (115 comparaisons en six blocs). Les poids individuels, leur cohérence et les poids agrégés sont calculés automatiquement.</p>';
    h += '<div class="btns"><button data-act="ahpNew">Nouvelle passation</button></div><div id="ahpForm"></div>';
    if (sessions.length) {
      h += '<p>' + sessions.length + ' passation(s) : ' + sessions.map(function (s) { return esc(s.code) + ' (' + (s.mode === 'repondant' ? 'saisie par le répondant' : 'reportée par un enquêteur') + ', ' + s.date.slice(0, 10) + ') <button class="link" data-act="ahpEdit" data-id="' + s.id + '">compléter</button>'; }).join(' ; ') + '</p>';
      BLOCKS.forEach(function (b) {
        var r = blockResult(sessions, b);
        if (!r.rows.length) return;
        h += '<h4>' + b.label + '</h4><div class="scroll"><table class="num"><thead><tr><th>Répondant</th>' + b.items.map(function (it) { return '<th>' + (b.code === 'dims' ? { alpha: 'α', omega: 'Ω', gamma: 'γ' }[it] : it) + '</th>'; }).join('') + '<th>λmax</th><th>RC</th></tr></thead><tbody>' +
          r.rows.map(function (x) {
            return '<tr><th>' + esc(x.s.code) + '</th>' + x.w.map(function (w) { return '<td>' + F.idx(w) + '</td>'; }).join('') + '<td>' + F.idx(x.cons.lambdaMax) + '</td><td class="' + (x.cons.coherent ? '' : 'neg') + '">' + F.idx(x.cons.RC) + '</td></tr>' +
              (x.worst.length ? '<tr><td colspan="' + (b.items.length + 3) + '" class="txt warn">RC ≥ 0,10 : revoir ' + x.worst.map(function (wp) { return b.items[wp.i] + ' / ' + b.items[wp.j]; }).join(', ') + '</td></tr>' : '');
          }).join('') +
          (r.agg ? '<tr class="total"><th>Agrégé</th>' + r.agg.w.map(function (w) { return '<td>' + F.idx(w) + '</td>'; }).join('') + '<td>' + F.idx(r.agg.cons.lambdaMax) + '</td><td>' + F.idx(r.agg.cons.RC) + '</td></tr>' : '') +
          '</tbody></table></div>';
      });
      if (S.can('admin') || S.can('pdg')) h += '<div class="btns"><button data-act="ahpAdopt">Proposer les poids agrégés comme nouvelle version de paramètres</button></div>';
    }
    return h + '</section>';
  };

  App.actions.ahpNew = function () {
    var code = root.prompt('Code du répondant (ex. P2) :', S.user().code || '');
    if (!code) return;
    var mode = root.confirm('Le répondant saisit-il lui-même ses comparaisons ?\n\nOK : oui, il saisit lui-même\nAnnuler : un enquêteur reporte ses avis') ? 'repondant' : 'enqueteur';
    var s = { id: S.uid('ahp'), code: code.trim(), mode: mode, date: new Date().toISOString(), blocs: {}, raisons: {} };
    S.base.ahp.push(s);
    S.base.evaluateurs[code.trim()] = S.base.evaluateurs[code.trim()] || '';
    S.touch('Nouvelle passation AHP ' + code, null, mode);
    App.state.ahpSession = s.id; App.state.ahpBlock = 'dims';
    App.render();
    showAhpForm();
  };
  App.actions.ahpEdit = function (el) { App.state.ahpSession = el.dataset.id; App.state.ahpBlock = App.state.ahpBlock || 'dims'; showAhpForm(); };

  function showAhpForm() {
    var box = document.getElementById('ahpForm');
    if (!box) return;
    var s = S.base.ahp.filter(function (x) { return x.id === App.state.ahpSession; })[0];
    var b = BLOCKS.filter(function (x) { return x.code === App.state.ahpBlock; })[0];
    var up = s.blocs[b.code] || [];
    var h = '<form id="ahpF" class="card inner"><div class="head-row"><h4>Passation ' + esc(s.code) + '</h4><select data-change="ahpBlock">' + BLOCKS.map(function (x) {
      var done = (s.blocs[x.code] || []).filter(F.isNum).length;
      return '<option value="' + x.code + '"' + (x.code === b.code ? ' selected' : '') + '>' + x.label + ' (' + done + '/' + nPairs(x.items.length) + ')</option>';
    }).join('') + '</select></div><ol class="pairs">';
    var k = 0;
    for (var i = 0; i < b.items.length; i++) for (var j = i + 1; j < b.items.length; j++) {
      var cur = up[k];
      h += '<li><p>Pour la GAANA, lequel compte le plus, et à quel point ?<br><strong>A :</strong> ' + esc(itemName(b, b.items[i])) + '<br><strong>B :</strong> ' + esc(itemName(b, b.items[j])) + '</p>' +
        '<select name="q' + k + '"><option value="">—</option>' + SCALE.map(function (v) {
          var txt = v === 1 ? 'A et B comptent autant' : (v > 1 ? 'A compte ' + SCALE_TXT[v] + ' que B (' + v + ')' : 'B compte ' + SCALE_TXT[Math.round(1 / v)] + ' que A (1/' + Math.round(1 / v) + ')');
          return '<option value="' + v + '"' + (F.isNum(cur) && Math.abs(cur - v) < 1e-9 ? ' selected' : '') + '>' + txt + '</option>';
        }).join('') + '</select><input name="r' + k + '" placeholder="Pourquoi ? (facultatif)" value="' + esc((s.raisons[b.code] || [])[k] || '') + '"></li>';
      k++;
    }
    h += '</ol><button class="primary" data-act="ahpSave">Enregistrer ce bloc</button></form>';
    box.innerHTML = h;
    box.scrollIntoView({ behavior: 'smooth' });
  }
  App.actions.ahpBlock = function (el) { App.state.ahpBlock = el.value; showAhpForm(); };
  App.actions.ahpSave = function () {
    var f = document.getElementById('ahpF');
    var s = S.base.ahp.filter(function (x) { return x.id === App.state.ahpSession; })[0];
    var b = BLOCKS.filter(function (x) { return x.code === App.state.ahpBlock; })[0];
    var n = nPairs(b.items.length), up = [], rs = [];
    for (var k = 0; k < n; k++) { var v = f.elements['q' + k].value; up.push(v ? +v : null); rs.push(f.elements['r' + k].value); }
    s.blocs[b.code] = up; s.raisons[b.code] = rs;
    S.touch('AHP ' + s.code + ' / ' + b.label, null, up.filter(F.isNum).length + ' comparaisons');
    var full = up.every(F.isNum);
    var msg = 'Bloc enregistré.';
    if (full) { var cons = M.ahpConsistency(M.ahpMatrix(b.items.length, up)); msg += ' RC = ' + F.idx(cons.RC) + (cons.coherent ? ' (cohérent).' : ' : réponses incohérentes, à revoir.'); }
    App.render();
    App.toast(msg, full && !M.ahpConsistency(M.ahpMatrix(b.items.length, up)).coherent ? 'err' : '');
    var next = BLOCKS[BLOCKS.indexOf(b) + 1];
    if (next) { App.state.ahpBlock = next.code; }
    showAhpForm();
  };
  App.actions.ahpAdopt = function () {
    var p = S.clone(S.params()), missing = [];
    BLOCKS.forEach(function (b) {
      var r = blockResult(S.base.ahp, b);
      if (!r.agg) { missing.push(b.label); return; }
      b.items.forEach(function (it, i) {
        var w = +r.agg.w[i].toFixed(3);
        if (b.code === 'dims') p.wDim[it] = w;
        else if (it === 'Xe_E') { p.sub.Xe_E1.poids = +(r.agg.w[i] / 2).toFixed(3); p.sub.Xe_E2.poids = +(r.agg.w[i] / 2).toFixed(3); }
        else p.sub[it].poids = w;
      });
    });
    if (missing.length) { root.alert('Blocs sans passation complète : ' + missing.join(', ') + '. Les poids actuels sont conservés pour ces blocs.'); }
    var j = root.prompt('Justification (ex. « Pondération AHP refaite en 2027 avec les cinq responsables ») :');
    if (!j) return;
    var res = S.proposeParams(p, j, S.can('pdg'));
    App.toast(S.can('pdg') ? 'Version ' + res.id + ' adoptée.' : 'Proposition transmise au PDG.');
    App.render();
  };

  /* ---------- Analyses : sensibilité et statistiques ---------- */
  App.views.analyses = {
    html: function () {
      var c = App.calc();
      if (!c.res.mois.length) return App.empty();
      var years = c.res.annees.map(function (a) { return a.annee; });
      var y = App.state.sensYear || (years.indexOf(2022) >= 0 ? 2022 : years[years.length - 1]);
      var tests = App.state.sensTests || { theta: [0.20, 0.25, 0.45, 0.50, 0.70], wAlpha: [0.36, 0.44], cibleTRSS: [0.01, 0.05], clog: [-0.10, 0.10] };
      var sens = M.sensitivity(c.months, c.params, y, tests);
      var h = App.pageHead('Analyses', 'Sensibilité et statistiques', 'Quelle variable pèse le plus sur la VNL, et les liens observés sont-ils significatifs ?');
      h += '<section class="card"><div class="head-row"><h3>Sensibilité de la VNL</h3><label class="inline">Année <select data-change="sensYear">' + years.map(function (x) { return '<option' + (x === y ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></label></div>' +
        '<p>VNL de référence ' + y + ' : <strong>' + F.mfc(sens.reference) + '</strong>. Un écart supérieur à ' + F.pct(c.params.seuilSensibilite, 0) + ' signale un paramètre influent.</p>' +
        '<div class="scroll"><table class="num"><thead><tr><th class="txt">Paramètre</th><th>Valeur testée</th><th>VNL</th><th>Écart</th><th></th></tr></thead><tbody>' +
        sens.lignes.map(function (l) { return '<tr><th class="txt">' + l.parametre + '</th><td>' + (typeof l.valeur === 'number' ? I.formatNumber(l.valeur) : l.valeur) + '</td><td>' + F.mfc(l.vnl, false) + '</td><td class="' + (l.ecart >= 0 ? 'pos' : 'neg') + '">' + (l.ecart > 0 ? '+' : '') + F.pct(l.ecart) + '</td><td>' + (l.influent ? '<span class="tag bad">influent</span>' : '') + '</td></tr>'; }).join('') +
        '</tbody></table></div><details><summary>Modifier les valeurs testées</summary><form id="sensF" class="grid3">' +
        [['theta', 'θ'], ['wAlpha', 'Poids de α'], ['cibleTRSS', 'Cible du taux de rupture'], ['clog', 'Variation des coûts logistiques']].map(function (t) {
          return '<label>' + t[1] + '<input name="' + t[0] + '" value="' + tests[t[0]].map(function (v) { return I.formatNumber(v); }).join(' ; ') + '"></label>';
        }).join('') + '<button data-act="sensTests">Recalculer</button></form></details></section>';

      // F9.3 réduction due à l'hostilité selon θ
      var thetas = [0.20, 0.35, 0.50, 0.70];
      h += '<section class="card"><h3>Réduction de la VNL due à l’hostilité selon θ</h3><div class="scroll"><table class="num"><thead><tr><th>Année</th>' + thetas.map(function (t) { return '<th>θ = ' + I.formatNumber(t) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        years.map(function (yy) {
          return '<tr><th>' + yy + '</th>' + thetas.map(function (t) {
            var p = S.clone(c.params); p.theta = t;
            var a = M.aggregate(c.months.filter(function (m) { return +m.mois.slice(0, 4) === yy; }).map(function (m) { return M.computeMonth(m, p); }));
            return '<td>' + F.pct(a.reductionHostilite) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div></section>';

      // Statistiques
      var r = c.res.mois;
      var psi = r.map(function (x) { return x.psi; }), xe = r.map(function (x) { return x.idx.xe; }), E = r.map(function (x) { return x.E; });
      function row(label, a, b) {
        var lv = M.spearman(a, b), dt = M.spearman(M.detrend(a), M.detrend(b)), df = M.spearman(M.diff(a), M.diff(b));
        function cell(s) { return s ? 'ρ = ' + I.formatNumber(s.rho, 3) + ' · p = ' + pv(s.p) + ' · n = ' + s.n : '—'; }
        return '<tr><th class="txt">' + label + '</th><td>' + cell(lv) + '</td><td>' + cell(dt) + '</td><td>' + cell(df) + '</td></tr>';
      }
      var ms = r.map(function (x) { return x.mois; });
      var pa = App.state.mwA || ['2020-01', '2020-12'], pb = App.state.mwB || ['2018-01', '2019-12'];
      function inP(m, p) { return m >= p[0] && m <= p[1]; }
      var mw = M.mannWhitney(r.filter(function (x) { return inP(x.mois, pa); }).map(function (x) { return x.psi; }), r.filter(function (x) { return inP(x.mois, pb); }).map(function (x) { return x.psi; }));
      var serie = App.state.swSerie || 'psi';
      var series = { psi: ['Ψ', psi], ratio: ['VNL/VMB', r.map(function (x) { return x.ratio; })], xe: ['Xe', xe], E: ['E', E], vnl: ['VNL', r.map(function (x) { return x.vnl; })] };
      var sw = M.shapiroWilk(series[serie][1]);
      h += '<section class="card"><h3>Analyses statistiques</h3><h4>Corrélation de rang de Spearman avec Ψ</h4><div class="scroll"><table><thead><tr><th></th><th>Niveaux</th><th>Séries sans tendance</th><th>Différences premières</th></tr></thead><tbody>' +
        row('Hostilité Xe et Ψ', xe, psi) + row('Exposition E et Ψ', E, psi) + '</tbody></table></div>' +
        '<h4>Test de Mann-Whitney sur Ψ</h4><form class="inline" id="mwF">Période A du <input name="a0" value="' + pa[0] + '" size="7"> au <input name="a1" value="' + pa[1] + '" size="7">, période B du <input name="b0" value="' + pb[0] + '" size="7"> au <input name="b1" value="' + pb[1] + '" size="7"> <button data-act="mw">Comparer</button></form>' +
        (mw ? '<p>U = ' + I.formatNumber(mw.U) + ' · p = ' + pv(mw.p) + ' (n = ' + mw.n1 + ' et ' + mw.n2 + ', approximation normale)</p>' : '<p>Périodes vides.</p>') +
        '<h4>Test de normalité de Shapiro-Wilk</h4><label class="inline">Série <select data-change="swSerie">' + Object.keys(series).map(function (k) { return '<option value="' + k + '"' + (k === serie ? ' selected' : '') + '>' + series[k][0] + '</option>'; }).join('') + '</select></label>' +
        (sw ? '<p>W = ' + I.formatNumber(sw.W, 3) + ' · p = ' + pv(sw.p) + ' · n = ' + sw.n + (sw.p < 0.05 ? ' : la normalité est rejetée au seuil de 5 %.' : ' : la normalité n’est pas rejetée au seuil de 5 %.') + '</p>' : '') +
        '<p class="hint">Mois disponibles : ' + ms[0] + ' à ' + ms[ms.length - 1] + '.</p></section>';
      return h;
    }
  };
  function pv(p) { return p < 0.001 ? '< 0,001' : I.formatNumber(p, 3); }
  App.actions.sensYear = function (el) { App.state.sensYear = +el.value; App.render(); };
  App.actions.sensTests = function () {
    var f = document.getElementById('sensF'), t = {};
    ['theta', 'wAlpha', 'cibleTRSS', 'clog'].forEach(function (k) { t[k] = f.elements[k].value.split(';').map(I.parseNumber).filter(F.isNum); });
    App.state.sensTests = t; App.render();
  };
  App.actions.mw = function () {
    var f = document.getElementById('mwF');
    App.state.mwA = [f.a0.value.trim(), f.a1.value.trim()]; App.state.mwB = [f.b0.value.trim(), f.b1.value.trim()];
    App.render();
  };
  App.actions.swSerie = function (el) { App.state.swSerie = el.value; App.render(); };
})(window);
