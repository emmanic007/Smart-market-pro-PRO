'use strict';
const Returns = {

  async process(saleId) {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin_required'),'danger');
    const sale = DB.data.sales.find(s => s.id === saleId);
    if (!sale || sale.deleted || sale.returned) return UI.toast(I18n.t('toast_err_sale_not_found'),'warning');
    if (!await SmpModal.confirm(`${I18n.t('modal_return_msg')}`, {title:I18n.t('modal_return_title')+' — '+sale.itemName, icon:'↩️', okLabel:I18n.t('modal_return_ok'), okClass:'btn-warning'})) return;

    sale.returned   = true;
    sale.returnDate = new Date().toISOString();
    const returnedDebt = sale.debt || 0;
    sale.debt = 0; // Annuler la dette liée à cette vente

    // Restaurer le stock
    const item = DB.data.items.find(i => i.id === sale.itemId);
    if (item) item.qty += sale.qty;

    // Déduire les points fidélité si applicable
    if (sale.clientName && typeof Loyalty !== 'undefined') {
      const pointsToDeduct = Math.floor(sale.total * Loyalty.POINTS_PER_UNIT / 100);
      if (pointsToDeduct > 0 && DB.data.loyalty && DB.data.loyalty[sale.clientName]) {
        DB.data.loyalty[sale.clientName] = Math.max(0,
          DB.data.loyalty[sale.clientName] - pointsToDeduct
        );
      }
    }

    // Enregistrer le retour dans l'historique
    if (!DB.data.returns) DB.data.returns = [];
    DB.data.returns.push({
      id:          Utils.uid(),
      date:        new Date().toISOString(),
      saleId:      sale.id,
      itemId:      sale.itemId,
      itemName:    sale.itemName,
      qty:         sale.qty,
      amount:      sale.total,
      debtCancelled: returnedDebt,
      profit:      sale.profit || 0,
      userName:    Auth.currentUser?.name || '',
      clientName:  sale.clientName || ''
    });

    DB.save();
    UI.renderAll();
    Dashboard.refresh();
    UI.toast(`${I18n.t('toast_return_ok')}${returnedDebt > 0 ? ' ' + I18n.t('toast_return_debt_cancelled') + ' : ' + Utils.currency(returnedDebt) : ''}`,'success');
    this.render();
  },

  render() {
    const tbody = document.querySelector('#tableReturns tbody');
    if (!tbody) return;
    const returns = DB.data.returns || [];

    // KPIs
    const totalReturned   = returns.reduce((t,r) => t + r.amount, 0);
    const totalDebtCancel = returns.reduce((t,r) => t + (r.debtCancelled || 0), 0);
    const profitLost      = returns.reduce((t,r) => t + (r.profit || 0), 0);
    const today = new Date().toDateString();
    const todayRet = returns.filter(r => new Date(r.date).toDateString() === today);
    const todayAmt = todayRet.reduce((t,r) => t + r.amount, 0);

    const se = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    se('returns-total',      Utils.currency(totalReturned));
    se('returns-count',      returns.length);
    se('returns-today',      Utils.currency(todayAmt));
    se('returns-debt-cancel',Utils.currency(totalDebtCancel));

    if (!returns.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text3);padding:32px">${I18n.t('no_returns')}</td></tr>`;
      return;
    }
    tbody.innerHTML = returns.slice().reverse().slice(0,100).map(r => `
      <tr>
        <td class="td-mono" style="font-size:.72rem">${new Date(r.date).toLocaleDateString('fr-FR')}</td>
        <td class="fw-700">${Utils.esc(r.itemName)}</td>
        <td class="td-mono">${r.qty}</td>
        <td class="td-mono" style="color:var(--danger)">${Utils.currency(r.amount)}</td>
        <td>${r.debtCancelled > 0 ? '<span style="color:var(--warning);font-size:.7rem">−' + Utils.currency(r.debtCancelled) + ' dette</span>' : '—'}</td>
        <td>${Utils.esc(r.clientName || '—')}</td>
        <td><span class="badge badge-yellow">↩ Retourné</span></td>
      </tr>`).join('');
  }
};

/* ═══════════════════════════════════════════════════════
   MODULE: LOYALTY — Programme de fidélité clients
   ═══════════════════════════════════════════════════════ */
