'use strict';
const Sales = {
  toggleDiscount() {
    const wrap   = document.getElementById('s-discount-wrap');
    const toggle = document.getElementById('s-discount-toggle');
    const priceEl = document.getElementById('s-price');
    if (!wrap) return;
    const isOpen = wrap.style.display !== 'none';
    wrap.style.display = isOpen ? 'none' : '';
    if (toggle) toggle.textContent = isOpen ? '± Modifier le prix' : '✕ Annuler modification';
    if (!isOpen) {
      // Pré-remplir le prix réel avec le prix du stock
      const realEl = document.getElementById('s-real-price');
      if (realEl && priceEl) realEl.value = priceEl.value;
      setTimeout(() => document.getElementById('s-real-price')?.focus(), 50);
    } else {
      // Réinitialiser
      const realEl = document.getElementById('s-real-price');
      const reasonEl = document.getElementById('s-discount-reason');
      if (realEl) realEl.value = '';
      if (reasonEl) reasonEl.value = '';
    }
    this.validate();
  },

  syncFields() {
    const item = DB.data.items.find(i=>i.id===document.getElementById('s-item')?.value);
    if (item) {
      const priceEl = document.getElementById('s-price');
      if (priceEl) priceEl.value = item.sell;
      // S'assurer que la quantité est au moins 1
      const qtyEl = document.getElementById('s-qty');
      if (qtyEl && (!qtyEl.value || parseInt(qtyEl.value) <= 0)) qtyEl.value = '1';
    }
    this.validate();
  },
  setFullCredit() {
    const pEl = document.getElementById('s-paid');
    if (pEl) { pEl.value = '0'; this.validate(); UI.toast(I18n.t('toast_full_credit_set'), 'warning'); }
  },
  validate() {
    const id    = document.getElementById('s-item')?.value;
    const qty   = Utils.int(document.getElementById('s-qty')?.value) || 0;
    const basePrice = Utils.num(document.getElementById('s-price')?.value);
    // Prix réel = prix négocié si champ visible, sinon prix du stock
    const realPriceEl = document.getElementById('s-real-price');
    const discountOpen = document.getElementById('s-discount-wrap')?.style.display !== 'none';
    const price = (discountOpen && realPriceEl && realPriceEl.value !== '') ? Utils.num(realPriceEl.value) : basePrice;
    const item  = DB.data.items.find(i=>i.id===id);
    const btn   = document.getElementById('btn-do-sale');
    const warn  = document.getElementById('sale-warning');
    const prev  = document.getElementById('sale-total-preview');
    const invalid = !item||isNaN(qty)||qty<=0||qty>item.qty||isNaN(price)||price<0;
    if (btn) btn.disabled = invalid;
    if (invalid) { if(warn)warn.style.display='none'; if(prev)prev.innerHTML=''; return; }
    if (warn) warn.style.display = (Settings.data.warnMargin && price<item.buy) ? 'block' : 'none';
    const total = price * qty;
    if (prev) prev.innerHTML = `Total : <strong style="color:var(--accent);margin-left:5px">${Utils.currency(total)}</strong>`;
    // Rendu monnaie
    const paidRaw   = document.getElementById('s-paid')?.value;
    const changeWrap = document.getElementById('s-change-wrap');
    const changeDisp = document.getElementById('s-change-display');
    if (changeWrap && changeDisp && paidRaw !== '' && paidRaw != null) {
      const paid   = Utils.num(paidRaw);
      const change = paid - total;
      if (!isNaN(paid) && paid > 0) {
        changeWrap.style.display = '';
        if (change >= 0) {
          changeDisp.textContent      = 'Rendre : ' + Utils.currency(change);
          changeDisp.style.color       = 'var(--accent)';
          changeDisp.style.borderColor = 'var(--accent)';
          changeDisp.style.background  = 'rgba(0,232,122,.08)';
        } else {
          changeDisp.textContent      = 'Reste a payer : ' + Utils.currency(Math.abs(change));
          changeDisp.style.color       = 'var(--danger)';
          changeDisp.style.borderColor = 'var(--danger)';
          changeDisp.style.background  = 'rgba(255,59,92,.08)';
        }
      } else {
        changeWrap.style.display = 'none';
      }
    } else if (changeWrap) {
      changeWrap.style.display = 'none';
    }
  },
  async process() {
    const id    = document.getElementById('s-item')?.value;
    const item  = DB.data.items.find(i=>i.id===id);
    if (!item)             return UI.toast(I18n.t('toast_err_product_not_found'),'danger');
    if (!Auth.currentUser) return UI.toast(I18n.t('toast_err_auth'),'danger');
    const qty       = Utils.int(document.getElementById('s-qty')?.value);
    const basePrice = Utils.num(document.getElementById('s-price')?.value);
    // Prix réel = prix négocié si le champ remise est visible, sinon prix du stock
    const realPriceEl   = document.getElementById('s-real-price');
    const discountOpen  = document.getElementById('s-discount-wrap')?.style.display !== 'none';
    const price         = (discountOpen && realPriceEl && realPriceEl.value !== '') ? Utils.num(realPriceEl.value) : basePrice;
    const priceModified = discountOpen && realPriceEl && realPriceEl.value !== '';
    const discountReason = document.getElementById('s-discount-reason')?.value.trim() || '';
    if (isNaN(qty)||qty<=0)    return UI.toast(I18n.t('toast_err_qty_invalid'),'danger');
    if (isNaN(price)||price<0) return UI.toast(I18n.t('toast_err_price_invalid'),'danger');
    if (qty>item.qty)          return UI.toast(`${I18n.t('toast_err_stock_low')} (dispo: ${item.qty})`,'danger');
    if (Settings.data.confirmSale) { if(!await SmpModal.confirm(`${I18n.t('misc_confirm')} ${qty} × ${item.name} = ${Utils.currency(price*qty)} ?`, {title:I18n.t('modal_confirm_sale_title'), icon:'🛒', okLabel:I18n.t('modal_confirm_sale_ok'), okClass:'btn-primary'})) return; }
    const total    = price * qty;
    const paidRaw  = document.getElementById('s-paid')?.value;
    const paid     = paidRaw === '' ? total : Utils.num(paidRaw);
    const client   = document.getElementById('s-client')?.value.trim() || '';
    DB.data.sales.push({
      id:Utils.uid(), date:new Date().toISOString(),
      itemId:item.id, itemName:item.name, qty, price, total,
      debt: Math.max(0, total - (isNaN(paid)?total:paid)),
      profit: (price-item.buy)*qty,
      userId:Auth.currentUser.id, userName:Auth.currentUser.name,
      clientName:client, deleted:false,
      priceRef: basePrice,
      priceModified: priceModified || false,
      discountReason: discountReason || ''
    });
    item.qty -= qty;
    // Award loyalty points if client name provided
    if (client && typeof Loyalty !== 'undefined') Loyalty.addPoints(client, total);
    DB.save();
    const pEl=document.getElementById('s-paid'); if(pEl) pEl.value='';
    const cEl=document.getElementById('s-client'); if(cEl) cEl.value='';
    const qEl=document.getElementById('s-qty'); if(qEl) qEl.value='1';
    // Toujours re-valider après reset pour réactiver le bouton
    setTimeout(() => Sales.validate(), 50);
    // Réinitialiser le champ remise
    const rWrap = document.getElementById('s-discount-wrap'); if(rWrap) rWrap.style.display='none';
    const rEl   = document.getElementById('s-real-price');    if(rEl)   rEl.value='';
    const rsnEl = document.getElementById('s-discount-reason'); if(rsnEl) rsnEl.value='';
    const rtgl  = document.getElementById('s-discount-toggle'); if(rtgl)  rtgl.textContent='± Modifier le prix';
    UI.renderAll();
    UI.toast(I18n.t('toast_sale_ok'),'success');
  },
  async cancel(id) {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin'),'danger');
    const sale = DB.data.sales.find(s=>s.id===id);
    if (!sale||sale.deleted) return;
    if (!await SmpModal.confirm(`${I18n.t('modal_cancel_sale_msg').replace('Le stock','Annuler "'+sale.itemName+'" — '+Utils.currency(sale.total)+' ? Le stock')}`, {title:I18n.t('modal_cancel_sale_title'), icon:'↩️', okLabel:I18n.t('modal_cancel_sale_ok'), okClass:'btn-danger'})) return;
    const item = DB.data.items.find(i=>i.id===sale.itemId);
    if (item) item.qty += sale.qty;
    sale.deleted = true;
    DB.save(); UI.renderAll();
    if (typeof History !== 'undefined') History.render();
    UI.toast(I18n.t('toast_sale_cancelled'),'warning');
  },
  filterTable(q) {
    const term = (q||'').toLowerCase().trim();
    const rows = document.querySelectorAll('#tableSales tbody tr');
    rows.forEach(tr => {
      const txt = tr.textContent.toLowerCase();
      tr.style.display = (!term || txt.includes(term)) ? '' : 'none';
    });
  },
  async cancelBulk(ids) {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin'),'danger');
    const sales = ids.map(id => DB.data.sales.find(s=>s.id===id)).filter(s => s && !s.deleted);
    if (!sales.length) return;
    const total = sales.reduce((t,s)=>t+s.total,0);
    const msg = I18n.t('modal_cancel_bulk_msg').replace('{n}', sales.length).replace('{total}', Utils.currency(total));
    if (!await SmpModal.confirm(msg, {title:I18n.t('modal_cancel_sale_title'), icon:'↩️', okLabel:I18n.t('modal_cancel_sale_ok'), okClass:'btn-danger'})) return;
    sales.forEach(sale => {
      const item = DB.data.items.find(i=>i.id===sale.itemId);
      if (item) item.qty += sale.qty;
      sale.deleted = true;
    });
    DB.save(); UI.renderAll();
    if (typeof History !== 'undefined') History.render();
    UI.toast(I18n.t('toast_sales_cancelled_bulk').replace('{n}', sales.length), 'warning');
  },
  // ── Sélection multiple sur "Transactions du Jour" ──
  _selectedToday: new Set(),
  toggleOneToday(id, checked, cbEl) {
    if (checked) this._selectedToday.add(id); else this._selectedToday.delete(id);
    const row = cbEl?.closest ? cbEl.closest('tr') : null;
    if (row) row.classList.toggle('row-selected', checked);
    this._updateTodaySelectionUI();
  },
  toggleAllToday(checked) {
    document.querySelectorAll('#tableSales tbody .sale-row-check').forEach(cb => {
      cb.checked = checked;
      if (checked) this._selectedToday.add(cb.value); else this._selectedToday.delete(cb.value);
      const row = cb.closest ? cb.closest('tr') : null;
      if (row) row.classList.toggle('row-selected', checked);
    });
    this._updateTodaySelectionUI();
  },
  _updateTodaySelectionUI() {
    const btn = document.getElementById('sales-delete-sel-btn');
    const cnt = document.getElementById('sales-sel-count');
    if (cnt) cnt.textContent = this._selectedToday.size;
    if (btn) btn.style.display = this._selectedToday.size > 0 ? '' : 'none';
    const allCb = document.getElementById('sales-check-all');
    if (allCb) {
      const rows = document.querySelectorAll('#tableSales tbody .sale-row-check');
      allCb.checked = rows.length > 0 && Array.from(rows).every(cb => cb.checked);
    }
  },
  async deleteSelectedToday() {
    const ids = Array.from(this._selectedToday);
    await this.cancelBulk(ids);
    this._selectedToday.clear();
    this._updateTodaySelectionUI();
  }
};

/* ═══════════════ STOCK ═══════════════ */
