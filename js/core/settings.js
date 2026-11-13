'use strict';
const Settings = {
  KEY: 'SMP_SETTINGS_V76',
  data: {},
  defaults() {
    return { shopName:'', shopPhone:'', currency:'F', lang:'fr', lightMode:false,
      accentColor:'#00e87a', accentColor2:'#00b85e', fontSize:16,
      confirmSale:false, warnMargin:true, resetQty:true, debtThreshold:10000,
      autoBackup:true, backupOnUnload:true, stockMin:5,
      eodEnabled:true, eodHour:20, eodMinute:0,
      commissionsEnabled:false, commissionsBase:'profit' };
  },
  load() {
    try {
      const r = localStorage.getItem(this.KEY);
      if (!r) { this.data = this.defaults(); return; }
      const parsed = JSON.parse(r);
      const defs   = this.defaults();
      // Merge propre : les clés présentes dans parsed écrasent les defaults
      // y compris les booléens false (évite le bug du spread)
      this.data = Object.assign({}, defs);
      for (const key of Object.keys(parsed)) {
        if (parsed[key] !== undefined) this.data[key] = parsed[key];
      }
    } catch(_) { this.data = this.defaults(); }
  },
  save() { localStorage.setItem(this.KEY, JSON.stringify(this.data)); },
  getCurrency() { return this.data.currency || 'F'; },
  apply() {
    document.documentElement.style.setProperty('--accent', this.data.accentColor||'#00e87a');
    document.documentElement.style.setProperty('--acc2',   this.data.accentColor2||'#00b85e');
    document.documentElement.style.setProperty('--glow',   `0 0 30px ${this.data.accentColor||'#00e87a'}40`);
    document.body.classList.toggle('theme-light', !!this.data.lightMode);
    document.documentElement.style.fontSize = (this.data.fontSize||16) + 'px';
    this._updateBranding();
    this._fillForm();
    // Set lang tabs
    document.getElementById('lang-fr')?.classList.toggle('active', (this.data.lang||'fr')==='fr');
    document.getElementById('lang-en')?.classList.toggle('active', this.data.lang==='en');
    // Show master code if element exists
    const mcd=document.getElementById('master-code-display');
    if(mcd) setTimeout(()=>{mcd.textContent=RecoveryManager.getMasterCode()||'—';},100);
  },
  _updateBranding() {
    const name  = this.data.shopName;
    const brand = name || 'Smart Market Pro';
    const short = name ? name.substring(0,12) : 'SMP';
    const authBrand = document.getElementById('auth-brand');
    if (authBrand) authBrand.textContent = brand;
    const nb=document.getElementById('nav-brand'); if(nb) nb.textContent=brand;
    const mb=document.getElementById('mob-brand'); if(mb) mb.textContent=short;
    document.title = brand + ' | v7.7';
  },
  _fillForm() {
    const s=this.data;
    const se=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v;};
    const sc=(id,v)=>{const el=document.getElementById(id);if(el)el.checked=!!v;};
    se('set-shop-name',s.shopName); se('set-shop-phone',s.shopPhone); se('set-currency',s.currency);
    sc('set-light-mode',s.lightMode); se('set-font-size',s.fontSize);
    sc('set-confirm-sale',s.confirmSale); sc('set-warn-margin',s.warnMargin); sc('set-reset-qty',s.resetQty);
    se('set-debt-threshold',s.debtThreshold); sc('set-auto-backup',s.autoBackup); sc('set-backup-unload',s.backupOnUnload);
    const eodHr = document.getElementById('set-eod-hour');   if (eodHr)  eodHr.value  = s.eodHour   ?? 20;
    const eodMn = document.getElementById('set-eod-minute'); if (eodMn)  eodMn.value  = s.eodMinute ?? 0;
    const eodEn = document.getElementById('set-eod-enabled');if (eodEn)  eodEn.checked = s.eodEnabled !== false;
    const commEn = document.getElementById('set-comm-enabled'); if (commEn) commEn.checked = s.commissionsEnabled === true;
    const commBs = document.getElementById('set-comm-base');    if (commBs) commBs.value   = s.commissionsBase || 'profit';
    const lb=localStorage.getItem('SMP_LAST_BACKUP'); const el=document.getElementById('last-backup-time'); if(el&&lb) el.textContent=lb;
    document.querySelectorAll('.swatch').forEach(sw=>sw.classList.toggle('active',sw.dataset.color===s.accentColor));
    const mcd=document.getElementById('master-code-display'); if(mcd) mcd.textContent=RecoveryManager.getMasterCode()||'—';
  },
  setAccent(el) {
    const c=el.dataset.color, c2=el.dataset.acc2||c;
    this.data.accentColor=c; this.data.accentColor2=c2;
    document.documentElement.style.setProperty('--accent',c);
    document.documentElement.style.setProperty('--acc2',c2);
    document.documentElement.style.setProperty('--glow',`0 0 30px ${c}40`);
    document.querySelectorAll('.swatch').forEach(sw=>sw.classList.remove('active'));
    el.classList.add('active'); this.save();
    UI.toast(I18n.t('toast_color_applied'),'success');
  },
  applyTheme()    { this.data.lightMode=document.getElementById('set-light-mode')?.checked||false; document.body.classList.toggle('theme-light',this.data.lightMode); this.save(); },
  setTheme(mode) {
    this.data.lightMode = (mode === 'light');
    document.body.classList.toggle('theme-light', this.data.lightMode);
    this.save();
    // Mettre à jour le toggle dans les paramètres si visible
    const cb = document.getElementById('set-light-mode');
    if (cb) cb.checked = this.data.lightMode;
    UI.toast(mode==='light' ? (I18n._lang==='fr' ? '☀️ Thème clair activé' : '☀️ Light theme') : (I18n._lang==='fr' ? '🌙 Thème sombre activé' : '🌙 Dark theme'),'success');
  },
  applyFontSize() { const sz=Utils.int(document.getElementById('set-font-size')?.value)||16; this.data.fontSize=sz; document.documentElement.style.fontSize=sz+'px'; this.save(); },
  setLang(lang)   { I18n.setLang(lang); },
  saveIdentity()  { this.data.shopName=document.getElementById('set-shop-name')?.value.trim()||''; this.data.shopPhone=document.getElementById('set-shop-phone')?.value.trim()||''; this.data.currency=document.getElementById('set-currency')?.value||'F'; this._updateBranding(); this.save(); UI.toast(I18n.t('toast_identity_saved'),'success'); },
  saveBehavior()  { this.data.confirmSale=document.getElementById('set-confirm-sale')?.checked||false; this.data.warnMargin=document.getElementById('set-warn-margin')?.checked||false; this.data.resetQty=document.getElementById('set-reset-qty')?.checked||false; this.data.debtThreshold=Utils.num(document.getElementById('set-debt-threshold')?.value)||10000; this.data.eodEnabled=document.getElementById('set-eod-enabled')?.checked||false; this.data.eodHour=Utils.int(document.getElementById('set-eod-hour')?.value)||20; this.data.eodMinute=Utils.int(document.getElementById('set-eod-minute')?.value)||0; this.save(); EODSummary.schedule(); UI.toast(I18n.t('toast_settings_saved'),'success'); },
  saveCommissions() {
    this.data.commissionsEnabled = document.getElementById('set-comm-enabled')?.checked || false;
    this.data.commissionsBase    = document.getElementById('set-comm-base')?.value || 'profit';
    this.save();
    UI.toast(I18n.t('toast_comm_settings_saved'),'success');
    // Masquer/afficher l'onglet commissions dans le drawer selon l'état
    Commissions.render();
  },
  toggleAutoBackup() { this.data.autoBackup=document.getElementById('set-auto-backup')?.checked||false; this.save(); AutoBackup.restart(); },
  async resetSettings() { if(!await SmpModal.confirm(I18n.t('modal_reset_settings_msg'), {title:I18n.t('modal_reset_settings_title'), icon:'🔄', okLabel:I18n.t('modal_reset_settings_ok'), okClass:'btn-warning'})) return; this.data=this.defaults(); this.save(); this.apply(); UI.toast(I18n.t('toast_settings_reset'),'warning'); }
};

/* ═══════════════ AUTO-BACKUP ═══════════════ */
