'use strict';
const Onboarding = {
  KEY: 'SMP_ONBOARDING_DONE_V76',

  shouldShow() {
    // Si l'app vient d'un hard reset (URL ?reset=...), forcer l'onboarding
    if (location.search && location.search.includes('reset=')) {
      localStorage.removeItem(this.KEY);
      // Nettoyer l'URL sans recharger
      try { history.replaceState({}, '', location.pathname); } catch(_) {}
    }
    // Migration : si V75 existait, ne pas ré-afficher l'onboarding
    const legacy = localStorage.getItem('SMP_ONBOARDING_DONE_V75');
    if (legacy && !localStorage.getItem(this.KEY)) {
      localStorage.setItem(this.KEY, '1');
    }
    return !localStorage.getItem(this.KEY);
  },

  show() {
    const ov = document.getElementById('onboarding-overlay');
    if (ov) { ov.style.display = 'flex'; this._showStep(1); }
  },

  _showStep(n) {
    [1,2,3].forEach(i => {
      const el = document.getElementById('ob-step-' + i);
      if (el) el.style.display = i === n ? '' : 'none';
    });
  },

  backTo(n) { this._showStep(n); },

  step2() {
    const name = document.getElementById('ob-shop-name')?.value.trim();
    if (!name) { UI.toast(I18n.t('toast_err_enter_shop_name'),'danger'); return; }
    this._showStep(2);
  },

  step3() {
    this._showStep(3);
  },

  async finish(skipPin) {
    const name  = document.getElementById('ob-shop-name')?.value.trim() || 'Ma Boutique';
    const phone = document.getElementById('ob-phone')?.value.trim() || '';
    const curr  = document.getElementById('ob-currency')?.value || 'FCFA';
    const lang  = document.getElementById('ob-lang')?.value || 'fr';

    // Enregistrer les réglages de base
    Settings.data.shopName  = name;
    Settings.data.shopPhone = phone;
    Settings.data.currency  = curr;
    Settings.data.lang      = lang;
    Settings.save();
    Settings.apply();
    Settings._updateBranding();
    I18n._lang = lang;
    I18n.apply();

    if (!skipPin) {
      const pin  = document.getElementById('ob-pin')?.value;
      const pin2 = document.getElementById('ob-pin2')?.value;
      const errEl = document.getElementById('ob-error');

      if (pin && pin.length === 4 && /^\d{4}$/.test(pin)) {
        if (pin !== pin2) {
          if (errEl) errEl.textContent = I18n.t('toast_err_pin_match2');
          return;
        }
        // Mettre à jour le PIN de l'admin
        const newHash = await Utils.sha256(pin);
        const admin = DB.data.users.find(u => u.role === 'admin');
        if (admin) {
          admin.pinHash = newHash;
          DB.save();
          UI.toast(I18n.t('toast_pin_updated'),'success');
        }
      } else if (pin && pin.length > 0) {
        if (errEl) errEl.textContent = I18n.t('toast_err_pin_4digits');
        return;
      }
    }

    // Marquer onboarding terminé
    localStorage.setItem(this.KEY, '1');

    const ov = document.getElementById('onboarding-overlay');
    if (ov) ov.style.display = 'none';

    UI.toast(`${I18n.t('toast_welcome_new')}, ${name} !`,'success');
    Auth.renderAccountsList();
  }
};

/* ═══════════════ SMP MODAL (remplace confirm / prompt natifs) ═══════════════ */
