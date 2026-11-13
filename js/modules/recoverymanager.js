'use strict';
const RecoveryManager = {
  MASTER_KEY: 'SMP_MASTER_V76',

  /* Génère et stocke le code maître à la première utilisation */
  generateMasterCode() {
    // Migration depuis ancienne clé
    const legacy = localStorage.getItem('SMP_MASTER_V72') || localStorage.getItem('SMP_MASTER_V71');
    if (legacy && !localStorage.getItem(this.MASTER_KEY)) {
      localStorage.setItem(this.MASTER_KEY, legacy);
      return legacy;
    }
    const existing = localStorage.getItem(this.MASTER_KEY);
    if (existing) return existing;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'SMP-';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    localStorage.setItem(this.MASTER_KEY, code);
    return code;
  },

  getMasterCode() { return localStorage.getItem(this.MASTER_KEY); },

  show() {
    const modal = document.getElementById('recovery-modal');
    if (modal) { modal.style.display = 'flex'; }
    const input = document.getElementById('master-code-input');
    if (input) { input.value = ''; input.focus(); }
    const err = document.getElementById('recovery-error');
    if (err) err.textContent = '';
  },

  hide() {
    const modal = document.getElementById('recovery-modal');
    if (modal) modal.style.display = 'none';
  },

  async verify() {
    const input = document.getElementById('master-code-input')?.value.trim().toUpperCase();
    const err   = document.getElementById('recovery-error');
    const master = this.getMasterCode();

    if (!input) { if(err) err.textContent = I18n.t('toast_err_master_empty'); return; }
    if (input !== master) { if(err) err.textContent = I18n.t('toast_err_master_wrong'); return; }

    // Reset all PINs to 0000 and grant access as first admin
    const hash0000 = await Utils.sha256('0000');
    const admin    = DB.data.users.find(u => u.role === 'admin');
    if (admin) {
      admin.pinHash = hash0000;
      DB.save();
    }
    this.hide();
    UI.toast(I18n.t('toast_pin_reset'),'warning');
    // Auto-login complet
    Auth.currentUser = admin;
    try { localStorage.setItem('SMP_PIN_LOCK', JSON.stringify({a:0,u:0})); } catch(_) {}
    document.getElementById('auth-overlay').style.display = 'none';
    if (admin.role === 'admin') document.querySelectorAll('.admin-only').forEach(el => el.classList.add('admin-visible'));
    const navU = document.getElementById('nav-username'); if(navU) navU.textContent = admin.name;
    const mobU = document.getElementById('mob-username'); if(mobU) mobU.textContent = admin.name;
    UI.renderAll();
    Dashboard.refresh();
    if (typeof EODSummary !== 'undefined') EODSummary.schedule();
  }
};

/* ═══════════════ GUIDE D'UTILISATION ═══════════════ */
