/*
 * Lecture des fiches CSV des services (format : champ;valeur;reconstitue;méthode)
 * et des fichiers de fiche mensuelle complète (une ligne par mois).
 * Nombres au format GAANA : virgule décimale, espace comme séparateur de milliers (F1.10).
 */
(function (root) {
  'use strict';

  var C = root.VNLConfig || (typeof require !== 'undefined' ? require('./config.js') : null);
  var KEYS = C.VARIABLES.map(function (v) { return v.key; });

  function parseNumber(s) {
    if (typeof s === 'number') return s;
    if (s === null || s === undefined) return null;
    s = String(s).replace(/[\s  ]/g, '').replace(',', '.');
    if (s === '') return null;
    var x = Number(s);
    return isFinite(x) ? x : NaN;
  }

  function formatNumber(x, dec) {
    if (typeof x !== 'number' || !isFinite(x)) return '';
    var s = dec === undefined ? String(+x.toPrecision(12)) : x.toFixed(dec);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return parts.join(',');
  }

  function splitLines(text) {
    return String(text).replace(/^﻿/, '').split(/\r?\n/).filter(function (l) { return l.trim() !== ''; });
  }

  function sep(line) { return line.indexOf(';') >= 0 ? ';' : (line.indexOf('\t') >= 0 ? '\t' : ','); }

  /* Fiche d'un service : retourne { valeurs: {cle: nombre}, recon: {cle: méthode}, inconnus: [] }. */
  function parseServiceCsv(text) {
    var lines = splitLines(text);
    var out = { valeurs: {}, recon: {}, inconnus: [] };
    if (!lines.length) return out;
    var s = sep(lines[0]);
    lines.slice(1).forEach(function (l) {
      var c = l.split(s);
      var key = (c[0] || '').trim();
      if (KEYS.indexOf(key) < 0) { if (key) out.inconnus.push(key); return; }
      out.valeurs[key] = parseNumber(c[1]);
      var r = (c[2] || '').trim().toLowerCase();
      if (r === 'oui' || r === '1' || r === 'true') out.recon[key] = (c.slice(3).join(s) || '').trim() || 'Reconstituée';
    });
    return out;
  }

  /* Tableau large : colonnes mois + clés des variables (modèle d'import F1.3). */
  function parseWideRows(rows) {
    var months = [];
    rows.forEach(function (r) {
      var mois = String(r.mois || r.Mois || '').trim();
      if (!/^\d{4}-\d{2}$/.test(mois)) return;
      var m = { mois: mois, recon: {}, remarque: r.remarque || '' };
      KEYS.forEach(function (k) { if (r[k] !== undefined) m[k] = parseNumber(r[k]); });
      String(r.reconstituees || '').split(/[,;]\s*/).forEach(function (k) { k = k.trim(); if (KEYS.indexOf(k) >= 0) m.recon[k] = 'Reconstituée (voir remarques)'; });
      months.push(m);
    });
    return months;
  }

  function parseWideCsv(text) {
    var lines = splitLines(text);
    if (lines.length < 2) return [];
    var s = sep(lines[0]);
    var head = lines[0].split(s).map(function (h) { return h.trim(); });
    return parseWideRows(lines.slice(1).map(function (l) {
      var c = l.split(s), o = {};
      head.forEach(function (h, i) { o[h] = c[i]; });
      return o;
    }));
  }

  function templateCsv() {
    return 'mois;' + KEYS.join(';') + ';remarque\n2023-01;' + KEYS.map(function () { return ''; }).join(';') + ';\n';
  }

  /* Repère le mois dans un chemin du type ".../2018-01/achat.csv". */
  function monthFromPath(p) {
    var m = String(p).match(/(\d{4})-(\d{2})(?!.*\d{4}-\d{2})/);
    return m ? m[1] + '-' + m[2] : null;
  }
  function serviceFromPath(p) {
    var f = String(p).split(/[\\/]/).pop().replace(/\.csv$/i, '').toLowerCase();
    return C.SERVICES.some(function (s) { return s.code === f; }) ? f : null;
  }

  root.VNLImporter = {
    parseNumber: parseNumber,
    formatNumber: formatNumber,
    parseServiceCsv: parseServiceCsv,
    parseWideCsv: parseWideCsv,
    parseWideRows: parseWideRows,
    templateCsv: templateCsv,
    monthFromPath: monthFromPath,
    serviceFromPath: serviceFromPath
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.VNLImporter;
})(typeof window !== 'undefined' ? window : globalThis);
