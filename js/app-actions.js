/*
 * Écran 5 : AMDEC, actions correctives, optimisation sous budget, suivi de réalisation.
 */
(function (root) {
  'use strict';

  var C = root.VNLConfig, M = root.VNLModel, S = root.VNLStore, I = root.VNLImporter, App = root.App;
  var F = App.fmt, esc = F.esc;

  /* Criticité courante d'une défaillance : dernière campagne, sinon valeur du mémoire. */
  function failuresNow() {
    var p = S.params();
    var camps = S.base.campagnesAmdec;
    var last = camps[camps.length - 1];
    return S.base.defaillances.map(function (f) {
      var x = Object.assign({}, f);
      var notes = last && last.notes[f.id] ? Object.keys(last.notes[f.id]).map(function (k) { return last.notes[f.id][k]; }) : [];
      var c = notes.length ? M.amdecCriticite(notes, p.amdec) : null;
      if (c) { x.C = c.C; x.F = c.F; x.G = c.G; x.D = c.D; x.gravite5 = c.gravite5; x.source = last.date.slice(0, 10); }
      else { x.C = f.crit; x.source = 'mémoire'; }
      x.classe = F.isNum(x.C) ? M.classeAmdec(x.C, p.amdec) : '—';
      return x;
    }).sort(function (a, b) { return (b.C || 0) - (a.C || 0); });
  }
  App.failuresNow = failuresNow;

  function forcedNums() { return S.base.forcees.map(function (f) { return f.n; }); }

  App.views.actions = {
    html: function () {
      var c = App.calc(), p = c.params;
      var fails = failuresNow();
      var opt = M.optimize(c.actions, p.budget, forcedNums());
      var sel = c.actions.filter(function (a) { return opt.actions.indexOf(a.n) >= 0; });
      var unc = M.uncovered(fails, opt.actions, c.actions);
      var h = '<div class="head-row"><h2>Actions</h2></div>';

      // Programme optimal
      h += '<section class="card"><h3>Que financer en premier ? Budget ' + F.mfc(p.budget) + '</h3>' +
        '<p class="big">Actions retenues : <strong>' + (opt.actions.length ? opt.actions.map(function (n) { return 'n° ' + n; }).join(', ') : 'aucune') + '</strong> · coût ' + F.mfc(opt.cout) + ' · VAN cumulée ' + F.mfc(opt.van) + ' · reste ' + F.mfc(opt.reste) + '</p>' +
        (opt.depasse ? '<p class="warn">Les actions imposées dépassent à elles seules le budget.</p>' : '') +
        '<ul>' + sel.map(function (a) { return '<li>n° ' + a.n + ' ' + esc(a.nom) + ' : coût ' + F.mfc(a.cout) + ', VAN ' + F.mfc(a.van) + (opt.imposees.indexOf(a.n) >= 0 ? ' <span class="tag">imposée</span>' : '') + '</li>'; }).join('') + '</ul>';
      var comb = M.combinedEffect(sel, c.ref, p);
      if (comb && comb.estime) h += '<p>Effet combiné recalculé sur ' + p.anneeReference + ' (le modèle est multiplicatif, les effets ne s’additionnent pas) : VNL ' + F.mfc(comb.avant) + ' → ' + F.mfc(comb.apres) + ', soit ' + F.mfc(comb.gain) + ' de plus par an.</p>';
      else h += '<p class="hint">L’effet combiné sur la VNL sera calculé dès que la valeur attendue de chaque action sera saisie dans le tableau ci-dessous. En attendant, la VAN publiée dans le mémoire est utilisée.</p>';
      if (unc.length) h += '<p class="warn"><strong>Risques non couverts</strong> par le programme : ' + unc.map(function (f) { return esc(f.nom) + ' (' + f.classe.toLowerCase() + (f.gravite5 ? ', gravité maximale' : '') + ')'; }).join(' ; ') + '. Vous pouvez imposer une action malgré sa VAN négative ci-dessous.</p>';
      var prog = S.base.programme;
      h += '<div class="btns">' + (S.can('pdg') ? '<button class="primary" data-act="validateProg">Valider ce programme</button>' : '') + '</div>' +
        (prog ? '<p class="hint">Dernier programme validé le ' + esc(prog.date.slice(0, 10)) + ' par ' + esc(prog.par) + ' : actions ' + prog.actions.join(', ') + ', coût ' + F.mfc(prog.cout) + '.</p>' : '') + '</section>';

      // Série de budgets (F8.7)
      var budgets = []; for (var b = 5; b <= 40; b += 5) budgets.push(b * 1e6);
      var bs = M.budgetSeries(c.actions, budgets, forcedNums());
      h += '<section class="card"><h3>Programme selon le budget</h3><div class="scroll"><table class="num"><thead><tr><th>Budget</th><th class="txt">Actions retenues</th><th>Coût</th><th>VAN cumulée</th></tr></thead><tbody>' +
        bs.series.map(function (s) { return '<tr><th>' + F.mfc(s.budget, false) + '</th><td class="txt">' + s.actions.join(', ') + '</td><td>' + F.mfc(s.cout, false) + '</td><td>' + F.mfc(s.van, false) + '</td></tr>'; }).join('') +
        '</tbody></table></div>' + (bs.budgetStable ? '<p>Au-delà de <strong>' + F.mfc(bs.budgetStable) + '</strong>, le programme ne change plus : un budget plus élevé n’apporte rien avec les actions actuelles.</p>' : '') + '</section>';

      // Liste des actions (F8.1, F8.2, F8.8)
      var editable = S.can('admin') || S.can('pdg');
      var targets = C.SUB_INDICATORS.filter(function (s) { return s.dim !== 'xe'; }).map(function (s) { return s.code; }).concat(['tau']);
      h += '<section class="card"><h3>Actions correctives</h3><p class="hint">Valeur attendue : niveau du sous-indicateur visé après l’action (moyenne annuelle). Gain annuel = VNL de ' + p.anneeReference + ' recalculée avec cette valeur − VNL de référence − coût annuel. VAN au taux de ' + F.pct(p.taux, 0) + '.</p><div class="scroll"><table class="num actions"><thead><tr><th>N°</th><th class="txt">Action</th><th class="txt">Défaillance</th><th>Vise</th><th>Valeur actuelle</th><th>Valeur attendue</th><th>Investissement (M FC)</th><th>Coût annuel (M FC)</th><th>Durée (ans)</th><th>Gain annuel</th><th>VAN</th><th>Imposer</th></tr></thead><tbody>' +
        c.actions.map(function (a, k) {
          var cur = c.ref ? (a.cible === 'tau' ? c.ref.tau : c.ref.brut[a.cible]) : null;
          var forced = S.base.forcees.filter(function (f) { return f.n === a.n; })[0];
          function inp(field, v, scale) {
            var shown = F.isNum(v) ? I.formatNumber(scale ? v / scale : v) : '';
            return editable ? '<input class="sm" inputmode="decimal" data-change="actField" data-k="' + k + '" data-f="' + field + '"' + (scale ? ' data-scale="' + scale + '"' : '') + ' value="' + esc(shown) + '">' : esc(shown);
          }
          var fail = S.base.defaillances.filter(function (f) { return f.id === a.defaillance; })[0];
          return '<tr' + (opt.actions.indexOf(a.n) >= 0 ? ' class="hl"' : '') + '><th>' + a.n + '</th><td class="txt">' + esc(a.nom) + '</td><td class="txt">' + esc(fail ? fail.nom : '') + '</td><td>' +
            (editable ? '<select data-change="actField" data-k="' + k + '" data-f="cible">' + targets.map(function (t) { return '<option' + (t === a.cible ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' : a.cible) + '</td>' +
            '<td>' + F.num(cur, 3) + '</td><td>' + inp('attendue', S.base.actions[k].attendue) + '</td><td>' + inp('cout', a.cout, 1e6) + '</td><td>' + inp('coutAnnuel', S.base.actions[k].coutAnnuel, 1e6) + '</td><td>' + inp('duree', S.base.actions[k].duree) + '</td>' +
            '<td>' + (F.isNum(a.gain) ? F.mfc(a.gain, false) : '—') + '</td><td class="' + (a.van >= 0 ? 'pos' : 'neg') + '">' + F.mfc(a.van, false) + (a.source === 'mémoire' ? '<sup title="VAN publiée dans le mémoire">m</sup>' : '') + '</td>' +
            '<td>' + (editable ? '<input type="checkbox" data-change="force" data-n="' + a.n + '"' + (forced ? ' checked' : '') + ' title="' + esc(forced ? forced.motif : 'Imposer malgré la VAN') + '">' : (forced ? 'oui' : '')) + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="hint"><sup>m</sup> VAN publiée dans le mémoire (tableau III-29), utilisée tant que les estimations ne sont pas saisies.</p>' +
        (editable ? '<div class="btns"><button data-act="addAction">Ajouter une action</button></div>' : '') + '</section>';

      // Suivi de réalisation (F8.10)
      var engaged = c.actions.filter(function (a) { return a.engagee; });
      h += '<section class="card"><h3>Suivi des actions engagées</h3>' + (engaged.length ? '<div class="scroll"><table class="num"><thead><tr><th class="txt">Action</th><th>Vise</th><th>Attendu</th><th>Observé (dernier mois)</th><th>Écart</th></tr></thead><tbody>' +
        engaged.map(function (a) {
          var last = c.res.mois[c.res.mois.length - 1];
          var obs = last ? (a.cible === 'tau' ? last.tau : last.brut[a.cible]) : null;
          return '<tr><td class="txt">n° ' + a.n + ' ' + esc(a.nom) + '</td><td>' + a.cible + '</td><td>' + F.num(a.attendue, 3) + '</td><td>' + F.num(obs, 3) + '</td><td>' + (F.isNum(obs) && F.isNum(a.attendue) ? F.num(obs - a.attendue, 3) : '—') + '</td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="hint">Aucune action engagée.</p>') +
        (editable ? '<label class="inline">Marquer comme engagée <select data-change="engage"><option value="">—</option>' + c.actions.map(function (a) { return '<option value="' + a.n + '">' + (a.engagee ? '✓ ' : '') + 'n° ' + a.n + ' ' + esc(a.nom) + '</option>'; }).join('') + '</select></label>' : '') + '</section>';

      // AMDEC
      h += '<section class="card"><h3>Analyse des défaillances (AMDEC)</h3><div class="chart"><canvas id="chAmdec"></canvas></div><div class="scroll"><table class="num"><thead><tr><th class="txt">Défaillance</th><th class="txt">Maillon</th><th>F</th><th>G</th><th>D</th><th>Criticité</th><th>Classe</th><th>Source</th></tr></thead><tbody>' +
        fails.map(function (f) {
          return '<tr><td class="txt">' + esc(f.nom) + (f.gravite5 ? ' <span class="tag bad">gravité 5</span>' : '') + '</td><td class="txt">' + esc(f.maillon) + '</td><td>' + F.num(f.F, 2) + '</td><td>' + F.num(f.G, 2) + '</td><td>' + F.num(f.D, 2) + '</td><td><strong>' + F.num(f.C, 1) + '</strong></td><td class="cls ' + f.classe.toLowerCase() + '">' + f.classe + '</td><td>' + esc(f.source) + '</td></tr>';
        }).join('') + '</tbody></table></div><p class="hint">Criticité C = F × G × D sur les moyennes des évaluateurs : critique au-delà de ' + S.params().amdec.critique + ', majeure de ' + S.params().amdec.majeure + ' à ' + S.params().amdec.critique + ', modérée en dessous.</p>' +
        '<div class="btns"><button data-act="amdecForm">Coter les défaillances (nouvelle campagne)</button>' + (editable ? '<button data-act="addFailure">Ajouter une défaillance</button>' : '') + '</div><div id="amdecForm"></div>' +
        '<details><summary>Causes, effets et mode de détection</summary>' + S.base.defaillances.map(function (f, k) {
          return '<fieldset class="fail"><legend>' + esc(f.nom) + '</legend><div class="grid3">' + ['cause', 'effets', 'detection'].map(function (fd) {
            return '<label>' + { cause: 'Cause', effets: 'Effets', detection: 'Mode de détection' }[fd] + '<textarea rows="2" data-change="failField" data-k="' + k + '" data-f="' + fd + '"' + (editable ? '' : ' disabled') + '>' + esc(f[fd] || '') + '</textarea></label>';
          }).join('') + '</div>' + (editable ? '<button class="link" data-act="delFailure" data-k="' + k + '">Retirer cette défaillance</button>' : '') + '</fieldset>';
        }).join('') + '</details>' +
        (S.base.campagnesAmdec.length > 1 ? campaignsCompare() : '') + '</section>';
      return h;
    },
    after: function () {
      var fails = failuresNow();
      App.chart(document.getElementById('chAmdec'), {
        type: 'bar',
        data: { labels: fails.map(function (f) { return f.nom; }), datasets: [{ data: fails.map(function (f) { return f.C; }), backgroundColor: fails.map(function (f) { return App.color(f.classe === 'Critique' ? 'bad' : f.classe === 'Majeure' ? 'warn' : 'c1'); }), borderRadius: 3 }] },
        options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { display: false } }, scales: { x: { min: 0, title: { display: true, text: 'Criticité' } }, y: { ticks: { autoSkip: false } } } }
      });
    }
  };

  function campaignsCompare() {
    var camps = S.base.campagnesAmdec, p = S.params();
    return '<h4>Évolution des criticités par campagne</h4><div class="scroll"><table class="num"><thead><tr><th class="txt">Défaillance</th>' + camps.map(function (c) { return '<th>' + c.date.slice(0, 10) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      S.base.defaillances.map(function (f) {
        return '<tr><td class="txt">' + esc(f.nom) + '</td>' + camps.map(function (c) {
          var n = c.notes[f.id] ? Object.keys(c.notes[f.id]).map(function (k) { return c.notes[f.id][k]; }) : [];
          var r = M.amdecCriticite(n, p.amdec);
          return '<td>' + (r ? F.num(r.C, 1) : '—') + '</td>';
        }).join('') + '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  App.actions.actField = function (el) {
    var a = S.base.actions[+el.dataset.k], f = el.dataset.f;
    var old = a[f];
    var v = f === 'cible' ? el.value : I.parseNumber(el.value);
    if (f !== 'cible' && el.value.trim() === '') v = null;
    if (v !== null && f !== 'cible' && (!F.isNum(v) || v < 0)) { App.toast('Valeur invalide.', 'err'); return; }
    if (el.dataset.scale && F.isNum(v)) v = v * +el.dataset.scale;
    a[f] = v;
    S.touch('Action n° ' + a.n + ' / ' + f, old, v);
    App.render();
  };
  App.actions.force = function (el) {
    var n = +el.dataset.n;
    if (el.checked) {
      var motif = root.prompt('Motif pour imposer cette action malgré sa VAN (continuité, sécurité, gravité maximale…) :');
      if (!motif) { el.checked = false; return; }
      S.base.forcees.push({ n: n, motif: motif });
      S.touch('Action n° ' + n + ' imposée', null, null, motif);
    } else {
      S.base.forcees = S.base.forcees.filter(function (f) { return f.n !== n; });
      S.touch('Action n° ' + n + ' n’est plus imposée');
    }
    App.render();
  };
  App.actions.engage = function (el) {
    if (!el.value) return;
    var a = S.base.actions.filter(function (x) { return x.n === +el.value; })[0];
    a.engagee = !a.engagee; a.engageeLe = new Date().toISOString();
    S.touch('Action n° ' + a.n + (a.engagee ? ' engagée' : ' non engagée'));
    App.render();
  };
  App.actions.addAction = function () {
    var nom = root.prompt('Intitulé de la nouvelle action :');
    if (!nom) return;
    var n = Math.max.apply(null, S.base.actions.map(function (a) { return a.n; }).concat([0])) + 1;
    S.base.actions.push({ n: n, nom: nom, defaillance: S.base.defaillances[0].id, cible: 'tau', cout: 0, vanRef: null, attendue: null, coutAnnuel: null, duree: null, engagee: false });
    S.touch('Ajout de l’action n° ' + n, null, nom);
    App.render();
  };
  App.actions.validateProg = function () {
    var c = App.calc(), opt = M.optimize(c.actions, c.params.budget, forcedNums());
    S.base.programme = { date: new Date().toISOString(), par: S.user().nom, actions: opt.actions, cout: opt.cout, van: opt.van, forcees: S.base.forcees.slice() };
    S.touch('Validation du programme d’actions', null, opt.actions.join(', '));
    App.toast('Programme validé.');
    App.render();
  };
  App.actions.addFailure = function () {
    var nom = root.prompt('Nom de la défaillance :');
    if (!nom) return;
    var id = 'F' + String(S.base.defaillances.length + 1).padStart(2, '0') + Date.now().toString(36).slice(-3);
    S.base.defaillances.push({ id: id, nom: nom, maillon: root.prompt('Maillon concerné :') || '', crit: null, cause: '', effets: '', detection: '' });
    S.touch('Ajout de la défaillance', null, nom);
    App.render();
  };
  App.actions.delFailure = function (el) {
    var f = S.base.defaillances[+el.dataset.k];
    if (!root.confirm('Retirer « ' + f.nom + ' » ?')) return;
    S.base.defaillances.splice(+el.dataset.k, 1);
    S.touch('Retrait de la défaillance', f.nom, null);
    App.render();
  };
  App.actions.failField = function (el) {
    var f = S.base.defaillances[+el.dataset.k], fd = el.dataset.f, old = f[fd];
    f[fd] = el.value;
    S.touch('Défaillance ' + f.nom + ' / ' + fd, old, el.value);
  };

  /* Formulaire de cotation (F7.3) */
  App.actions.amdecForm = function () {
    var box = document.getElementById('amdecForm');
    var code = (S.user().code || '').trim() || 'E?';
    var sc = C.AMDEC_SCALE;
    function sel(crit, fid) {
      return '<select name="' + crit + '|' + fid + '"><option value="">—</option>' + sc[crit].map(function (l, i) { return '<option value="' + (i + 1) + '">' + (i + 1) + ' · ' + l + '</option>'; }).join('') + '</select>';
    }
    box.innerHTML = '<form id="amdecF" class="card inner"><h4>Cotation</h4><label class="inline">Code de l’évaluateur <input name="code" value="' + esc(code) + '" size="6"></label>' +
      '<label class="check"><input type="checkbox" name="newCamp"' + (S.base.campagnesAmdec.length ? '' : ' checked disabled') + '> Ouvrir une nouvelle campagne datée d’aujourd’hui</label>' +
      '<div class="scroll"><table><thead><tr><th class="txt">Défaillance</th><th>Fréquence F</th><th>Gravité G</th><th>Difficulté de détection D</th></tr></thead><tbody>' +
      S.base.defaillances.map(function (f) { return '<tr><td class="txt">' + esc(f.nom) + '</td><td>' + sel('F', f.id) + '</td><td>' + sel('G', f.id) + '</td><td>' + sel('D', f.id) + '</td></tr>'; }).join('') +
      '</tbody></table></div><button class="primary" data-act="amdecSave">Enregistrer mes notes</button></form>';
    box.scrollIntoView({ behavior: 'smooth' });
  };
  App.actions.amdecSave = function () {
    var f = document.getElementById('amdecF');
    var code = f.code.value.trim();
    if (!code) { App.toast('Indiquez votre code d’évaluateur.', 'err'); return; }
    var camps = S.base.campagnesAmdec;
    if (!camps.length || f.newCamp.checked) camps.push({ id: S.uid('amdec'), date: new Date().toISOString(), notes: {} });
    var camp = camps[camps.length - 1];
    var n = 0;
    S.base.defaillances.forEach(function (d) {
      var v = {};
      ['F', 'G', 'D'].forEach(function (k) { var x = f.elements[k + '|' + d.id].value; v[k] = x ? +x : null; });
      if (v.F && v.G && v.D) { camp.notes[d.id] = camp.notes[d.id] || {}; camp.notes[d.id][code] = v; n++; }
    });
    S.base.evaluateurs[code] = S.user().nom;
    S.touch('Cotation AMDEC de ' + code, null, n + ' défaillances');
    App.toast(n + ' défaillances cotées.');
    App.render();
  };
})(window);
