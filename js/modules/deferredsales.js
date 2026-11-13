'use strict';
const DeferredSales = {
  _lines: [],
  _lineId: 0,

  open() {
    const ov = document.getElementById('deferred-overlay');
    if (!ov) return;
    // Remplir le sélecteur vendeur
    const sel = document.getElementById('def-seller');
    if (sel) {
      sel.innerHTML = `<option value="">${I18n.t('def_seller_self')}</option>`;
      DB.data.users.forEach(u => {
        const o = document.createElement('option');
        o.value = u.id; o.textContent = u.name;
        if (Auth.currentUser && u.id === Auth.currentUser.id) o.selected = true;
        sel.appendChild(o);
      });
    }
    // Date par défaut = aujourd'hui (heure locale, pas UTC)
    const dateEl = document.getElementById('def-date');
    if (dateEl) {
      const now = new Date();
      const localDate = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      dateEl.value = localDate;
      // Bloquer les dates futures
      dateEl.max = localDate;
    }

    this._lines = [];
    this._lineId = 0;
    ov.classList.add('open');
    this.addLine(); // Une ligne vide d'emblée (appelle déjà _renderLines)
    this.onDateChange();
  },

  close() {
    const ov = document.getElementById('deferred-overlay');
    if (ov) ov.classList.remove('open');
    this._lines = [];
  },

  onDateChange() {
    const dateVal = document.getElementById('def-date')?.value;
    const infoEl  = document.getElementById('def-date-info');
    if (!dateVal || !infoEl) return;
    // Ajouter T00:00:00 pour forcer l'interprétation en heure locale (évite le bug UTC)
    const d = new Date(dateVal + 'T00:00:00');
    const today = new Date();
    today.setHours(0,0,0,0);
    const diff = Math.floor((today - d) / 86400000);
    if (diff === 0) {
      infoEl.textContent = I18n.t('def_date_today');
      infoEl.style.color = 'var(--accent)';
    } else if (diff === 1) {
      infoEl.textContent = I18n.t('def_date_yesterday');
      infoEl.style.color = 'var(--text3)';
    } else if (diff > 1) {
      const locale = I18n._lang === 'en' ? 'en-US' : 'fr-FR';
      infoEl.textContent = I18n.t('def_date_days_ago')
        .replace('{days}', diff)
        .replace('{date}', d.toLocaleDateString(locale,{weekday:'long',day:'numeric',month:'long'}));
      infoEl.style.color = 'var(--text3)';
    } else {
      infoEl.textContent = '⚠️ ' + I18n.t('toast_err_date_future');
      infoEl.style.color = 'var(--danger)';
    }
  },

  addLine() {
    const id = ++this._lineId;
    // Nouvelle ligne vide TOUJOURS en haut (unshift, pas push)
    this._lines.unshift({ id, itemId:'', qty:1, price:0, paid:'', client:'' });
    this._renderLines();
    // Focus direct sur le select, sans besoin de scroll — elle est déjà en haut
    setTimeout(() => {
      document.getElementById('def-item-' + id)?.focus();
    }, 80);
  },

  removeLine(id) {
    this._lines = this._lines.filter(l => l.id !== id);
    this._renderLines();
    this._updateSummary();
  },

  setLineFullCredit(id) {
    this.updateLine(id, 'paid', 0);
    const pEl = document.getElementById('def-paid-' + id);
    if (pEl) pEl.value = '0';
    UI.toast(I18n.t('toast_full_credit_set'), 'warning');
  },

  updateLine(id, field, value) {
    const line = this._lines.find(l => l.id === id);
    if (!line) return;
    line[field] = value;
    if (field === 'itemId') {
      const item = DB.data.items.find(i => i.id === value);
      if (item) line.price = item.sell;
      const priceEl = document.getElementById('def-price-' + id);
      if (priceEl && item) priceEl.value = item.sell;
    }
    this._updateLineTotal(id);
    this._updateSummary();
  },

  validateLine(id) {
    const line = this._lines.find(l => l.id === id);
    if (!line) return;
    const item = DB.data.items.find(i => i.id === line.itemId);
    if (!item) { UI.toast(I18n.t('toast_err_item_required'), 'danger'); return; }
    if (!(parseInt(line.qty) > 0)) { UI.toast(I18n.t('toast_err_qty_required'), 'danger'); return; }
    line._wasFilled = true;
    this._lines = this._lines.filter(l => l.id !== id);
    const firstValidatedIdx = this._lines.findIndex(l => l._wasFilled);
    if (firstValidatedIdx === -1) { this._lines.push(line); }
    else { this._lines.splice(firstValidatedIdx, 0, line); }
    this._renderLines();
    UI.toast(I18n.t('toast_line_validated'), 'success');
    if (!this._lines.some(l => !l._wasFilled)) this.addLine();
  },

  _updateLineTotal(id) {
    const line    = this._lines.find(l => l.id === id);
    if (!line) return;
    const qty     = parseInt(line.qty)   || 0;
    const price   = parseFloat(line.price) || 0;
    const total   = qty * price;
    const totEl   = document.getElementById('def-total-' + id);
    if (totEl) totEl.textContent = total > 0 ? I18n.t('def_total_prefix') + Utils.currency(total) : '';
    // Rendu monnaie
    const paid    = parseFloat(line.paid);
    const chEl    = document.getElementById('def-change-' + id);
    if (chEl) {
      if (!isNaN(paid) && paid > 0 && total > 0) {
        const change = paid - total;
        chEl.textContent = change >= 0
          ? I18n.t('def_change_give') + Utils.currency(change)
          : I18n.t('def_change_owe') + Utils.currency(Math.abs(change));
        chEl.style.color = change >= 0 ? 'var(--accent)' : 'var(--danger)';
        chEl.style.display = '';
      } else {
        chEl.style.display = 'none';
      }
    }
  },

  _updateSummary() {
    const total = this._lines.reduce((t, l) => {
      return t + (parseInt(l.qty)||0) * (parseFloat(l.price)||0);
    }, 0);
    const valid = this._lines.filter(l => l.itemId && parseInt(l.qty) > 0 && parseFloat(l.price) >= 0).length;
    const se = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    se('def-total-display', Utils.currency(total));
    se('def-lines-info', valid + ' ' + I18n.t('def_lines_valid'));
    const sumEl = document.getElementById('def-summary');
    if (sumEl) sumEl.style.opacity = this._lines.length > 0 ? '1' : '0.4';
    const btn = document.getElementById('def-submit-btn');
    if (btn) btn.disabled = valid === 0;
  },

  _renderLines() {
    const container = document.getElementById('def-lines-container');
    if (!container) return;
    if (!this._lines.length) {
      container.innerHTML = `<div style="text-align:center;color:var(--text3);font-family:var(--fm);font-size:.8rem;padding:20px 0">${I18n.t('def_empty_state')}</div>`;
      return;
    }
    const items = DB.data.items;
    // Trier A→Z
    const sortLocale = I18n._lang === 'en' ? 'en' : 'fr';
    const sortedItems = [...items].sort((a,b) => a.name.localeCompare(b.name,sortLocale,{sensitivity:'base'}));
    const itemOpts = sortedItems.length
      ? `<option value="">${I18n.t('def_choose_short')}</option>` + sortedItems.map(i => `<option value="${Utils.esc(i.id)}">${Utils.esc(i.name)} (dispo: ${i.qty})</option>`).join('')
      : `<option value="">— ${I18n.t('no_stock')} —</option>`;

    container.innerHTML = this._lines.map((line, idx) => `
      <div class="deferred-row" id="def-row-${line.id}" style="${line._wasFilled ? 'opacity:.85;border-left:3px solid var(--accent)' : 'border-left:3px solid var(--warning)'}">
        <div class="deferred-row-num">${I18n.t('def_line_num')} ${idx+1} ${line._wasFilled ? '✓' : ''}</div>
        <div class="form-group" style="grid-column:1/-1;margin-bottom:0;margin-top:14px">
          <label class="form-label">${I18n.t('def_item_label')}</label>
          <select id="def-item-${line.id}"
            onchange="DeferredSales.updateLine(${line.id},'itemId',this.value)">
            <option value="">${I18n.t('def_choose_item')}</option>
            ${itemOpts}
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">${I18n.t('def_qty_star')}</label>
          <input type="number" id="def-qty-${line.id}" value="${line.qty}"
            min="1" inputmode="numeric"
            oninput="DeferredSales.updateLine(${line.id},'qty',this.value)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">${I18n.t('def_price_unit')}</label>
          <input type="number" id="def-price-${line.id}" value="${line.price||''}"
            min="0" inputmode="decimal"
            oninput="DeferredSales.updateLine(${line.id},'price',this.value)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">${I18n.t('def_paid_hint')} <button type="button" onclick="DeferredSales.setLineFullCredit(${line.id})" style="background:none;border:none;color:var(--danger);font-size:.6rem;cursor:pointer;font-family:var(--fm);text-decoration:underline;padding:0;margin-left:4px">🔴 ${I18n.t('lbl_full_credit')}</button></label>
          <input type="number" id="def-paid-${line.id}" value="${line.paid||''}"
            min="0" inputmode="decimal"
            oninput="DeferredSales.updateLine(${line.id},'paid',this.value)">
        </div>
        <div class="form-group" style="margin-bottom:0">
          <label class="form-label">${I18n.t('def_client_optional')}</label>
          <input type="text" id="def-client-${line.id}" value="${Utils.esc(line.client||'')}"
            placeholder="${I18n.t('def_client_name_ph')}"
            oninput="DeferredSales.updateLine(${line.id},'client',this.value)">
        </div>
        <div class="deferred-row-total" id="def-total-${line.id}"></div>
        <div id="def-change-${line.id}" style="display:none;grid-column:1/-1;text-align:center;font-family:var(--fm);font-size:.75rem;font-weight:700;padding:4px"></div>
        ${!line._wasFilled ? `
        <button onclick="DeferredSales.validateLine(${line.id})"
          style="grid-column:1/-1;margin-top:6px;background:var(--accent);color:#000;border:none;border-radius:var(--rmd);padding:10px;font-family:var(--fd);font-weight:700;font-size:.82rem;cursor:pointer">
          ✓ ${I18n.t('def_validate_line').replace('✓ ','')}
        </button>` : ''}
        <button onclick="DeferredSales.removeLine(${line.id})"
          style="position:absolute;top:8px;right:8px;background:none;border:none;color:var(--danger);cursor:pointer;font-size:1rem;padding:2px 6px">✕</button>
      </div>
    `).join('');

    // Restaurer les valeurs sélectionnées
    this._lines.forEach(line => {
      const sel = document.getElementById('def-item-' + line.id);
      if (sel && line.itemId) sel.value = line.itemId;
      this._updateLineTotal(line.id);
    });
    this._updateSummary();
  },

  async submit() {
    const dateVal  = document.getElementById('def-date')?.value;
    if (!dateVal) return UI.toast(I18n.t('toast_err_date_required'),'danger');

    // Bloquer les dates futures
    const chosenDate = new Date(dateVal);
    const today = new Date(); today.setHours(23,59,59,999);
    if (chosenDate > today) return UI.toast(I18n.t('toast_err_date_future'),'danger');

    const globalClient = document.getElementById('def-client')?.value.trim() || '';
    const sellerEl     = document.getElementById('def-seller');
    const sellerId     = sellerEl?.value || Auth.currentUser?.id || '';
    const sellerName   = sellerId
      ? (DB.data.users.find(u => u.id === sellerId)?.name || Auth.currentUser?.name || '')
      : (Auth.currentUser?.name || '');

    // Filtrer les lignes valides
    const valid = this._lines.filter(l => {
      const item = DB.data.items.find(i => i.id === l.itemId);
      return item && parseInt(l.qty) > 0 && parseFloat(l.price) >= 0;
    });

    if (!valid.length) return UI.toast(I18n.t('toast_err_no_lines'),'danger');

    // Vérifier le stock pour chaque ligne
    for (const line of valid) {
      const item = DB.data.items.find(i => i.id === line.itemId);
      const qty  = parseInt(line.qty);
      if (item.qty < qty) {
        UI.toast(`${I18n.t('toast_err_stock_low')} — ${item.name} (${item.qty} dispo)`, 'danger');
        return;
      }
    }

    // Enregistrer chaque ligne
    let lineCount = 0;
    let totalCA   = 0;

    // Heure de base : si date = aujourd'hui on utilise maintenant, sinon 12h00
    const isToday = new Date(dateVal).toDateString() === new Date().toDateString();
    const baseHour = isToday ? new Date() : new Date(dateVal + 'T12:00:00');

    for (let i = 0; i < valid.length; i++) {
      const line  = valid[i];
      const item  = DB.data.items.find(x => x.id === line.itemId);
      const qty   = parseInt(line.qty);
      const price = parseFloat(line.price);
      const total = qty * price;
      const paidRaw = line.paid === '' || line.paid == null ? null : parseFloat(line.paid);
      const paid  = (paidRaw == null || isNaN(paidRaw)) ? total : paidRaw;
      const debt  = Math.max(0, total - paid);
      const client = line.client.trim() || globalClient;

      // Décaler de 1 seconde par ligne pour préserver l'ordre
      const saleDate = new Date(baseHour.getTime() + i * 1000);

      DB.data.sales.push({
        id:         Utils.uid(),
        date:       saleDate.toISOString(),
        itemId:     item.id,
        itemName:   item.name,
        qty, price, total, debt,
        profit:     (price - item.buy) * qty,
        userId:     sellerId,
        userName:   sellerName,
        clientName: client,
        deleted:    false,
        deferred:   true  // Marqueur pour identifier les saisies différées
      });

      item.qty -= qty;
      if (client && typeof Loyalty !== 'undefined') Loyalty.addPoints(client, total);
      lineCount++;
      totalCA += total;
    }

    DB.save();
    UI.renderAll();
    Dashboard.refresh();

    UI.toast(`${lineCount} ${I18n.t('toast_deferred_ok')} — ${Utils.currency(totalCA)}`,'success');
    this.close();
  }
};

/* ═══════════════ SELLER DASH ═══════════════ */
