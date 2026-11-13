'use strict';
const SmpModal = {
  _resolve: null,
  _orderSupId: null,

  /* Confirmation simple */
  confirm(msg, { title='Confirmation', icon='⚠️', okLabel='Confirmer', okClass='btn-danger', cancelLabel='Annuler' } = {}) {
    return new Promise(resolve => {
      this._resolve = resolve;
      const ov  = document.getElementById('smp-confirm-overlay');
      const iEl = document.getElementById('smp-confirm-icon');
      const tEl = document.getElementById('smp-confirm-title');
      const mEl = document.getElementById('smp-confirm-msg');
      const iw  = document.getElementById('smp-confirm-input-wrap');
      const ok  = document.getElementById('smp-confirm-ok');
      const ca  = document.getElementById('smp-confirm-cancel');
      if (!ov) { resolve(false); return; }
      if (iEl) iEl.textContent = icon;
      if (tEl) tEl.textContent = title;
      if (mEl) mEl.textContent = msg;
      if (iw)  iw.style.display = 'none';
      if (ok)  { ok.textContent = okLabel; ok.className = 'btn ' + okClass; ok.style.flex = '1'; }
      if (ca)  { ca.textContent = cancelLabel; }
      ok.onclick  = () => { this._close(); resolve(true); };
      ca.onclick  = () => { this._close(); resolve(false); };
      ov.classList.add('open');
    });
  },

  /* Modale de saisie texte avec validation (pour confirmation par mot-clé) */
  prompt({ title='Confirmation', message='', placeholder='', okLabel='Confirmer', okClass='btn-danger', validate=null, onConfirm=null, onCancel=null } = {}) {
    // Créer ou réutiliser la modale prompt
    let ov = document.getElementById('smp-prompt-overlay');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'smp-prompt-overlay';
      ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:29999;align-items:center;justify-content:center;padding:20px;';
      ov.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--bord2);border-radius:var(--rxl);padding:28px 24px;width:100%;max-width:400px;box-shadow:var(--shadow-lg);animation:slideUp .18s ease">
          <div style="font-size:2rem;text-align:center;margin-bottom:12px">⚠️</div>
          <div id="smp-prompt-title" style="font-family:var(--fd);font-size:1rem;font-weight:800;text-align:center;margin-bottom:10px"></div>
          <div id="smp-prompt-msg" style="font-family:var(--fm);font-size:.82rem;color:var(--text2);text-align:center;margin-bottom:16px;line-height:1.5"></div>
          <input id="smp-prompt-input" type="text" style="width:100%;margin-bottom:16px;text-align:center;font-weight:700;letter-spacing:2px;text-transform:uppercase" autocomplete="off">
          <div id="smp-prompt-err" style="color:var(--danger);font-size:.75rem;text-align:center;margin-bottom:10px;min-height:18px;font-family:var(--fm)"></div>
          <div style="display:flex;gap:10px">
            <button id="smp-prompt-cancel" class="btn btn-ghost" style="flex:1">${I18n._lang==='en'?'Cancel':'Annuler'}</button>
            <button id="smp-prompt-ok" class="btn btn-danger" style="flex:1">${okLabel}</button>
          </div>
        </div>`;
      document.body.appendChild(ov);
    }
    // Peupler
    document.getElementById('smp-prompt-title').textContent = title;
    document.getElementById('smp-prompt-msg').innerHTML = message;
    document.getElementById('smp-prompt-err').textContent = '';
    const inp = document.getElementById('smp-prompt-input');
    inp.value = ''; inp.placeholder = placeholder;
    const okBtn = document.getElementById('smp-prompt-ok');
    okBtn.textContent = okLabel; okBtn.className = 'btn ' + okClass;
    ov.style.display = 'flex';
    setTimeout(() => inp.focus(), 100);

    const close = () => { ov.style.display = 'none'; };
    okBtn.onclick = () => {
      const val = inp.value.trim();
      if (validate && !validate(val)) {
        document.getElementById('smp-prompt-err').textContent = I18n._lang==='en'
          ? `Incorrect — please type: ${placeholder}`
          : `Incorrect — tapez exactement : ${placeholder}`;
        inp.focus(); inp.select(); return;
      }
      close(); if (onConfirm) onConfirm(val);
    };
    document.getElementById('smp-prompt-cancel').onclick = () => { close(); if (onCancel) onCancel(); };
    inp.onkeydown = e => { if (e.key==='Enter') okBtn.click(); if (e.key==='Escape') { close(); if (onCancel) onCancel(); } };
  },

  /* Ferme la modale */
  _close() {
    const ov = document.getElementById('smp-confirm-overlay');
    if (ov) ov.classList.remove('open');
  },

  /* Ouvre la modale commande fournisseur */
  openOrder(supplierId, supName) {
    this._orderSupId = supplierId;
    const ov = document.getElementById('smp-order-overlay');
    const nm = document.getElementById('smp-order-sup-name');
    const am = document.getElementById('smp-order-amount');
    const ds = document.getElementById('smp-order-desc');
    if (nm) nm.textContent = supName;
    if (am) am.value = '';
    if (ds) ds.value = '';
    if (ov) ov.classList.add('open');
    setTimeout(() => { if (am) am.focus(); }, 100);
  },

  closeOrder() {
    const ov = document.getElementById('smp-order-overlay');
    if (ov) ov.classList.remove('open');
    this._orderSupId = null;
  },

  confirmOrder() {
    const amount = parseFloat(document.getElementById('smp-order-amount')?.value);
    const desc   = document.getElementById('smp-order-desc')?.value.trim() || '';
    if (isNaN(amount) || amount <= 0) {
      UI.toast(I18n.t('toast_err_amount_invalid'),'danger'); return;
    }
    const sup = (DB.data.suppliers || []).find(s => s.id === this._orderSupId);
    if (!sup) { this.closeOrder(); return; }
    if (!sup.orders) sup.orders = [];
    sup.orders.push({ date: new Date().toISOString(), amount, desc });
    DB.save(); Suppliers.render();
    UI.toast(`${I18n.t('toast_order_placed')} : ${Utils.currency(amount)}`,'success');
    this.closeOrder();
  }
};
