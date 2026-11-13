'use strict';
const PWA = {
  _deferredPrompt: null,
  _dismissed: false,

  init() {
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this._deferredPrompt = e;
      if (!this._dismissed && !this._isInstalled()) {
        setTimeout(() => this._showBanner(), 3000);
      }
    });
    window.addEventListener('appinstalled', () => {
      this._hideBanner();
      UI.toast(I18n.t('toast_app_installed'),'success');
      this._deferredPrompt = null;
    });
    // Bouton install dans settings si disponible
    this._updateInstallBtn();
  },

  _isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
  },

  _showBanner() {
    if (this._isInstalled()) return;
    const b = document.getElementById('pwa-banner');
    if (b) b.classList.add('show');
  },

  _hideBanner() {
    const b = document.getElementById('pwa-banner');
    if (b) b.classList.remove('show');
  },

  dismissBanner() {
    this._dismissed = true;
    this._hideBanner();
    localStorage.setItem('SMP_PWA_DISMISSED', '1');
  },

  async install() {
    if (!this._deferredPrompt) {
      UI.toast(I18n.t('toast_install_manual'),'info');
      return;
    }
    this._deferredPrompt.prompt();
    const { outcome } = await this._deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      UI.toast(I18n.t('toast_install_pending'),'success');
    }
    this._deferredPrompt = null;
    this._hideBanner();
  },

  _updateInstallBtn() {
    const btn = document.getElementById('pwa-install-btn');
    if (!btn) return;
    if (this._isInstalled()) {
      btn.textContent = '✅ Application installée';
      btn.disabled = true;
    }
  }
};

/* ═══════════════ MOB NAV DRAWER ═══════════════ */
