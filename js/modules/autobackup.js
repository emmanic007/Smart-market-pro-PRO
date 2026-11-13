'use strict';
const AutoBackup = {
  _timer: null,
  INTERVAL: 60*60*1000,
  start() {
    if (!Settings.data.autoBackup) return;
    this._timer = setInterval(() => this._do(), this.INTERVAL);
    window.addEventListener('beforeunload', () => { if(Settings.data.backupOnUnload) this._do(true); });
  },
  restart() { clearInterval(this._timer); this.start(); },
  _do(silent=false) {
    try {
      const payload = { exported:new Date().toISOString(), version:'7.7', auto:true, data:DB.data };
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}));
      a.download = `SMP_Auto_${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(a.href);
      const ts = new Date().toLocaleString('fr-FR');
      localStorage.setItem('SMP_LAST_BACKUP', ts);
      const el = document.getElementById('last-backup-time'); if(el) el.textContent=ts;
    } catch(e) { console.error('[AutoBackup]', e); }
  }
};
