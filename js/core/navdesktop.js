'use strict';
const NavDesktop = {
  _isOpen: false,

  toggle() {
    this._isOpen ? this.close() : this.open();
  },

  open() {
    const dd  = document.getElementById('nav-dropdown');
    const btn = document.getElementById('nav-more-btn');
    if (dd)  dd.classList.add('open');
    if (btn) btn.classList.add('open');
    this._isOpen = true;
    // Fermer au prochain clic en dehors
    setTimeout(() => {
      document.addEventListener('click', this._handleOutside, { once: true });
    }, 10);
  },

  close() {
    const dd  = document.getElementById('nav-dropdown');
    const btn = document.getElementById('nav-more-btn');
    if (dd)  dd.classList.remove('open');
    if (btn) btn.classList.remove('open');
    this._isOpen = false;
    document.removeEventListener('click', this._handleOutside);
  },

  _handleOutside(e) {
    const wrap = document.getElementById('nav-more-wrap');
    // Si le clic est dans le wrap (bouton Plus), toggle() s'en charge
    if (wrap && wrap.contains(e.target)) return;
    NavDesktop.close();
  },

  go(tabId) {
    this.close();
    UI.switchTab(tabId);
  }
};

/* ═══════════════ PWA ═══════════════ */
