'use strict';
const Expenses = {
  add() {
    const desc   = document.getElementById('exp-desc')?.value.trim();
    const amount = Utils.num(document.getElementById('exp-amount')?.value);
    const cat    = document.getElementById('exp-cat')?.value || 'Autre';
    const notes  = document.getElementById('exp-notes')?.value.trim() || '';
    const date   = document.getElementById('exp-date')?.value || new Date().toISOString().slice(0,10);
    if (!desc)                    return UI.toast(I18n.t('toast_err_desc_required'),'danger');
    if (isNaN(amount)||amount<=0) return UI.toast(I18n.t('toast_err_amount_invalid'),'danger');
    if (!DB.data.expenses) DB.data.expenses = [];
    DB.data.expenses.push({
      id: Utils.uid(), desc, amount, cat, notes,
      date: new Date(date).toISOString(),
      addedBy: Auth.currentUser?.name || '',
      createdAt: new Date().toISOString()
    });
    DB.save(); this.render();
    UI.toast(`${I18n.t('toast_expense_ok')} : ${Utils.currency(amount)}`,'success');
    ['exp-desc','exp-amount','exp-notes'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
  },
  async remove(id) {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin_required'),'danger');
    if (!await SmpModal.confirm(I18n.t('modal_delete_expense_msg'), {title:I18n.t('modal_delete_expense_title'), icon:'💸', okLabel:I18n.t('modal_delete_expense_ok'), okClass:'btn-danger'})) return;
    DB.data.expenses = (DB.data.expenses||[]).filter(e => e.id !== id);
    DB.save(); this.render();
    UI.toast(I18n.t('toast_expense_deleted'),'warning');
  },
  getMonthTotal() {
    const n = new Date();
    return (DB.data.expenses||[])
      .filter(e => {
        const d = new Date(e.date);
        return d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
      })
      .reduce((t,e) => t+e.amount, 0);
  },
  getTotal() {
    return (DB.data.expenses||[]).reduce((t,e) => t+e.amount, 0);
  },
  getRealNetProfit() {
    const ca     = DB.activeSales().reduce((t,s) => t+s.total, 0);
    const bought = DB.activeSales().reduce((t,s) => t+(s.total-s.profit), 0);
    return ca - bought - this.getTotal();
  },
  render() {
    const exp = DB.data.expenses || [];
    const n   = new Date();
    const mth = this.getMonthTotal();
    const tot = this.getTotal();
    const net = this.getRealNetProfit();
    const prev = exp.filter(e => {
      const d  = new Date(e.date);
      const pm = n.getMonth()===0 ? 11 : n.getMonth()-1;
      const py = n.getMonth()===0 ? n.getFullYear()-1 : n.getFullYear();
      return d.getMonth()===pm && d.getFullYear()===py;
    }).reduce((t,e) => t+e.amount, 0);
    const trend = prev>0 ? ((mth-prev)/prev*100).toFixed(0) : null;
    const se = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    se('exp-month', Utils.currency(mth));
    se('exp-total', Utils.currency(tot));
    se('exp-net',   Utils.currency(net));
    se('exp-trend', trend!==null ? (parseFloat(trend)>=0?'+':'')+trend+'%' : 'Premier mois');
    const dateEl = document.getElementById('exp-date');
    if (dateEl && !dateEl.value) dateEl.value = n.toISOString().slice(0,10);
    const tbody = document.querySelector('#tableExpenses tbody');
    if (!tbody) return;
    if (!exp.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:32px">${I18n.t('no_expenses')}</td></tr>`;
      return;
    }
    tbody.innerHTML = exp.slice().reverse().slice(0,100).map(e => `
      <tr>
        <td class="td-mono">${new Date(e.date).toLocaleDateString('fr-FR')}</td>
        <td class="fw-700">${Utils.esc(e.desc)}${e.notes ? '<div style="font-size:.7rem;color:var(--text3)">'+Utils.esc(e.notes)+'</div>' : ''}</td>
        <td><span class="badge badge-gray">${Utils.esc(e.cat)}</span></td>
        <td class="td-mono" style="color:var(--danger)">${Utils.currency(e.amount)}</td>
        <td class="td-mono">${Utils.esc(e.addedBy||'')}</td>
        <td><button class="btn btn-danger btn-sm" onclick="Expenses.remove('${Utils.esc(e.id)}')" ${!Auth.isAdmin()?'disabled':''}>Suppr.</button></td>
      </tr>`).join('');
  }
};

/* ═══════════════ CASH REPORT ═══════════════ */
