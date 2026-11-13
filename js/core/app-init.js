'use strict';
window.addEventListener('DOMContentLoaded', async () => {
  // 1. DB + Paramètres
  Settings.load();
  DB.load();

  // 2. Paramètres visuels
  Settings.apply();
  Settings._updateBranding();

  // 3. I18n
  I18n._lang = Settings.data.lang || 'fr';
  I18n.apply();

  // 4. Données manquantes
  if (!DB.data.categories)      DB.data.categories      = [...Categories.defaults];
  if (!DB.data.expenses)        DB.data.expenses        = [];
  if (!DB.data.commissionsPaid) DB.data.commissionsPaid = {};
  if (!DB.data.suppliers)       DB.data.suppliers       = [];
  if (!DB.data.returns)         DB.data.returns         = [];
  if (!DB.data.loyalty)         DB.data.loyalty         = {};
  Categories.normalize();

  // 5. Modules divers
  if (typeof PWA !== 'undefined') PWA.init();
  if (typeof AutoBackup !== 'undefined') AutoBackup.start();
  if (typeof EODSummary !== 'undefined') EODSummary.schedule();
  if (typeof StorageConfig !== 'undefined') StorageConfig.initPreview();
  if (typeof AIConfig !== 'undefined') AIConfig.updateStatus();
  if (typeof RecoveryManager !== 'undefined') RecoveryManager.generateMasterCode();

  // 6. Bouton retour Android
  history.replaceState({ tab:'dashboard' }, '', '#dashboard');
  let _backPressedOnce = false, _backPressTimer = null;
  window.addEventListener('popstate', () => {
    if (!Auth.currentUser) return;
    if (UI._currentTab === 'dashboard') {
      history.pushState({ tab:'dashboard' }, '', '#dashboard');
      if (_backPressedOnce) { clearTimeout(_backPressTimer); history.go(-1); return; }
      _backPressedOnce = true;
      UI.toast(I18n.t('toast_quit_confirm'),'warning');
      _backPressTimer = setTimeout(() => { _backPressedOnce = false; }, 2000);
      return;
    }
    _backPressedOnce = false; clearTimeout(_backPressTimer);
    UI.switchTab('dashboard', true);
  });

  // 7. Timer inactivité
  ['click','touchstart','keydown','scroll'].forEach(ev => {
    document.addEventListener(ev, () => {
      if (Auth.currentUser && typeof Auth.resetInactivityTimer === 'function')
        Auth.resetInactivityTimer();
    }, {passive:true});
  });

  // 8. Démarrage — Version hors ligne : PIN local direct
  await Auth.ensureDefaultAdmin();
  Auth.renderAccountsList();
  const ov = document.getElementById('auth-overlay');
  if (ov) ov.style.display = 'flex';

  console.log('[SMP v7.7 Free] ✅ Smart Market Pro démarré (hors ligne)');
});
