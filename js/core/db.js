'use strict';
const DB = {
  KEY: 'SMP_DB_V77',
  data: null,
  defaultSchema() { return {version:'7.7',items:[],sales:[],users:[],cashInit:0,lastSync:null,expenses:[],returns:[],loyalty:{},commissionsPaid:{},suppliers:[],categories:[],shopId:null,ownerId:null}; },
  load() {
    try {
      // Migration transparente : cherche d'abord la clé courante, puis toutes les anciennes
      const LEGACY_KEYS = ['SMP_DB_V76','SMP_DB_V75', 'SMP_DB_V72', 'SMP_DB_V71', 'SMP_DB_V70'];
      let r = localStorage.getItem(this.KEY);
      if (!r) {
        for (const lk of LEGACY_KEYS) {
          const lr = localStorage.getItem(lk);
          if (lr) { r = lr; console.log('[DB] Migration depuis', lk); break; }
        }
      }
      if (!r) { this.data = this.defaultSchema(); return; }
      const p = JSON.parse(r);
      this.data = {
        ...this.defaultSchema(), ...p,
        items:              Array.isArray(p.items)    ? p.items    : [],
        sales:              Array.isArray(p.sales)    ? p.sales    : [],
        users:              Array.isArray(p.users)    ? p.users    : [],
        expenses:           Array.isArray(p.expenses) ? p.expenses : [],
        returns:            Array.isArray(p.returns)  ? p.returns  : [],
        commissionsPaid:    p.commissionsPaid || {},
        loyalty:            p.loyalty         || {},
        suppliers:          Array.isArray(p.suppliers)   ? p.suppliers   : [],
        categories:         Array.isArray(p.categories)  ? p.categories  : [],
      };
      this.data.version = '7.7';
      // Sauvegarder immédiatement dans la nouvelle clé
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch(e) { console.error('[DB]',e); this.data=this.defaultSchema(); }
  },
  save() {
    try {
      this.data.lastSync = new Date().toISOString();
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch(e) { try { UI.toast(I18n.t('toast_err_storage_low'),'danger'); } catch(_) { console.error('[DB] save:',e); } }
  },
  activeSales() { return this.data.sales.filter(s=>!s.deleted && !s.returned); },
  salesInPeriod(p) { const start=Utils.periodStart(p); return this.activeSales().filter(s=>new Date(s.date).getTime()>=start); }
};

/* ═══════════════ AUTH ═══════════════ */
