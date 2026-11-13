'use strict';
const StorageConfig = {
  // Note: Le navigateur sandboxe le système de fichiers.
  // L'utilisateur choisit l'emplacement à chaque export.
  // On sauvegarde sa préférence pour nommer les fichiers.
  PREF_KEY: 'SMP_STORAGE_PREF_V76',

  getPrefs() {
    try { return JSON.parse(localStorage.getItem(this.PREF_KEY)||'{}'); }
    catch(_) { return {}; }
  },

  save(prefs) {
    localStorage.setItem(this.PREF_KEY, JSON.stringify({...this.getPrefs(),...prefs}));
  },

  savePrefs() {
    const prefix = document.getElementById('storage-prefix')?.value.trim() || '';
    this.save({ folderName: prefix });
    const preview = document.getElementById('storage-preview');
    if (preview) preview.textContent = (prefix||'SMP')+'_Backup_2026.json';
    UI.toast(I18n.t('toast_storage_saved'),'success');
  },

  initPreview() {
    const prefs = this.getPrefs();
    const el = document.getElementById('storage-prefix');
    if (el && prefs.folderName) el.value = prefs.folderName;
    const preview = document.getElementById('storage-preview');
    if (preview) preview.textContent = (prefs.folderName||'SMP')+'_Backup_2026.json';
  },

  // Déclenche un download avec le nom préféré
  downloadToLocation(content, filename, type='application/json') {
    const prefs = this.getPrefs();
    const prefix = prefs.folderName ? prefs.folderName + '_' : '';
    const blob = new Blob([content], {type});
    const a = document.createElement('a'); a.style.display='none';
    a.href = URL.createObjectURL(blob);
    a.download = prefix + filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }
};

/* ═══════════════════════════════════════════════════════
   MODULE: BIZ IMPORT — Import & Analyse IA de données business
   Supporte: CSV, JSON, TXT tabulaire
   Détection automatique des colonnes + analyse avancée
   ═══════════════════════════════════════════════════════ */
