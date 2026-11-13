'use strict';
const DataManager = {
  downloadBackup() {
    const payload={exported:new Date().toISOString(),version:'7.7',exportedBy:Auth.currentUser?.name||'?',data:DB.data};
    const prefs=StorageConfig.getPrefs();
    const prefix=prefs.folderName?prefs.folderName+'_':'SMP_';
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
    a.download=`${prefix}Backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    const ts=new Date().toLocaleString('fr-FR'); localStorage.setItem('SMP_LAST_BACKUP',ts);
    const el=document.getElementById('last-backup-time'); if(el) el.textContent=ts;
    UI.toast(I18n.t('toast_backup_ok'),'success');
  },
  downloadCSV() {
    const sales = DB.activeSales();
    const curr  = Settings.getCurrency();
    const rows  = [
      [I18n.t('th_date'),I18n.t('th_time'),I18n.t('th_seller'),I18n.t('th_product'),I18n.t('th_qty'),I18n.t('th_price'),I18n.t('th_total'),I18n.t('debt_lbl'),I18n.t('th_client'),I18n.t('th_status')],
      ...sales.map(s=>[
        new Date(s.date).toLocaleDateString('fr-FR'),
        new Date(s.date).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'}),
        s.userName,s.itemName,s.qty,s.price+' '+curr,s.total+' '+curr,
        s.debt+' '+curr,s.clientName||'',s.debt>0?I18n.t('debt_lbl'):I18n.t('sold')
      ])
    ];
    const BOM = '\uFEFF';
    const csvRows = rows.map(function(r){return r.map(function(v){var s=String(v==null?'':v);return s.indexOf(',')>=0||s.indexOf('"')>=0?'"'+s.replace(/"/g,'""')+'"':s;}).join(',');}).join('\r\n');
    const csv = BOM + csvRows;
    const prefs = StorageConfig.getPrefs();
    const prefix = prefs.folderName ? prefs.folderName+'_' : 'SMP_';
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));
    a.download=`${prefix}Ventes_${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(a.href);
    UI.toast(I18n.t('toast_export_csv'),'success');
  },

  importBackup(event) {
    const file=event.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=async e=>{
      try {
        const p=JSON.parse(e.target.result); const data=p.data||p;
        if (!Array.isArray(data.items)||!Array.isArray(data.sales)||!Array.isArray(data.users)) throw new Error();
        if (!await SmpModal.confirm(I18n.t('modal_import_backup_msg'), {title:I18n.t('modal_import_backup_title'), icon:'📂', okLabel:I18n.t('modal_import_backup_ok'), okClass:'btn-warning'})) return;
        DB.data={...DB.defaultSchema(),...data,items:data.items,sales:data.sales,users:data.users};
        DB.save(); UI.renderAll();
        UI.toast(I18n.t('toast_backup_imported'),'success');
      } catch(_) { UI.toast(I18n.t('toast_err_file_invalid'),'danger'); }
    };
    reader.readAsText(file); event.target.value='';
  },
  // ── Toutes les clés localStorage connues de l'app ──
  ALL_KEYS: [
    'SMP_DB_V77','SMP_DB_V76','SMP_DB_V75','SMP_DB_V72','SMP_DB_V71','SMP_DB_V70',
    'SMP_SETTINGS_V76','SMP_SETTINGS_V75',
    'SMP_CLOUD_CFG_V76','SMP_CLOUD_CFG_V75',
    'SMP_SERVER_CFG_V76','SMP_SERVER_CFG_V75',
    'SMP_AI_CFG_V76','SMP_AI_CFG_V73','SMP_AI_CFG_V72',
    'SMP_AI_MEMORY_V76','SMP_AI_STATS_V76',
    'SMP_STORAGE_PREF_V76',
    'SMP_COMM_V76','SMP_COMM_V73',
    'SMP_MASTER_V76','SMP_MASTER_V72','SMP_MASTER_V71',
    'SMP_ONBOARDING_DONE_V76','SMP_ONBOARDING_DONE_V75',
    'SMP_LAST_BACKUP',
  ],

  // ── Hard Reset : efface TOUT, repart à zéro ──
  async resetSystem() {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin_required'),'danger');

    // Étape 1 : confirmation modale
    if (!await SmpModal.confirm(I18n.t('modal_reset_system_msg'), {
      title: I18n.t('modal_reset_system_title'),
      icon: '🚨', okLabel: I18n.t('modal_reset_system_ok'), okClass: 'btn-danger'
    })) return;

    // Étape 2 : confirmation par mot-clé
    const shopName = (Settings.data.shopName || 'SUPPRIMER').toUpperCase();
    const keyword  = shopName || 'SUPPRIMER';
    const confirmed = await new Promise(resolve => {
      SmpModal.prompt({
        title: I18n._lang === 'en' ? '⚠️ Final Confirmation' : '⚠️ Confirmation Finale',
        message: I18n._lang === 'en'
          ? `Type <strong>${keyword}</strong> to confirm total deletion of all data.`
          : `Tapez <strong>${keyword}</strong> pour confirmer la suppression totale.`,
        placeholder: keyword,
        okLabel: I18n._lang === 'en' ? 'Delete everything' : 'Tout supprimer',
        okClass: 'btn-danger',
        validate: v => v.trim().toUpperCase() === keyword,
        onConfirm: () => resolve(true),
        onCancel:  () => resolve(false),
      });
    });
    if (!confirmed) return UI.toast(I18n._lang === 'en' ? 'Reset cancelled' : 'Réinitialisation annulée','warning');

    // Étape 3 : backup auto avant suppression
    try {
      const payload = {exported:new Date().toISOString(),version:'7.7',auto:true,preReset:true,data:DB.data};
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
      a.download = 'SMP_PreReset_Backup_'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch(_) {}

    // Étape 4 : effacer TOUTES les clés connues + scan complet
    this.ALL_KEYS.forEach(k => localStorage.removeItem(k));
    // Scan de sécurité : supprimer toute clé résiduelle SMP_
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('SMP_'))
        .forEach(k => localStorage.removeItem(k));
    } catch(_) {}

    // Étape 5 : rechargement propre
    UI.toast(I18n._lang === 'en' ? '✅ Reset complete — restarting...' : '✅ Réinitialisation terminée — redémarrage...','success');
    setTimeout(() => {
      try { location.href = location.pathname + '?reset=' + Date.now(); }
      catch(_) { location.reload(true); }
    }, 1200);
  },

  // ── Soft Reset : garde config boutique, efface données commerciales ──
  async resetDataOnly() {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin_required'),'danger');
    if (!await SmpModal.confirm(
      I18n._lang === 'en'
        ? 'Delete all sales, stock, debts and expenses? Settings and accounts will be kept.'
        : 'Supprimer toutes les ventes, le stock, les dettes et les dépenses ? Les paramètres et comptes seront conservés.',
      { title: I18n._lang === 'en' ? '🧹 Reset commercial data' : '🧹 Réinitialiser les données commerciales',
        icon: '🧹', okLabel: I18n._lang === 'en' ? 'Delete data' : 'Supprimer les données', okClass: 'btn-warning' }
    )) return;

    // Backup avant
    try {
      const payload = {exported:new Date().toISOString(),version:'7.7',auto:true,softReset:true,data:DB.data};
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
      a.download = 'SMP_PreSoftReset_'+new Date().toISOString().slice(0,10)+'.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch(_) {}

    // Effacer uniquement les données commerciales
    DB.data.items     = [];
    DB.data.sales     = [];
    DB.data.expenses  = [];
    DB.data.returns   = [];
    DB.data.loyalty   = {};
    DB.data.suppliers = [];
    DB.data.commissionsPaid = {};
    DB.data.lastSync  = null;
    DB.save();

    UI.toast(I18n._lang === 'en' ? '✅ Commercial data deleted — settings kept' : '✅ Données commerciales supprimées — paramètres conservés','success');
    setTimeout(() => location.reload(), 1000);
  },
};

/* ═══════════════ SYS INFO ═══════════════ */
