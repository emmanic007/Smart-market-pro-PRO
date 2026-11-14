window.__SMP_BOOT_HASH = location.hash;   // adresse d'arrivée (lien « mot de passe oublié »), lue avant que l'app ne la modifie
/* ── Chargement CDN non-bloquant + Service Worker PWA ── */
(function(){
  function loadScript(src, onload, onerror){ var s=document.createElement('script'); s.src=src; s.async=true; s.onload=onload||null; s.onerror=onerror||null; document.head.appendChild(s); }
  loadScript('https://cdn.jsdelivr.net/npm/chart.js', null, function(){ window.Chart=null; console.warn('[SMP] Chart.js non disponible - mode hors ligne'); });
  loadScript('https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js', function(){ console.log('[SMP] SheetJS chargé'); }, function(){ console.warn('[SMP] SheetJS non disponible - export CSV fallback'); });

  // ── Service Worker — fichier séparé sw.js (compatible tous navigateurs) ──
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('./sw.js', {scope: './'})
        .then(function(reg) {
          (console.log||function(){})('[SMP] Service Worker OK — version smp-pro-v1');
          // Vérifier les mises à jour toutes les 60 minutes
          setInterval(function(){ reg.update(); }, 60 * 60 * 1000);
        })
        .catch(function(err) {
          // Silencieux — l'app fonctionne sans SW (localStorage actif)
          (console.log||function(){})('[SMP] SW non disponible — mode localStorage');
        });
    });
  }
})();
/* ── PWA — Service Worker externe (sw.js) + localStorage hors ligne ──
   SW enregistré depuis ./sw.js (fichier séparé sur GitHub Pages).
   L'app fonctionne hors ligne via localStorage + cache SW.       ── */
console.log('[SMP PWA] Mode localStorage + Service Worker ./sw.js');
