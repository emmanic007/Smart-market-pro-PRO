'use strict';
const Alerts = {
  generate() {
    const c = document.getElementById('system-alerts'); if(!c) return;
    const alerts=[];
    const minQty = Settings.data.stockMin || 5;
    const debtThresh = Settings.data.debtThreshold || 10000;
    DB.data.items.filter(i=>i.qty<=(i.min??minQty)&&i.qty>0).forEach(i=>alerts.push({type:'warn',msg:`Stock faible : <strong>${Utils.esc(i.name)}</strong> (${i.qty} restant${i.qty>1?'s':''})`}));
    DB.data.items.filter(i=>i.qty===0).forEach(i=>alerts.push({type:'danger',msg:`Stock épuisé : <strong>${Utils.esc(i.name)}</strong>`}));
    DB.data.items.filter(i=>i.sell<i.buy).forEach(i=>alerts.push({type:'warn',msg:`Marge négative : <strong>${Utils.esc(i.name)}</strong>`}));
    const td=DB.activeSales().reduce((s,v)=>s+v.debt,0);
    if (td>debtThresh*5)  alerts.push({type:'danger',msg:`Dettes élevées : <strong>${Utils.currency(td)}</strong>`});
    else if (td>debtThresh) alerts.push({type:'warn',msg:`Dettes en cours : <strong>${Utils.currency(td)}</strong>`});
    c.innerHTML = alerts.map(a=>`<div class="alert-item alert-${a.type}">${a.type==='danger'?'🔴':'🟡'} ${a.msg}</div>`).join('');
  }
};

/* ═══════════════ DEBTS ═══════════════ */
