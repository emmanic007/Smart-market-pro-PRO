'use strict';
const Suppliers = {

  add() {
    const name    = document.getElementById('sup-name')?.value.trim();
    const phone   = document.getElementById('sup-phone')?.value.trim();
    const contact = document.getElementById('sup-contact')?.value.trim();
    const notes   = document.getElementById('sup-notes')?.value.trim();

    if (!name) return UI.toast(I18n.t('toast_err_supplier_name_required'),'danger');
    if (!DB.data.suppliers) DB.data.suppliers = [];

    const existing = DB.data.suppliers.find(s => s.name.toLowerCase() === name.toLowerCase());
    if (existing) return UI.toast(I18n.t('toast_supplier_exists'),'warning');

    DB.data.suppliers.push({
      id:        Utils.uid(),
      name,
      phone:     phone || '',
      contact:   contact || '',
      notes:     notes || '',
      createdAt: new Date().toISOString(),
      orders:    []
    });
    DB.save();
    this.render();
    UI.toast(`${I18n.t('toast_supplier_added')} : ${name}`,'success');
    ['sup-name','sup-phone','sup-contact','sup-notes'].forEach(id => {
      const el = document.getElementById(id); if(el) el.value = '';
    });
  },

  recordOrder(supplierId) {
    const sup = (DB.data.suppliers||[]).find(s => s.id === supplierId);
    if (!sup) return;
    SmpModal.openOrder(supplierId, sup.name);
  },

  async remove(id) {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin_required'),'danger');
    if (!await SmpModal.confirm(I18n.t('modal_delete_supplier_msg'), {title:I18n.t('modal_delete_supplier_title'), icon:'🏭', okLabel:I18n.t('modal_delete_supplier_ok'), okClass:'btn-danger'})) return;
    DB.data.suppliers = (DB.data.suppliers||[]).filter(s => s.id !== id);
    DB.save();
    this.render();
    UI.toast(I18n.t('toast_supplier_deleted'),'warning');
  },

  render() {
    const tbody = document.querySelector('#tableSuppliers tbody');
    if (!tbody) return;
    const sups = DB.data.suppliers || [];

    if (!sups.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:32px">${I18n.t('no_suppliers')}</td></tr>`;
      return;
    }

    tbody.innerHTML = sups.map(s => {
      const totalOrders = (s.orders||[]).reduce((t,o) => t+o.amount, 0);
      const lastOrder   = s.orders?.length ? new Date(s.orders[s.orders.length-1].date).toLocaleDateString('fr-FR') : '—';
      return `<tr>
        <td class="fw-700">${Utils.esc(s.name)}</td>
        <td class="td-mono">${Utils.esc(s.phone||'—')}</td>
        <td class="td-mono">${Utils.esc(s.contact||'—')}</td>
        <td class="td-mono">${(s.orders||[]).length} commande(s)</td>
        <td class="td-mono">${Utils.currency(totalOrders)}</td>
        <td class="td-mono">${lastOrder}</td>
        <td style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="Suppliers.recordOrder('${Utils.esc(s.id)}')">+ Commande</button>
          <button class="btn btn-danger btn-sm" onclick="Suppliers.remove('${Utils.esc(s.id)}')" ${!Auth.isAdmin()?'disabled':''}>Suppr.</button>
        </td>
      </tr>`;
    }).join('');

    // Stats
    const totalSpent = sups.reduce((t,s) => t + (s.orders||[]).reduce((a,o)=>a+o.amount,0), 0);
    const el = document.getElementById('sup-total-spent');
    if (el) el.textContent = Utils.currency(totalSpent);
    const el2 = document.getElementById('sup-count');
    if (el2) el2.textContent = sups.length;
  }
};

/* ═══════════════════════════════════════════════════════
   MODULE: MULTISHOP — Multi-boutiques
   ═══════════════════════════════════════════════════════ */
