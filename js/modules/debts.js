'use strict';
const Debts = {
  _current: null,
  _byClient() {
    const map={};
    DB.activeSales().filter(s=>s.debt>0).forEach(s=>{
      const cl=s.clientName||'Client #'+s.id.slice(-4);
      if(!map[cl]) map[cl]={total:0,count:0,lastDate:'',sales:[]};
      map[cl].total+=s.debt; map[cl].count++;
      if(!map[cl].lastDate||s.date>map[cl].lastDate) map[cl].lastDate=s.date;
      map[cl].sales.push(s);
    });
    return map;
  },
  render() {
    const map = this._byClient();
    const clients = Object.entries(map).sort((a,b)=>b[1].total-a[1].total);
    const total = clients.reduce((s,[,d])=>s+d.total,0);
    const max   = clients.length?clients[0][1].total:0;
    const avg   = clients.length?total/clients.length:0;
    const se=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    se('dt-total',Utils.currency(total)); se('dt-count',clients.length);
    se('dt-avg',Utils.currency(avg));     se('dt-max',Utils.currency(max));
    const tbody=document.querySelector('#tableDebts tbody'); if(!tbody) return;
    if (!clients.length) { tbody.innerHTML=`<tr><td colspan="5" style="text-align:center;color:var(--text3);padding:32px">${I18n.t('no_debts')}</td></tr>`; return; }
    tbody.innerHTML = clients.map(([name,d])=>`
      <tr style="cursor:pointer" onclick="Debts.showDetail('${Utils.esc(name)}')">
        <td class="fw-700">${Utils.esc(name)}</td>
        <td class="td-mono" style="color:var(--danger)">${Utils.currency(d.total)}</td>
        <td class="td-mono">${new Date(d.lastDate).toLocaleDateString(I18n._lang==='en'?'en-US':'fr-FR')}</td>
        <td class="td-mono">${d.count}</td>
        <td><button class="btn btn-primary btn-sm" onclick="event.stopPropagation();Debts.showDetail('${Utils.esc(name)}')">${I18n.t('lbl_view')}</button></td>
      </tr>`).join('');
  },
  showDetail(clientName) {
    this._current=clientName;
    const map=this._byClient(); const d=map[clientName]; if(!d) return;
    document.getElementById('debt-detail').style.display='block';
    document.getElementById('debt-detail-title').textContent=`${clientName} — ${Utils.currency(d.total)}`;
    const tbody=document.querySelector('#tableDebtDetail tbody');
    const locale = I18n._lang==='en'?'en-US':'fr-FR';
    tbody.innerHTML=d.sales.map(s=>`
      <tr>
        <td class="td-mono">${new Date(s.date).toLocaleDateString(locale)}</td>
        <td class="fw-700">${Utils.esc(s.itemName)}</td>
        <td class="td-mono">${Utils.currency(s.total)}</td>
        <td class="td-mono" style="color:var(--danger)">${Utils.currency(s.debt)}</td>
        <td style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="Debts.markPaid('${Utils.esc(s.id)}')">${I18n.t('lbl_paid_check')}</button>
          <button class="btn btn-ghost btn-sm" onclick="Debts.partialPay('${Utils.esc(s.id)}')" style="font-size:.65rem">${I18n.t('lbl_partial')}</button>
        </td>
      </tr>`).join('');
    document.getElementById('debt-detail').scrollIntoView({behavior:'smooth'});
  },
  closeDetail() { document.getElementById('debt-detail').style.display='none'; this._current=null; },
  markPaid(saleId) {
    const sale=DB.data.sales.find(s=>s.id===saleId); if(!sale) return;
    sale.debt=0; DB.save();
    UI.toast(I18n.t('toast_debt_paid'),'success');
    this.render(); if(this._current) this.showDetail(this._current);
  },
  markAllPaid() {
    if(!this._current) return;
    const map=this._byClient(); const d=map[this._current]; if(!d) return;
    d.sales.forEach(s=>{ const sale=DB.data.sales.find(x=>x.id===s.id); if(sale) sale.debt=0; });
    DB.save();
    UI.toast(I18n.t('toast_debts_all_paid'),'success');
    this.closeDetail(); this.render(); Analytics.refresh();
  },

  _partialSaleId: null,

  partialPay(saleId) {
    const sale = DB.data.sales.find(s => s.id === saleId);
    if (!sale || sale.debt <= 0) return;
    this._partialSaleId = saleId;
    const info = document.getElementById('smp-partial-info');
    const amt  = document.getElementById('smp-partial-amount');
    const rest = document.getElementById('smp-partial-rest');
    if (info) info.textContent = (sale.clientName || I18n.t('lbl_client')) + ' — ' + I18n.t('partial_debt_remaining') + ' : ' + Utils.currency(sale.debt);
    if (amt)  { amt.value = ''; amt.max = sale.debt; amt.oninput = () => {
      const v = Utils.num(amt.value);
      if (rest) rest.textContent = !isNaN(v) && v > 0
        ? I18n.t('partial_after_payment') + ' : ' + Utils.currency(Math.max(0, sale.debt - v))
        : '';
    }; }
    const ov = document.getElementById('smp-partial-overlay');
    if (ov) { ov.style.display = 'flex'; setTimeout(() => amt?.focus(), 100); }
  },

  closePartial() {
    const ov = document.getElementById('smp-partial-overlay');
    if (ov) ov.style.display = 'none';
    this._partialSaleId = null;
  },

  confirmPartial() {
    const sale = DB.data.sales.find(s => s.id === this._partialSaleId);
    if (!sale) { this.closePartial(); return; }
    const amount = Utils.num(document.getElementById('smp-partial-amount')?.value);
    if (isNaN(amount) || amount <= 0) return UI.toast(I18n.t('toast_err_amount_invalid'),'danger');
    if (amount > sale.debt) return UI.toast(I18n.t('toast_err_debt_over'),'danger');
    sale.debt = Math.max(0, sale.debt - amount);
    DB.save();
    UI.toast(`${I18n.t('toast_debt_payment_ok')} : ${Utils.currency(amount)}`,'success');
    this.closePartial();
    this.render();
    if (this._current) this.showDetail(this._current);
    Dashboard.refresh();
  }
};

/* ═══════════════ PIN MANAGER ═══════════════ */
