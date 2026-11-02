/*
 * Écran 6 : saisie par service, import, contrôles, clôture du mois, audit de la base.
 */
(function (root) {
  'use strict';

  var C = root.VNLConfig, M = root.VNLModel, S = root.VNLStore, I = root.VNLImporter, App = root.App;
  var F = App.fmt, esc = F.esc;

  function lastMonth() {
    var ms = S.months();
    return ms.length ? ms[ms.length - 1].mois : null;
  }
  function nextMonth(m) {
    if (!m) { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
    var p = m.split('-').map(Number);
    var y = p[0] + (p[1] === 12 ? 1 : 0), mo = p[1] === 12 ? 1 : p[1] + 1;
    return y + '-' + String(mo).padStart(2, '0');
  }

  function progress(rec) {
    var out = {};
    C.SERVICES.forEach(function (s) {
      var vars = C.VARIABLES.filter(function (v) { return v.svc === s.code; });
      var done = vars.filter(function (v) { return rec && F.isNum(rec[v.key]); }).length;
      out[s.code] = { done: done, total: vars.length };
    });
    return out;
  }

  function inputFor(v, rec, editable) {
    var val = rec && F.isNum(rec[v.key]) ? I.formatNumber(rec[v.key]) : '';
    var unit = { fc: 'FC', kg: 'kg', h: 'h', j: 'jours', taux: '0 à 1', score: '1 à 5', nb: '' }[v.unit];
    var recon = rec && rec.recon && rec.recon[v.key];
    return '<div class="field' + (recon ? ' is-recon' : '') + '"><label for="v-' + v.key + '"><span class="n">' + v.n + '</span> ' + esc(v.label) + (v.recon ? ' <span class="tag" title="Grandeur absente des documents sous cette forme : à reconstituer selon une règle décrite dans les remarques du mois">à reconstituer</span>' : '') + '</label>' +
      '<div class="in"><input id="v-' + v.key + '" inputmode="decimal" data-change="saisie" data-key="' + v.key + '" value="' + esc(val) + '"' + (editable ? '' : ' disabled') + '><span class="unit">' + unit + '</span>' +
      '<label class="check small" title="Valeur reconstituée"><input type="checkbox" data-change="recon" data-key="' + v.key + '"' + (recon ? ' checked' : '') + (editable ? '' : ' disabled') + '> reconstituée</label></div>' +
      '<div class="err" id="e-' + v.key + '"></div></div>';
  }

  App.views.saisie = {
    html: function () {
      var m = App.state.saisieMois || lastMonth() || nextMonth(null);
      App.state.saisieMois = m;
      var rec = S.getMonth(m);
      var prog = progress(rec);
      var ms = S.months().map(function (x) { return x.mois; });
      var h = '<div class="head-row"><h2>Saisie et import</h2><div class="inline"><label class="inline">Mois <select data-change="saisieMois">' +
        ms.slice().reverse().map(function (x) { return '<option value="' + x + '"' + (x === m ? ' selected' : '') + '>' + F.moisLabel(x) + (S.getMonth(x).cloture ? ' (clôturé)' : '') + '</option>'; }).join('') +
        (ms.indexOf(m) < 0 ? '<option selected value="' + m + '">' + F.moisLabel(m) + ' (nouveau)</option>' : '') +
        '</select></label><button data-act="newMonth">Nouveau mois</button></div></div>';

      // état d'avancement (F1.2)
      h += '<section class="card"><h3>' + F.moisLabel(m) + (rec && rec.cloture ? ' · <span class="ok">clôturé le ' + esc((rec.clotureLe || '').slice(0, 10)) + ' par ' + esc(rec.cloturePar || '') + '</span>' : '') + '</h3><div class="progress">' +
        C.SERVICES.map(function (s) {
          var p = prog[s.code], full = p.done === p.total;
          return '<div class="prog ' + (full ? 'full' : '') + '"><span>' + s.label + '</span><span class="bar"><span class="fill ' + (full ? 'good' : 'warn') + '" style="width:' + Math.round(p.done / p.total * 100) + '%"></span></span><span>' + p.done + ' / ' + p.total + '</span></div>';
        }).join('') + '</div>';
      // variables dérivées (F1.9)
      if (rec && F.isNum(rec.ca) && F.isNum(rec.cmv)) {
        var r = M.computeMonth(rec, S.params());
        h += '<p class="derived">Calculé automatiquement : marge brute VMB ' + F.mfc(r.vmb) + ' · taux de pertes τ ' + F.pct(r.tau, 2) + ' · coûts logistiques ' + F.mfc(r.clog) + (F.isNum(r.vnl) ? ' · VNL ' + F.mfc(r.vnl) : '') + '</p>';
      }
      h += '</section>';

      // en-tête de la fiche (F1.1)
      var e = (rec && rec.entete) || {};
      var closed = rec && rec.cloture;
      h += '<section class="card"><h3>En-tête de la fiche</h3><div class="grid3">' +
        '<label>Documents consultés<input data-change="entete" name="documents" value="' + esc(e.documents || '') + '"' + (closed ? ' disabled' : '') + '></label>' +
        '<label>Date du relevé<input type="date" data-change="entete" name="dateReleve" value="' + esc(e.dateReleve || '') + '"' + (closed ? ' disabled' : '') + '></label>' +
        '<label>Fonction de la personne qui valide<input data-change="entete" name="validePar" value="' + esc(e.validePar || '') + '"' + (closed ? ' disabled' : '') + '></label>' +
        '<label>Taux de change indicatif (FC pour 1 USD)<input inputmode="decimal" data-change="change" value="' + (rec && F.isNum(rec.tauxChange) ? I.formatNumber(rec.tauxChange) : '') + '"' + (closed ? ' disabled' : '') + '></label></div></section>';

      // fiches par service
      C.SERVICES.forEach(function (s) {
        var editable = S.canEnter(s.code) && !closed;
        var mine = S.canEnter(s.code);
        h += '<details class="card svc"' + (mine ? ' open' : '') + '><summary><h3>' + s.label + '</h3><span class="muted">' + prog[s.code].done + ' / ' + prog[s.code].total + (mine ? '' : ' · lecture seule') + '</span></summary><div class="fields">' +
          C.VARIABLES.filter(function (v) { return v.svc === s.code; }).map(function (v) { return inputFor(v, rec, editable); }).join('') + '</div></details>';
      });

      h += '<section class="card"><h3>Remarques du mois</h3><p class="hint">Événements notables (coupure prolongée, pénurie de carburant, inondation…) et règle de reconstitution des valeurs marquées « reconstituée ».</p>' +
        '<textarea data-change="remarque" rows="4"' + (closed ? ' disabled' : '') + '>' + esc((rec && rec.remarque) || '') + '</textarea></section>';

      h += '<div class="btns">';
      if (closed) h += '<button data-act="reopen">Corriger un mois clôturé</button>';
      else h += '<button class="primary" data-act="close"' + (S.can('comptabilite') || S.can('admin') ? '' : ' disabled title="La clôture revient à la comptabilité"') + '>Contrôler et clôturer le mois</button>';
      h += '</div>';

      // import (F1.3, F1.4)
      h += '<section class="card"><h3>Importer des mois</h3>' +
        '<p>Deux formats sont acceptés : les fiches des services (un dossier par mois nommé AAAA-MM, contenant achat.csv, commercial.csv, comptabilite.csv, direction.csv et production.csv), ou une fiche complète avec un mois par ligne (CSV ou Excel, au format du modèle).</p>' +
        '<div class="btns"><label class="button">Choisir un dossier de fiches<input type="file" webkitdirectory multiple hidden data-change="importDir"></label>' +
        '<label class="button">Choisir des fichiers CSV ou Excel<input type="file" multiple accept=".csv,.xlsx,.xls,.txt" hidden data-change="importFiles"></label>' +
        '<button data-act="template">Télécharger le modèle vierge</button></div>' +
        '<label class="check"><input type="checkbox" id="importClose"> Clôturer les mois importés (reprise de l’historique déjà validé)</label></section>';

      h += App.auditCard();
      return h;
    }
  };

  App.actions.saisieMois = function (el) { App.state.saisieMois = el.value; App.render(); };
  App.actions.newMonth = function () {
    var m = root.prompt('Mois à ouvrir (AAAA-MM)', nextMonth(lastMonth()));
    if (!m) return;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) { App.toast('Format attendu : AAAA-MM, par exemple 2023-01.', 'err'); return; }
    S.ensureMonth(m); S.touch();
    App.state.saisieMois = m; App.render();
  };

  function motifIfClosed(m) {
    var rec = S.getMonth(m);
    if (!rec || !rec.cloture) return '';
    var motif = root.prompt('Ce mois est clôturé. Motif de la correction :');
    if (!motif) throw new Error('Correction annulée : un motif est obligatoire.');
    return motif;
  }

  App.actions.saisie = function (el) {
    var m = App.state.saisieMois, key = el.dataset.key;
    var def = C.VARIABLES.filter(function (v) { return v.key === key; })[0];
    var errEl = document.getElementById('e-' + key);
    var x = el.value.trim() === '' ? null : I.parseNumber(el.value);
    var msg = x === null ? null : M.checkValue(def, x);
    if (!msg && x !== null) {
      var probe = Object.assign({}, S.getMonth(m) || {}); probe[key] = x;
      var coh = M.checkCoherence(probe).filter(function (e) { return e.champs.indexOf(key) >= 0 || true; })
        .filter(function (e) { return relatedTo(e, key); });
      if (coh.length) msg = coh[0].msg;
    }
    if (msg) {
      errEl.textContent = msg + '. Valeur refusée.';
      el.classList.add('bad');
      return;
    }
    errEl.textContent = ''; el.classList.remove('bad');
    try {
      S.setValue(m, key, x, motifIfClosed(m));
      el.value = x === null ? '' : I.formatNumber(x);
      refreshHeader();
    } catch (e) { App.toast(e.message, 'err'); App.render(); }
  };
  var PAIRS = [['livraisons', 'commandes'], ['ruptures', 'jours'], ['couverture', 'coupures'], ['production', 'capacite'], ['retours', 'ventes'], ['cmv', 'ca']];
  function relatedTo(e, key) {
    return PAIRS.some(function (p) { return p.indexOf(key) >= 0 && e.champs.indexOf(p[0]) >= 0; });
  }
  function refreshHeader() {
    // met à jour l'avancement sans perdre la position de saisie
    var y = root.scrollY, active = document.activeElement && document.activeElement.id;
    App.render();
    root.scrollTo(0, y);
    if (active) { var a = document.getElementById(active); var next = a && nextInput(a); if (next) next.focus({ preventScroll: true }); }
  }
  function nextInput(a) {
    var all = Array.prototype.slice.call(document.querySelectorAll('input[data-change=saisie]:not([disabled])'));
    return all[all.indexOf(a) + 1] || null;
  }

  App.actions.recon = function (el) {
    var m = App.state.saisieMois, rec = S.ensureMonth(m), key = el.dataset.key;
    if (el.checked) rec.recon[key] = 'Reconstituée (règle décrite dans les remarques)';
    else delete rec.recon[key];
    S.touch('Marquage reconstitué ' + m + ' / ' + key, null, el.checked ? 'oui' : 'non');
  };
  App.actions.entete = function (el) {
    var m = App.state.saisieMois, rec = S.ensureMonth(m);
    var e = Object.assign({}, rec.entete); e[el.name] = el.value;
    S.setMeta(m, 'entete', e);
  };
  App.actions.change = function (el) {
    S.setMeta(App.state.saisieMois, 'tauxChange', I.parseNumber(el.value));
  };
  App.actions.remarque = function (el) { S.setMeta(App.state.saisieMois, 'remarque', el.value); };

  App.actions.close = function () {
    var m = App.state.saisieMois, rec = S.getMonth(m);
    var problems = [];
    C.VARIABLES.forEach(function (v) {
      if (!rec || !F.isNum(rec[v.key])) problems.push('Variable manquante : ' + v.n + ' ' + v.label);
      else { var e = M.checkValue(v, rec[v.key]); if (e) problems.push(v.label + ' : ' + e); }
    });
    if (rec) M.checkCoherence(rec).forEach(function (e) { problems.push(e.msg); });
    if (rec && Object.keys(rec.recon || {}).length && !(rec.remarque || '').trim()) problems.push('Des valeurs sont marquées « reconstituée » : décrivez la règle utilisée dans les remarques du mois.');
    if (problems.length) {
      root.alert('Le mois ne peut pas être clôturé :\n\n• ' + problems.slice(0, 12).join('\n• ') + (problems.length > 12 ? '\n…' : ''));
      return;
    }
    if (!root.confirm('Clôturer ' + F.moisLabel(m) + ' ? Les valeurs seront verrouillées.')) return;
    S.closeMonth(m);
    App.toast('Mois clôturé. Résultats disponibles dans le tableau de bord.');
    App.state.mois = m;
    App.render();
  };
  App.actions.reopen = function () {
    var m = App.state.saisieMois;
    var motif = root.prompt('Motif de la réouverture de ' + F.moisLabel(m) + ' :');
    if (!motif) return;
    S.reopenMonth(m, motif); App.render();
  };

  /* ---------- Import ---------- */
  function readText(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsText(file, 'utf-8'); }); }
  function readBuf(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsArrayBuffer(file); }); }

  function importServiceFiles(files) {
    var byMonth = {};
    var jobs = files.map(function (f) {
      var path = f.webkitRelativePath || f.name;
      var m = I.monthFromPath(path), svc = I.serviceFromPath(path);
      if (!m || !svc) return Promise.resolve();
      return readText(f).then(function (t) {
        var p = I.parseServiceCsv(t);
        var rec = byMonth[m] = byMonth[m] || { mois: m, recon: {} };
        Object.assign(rec, p.valeurs); Object.assign(rec.recon, p.recon);
      });
    });
    return Promise.all(jobs).then(function () { return Object.keys(byMonth).sort().map(function (k) { return byMonth[k]; }); });
  }

  function finishImport(list, origine) {
    if (!list.length) { App.toast('Aucun mois reconnu dans ces fichiers.', 'err'); return; }
    var bad = [];
    list.forEach(function (m) {
      C.VARIABLES.forEach(function (v) { var e = M.checkValue(v, m[v.key]); if (e) { bad.push(m.mois + ' ' + v.key + ' : ' + e); delete m[v.key]; } });
    });
    var close = document.getElementById('importClose') && document.getElementById('importClose').checked;
    list.forEach(function (m) { m.cloture = close; });
    var r = S.importMonths(list, origine);
    App.state.saisieMois = list[list.length - 1].mois;
    App.render();
    App.toast(r.importes + ' mois importés' + (r.bloques.length ? ', ' + r.bloques.length + ' mois clôturés ignorés' : '') + (bad.length ? ', ' + bad.length + ' valeurs refusées' : '') + '.');
    if (bad.length) root.alert('Valeurs refusées à l’import :\n\n' + bad.slice(0, 15).join('\n'));
  }

  App.actions.importDir = function (el) {
    var files = Array.prototype.slice.call(el.files);
    importServiceFiles(files).then(function (l) { finishImport(l, 'fiches des services'); });
  };
  App.actions.importFiles = function (el) {
    var files = Array.prototype.slice.call(el.files);
    var service = files.filter(function (f) { return I.serviceFromPath(f.name) && I.monthFromPath(f.webkitRelativePath || f.name); });
    if (service.length) { importServiceFiles(service).then(function (l) { finishImport(l, 'fiches des services'); }); return; }
    Promise.all(files.map(function (f) {
      if (/\.xlsx?$/i.test(f.name)) {
        return readBuf(f).then(function (b) {
          var wb = root.XLSX.read(b, { type: 'array' });
          var ws = wb.Sheets[wb.SheetNames[0]];
          return I.parseWideRows(root.XLSX.utils.sheet_to_json(ws, { raw: true, defval: '' }));
        });
      }
      return readText(f).then(I.parseWideCsv);
    })).then(function (lists) { finishImport([].concat.apply([], lists), 'fichier ' + files.map(function (f) { return f.name; }).join(', ')); });
  };
  App.actions.template = function () {
    var keys = C.VARIABLES.map(function (v) { return v.key; });
    var rows = [['mois'].concat(keys).concat(['remarque']), ['N°'].concat(C.VARIABLES.map(function (v) { return v.n + ' ' + v.label; })).concat(['']), ['2023-01'].concat(keys.map(function () { return ''; })).concat([''])];
    var wb = root.XLSX.utils.book_new();
    root.XLSX.utils.book_append_sheet(wb, root.XLSX.utils.aoa_to_sheet(rows), 'Fiche mensuelle');
    root.XLSX.writeFile(wb, 'modele_fiche_mensuelle_VNL-SAD.xlsx');
  };

  /* ---------- Audit (F2.1 à F2.4) ---------- */
  App.auditCard = function () {
    var ms = S.months();
    if (!ms.length) return '';
    var res = M.audit(ms);
    var h = '<section class="card" id="audit"><h3>Audit de la base</h3><div class="scroll"><table><thead><tr><th class="txt">Contrôle</th><th>Résultat</th><th class="txt">Détail</th></tr></thead><tbody>' +
      res.map(function (r) { return '<tr><th class="txt">' + esc(r.controle) + '</th><td>' + (r.ok ? '<span class="ok">Conforme</span>' : (r.avertissement ? '<span class="warn-t">À signaler</span>' : '<span class="ko">À traiter</span>')) + '</td><td class="txt">' + esc(r.detail) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';
    var ext = res.filter(function (r) { return r.extremes; })[0].extremes;
    if (ext.length) {
      h += '<h4>Valeurs extrêmes : conserver en citant l’événement, ou corriger</h4><div class="scroll"><table><thead><tr><th>Mois</th><th class="txt">Variable</th><th>Valeur</th><th>Événement qui l’explique</th></tr></thead><tbody>' +
        ext.map(function (x) {
          var k = x.mois + '|' + x.champ, j = S.base.justificationsExtremes[k] || '';
          return '<tr><td>' + x.mois + '</td><td>' + x.champ + '</td><td class="num">' + F.num(x.valeur, 3) + '</td><td><input class="wide" data-change="justifExt" data-k="' + esc(k) + '" value="' + esc(j) + '" placeholder="Ex. coupure prolongée, inondation…"></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    h += '<div class="btns"><button data-act="printAudit">Imprimer le rapport d’audit</button></div></section>';
    return h;
  };
  App.actions.justifExt = function (el) {
    var k = el.dataset.k, old = S.base.justificationsExtremes[k] || '';
    S.base.justificationsExtremes[k] = el.value;
    S.touch('Justification de la valeur extrême ' + k, old, el.value);
  };
})(window);
