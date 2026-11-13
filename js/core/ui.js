'use strict';
const UI = {
  _toastTimer: null,
  _chart: null,
  _currentTab: 'dashboard',
  toast(msg, type='success') {
    const t = document.getElementById('toast'); if(!t) return;
    t.className = 'toast-' + type; t.textContent = msg; t.style.display = 'block';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => t.style.display = 'none', 3200);
  },
  switchTab(id, _fromPopstate=false) {
    // Marquer le bouton "Plus" actif si l'onglet est dans le dropdown
    const dropItems = ['debts','expenses','cashreport','commissions','users','suppliers',
      'loyalty','returns','objectives','categories','ai','bizimport',
      'settings','config'];
    const moreBtn = document.getElementById('nav-more-btn');
    if (moreBtn) {
      moreBtn.style.color       = dropItems.includes(id) ? 'var(--accent)' : '';
      moreBtn.style.borderColor = dropItems.includes(id) ? 'var(--accent)' : '';
      moreBtn.style.background  = dropItems.includes(id) ? 'rgba(0,232,122,.08)' : '';
    }
    // Historique navigateur pour le bouton retour Android
    if (this._currentTab && this._currentTab !== id && !_fromPopstate) {
      history.pushState({ tab: id }, '', '#' + id);
    }
    this._currentTab = id;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-tab, .bot-tab').forEach(d => d.classList.remove('active'));
    document.getElementById(id)?.classList.add('active');
    document.getElementById('tab-' + id)?.classList.add('active');
    document.getElementById('btab-' + id)?.classList.add('active');
    if (id === 'analytics') Analytics.refresh();
    if (id === 'config')    SysInfo.render();
    if (id === 'debts')     Debts.render();
    if (id === 'settings')  { Settings._fillForm(); AIConfig.updateStatus(); }
    if (id === 'ai')        { AIAdvanced._generated=false; setTimeout(() => AIAdvanced.generateSummary(), 500); }
    if (id === 'bizimport')   { BizImport.reset(); }
    if (id === 'history')     { if(typeof History!=='undefined') History.render(); }
    if (id === 'expenses')    { if(typeof Expenses!=='undefined')    Expenses.render(); }
    if (id === 'cashreport')  { const _f=document.getElementById('cr-fond'); if(_f&&!_f.value) _f.value=DB.data.cashInit||0; }
    if (id === 'commissions') { if(typeof Commissions!=='undefined') Commissions.render(); }
    if (id === 'dashboard') Dashboard.refresh();
    if (id === 'sales')     Sales.renderSales && Sales.renderSales();
    if (id === 'stock')     Stock.render && Stock.render();
    if (id === 'users')     UI.renderUsers && UI.renderUsers();
    if (id === 'suppliers' && typeof Suppliers !== 'undefined') Suppliers.render();
    if (id === 'categories' && typeof Categories !== 'undefined') Categories.render();
    if (id === 'returns' && typeof Returns !== 'undefined') Returns.render();
    if (id === 'loyalty' && typeof Loyalty !== 'undefined') { Loyalty.render(); const el=document.getElementById('loyalty-curr');if(el)el.textContent=Settings.getCurrency(); }
    if (id === 'objectives' && typeof Objectives !== 'undefined') Objectives.renderProgress();
    window.scrollTo({top:0, behavior:'smooth'});
  },
  renderAll() { this.renderSales(); this.renderStock(); this.renderUsers(); this.updateItemSelect(); this.updateCategorySelect(); Alerts.generate(); },
  renderSales() {
    const tbody = document.querySelector('#tableSales tbody'); if(!tbody) return;
    const today = new Date().toDateString();
    const list  = DB.activeSales().filter(s => new Date(s.date).toDateString() === today).reverse().slice(0,50);
    if (!list.length) { tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text3);padding:32px">${I18n.t('no_sales')}</td></tr>`; Sales._updateTodaySelectionUI(); return; }
    tbody.innerHTML = list.map(s => {
      const locale = I18n._lang === 'en' ? 'en-US' : 'fr-FR';
      return `
      <tr class="${Sales._selectedToday.has(s.id)?'row-selected':''}">
        <td><input type="checkbox" class="row-check sale-row-check" value="${Utils.esc(s.id)}" ${Sales._selectedToday.has(s.id)?'checked':''} onchange="Sales.toggleOneToday('${Utils.esc(s.id)}', this.checked, this)" ${!Auth.isAdmin()?'disabled':''}></td>
        <td class="td-mono">${new Date(s.date).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})}${s.deferred?'<span style="margin-left:4px;font-family:var(--fm);font-size:.55rem;color:var(--warning);background:rgba(255,186,0,.12);padding:1px 4px;border-radius:3px">'+I18n.t('lbl_deferred_badge')+'</span>':''}</td>
        <td><span class="badge badge-gray">${Utils.esc(s.userName)}</span></td>
        <td class="fw-700">${Utils.esc(s.itemName)}</td>
        <td class="td-mono">${s.qty}</td>
        <td class="td-mono fw-700">${Utils.currency(s.total)}${s.priceModified ? '<span title="'+(s.discountReason||I18n.t('lbl_price_modified'))+'" style="margin-left:4px;font-size:.6rem;color:'+(s.price<(s.priceRef||s.price)?'var(--warning)':'var(--accent)')+'">('+(s.price<(s.priceRef||s.price)?I18n.t('lbl_discount'):I18n.t('lbl_surplus'))+')</span>' : ''}</td>
        <td>${s.debt>0?`<span class="badge badge-red">${I18n.t('lbl_debt')} ${Utils.currency(s.debt)}</span>`:`<span class="badge badge-green">${I18n.t('lbl_paid_off')}</span>`}</td>
        <td>
          <button class="btn btn-danger btn-sm" onclick="Sales.cancel('${Utils.esc(s.id)}')" ${!Auth.isAdmin()?'disabled':''}>${I18n.t('btn_cancel')}</button>
          <button class="btn btn-info btn-sm" onclick="Printer.printTicket('${Utils.esc(s.id)}')" style="margin-top:2px">🖨️</button>
          <button class="btn btn-warning btn-sm" onclick="Share.ticket('${Utils.esc(s.id)}')" style="margin-top:2px" title="${I18n.t('lbl_share_whatsapp')}">📤</button>
          <button class="btn btn-ghost btn-sm" onclick="Returns.process('${Utils.esc(s.id)}')" ${!Auth.isAdmin()||s.returned?'disabled':''} style="margin-top:2px" title="${I18n.t('nav_returns')}">↩️</button>
        </td>
      </tr>`;
    }).join('');
    Sales._updateTodaySelectionUI();
  },
  renderStock() {
    const tbody = document.querySelector('#tableStock tbody'); if(!tbody) return;
    if (!DB.data.items.length) { tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:32px">${I18n.t('no_stock')}</td></tr>`; }
    else {
      tbody.innerHTML = DB.data.items.map(i => {
        const isLow  = i.qty <= (i.min ?? Settings.data.stockMin ?? 5);
        const margin = i.buy > 0 ? (((i.sell-i.buy)/i.buy)*100).toFixed(1) : '—';
        return `<tr>
          <td class="td-mono text-muted" style="color:var(--text3)">${Utils.esc(i.code||'')}</td>
          <td class="fw-700">${Utils.esc(i.name)}${i.desc?'<div style="font-family:var(--fm);font-size:.62rem;color:var(--text3);font-weight:400;margin-top:2px">'+Utils.esc(i.desc)+'</div>':''}</td>
          <td class="td-mono"><span style="font-family:var(--fm);font-size:.58rem;color:var(--text3)">${I18n.t('th_buy')} </span>${Utils.currency(i.buy)}</td>
          <td class="td-mono"><span style="font-family:var(--fm);font-size:.58rem;color:var(--text3)">${I18n.t('th_sell')} </span>${Utils.currency(i.sell)}</td>
          <td class="td-mono ${i.sell<i.buy?'text-danger':'text-accent'}">${margin}%</td>
          <td class="td-mono">${i.tva>0?i.tva+'%':'—'}</td>
          <td class="td-mono"><span style="font-family:var(--fm);font-size:.58rem;color:var(--text3)">${I18n.t('th_stock')} </span><strong>${i.qty}</strong></td>
          <td><span class="badge badge-gray" style="font-size:.58rem">${Utils.esc(i.category||'—')}</span></td>
          <td><span class="badge ${isLow?'badge-red':'badge-green'}">${isLow?'⚠ '+I18n.t('badge_low_stock'):'✓ '+I18n.t('badge_ok_stock')}</span></td>
          <td style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="Stock.openEdit('${Utils.esc(i.id)}')" ${!Auth.isAdmin()?'disabled':''} title="${I18n.t('btn_edit')}">✏️ ${I18n.t('btn_edit')}</button>
            <button class="btn btn-danger btn-sm" onclick="Stock.remove('${Utils.esc(i.id)}')" ${!Auth.isAdmin()?'disabled':''}>${I18n.t('btn_delete')}</button>
          </td>
        </tr>`;
      }).join('');
    }
    const se = (id,v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    se('v-stock-buy',    Utils.currency(DB.data.items.reduce((s,i)=>s+i.buy*i.qty,0)));
    se('v-stock-sell',   Utils.currency(DB.data.items.reduce((s,i)=>s+i.sell*i.qty,0)));
    se('v-stock-alerts', DB.data.items.filter(i=>i.qty<=(i.min??Settings.data.stockMin??5)).length);
    se('v-stock-count',  DB.data.items.length);
  },
  renderUsers() {
    const tbody = document.querySelector('#tableUsers tbody'); if(!tbody) return;
    tbody.innerHTML = DB.data.users.map(u => {
      const us = DB.activeSales().filter(s=>s.userId===u.id);
      const ca = us.reduce((s,v)=>s+v.total,0);
      const isSelf = Auth.currentUser?.id === u.id;
      return `<tr>
        <td class="fw-700">${Utils.esc(u.name)}</td>
        <td><span class="badge ${u.role==='admin'?'badge-blue':'badge-gray'}">${u.role==='admin'?I18n.t('role_admin'):I18n.t('role_seller')}</span></td>
        <td class="td-mono">${us.length}</td>
        <td class="td-mono">${Utils.currency(ca)}</td>
        <td style="display:flex;gap:4px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="Users.openEdit('${Utils.esc(u.id)}')" ${!Auth.isAdmin()?'disabled':''}>✏️</button>
          <button class="btn btn-danger btn-sm" onclick="Users.remove('${Utils.esc(u.id)}')" ${isSelf||!Auth.isAdmin()?'disabled':''}>${I18n.t('btn_delete_short')}</button>
        </td>
      </tr>`;
    }).join('');
  },
  updateItemSelect() {
    const sel = document.getElementById('s-item'); if(!sel) return;
    const cur = sel.value;
    // Trier A→Z
    const sortLocale = I18n._lang === 'en' ? 'en' : 'fr';
    const avail = [...DB.data.items.filter(i=>i.qty>0)]
      .sort((a,b) => a.name.localeCompare(b.name, sortLocale, {sensitivity:'base'}));
    sel.innerHTML = avail.length
      ? `<option value="">${I18n.t('def_choose_item')}</option>` +
        avail.map(i=>`<option value="${Utils.esc(i.id)}">${Utils.esc(i.name)} (dispo: ${i.qty})</option>`).join('')
      : `<option value="">— ${I18n.t('no_stock')} —</option>`;
    if (cur) sel.value = cur;
    // Réinitialiser le champ de recherche si le stock a été rechargé
    const searchEl = document.getElementById('s-item-search');
    if (searchEl) searchEl.value = '';
    Sales.syncFields();
  },

  _filterItemSelect(query) {
    const sel = document.getElementById('s-item'); if(!sel) return;
    const q = query.trim().toLowerCase();
    const avail = [...DB.data.items.filter(i=>i.qty>0)]
      .sort((a,b) => a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));
    const filtered = q ? avail.filter(i => i.name.toLowerCase().includes(q)) : avail;
    const cur = sel.value;
    sel.innerHTML = filtered.length
      ? `<option value="">— Choisir —</option>` +
        filtered.map(i=>`<option value="${Utils.esc(i.id)}">${Utils.esc(i.name)} (dispo: ${i.qty})</option>`).join('')
      : `<option value="">— Aucun résultat —</option>`;
    if (cur) sel.value = cur;
  },

  updateCategorySelect() {
    const unique = ['Autre', ...Categories.getAll().filter(c => c !== 'Autre')];
    ['i-category', 'edit-stock-cat'].forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const cur = sel.value;
      sel.innerHTML = unique.map(n => `<option value="${Utils.esc(n)}">${Utils.esc(n)}</option>`).join('');
      if (cur && unique.includes(cur)) sel.value = cur;
    });
  }
};

/* ═══════════════ SALES ═══════════════ */
