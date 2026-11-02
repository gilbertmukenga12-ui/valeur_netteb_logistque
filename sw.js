/* Cache hors ligne : l'application fonctionne sans connexion une fois ouverte une première fois. */
var CACHE = 'vnlsad-v2-1';
var FILES = ['./', 'index.html', 'css/style.css', 'icon.svg', 'manifest.webmanifest',
  'vendor/chart.umd.js', 'vendor/xlsx.full.min.js',
  'js/config.js', 'js/model.js', 'js/importer.js', 'js/store.js',
  'js/app.js', 'js/app-saisie.js', 'js/app-actions.js', 'js/app-params.js', 'js/app-admin.js'];
self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(function (r) {
    return r || fetch(e.request).then(function (resp) {
      var copy = resp.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
      return resp;
    });
  }));
});
