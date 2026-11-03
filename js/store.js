/*
 * Stockage local du VNL-SAD. Toute modification est écrite immédiatement dans le navigateur
 * (NF2) ; une copie quotidienne est conservée, et la base entière peut être sauvegardée dans un
 * fichier (clé USB, carte mémoire) puis restaurée sur un autre appareil.
 */
(function (root) {
  'use strict';

  var C = root.VNLConfig;
  var KEY = 'vnlsad.base';
  var SNAP = 'vnlsad.copies';
  var SCHEMA = 2;

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function now() { return new Date().toISOString(); }
  function uid(p) { return (p || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

  function storageGet(k) { try { return root.localStorage.getItem(k); } catch (e) { return null; } }
  function storageSet(k, v) { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  function emptyBase() {
    var p0 = { id: 'P1', date: now(), auteur: 'Valeurs de départ du mémoire', justification: 'Tableau 6 et section 6.2 du cahier des charges', params: clone(C.DEFAULT_PARAMS) };
    return {
      schema: SCHEMA,
      creee: now(),
      mois: {},
      parametres: { versions: [p0], active: 'P1', propositions: [] },
      utilisateurs: [],
      defaillances: C.FAILURES.map(function (f) { var x = clone(f); x.cause = ''; x.effets = ''; x.detection = ''; return x; }),
      campagnesAmdec: [],
      actions: C.ACTIONS.map(function (a) { var x = clone(a); x.attendue = null; x.coutAnnuel = null; x.duree = null; x.engagee = false; return x; }),
      forcees: [],
      programme: null,
      ahp: [],
      decisionsAlertes: {},
      justificationsExtremes: {},
      questionnaires: [],
      journal: [],
      chronos: {},
      evaluateurs: {}
    };
  }

  var base = null;
  var listeners = [];
  var saveOk = true;

  function load() {
    var raw = storageGet(KEY);
    if (raw) {
      try { base = JSON.parse(raw); } catch (e) { base = null; }
    }
    if (!base || base.schema !== SCHEMA) base = emptyBase();
    dailySnapshot();
    return base;
  }

  function persist() {
    saveOk = storageSet(KEY, JSON.stringify(base));
    listeners.forEach(function (f) { f(); });
    return saveOk;
  }

  function dailySnapshot() {
    var day = now().slice(0, 10);
    var snaps = [];
    try { snaps = JSON.parse(storageGet(SNAP) || '[]'); } catch (e) { snaps = []; }
    if (snaps.length && snaps[0].jour === day) return;
    if (!Object.keys(base.mois).length) return;
    snaps.unshift({ jour: day, base: base });
    snaps = snaps.slice(0, 3);
    if (!storageSet(SNAP, JSON.stringify(snaps))) storageSet(SNAP, JSON.stringify(snaps.slice(0, 1)));
  }

  function snapshots() {
    try { return JSON.parse(storageGet(SNAP) || '[]').map(function (s) { return { jour: s.jour, mois: Object.keys(s.base.mois).length }; }); } catch (e) { return []; }
  }
  function restoreSnapshot(jour) {
    var snaps = JSON.parse(storageGet(SNAP) || '[]');
    var s = snaps.filter(function (x) { return x.jour === jour; })[0];
    if (!s) return false;
    base = s.base; log('Restauration de la copie automatique', null, jour, ''); persist(); return true;
  }

  /* ---------- Journal (F13.2), non modifiable depuis l'interface ---------- */
  var currentUser = null;
  function setUser(u) { currentUser = u; }
  function user() { return currentUser; }
  function log(quoi, ancien, nouveau, motif) {
    base.journal.push({ t: now(), qui: currentUser ? currentUser.nom : '—', quoi: quoi, ancien: ancien === undefined ? null : ancien, nouveau: nouveau === undefined ? null : nouveau, motif: motif || '' });
  }

  /* ---------- Mois ---------- */
  function months() {
    return Object.keys(base.mois).sort().map(function (k) { return base.mois[k]; });
  }
  function getMonth(m) { return base.mois[m] || null; }
  function ensureMonth(m) {
    if (!base.mois[m]) {
      base.mois[m] = { mois: m, recon: {}, remarque: '', cloture: false, entete: { documents: '', dateReleve: '', validePar: '' }, tauxChange: null };
      base.chronos[m] = { ouverture: now() };
      log('Ouverture du mois ' + m);
    }
    return base.mois[m];
  }
  function setValue(m, key, value, motif) {
    var rec = ensureMonth(m);
    var old = rec[key] === undefined ? null : rec[key];
    if (old === value) return;
    if (rec.cloture && !motif) throw new Error('Mois clôturé : une correction exige un motif.');
    rec[key] = value;
    log('Saisie ' + m + ' / ' + key, old, value, motif || '');
    persist();
  }
  function setMeta(m, field, value) {
    var rec = ensureMonth(m);
    var old = rec[field];
    rec[field] = value;
    log('Modification ' + m + ' / ' + field, typeof old === 'object' ? JSON.stringify(old) : old, typeof value === 'object' ? JSON.stringify(value) : value);
    persist();
  }
  function closeMonth(m) {
    var rec = ensureMonth(m);
    rec.cloture = true;
    rec.clotureLe = now();
    rec.cloturePar = currentUser ? currentUser.nom : '';
    base.chronos[m] = base.chronos[m] || {};
    base.chronos[m].cloture = now();
    log('Clôture du mois ' + m);
    persist();
  }
  function reopenMonth(m, motif) {
    var rec = ensureMonth(m);
    rec.cloture = false;
    log('Réouverture du mois ' + m, null, null, motif);
    persist();
  }
  function importMonths(list, origine) {
    var n = 0, bloques = [];
    list.forEach(function (src) {
      var rec = base.mois[src.mois];
      if (rec && rec.cloture) { bloques.push(src.mois); return; }
      rec = ensureMonth(src.mois);
      C.VARIABLES.forEach(function (v) { if (typeof src[v.key] === 'number' && isFinite(src[v.key])) rec[v.key] = src[v.key]; });
      if (src.recon) Object.keys(src.recon).forEach(function (k) { rec.recon[k] = src.recon[k]; });
      if (src.remarque) rec.remarque = src.remarque;
      if (src.cloture) { rec.cloture = true; rec.clotureLe = now(); rec.cloturePar = 'Reprise de l’historique'; }
      n++;
    });
    log('Import de ' + n + ' mois (' + origine + ')', null, null, bloques.length ? 'Mois clôturés ignorés : ' + bloques.join(', ') : '');
    persist();
    return { importes: n, bloques: bloques };
  }

  /* ---------- Paramètres versionnés (F3.2 à F3.4) ---------- */
  function paramVersion(id) {
    return base.parametres.versions.filter(function (v) { return v.id === (id || base.parametres.active); })[0];
  }
  function params() { return paramVersion().params; }
  function proposeParams(newParams, justification, auto) {
    var prop = { id: uid('prop'), date: now(), auteur: currentUser ? currentUser.nom : '', justification: justification, params: newParams };
    if (auto) return adoptParams(prop);
    base.parametres.propositions.push(prop);
    log('Proposition de paramètres', null, null, justification);
    persist();
    return prop;
  }
  function adoptParams(prop) {
    var n = base.parametres.versions.length + 1;
    var v = { id: 'P' + n, date: now(), auteur: prop.auteur, validePar: currentUser ? currentUser.nom : '', justification: prop.justification, params: prop.params };
    var before = params();
    base.parametres.versions.push(v);
    base.parametres.active = v.id;
    base.parametres.propositions = base.parametres.propositions.filter(function (p) { return p.id !== prop.id; });
    log('Nouvelle version de paramètres ' + v.id, diffParams(before, v.params), null, prop.justification);
    persist();
    return v;
  }
  function rejectParams(propId, motif) {
    base.parametres.propositions = base.parametres.propositions.filter(function (p) { return p.id !== propId; });
    log('Proposition de paramètres refusée', null, null, motif);
    persist();
  }
  function activateVersion(id, motif) {
    var old = base.parametres.active;
    base.parametres.active = id;
    log('Version de paramètres active', old, id, motif);
    persist();
  }
  function diffParams(a, b) {
    var out = [];
    ['theta', 'seuilRatio', 'seuilOmega', 'seuilBaisse', 'budget', 'taux', 'seuilSensibilite', 'anneeReference'].forEach(function (k) {
      if (a[k] !== b[k]) out.push(k + ' : ' + a[k] + ' → ' + b[k]);
    });
    ['alpha', 'omega', 'gamma'].forEach(function (k) { if (a.wDim[k] !== b.wDim[k]) out.push('w' + k + ' : ' + a.wDim[k] + ' → ' + b.wDim[k]); });
    Object.keys(b.sub).forEach(function (c) {
      var x = a.sub[c] || {}, y = b.sub[c];
      if (x.cible !== y.cible) out.push(c + ' cible : ' + x.cible + ' → ' + y.cible);
      if (x.poids !== y.poids) out.push(c + ' poids : ' + x.poids + ' → ' + y.poids);
      if (!!x.exclu !== !!y.exclu) out.push(c + (y.exclu ? ' exclu' : ' réintégré'));
    });
    return out.join(' ; ');
  }

  /* ---------- Utilisateurs (F13.1) ---------- */
  /* SHA-256 compact (domaine public), pour ne jamais stocker un mot de passe en clair. */
  function sha256(ascii) {
    function rr(v, a) { return (v >>> a) | (v << (32 - a)); }
    var mp = Math.pow, max = mp(2, 32), result = '', words = [], bitLen = ascii.length * 8;
    var hash = [], k = [], pc = 0, isC = {};
    for (var cand = 2; pc < 64; cand++) {
      if (!isC[cand]) {
        for (var i = 0; i < 313; i += cand) isC[i] = cand;
        hash[pc] = (mp(cand, .5) * max) | 0;
        k[pc++] = (mp(cand, 1 / 3) * max) | 0;
      }
    }
    hash = hash.slice(0, 8);
    ascii += '\x80';
    while (ascii.length % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii.length; i++) words[i >> 2] |= ascii.charCodeAt(i) << ((3 - i) % 4) * 8;
    words[words.length] = ((bitLen / max) | 0);
    words[words.length] = (bitLen);
    for (var j = 0; j < words.length;) {
      var w = words.slice(j, j += 16), oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & hash[5]) ^ ((~e) & hash[6])) + k[i] +
          (w[i] = (i < 16) ? w[i] : (w[i - 16] + (rr(w15, 7) ^ rr(w15, 18) ^ (w15 >>> 3)) + w[i - 7] + (rr(w2, 17) ^ rr(w2, 19) ^ (w2 >>> 10))) | 0);
        var t2 = (rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(t1 + t2) | 0].concat(hash);
        hash[4] = (hash[4] + t1) | 0;
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) for (j = 3; j + 1; j--) { var b = (hash[i] >> (j * 8)) & 255; result += ((b < 16) ? 0 : '') + b.toString(16); }
    return result;
  }
  function hashPw(pw, sel) { return sha256(unescape(encodeURIComponent(sel + ':' + pw))); }

  function addUser(nom, roles, pw, code) {
    var sel = uid('s');
    var u = { id: uid('u'), nom: nom, roles: roles, code: code || '', sel: sel, hash: hashPw(pw, sel), actif: true, cree: now() };
    base.utilisateurs.push(u);
    log('Création du compte ' + nom, null, roles.join(', '));
    persist();
    return u;
  }
  function updateUser(id, changes) {
    var u = base.utilisateurs.filter(function (x) { return x.id === id; })[0];
    if (!u) return;
    if (changes.pw) { u.sel = uid('s'); u.hash = hashPw(changes.pw, u.sel); log('Mot de passe modifié : ' + u.nom); }
    if (changes.roles) { log('Rôles de ' + u.nom, u.roles.join(', '), changes.roles.join(', ')); u.roles = changes.roles; }
    if (changes.actif !== undefined) { log((changes.actif ? 'Réactivation' : 'Désactivation') + ' du compte ' + u.nom); u.actif = changes.actif; }
    if (changes.code !== undefined) { u.code = changes.code; }
    persist();
  }
  function login(id, pw) {
    var u = base.utilisateurs.filter(function (x) { return x.id === id && x.actif; })[0];
    if (!u) return null;
    // Les claviers de téléphone ajoutent parfois une espace finale : on l'ignore.
    if (u.hash !== hashPw(pw, u.sel) && u.hash !== hashPw(String(pw).trim(), u.sel)) return null;
    currentUser = u;
    return u;
  }

  /* Code de secours : remis à la création du premier compte, il permet de redéfinir
     un mot de passe oublié sans perdre les données de l'appareil. */
  function newRecoveryCode() {
    var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', c = '';
    for (var i = 0; i < 8; i++) c += a[Math.floor(Math.random() * a.length)];
    c = c.slice(0, 4) + '-' + c.slice(4);
    var sel = uid('s');
    base.secours = { sel: sel, hash: hashPw(c, sel) };
    log('Code de secours renouvelé');
    persist();
    return c;
  }
  function normCode(c) { c = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return c.slice(0, 4) + '-' + c.slice(4); }
  function hasRecovery() { return !!base.secours; }
  function resetWithCode(id, code, pw) {
    if (!base.secours || base.secours.hash !== hashPw(normCode(code), base.secours.sel)) return false;
    var u = base.utilisateurs.filter(function (x) { return x.id === id; })[0];
    if (!u) return false;
    u.sel = uid('s'); u.hash = hashPw(pw, u.sel); u.actif = true;
    log('Mot de passe redéfini avec le code de secours : ' + u.nom);
    persist();
    return true;
  }
  function can(role) {
    if (!currentUser) return false;
    var r = currentUser.roles;
    return r.indexOf(role) >= 0;
  }
  function canEnter(service) {
    return can('admin') || can('operateur') || can(service);
  }

  /* ---------- Sauvegarde / restauration (F13.3) ---------- */
  function exportJson() { return JSON.stringify(base, null, 1); }
  function importJson(text) {
    var b = JSON.parse(text);
    if (!b || b.schema !== SCHEMA || !b.mois) throw new Error('Ce fichier n’est pas une sauvegarde VNL-SAD valide.');
    var keepUser = currentUser;
    base = b;
    currentUser = keepUser;
    log('Restauration d’une sauvegarde', null, Object.keys(b.mois).length + ' mois');
    persist();
  }

  function onChange(f) { listeners.push(f); }
  function touch(quoi, ancien, nouveau, motif) { if (quoi) log(quoi, ancien, nouveau, motif); return persist(); }

  root.VNLStore = {
    load: load,
    get base() { return base; },
    months: months,
    getMonth: getMonth,
    ensureMonth: ensureMonth,
    setValue: setValue,
    setMeta: setMeta,
    closeMonth: closeMonth,
    reopenMonth: reopenMonth,
    importMonths: importMonths,
    params: params,
    paramVersion: paramVersion,
    proposeParams: proposeParams,
    adoptParams: adoptParams,
    rejectParams: rejectParams,
    activateVersion: activateVersion,
    diffParams: diffParams,
    addUser: addUser,
    updateUser: updateUser,
    login: login,
    newRecoveryCode: newRecoveryCode,
    hasRecovery: hasRecovery,
    resetWithCode: resetWithCode,
    setUser: setUser,
    user: user,
    can: can,
    canEnter: canEnter,
    exportJson: exportJson,
    importJson: importJson,
    snapshots: snapshots,
    restoreSnapshot: restoreSnapshot,
    onChange: onChange,
    touch: touch,
    uid: uid,
    clone: clone,
    saveOk: function () { return saveOk; }
  };
})(window);
