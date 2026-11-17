'use strict';
/* Remplit les pages légales avec js/cloud/config.js (LEGAL et BILLING). Les champs vides s'affichent en jaune. */
(function () {
  const L = typeof LEGAL !== 'undefined' ? LEGAL : {};
  const fmt = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  document.querySelectorAll('[data-opt]').forEach(el => { if (!L[el.dataset.opt]) el.hidden = true; });
  document.querySelectorAll('[data-l]').forEach(el => {
    if (el.closest('[hidden]')) return;
    const v = L[el.dataset.l];
    if (v) el.textContent = v; else { el.textContent = '[à compléter]'; el.classList.add('todo'); }
  });
  const ul = document.getElementById('prices');
  if (ul && typeof BILLING !== 'undefined') ul.innerHTML = BILLING.options.map(o => '<li><b>' + o.label + '</b> : ' + fmt(o.price) + '\u00a0' + BILLING.currency + '</li>').join('');
  const pm = document.getElementById('pay-methods');
  if (pm && typeof BILLING !== 'undefined') pm.textContent = BILLING.methods.map(m => m.name).join(', ');
})();
