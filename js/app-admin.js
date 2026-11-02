/*
 * Administration (comptes, journal, sauvegarde, exports, questionnaire) et rapports imprimables.
 */
(function (root) {
  'use strict';

  var C = root.VNLConfig, M = root.VNLModel, S = root.VNLStore, I = root.VNLImporter, App = root.App;
  var F = App.fmt, esc = F.esc;

  App.views.admin = {
    html: function () {
      var admin = S.can('admin');
      var h = App.pageHead('Administration', 'Comptes et sauvegardes', 'Sauvegarde, exports, comptes des utilisateurs, questionnaire et journal des modifications.');

      // Sauvegarde (F13.3, NF2)
      h += '<section class="card"><h3>Sauvegarde et restauration</h3><p>Chaque valeur est enregistrée dès sa saisie dans cet appareil. Une copie automatique est faite chaque jour (les trois dernières sont gardées). Pour se protéger d’une panne de l’appareil, enregistrez régulièrement une sauvegarde sur une clé USB ou une carte mémoire.</p>' +
        '<div class="btns"><button class="primary" data-act="backup">Enregistrer une sauvegarde</button>' +
        (admin ? '<label class="button">Restaurer une sauvegarde<input type="file" accept=".json,application/json" hidden data-change="restore"></label>' : '') + '</div>';
      var snaps = S.snapshots();
      if (snaps.length && admin) h += '<p>Copies automatiques : ' + snaps.map(function (s) { return s.jour + ' (' + s.mois + ' mois) <button class="link" data-act="restoreSnap" data-j="' + s.jour + '">restaurer</button>'; }).join(' · ') + '</p>';
      h += '</section>';

      // Exports et rapports
      h += '<section class="card"><h3>Exports et rapports</h3><div class="btns">' +
        '<button data-act="exportXlsx">Exporter tout en Excel</button><button data-act="exportCsv">Exporter les résultats en CSV</button>' +
        '<button data-act="printYear">Imprimer le rapport annuel</button></div></section>';

      // Comptes (F13.1)
      if (admin) {
        h += '<section class="card"><h3>Comptes et rôles</h3><div class="scroll"><table><thead><tr><th>Nom</th><th>Code évaluateur</th>' + App.ROLES.map(function (r) { return '<th class="rot">' + r.label + '</th>'; }).join('') + '<th>Actif</th><th></th></tr></thead><tbody>' +
          S.base.utilisateurs.map(function (u) {
            return '<tr><th class="txt">' + esc(u.nom) + '</th><td><input class="sm" data-change="ucode" data-id="' + u.id + '" value="' + esc(u.code || '') + '"></td>' + App.ROLES.map(function (r) {
              return '<td><input type="checkbox" data-change="urole" data-id="' + u.id + '" data-r="' + r.code + '"' + (u.roles.indexOf(r.code) >= 0 ? ' checked' : '') + '></td>';
            }).join('') + '<td><input type="checkbox" data-change="uactif" data-id="' + u.id + '"' + (u.actif ? ' checked' : '') + (u.id === S.user().id ? ' disabled' : '') + '></td><td><button class="link" data-act="upw" data-id="' + u.id + '">Mot de passe</button></td></tr>';
          }).join('') + '</tbody></table></div>' +
          '<form id="newU" class="grid3"><label>Nom<input name="nom"></label><label>Code évaluateur<input name="code" placeholder="P1…P5"></label><label>Mot de passe initial<input name="pw" type="password" autocomplete="new-password"></label><button data-act="addUser">Créer le compte</button></form>' +
          '<p class="hint">Un utilisateur peut cumuler plusieurs rôles. Les codes évaluateurs servent à l’AHP, à l’AMDEC et au questionnaire ; seuls le PDG et l’administrateur voient leur correspondance avec les personnes.</p></section>';
      } else {
        h += '<section class="card"><h3>Mon compte</h3><button data-act="upw" data-id="' + S.user().id + '">Changer mon mot de passe</button></section>';
      }

      // Questionnaire (F12.4)
      h += questionnaire();

      // Temps de traitement (F12.5)
      var ch = S.base.chronos;
      var done = Object.keys(ch).filter(function (m) { return ch[m].ouverture && ch[m].cloture; });
      if (done.length) {
        h += '<section class="card"><h3>Temps de traitement des mois</h3><div class="scroll"><table class="num"><thead><tr><th>Mois</th><th>Ouverture</th><th>Clôture</th><th>Durée</th></tr></thead><tbody>' +
          done.sort().reverse().slice(0, 12).map(function (m) {
            var d = (new Date(ch[m].cloture) - new Date(ch[m].ouverture)) / 3600000;
            return '<tr><th>' + m + '</th><td>' + ch[m].ouverture.slice(0, 16).replace('T', ' ') + '</td><td>' + ch[m].cloture.slice(0, 16).replace('T', ' ') + '</td><td>' + I.formatNumber(d, 1) + ' h</td></tr>';
          }).join('') + '</tbody></table></div><p class="hint">Objectif du cahier des charges : deux heures au plus entre l’ouverture et la clôture.</p></section>';
      }

      // Journal (F13.2)
      if (admin || S.can('pdg')) {
        var j = S.base.journal.slice(-200).reverse();
        h += '<section class="card"><h3>Journal des modifications</h3><p class="hint">' + S.base.journal.length + ' opérations enregistrées. Le journal ne peut pas être modifié depuis le logiciel ; les 200 dernières sont affichées, toutes sont exportées.</p><div class="scroll tall"><table><thead><tr><th>Quand</th><th>Qui</th><th>Quoi</th><th>Ancienne valeur</th><th>Nouvelle valeur</th><th>Motif</th></tr></thead><tbody>' +
          j.map(function (x) { return '<tr><td>' + x.t.slice(0, 16).replace('T', ' ') + '</td><td>' + esc(x.qui) + '</td><td class="txt">' + esc(x.quoi) + '</td><td class="txt">' + esc(x.ancien) + '</td><td class="txt">' + esc(x.nouveau) + '</td><td class="txt">' + esc(x.motif) + '</td></tr>'; }).join('') +
          '</tbody></table></div></section>';
      }
      return h;
    }
  };

  function questionnaire() {
    var q = S.base.questionnaires;
    var h = '<section class="card"><h3>Questionnaire d’appréciation du logiciel</h3><p class="hint">Notes de 1 (pas du tout d’accord) à 5 (tout à fait d’accord). Objectif : utilité perçue d’au moins 4 sur 5.</p>' +
      '<form id="qF"><label class="inline">Code du répondant <input name="code" size="6" value="' + esc(S.user().code || '') + '"></label><ol class="q">' +
      C.QUESTIONNAIRE.map(function (x) {
        return '<li><span>' + x.code + ' · ' + esc(x.texte) + '</span><span class="likert">' + [1, 2, 3, 4, 5].map(function (n) { return '<label><input type="radio" name="' + x.code + '" value="' + n + '"> ' + n + '</label>'; }).join('') + '</span></li>';
      }).join('') + '</ol><label>Commentaire<textarea name="com" rows="2"></textarea></label><button data-act="qSave">Enregistrer mes réponses</button></form>';
    if (q.length) {
      var cons = {};
      C.QUESTIONNAIRE.forEach(function (x) {
        var vals = q.map(function (r) { return r.notes[x.code]; }).filter(F.isNum);
        (cons[x.construit] = cons[x.construit] || []).push.apply(cons[x.construit], vals);
        x._m = vals.length ? vals.reduce(function (a, b) { return a + b; }, 0) / vals.length : null;
      });
      h += '<h4>Résultats (' + q.length + ' réponses)</h4><div class="scroll"><table class="num"><thead><tr><th class="txt">Aspect</th><th>Moyenne</th></tr></thead><tbody>' +
        C.QUESTIONNAIRE.map(function (x) { return '<tr><td class="txt">' + x.code + ' · ' + esc(x.texte) + '</td><td>' + F.num(x._m, 2) + '</td></tr>'; }).join('') +
        Object.keys(cons).map(function (k) { var v = cons[k]; return '<tr class="total"><th>' + k + '</th><td>' + F.num(v.reduce(function (a, b) { return a + b; }, 0) / v.length, 2) + '</td></tr>'; }).join('') +
        '</tbody></table></div>';
    }
    return h + '</section>';
  }
  App.actions.qSave = function () {
    var f = document.getElementById('qF'), notes = {};
    C.QUESTIONNAIRE.forEach(function (x) { var c = f.querySelector('[name=' + x.code + ']:checked'); if (c) notes[x.code] = +c.value; });
    if (Object.keys(notes).length < C.QUESTIONNAIRE.length) { App.toast('Répondez aux huit questions.', 'err'); return; }
    S.base.questionnaires.push({ date: new Date().toISOString(), code: f.code.value.trim(), notes: notes, commentaire: f.com.value });
    S.touch('Questionnaire d’appréciation', null, f.code.value.trim());
    App.toast('Merci, réponses enregistrées.');
    App.render();
  };

  /* ---------- Comptes ---------- */
  App.actions.addUser = function () {
    var f = document.getElementById('newU');
    if (!f.nom.value.trim() || f.pw.value.length < 4) { App.toast('Nom et mot de passe (4 caractères au moins) obligatoires.', 'err'); return; }
    S.addUser(f.nom.value.trim(), [], f.pw.value, f.code.value.trim());
    App.toast('Compte créé. Cochez ses rôles.');
    App.render();
  };
  App.actions.urole = function (el) {
    var u = S.base.utilisateurs.filter(function (x) { return x.id === el.dataset.id; })[0];
    var roles = u.roles.filter(function (r) { return r !== el.dataset.r; });
    if (el.checked) roles.push(el.dataset.r);
    if (u.id === S.user().id && roles.indexOf('admin') < 0) { App.toast('Vous ne pouvez pas retirer votre propre rôle d’administrateur.', 'err'); el.checked = true; return; }
    S.updateUser(u.id, { roles: roles });
  };
  App.actions.uactif = function (el) { S.updateUser(el.dataset.id, { actif: el.checked }); };
  App.actions.ucode = function (el) { S.updateUser(el.dataset.id, { code: el.value.trim() }); };
  App.actions.upw = function (el) {
    var pw = root.prompt('Nouveau mot de passe (4 caractères au moins) :');
    if (!pw || pw.length < 4) return;
    S.updateUser(el.dataset.id, { pw: pw });
    App.toast('Mot de passe modifié.');
  };

  /* ---------- Sauvegarde ---------- */
  /* Téléchargement d'un fichier. Sur Android, passe par l'application (dossier Téléchargements). */
  function download(name, content, type) {
    if (root.AndroidBridge && root.AndroidBridge.saveFile) {
      var bytes = typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(content);
      var bin = '';
      for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      var ok = root.AndroidBridge.saveFile(name, btoa(bin), type.split(';')[0]);
      App.toast(ok ? 'Fichier enregistré dans Téléchargements : ' + name : 'Enregistrement impossible.', ok ? '' : 'err');
      return;
    }
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
  }
  App.download = download;
  App.downloadWorkbook = function (wb, name) {
    download(name, root.XLSX.write(wb, { bookType: 'xlsx', type: 'array' }), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };
  function stamp() { return new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-'); }
  App.actions.backup = function () {
    S.touch('Sauvegarde manuelle');
    download('VNL-SAD_sauvegarde_' + stamp() + '.json', S.exportJson(), 'application/json');
  };
  App.actions.restore = function (el) {
    var f = el.files[0];
    if (!f) return;
    if (!root.confirm('Remplacer toute la base de cet appareil par « ' + f.name + ' » ? Faites d’abord une sauvegarde si besoin.')) return;
    var r = new FileReader();
    r.onload = function () {
      try { S.importJson(r.result); App.invalidate(); App.toast('Base restaurée.'); App.render(); }
      catch (e) { App.toast(e.message, 'err'); }
    };
    r.readAsText(f);
  };
  App.actions.restoreSnap = function (el) {
    if (!root.confirm('Revenir à la copie du ' + el.dataset.j + ' ?')) return;
    S.restoreSnapshot(el.dataset.j); App.render();
  };

  /* ---------- Exports (F12.3) ---------- */
  function resultRows() {
    var c = App.calc();
    return c.res.mois.map(function (r) {
      var o = { mois: r.mois, version_parametres: r.versionParams, VMB: r.vmb, tau: r.tau, Clog: r.clog };
      C.DIMENSIONS.forEach(function (d) { o[d.sym] = r.idx[d.code]; });
      Object.assign(o, { Psi: r.psi, E: r.E, Phi: r.phi, VNL: r.vnl, VNL_VMB: r.ratio, VNL0: r.vnl0, reduction_hostilite: r.reductionHostilite,
        retrait_pertes: r.retraits.pertes, retrait_inefficacite: r.retraits.inefficacite, retrait_hostilite: r.retraits.hostilite, retrait_couts: r.retraits.couts,
        part_alpha: r.contrib.alpha, part_omega: r.contrib.omega, part_gamma: r.contrib.gamma, part_hostilite: r.contrib.hostilite,
        voyant: r.voyant, alertes: r.alertes.map(function (a) { return a.label; }).join(' ; '), recommandation: r.phrase });
      C.SUB_INDICATORS.forEach(function (s) { o['norm_' + s.code] = r.norm[s.code]; });
      return o;
    });
  }
  function inputRows() {
    return S.months().map(function (m) {
      var o = { mois: m.mois };
      C.VARIABLES.forEach(function (v) { o[v.key] = m[v.key]; });
      o.reconstituees = Object.keys(m.recon || {}).join(', ');
      o.remarque = m.remarque; o.cloture = m.cloture ? 'oui' : 'non';
      return o;
    });
  }
  App.actions.exportXlsx = function () {
    var X = root.XLSX, wb = X.utils.book_new(), c = App.calc();
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(inputRows()), 'Saisies');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(resultRows()), 'Résultats mensuels');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(c.res.annees.map(function (a) { return { annee: a.annee, mois: a.n, VMB: a.vmb, pertes: a.retraits.pertes, inefficacite: a.retraits.inefficacite, hostilite: a.retraits.hostilite, couts: a.retraits.couts, VNL: a.vnl, VNL_VMB: a.ratio }; })), 'Vue annuelle');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(c.res.alertes.map(function (a) { return { mois: a.mois, regles: a.regles.map(function (r) { return r.label; }).join(' ; '), dimension: a.dim, action: a.action, decision: S.base.decisionsAlertes[a.mois] || '' }; })), 'Alertes');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(c.actions.map(function (a) { return { n: a.n, action: a.nom, defaillance: a.defaillance, cible: a.cible, investissement: a.cout, valeur_attendue: a.attendue, cout_annuel: a.coutAnnuel, duree: a.duree, gain_annuel: a.gain, VAN: a.van, source_VAN: a.source }; })), 'Actions');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(App.failuresNow().map(function (f) { return { defaillance: f.nom, maillon: f.maillon, F: f.F, G: f.G, D: f.D, criticite: f.C, classe: f.classe, source: f.source }; })), 'AMDEC');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(S.base.parametres.versions.map(function (v) { return { version: v.id, date: v.date, auteur: v.auteur, justification: v.justification, parametres: JSON.stringify(v.params) }; })), 'Paramètres');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(S.base.journal), 'Journal');
    App.downloadWorkbook(wb, 'VNL-SAD_export_' + stamp() + '.xlsx');
  };
  App.actions.exportCsv = function () {
    var rows = resultRows();
    if (!rows.length) return;
    var keys = Object.keys(rows[0]);
    var csv = '﻿' + keys.join(';') + '\n' + rows.map(function (r) {
      return keys.map(function (k) { var v = r[k]; if (typeof v === 'number') return String(v).replace('.', ','); return '"' + String(v === null || v === undefined ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
    }).join('\n');
    download('VNL-SAD_resultats_' + stamp() + '.csv', csv, 'text/csv;charset=utf-8');
  };

  /* ---------- Rapports imprimables (F12.1, F12.2, F2.4) ---------- */
  function printHtml(html) {
    var box = document.getElementById('print');
    box.innerHTML = html;
    document.body.classList.add('printing');
    var done = function () { document.body.classList.remove('printing'); box.innerHTML = ''; root.removeEventListener('afterprint', done); };
    root.addEventListener('afterprint', done);
    setTimeout(function () {
      if (root.AndroidBridge && root.AndroidBridge.print) root.AndroidBridge.print();
      else root.print();
    }, 50);
  }
  function header(title) {
    return '<header class="p-head"><div><strong>GAANA SPRL</strong> · VNL-SAD</div><div>' + esc(title) + '</div><div>Imprimé le ' + new Date().toLocaleDateString('fr-FR') + '</div></header>';
  }

  App.actions.printMonth = function (el) {
    var c = App.calc();
    var r = c.res.mois.filter(function (x) { return x.mois === el.dataset.mois; })[0];
    if (!r) return;
    var rec = S.getMonth(r.mois), k = c.res.mois.indexOf(r), prev = c.res.mois[k - 1];
    var p = c.params;
    var far = C.SUB_INDICATORS.filter(function (s) { return !p.sub[s.code].exclu && s.dim !== 'xe' && F.isNum(r.norm[s.code]); }).sort(function (a, b) { return r.norm[a.code] - r.norm[b.code]; }).slice(0, 5);
    var h = header('Bilan logistique de ' + F.moisLabel(r.mois)) +
      '<h1>Bilan logistique · ' + F.moisLabel(r.mois) + '</h1>' +
      '<p class="p-voyant ' + r.voyant + '">' + { vert: 'Situation normale', orange: 'Vigilance', rouge: 'Alerte' }[r.voyant] + '</p>' +
      '<p class="p-phrase"><strong>Que faire ce mois-ci ?</strong> ' + esc(r.phrase) + '</p>' +
      '<h2>Chiffres clés</h2><table class="p-t"><tr><th></th><th>' + F.moisLabel(r.mois) + '</th><th>Mois précédent</th></tr>' +
      [['VNL', F.mfc(r.vnl), prev ? F.mfc(prev.vnl) : '—'], ['VNL / VMB', F.pct(r.ratio), prev ? F.pct(prev.ratio) : '—'], ['Marge brute (VMB)', F.mfc(r.vmb), prev ? F.mfc(prev.vmb) : '—'], ['Ψ conversion', F.idx(r.psi), prev ? F.idx(prev.psi) : '—'], ['Φ environnement', F.idx(r.phi), prev ? F.idx(prev.phi) : '—'], ['α ; Ω ; γ', F.idx(r.idx.alpha) + ' ; ' + F.idx(r.idx.omega) + ' ; ' + F.idx(r.idx.gamma), prev ? F.idx(prev.idx.alpha) + ' ; ' + F.idx(prev.idx.omega) + ' ; ' + F.idx(prev.idx.gamma) : '—']]
        .map(function (x) { return '<tr><td>' + x[0] + '</td><td>' + x[1] + '</td><td>' + x[2] + '</td></tr>'; }).join('') + '</table>' +
      '<h2>Alertes</h2>' + (r.alertes.length ? '<ul>' + r.alertes.map(function (a) { return '<li>' + esc(a.label) + '</li>'; }).join('') + '</ul>' : '<p>Aucune alerte.</p>') +
      '<h2>Diagnostic</h2><table class="p-t"><tr><th>De la VMB à la VNL</th><th>M FC</th></tr>' +
      [['Marge brute', r.vmb], ['− pertes physiques', r.retraits.pertes], ['− inefficacité de conversion', r.retraits.inefficacite], ['− effet de l’hostilité', r.retraits.hostilite], ['− coûts logistiques', r.retraits.couts], ['= VNL', r.vnl]].map(function (x) { return '<tr><td>' + x[0] + '</td><td>' + F.mfc(x[1], false) + '</td></tr>'; }).join('') + '</table>' +
      '<p>Part de chaque dimension dans la perte de conversion : α ' + F.pct(r.contrib.alpha) + ' · Ω ' + F.pct(r.contrib.omega) + ' · γ ' + F.pct(r.contrib.gamma) + ' · hostilité ' + F.pct(r.contrib.hostilite) + '.</p>' +
      '<p>Sous-indicateurs les plus éloignés de leur cible : ' + far.map(function (s) { return s.code + ' (' + F.idx(r.norm[s.code]) + ')'; }).join(', ') + '.</p>' +
      '<h2>Action recommandée</h2><p>' + (r.action ? 'n° ' + r.action.n + ' ' + esc(r.action.nom) + ' (VAN ' + F.mfc(r.action.van) + ').' : 'Aucune action chiffrée ne vise la dimension en cause.') + (S.base.decisionsAlertes[r.mois] ? ' Décision de la direction : ' + esc(S.base.decisionsAlertes[r.mois]) : '') + '</p>' +
      '<h2>Remarques du mois</h2><p>' + esc((rec && rec.remarque) || 'Aucune.') + '</p>' +
      '<p class="p-foot">Paramètres ' + esc(r.versionParams) + (rec && rec.cloture ? ' · mois clôturé le ' + esc((rec.clotureLe || '').slice(0, 10)) : ' · mois non clôturé') + (rec && Object.keys(rec.recon || {}).length ? ' · ' + Object.keys(rec.recon).length + ' valeur(s) reconstituée(s)' : '') + '</p>';
    printHtml(h);
  };

  App.actions.printYear = function () {
    var c = App.calc();
    if (!c.res.annees.length) return;
    var last = c.res.annees[c.res.annees.length - 1];
    var opt = M.optimize(c.actions, c.params.budget, S.base.forcees.map(function (f) { return f.n; }));
    var h = header('Rapport annuel ' + last.annee) + '<h1>Rapport logistique annuel · ' + last.annee + '</h1>' +
      '<h2>Décomposition de la marge brute</h2>' + App.annualTable(c.res.annees) +
      '<h2>Évolution</h2><p>Ratio VNL/VMB ' + last.annee + ' : ' + F.pct(last.ratio) + '. Parts de la perte de conversion : α ' + F.pct(last.contrib.alpha) + ', Ω ' + F.pct(last.contrib.omega) + ', γ ' + F.pct(last.contrib.gamma) + ', hostilité ' + F.pct(last.contrib.hostilite) + '. Réduction due à l’hostilité : ' + F.pct(last.reductionHostilite) + '.</p>' +
      '<p>Mois en alerte en ' + last.annee + ' : ' + c.res.alertes.filter(function (a) { return a.mois.slice(0, 4) === String(last.annee); }).length + '.</p>' +
      '<h2>AMDEC</h2><table class="p-t"><tr><th class="txt">Défaillance</th><th>Criticité</th><th>Classe</th></tr>' + App.failuresNow().map(function (f) { return '<tr><td>' + esc(f.nom) + '</td><td>' + F.num(f.C, 1) + '</td><td>' + f.classe + '</td></tr>'; }).join('') + '</table>' +
      '<h2>Programme d’actions</h2><p>Budget ' + F.mfc(c.params.budget) + ' : actions ' + opt.actions.join(', ') + ', coût ' + F.mfc(opt.cout) + ', VAN cumulée ' + F.mfc(opt.van) + '.</p>';
    printHtml(h);
  };

  App.actions.printAudit = function () {
    var res = M.audit(S.months());
    printHtml(header('Rapport d’audit de la base') + '<h1>Audit de la base</h1><table class="p-t"><tr><th class="txt">Contrôle</th><th>Résultat</th><th>Décision</th></tr>' +
      res.map(function (r) { return '<tr><td>' + esc(r.controle) + '</td><td>' + esc(r.detail) + '</td><td>' + (r.ok ? 'Conforme' : (r.extremes ? 'Valeurs conservées si l’événement est cité, sinon corrigées' : 'À traiter')) + '</td></tr>'; }).join('') + '</table>');
  };

  document.addEventListener('submit', function (e) { e.preventDefault(); });
})(window);
