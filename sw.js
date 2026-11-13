/* Smart Market Pro — Service Worker (version PRO)
   Si tu ajoutes ou renommes un fichier JS/CSS, mets-le dans APP_SHELL
   ET change CACHE_VERSION pour forcer la mise à jour chez les utilisateurs. */
const CACHE_VERSION = 'smp-pro-v3';
const CDN_HOSTS = ['cdn.jsdelivr.net'];            // Chart.js, SheetJS : mémorisés pour le hors ligne
const APP_SHELL = [
  './',
  './index.html',
  './css/main.css',
  './css/seller-mode.css',
  './js/core/boot.js',
  './css/cloud.css',
  './js/cloud/config.js',
  './js/cloud/cloud-auth.js',
  './js/core/utils.js',
  './js/core/i18n.js',
  './js/core/ui.js',
  './js/modules/sales.js',
  './js/modules/stock.js',
  './js/modules/analytics.js',
  './js/modules/alerts.js',
  './js/modules/debts.js',
  './js/modules/pinmanager.js',
  './js/modules/users.js',
  './js/modules/excelexport.js',
  './js/modules/datamanager.js',
  './js/modules/sysinfo.js',
  './js/modules/printer.js',
  './js/modules/aiadvanced.js',
  './js/modules/categories.js',
  './js/modules/suppliers.js',
  './js/modules/returns.js',
  './js/modules/loyalty.js',
  './js/modules/objectives.js',
  './js/modules/share.js',
  './js/modules/restockreport.js',
  './js/modules/storageconfig.js',
  './js/modules/bizimport.js',
  './js/modules/aiconfig.js',
  './js/modules/deferredsales.js',
  './js/modules/sellerdash.js',
  './js/modules/eodsummary.js',
  './js/modules/history.js',
  './js/modules/expenses.js',
  './js/modules/cashreport.js',
  './js/modules/commissions.js',
  './js/modules/sellermode.js',
  './js/modules/recoverymanager.js',
  './js/modules/guide.js',
  './js/modules/dashboard.js',
  './js/core/settings.js',
  './js/modules/autobackup.js',
  './js/core/db.js',
  './js/core/auth.js',
  './js/core/pwa.js',
  './js/core/mobnav.js',
  './js/core/onboarding.js',
  './js/core/smpmodal.js',
  './js/core/navdesktop.js',
  './js/core/app-init.js'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_VERSION).then(c => c.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (CDN_HOSTS.includes(url.hostname)) {                // librairies : réseau d'abord, sinon copie mémorisée
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }
  if (url.origin !== location.origin) return;           // Google Fonts, Supabase : réseau direct
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
