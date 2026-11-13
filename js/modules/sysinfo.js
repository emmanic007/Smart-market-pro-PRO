'use strict';
const SysInfo = {
  render() {
    const c=document.getElementById('sys-info'); if(!c) return;
    const sz=new Blob([localStorage.getItem(DB.KEY)||'']).size;
    // Storage warning
    if (sz > 4*1024*1024) {
      const wEl = document.getElementById('storage-warning');
      if (!wEl) {
        const w = document.createElement('div');
        w.id = 'storage-warning';
        w.className = 'alert-item alert-danger';
        w.style.marginBottom = '12px';
        w.innerHTML = '🔴 <strong>Stockage local presque plein</strong> — '+((sz/1024/1024).toFixed(1))+'MB / 5MB. Faites un backup JSON régulièrement.';
        document.getElementById('sys-info')?.before(w);
      }
    }
    const info=[
      ['Version','Smart Market Pro v7.7'],
      ['Commerce',Settings.data.shopName||'—'],
      ['Devise',Settings.getCurrency()],
      ['Produits',`${DB.data.items.length} référence(s)`],
      ['Ventes',`${DB.activeSales().length} transaction(s)`],
      ['Utilisateurs',`${DB.data.users.length} compte(s)`],
      ['Mode','📱 Hors ligne (Local)'],
      ['Taille DB',`${(sz/1024).toFixed(1)} KB`],
      ['Dernière sauvegarde',DB.data.lastSync?new Date(DB.data.lastSync).toLocaleString('fr-FR'):'—'],
      ['Session',Auth.currentUser?`${Auth.currentUser.name} (${Auth.currentUser.role})`:'—'],
      ['Dernier backup',localStorage.getItem('SMP_LAST_BACKUP')||'—'],
    ];
    c.innerHTML=info.map(([k,v])=>`<div style="display:flex;gap:14px"><span style="color:var(--text3);min-width:130px;flex-shrink:0">${Utils.esc(k)}</span><span>${Utils.esc(String(v))}</span></div>`).join('');
  }
};

/* ═══════════════ PRINTER ═══════════════ */
