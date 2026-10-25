// Vérifie le noyau de calcul contre les tableaux du mémoire.  Lancer : node tests/model.test.js
const assert = require('node:assert/strict');
const M = require('../js/model.js');
const D = require('../js/data.js');

let n = 0;
function check(name, fn) {
  fn();
  n++;
  console.log('ok -', name);
}
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} attendu ${b}, obtenu ${a}`);

const data = D.gaana();
const res = M.computeAll(data.years, data.params);

check('Ψ conforme au tableau III-10 (à 0,01 près)', () => {
  [0.89, 0.93, 0.57, 0.70, 0.69].forEach((p, k) => close(res[k].psi, p, 0.006, `Ψ ${res[k].year}`));
});

check('Φ conforme au tableau III-11 (à 0,002 près)', () => {
  [1.095, 1.126, 0.952, 1.011, 1.014].forEach((p, k) => close(res[k].phi, p, 0.002, `Φ ${res[k].year}`));
});

check('VNL conforme au tableau III-12 (écart < 1 % : le mémoire arrondit Ψ et Φ)', () => {
  [3032.4, 3529.8, 1508.8, 2382.3, 2613.3].forEach((v, k) => close(res[k].vnl, v, v * 0.01, `VNL ${res[k].year}`));
});

check('statuts de régime conformes au tableau III-13', () => {
  assert.deepEqual(res.map((r) => r.status), [
    'Création élevée', 'Création élevée', 'Création réduite', 'Reprise fragile', 'Reprise fragile'
  ]);
});

check('contrefactuel Xe = 0 en 2022 : Φ ≈ 1,287', () => {
  close(M.phi(0.72, 0, 0.35), 1.287, 0.001);
});

check('indice Rz 2022 ≈ 0,7209 (poids renormalisés, somme = 1,002 dans le mémoire)', () => {
  const dim = D.DIMENSIONS.find((x) => x.id === 'rz');
  const items = dim.subs.map((s) => ({ w: s.w, v: data.years[4].detail[s.code].ovr }));
  close(M.weightedIndex(items), 0.7209, 0.002);
});

check('normalisation : bornes et polarité', () => {
  assert.equal(M.normalize(0.5, 1, 'direct'), 0.5);
  assert.equal(M.normalize(5, 1, 'direct'), M.NORM_MAX);
  assert.equal(M.normalize(1, 4, 'inverse'), M.NORM_MAX);
  assert.equal(M.normalize(10, 1, 'inverse'), M.NORM_MIN);
  assert.ok(Number.isNaN(M.normalize(1, 0, 'direct')));
});

check('AMDEC : criticité et niveaux', () => {
  assert.equal(M.criticality(4, 5, 3), 60);
  assert.equal(M.criticalityLevel(36), 'Critique');
  assert.equal(M.criticalityLevel(35), 'Majeur');
  assert.equal(M.criticalityLevel(20), 'Majeur');
  assert.equal(M.criticalityLevel(18), 'Modéré');
});

check('optimisation : respecte le budget et améliore le gain', () => {
  [100, 150, 200].forEach((b) => {
    const o = M.optimize(data.actions, b);
    assert.ok(o.cost <= b + 1e-9, `budget ${b} dépassé`);
    console.log(`   budget ${b} -> actions ${o.selected.join(',')} coût ${o.cost} gain ${o.gain}`);
  });
  const b0 = M.optimize(data.actions, 0);
  assert.equal(b0.selected.length, 0);
});

check('optimisation : exacte face à une énumération complète', () => {
  const acts = data.actions;
  for (const b of [30, 55, 100, 150, 200, 260]) {
    let best = 0;
    for (let mask = 0; mask < 1 << acts.length; mask++) {
      let c = 0, g = 0;
      acts.forEach((a, i) => { if (mask & (1 << i)) { c += a.cost; g += a.gain; } });
      if (c <= b && g > best) best = g;
    }
    assert.equal(M.optimize(acts, b).gain, best, `budget ${b}`);
  }
});

console.log(`\n${n} groupes de tests réussis`);
