'use strict';
const History = {
  _page: 1,
  _perPage: 50,
  _filtered: [],
  _selected: new Set(),

  toggleOne(id, checked, cbEl) {
    if (checked) this._selected.add(id); else this._selected.delete(id);
    const row = cbEl?.closest ? cbEl.closest('tr') : null;
    if (row) row.classList.toggle('row-selected', checked);
    this._updateSelectionUI();
  },
  toggleAll(checked) {
    document.querySelectorAll('#tableHistory tbody .hist-row-check').forEach(cb => {
      cb.checked = checked;
      if (checked) this._selected.add(cb.value); else this._selected.delete(cb.value);
      const row = cb.closest ? cb.closest('tr') : null;
      if (row) row.classList.toggle('row-selected', checked);
    });
    this._updateSelectionUI();
  },
  _updateSelectionUI() {
    const btn = document.getElementById('hist-delete-sel-btn');
    const cnt = document.getElementById('hist-sel-count');
    if (cnt) cnt.textContent = this._selected.size;
    if (btn) btn.style.display = this._selected.size > 0 ? '' : 'none';
    const allCb = document.getElementById('hist-check-all');
    if (allCb) {
      const rows = document.querySelectorAll('#tableHistory tbody .hist-row-check');
      allCb.checked = rows.length > 0 && Array.from(rows).every(cb => cb.checked);
    }
  },
  async deleteSelected() {
    const ids = Array.from(this._selected);
    await Sales.cancelBulk(ids);
    this._selected.clear();
    this._updateSelectionUI();
  },

  _getSales() {
    const period  = document.getElementById('hist-period')?.value || 'month';
    const seller  = document.getElementById('hist-seller')?.value || '';
    const search  = (document.getElementById('hist-search')?.value || '').toLowerCase().trim();
    const fromVal = document.getElementById('hist-date-from')?.value;
    const toVal   = document.getElementById('hist-date-to')?.value;

    // Dates perso
    const fw = document.getElementById('hist-date-from-wrap');
    const tw = document.getElementById('hist-date-to-wrap');
    if (fw) fw.style.display = period === 'custom' ? '' : 'none';
    if (tw) tw.style.display = period === 'custom' ? '' : 'none';

    let sales = DB.activeSales().slice().reverse();

    // Filtre période
    if (period !== 'all' && period !== 'custom') {
      const start = Utils.periodStart(period === 'today' ? 'day' : period);
      sales = sales.filter(s => new Date(s.date).getTime() >= start);
    } else if (period === 'custom' && fromVal) {
      const from = new Date(fromVal).getTime();
      const to   = toVal ? new Date(toVal + 'T23:59:59').getTime() : Date.now();
      sales = sales.filter(s => {
        const t = new Date(s.date).getTime();
        return t >= from && t <= to;
      });
    }

    // Filtre vendeur
    if (seller) sales = sales.filter(s => s.userId === seller);

    // Filtre recherche
    if (search) {
      sales = sales.filter(s =>
        (s.itemName || '').toLowerCase().includes(search) ||
        (s.clientName || '').toLowerCase().includes(search) ||
        (s.userName || '').toLowerCase().includes(search)
      );
    }

    return sales;
  },

  render() {
    this._page = 1;
    // Peupler select vendeurs
    const sel = document.getElementById('hist-seller');
    if (sel && sel.options.length <= 1) {
      DB.data.users.forEach(u => {
        const o = document.createElement('option');
        o.value = u.id; o.textContent = u.name;
        sel.appendChild(o);
      });
    }

    this._filtered = this._getSales();
    this._renderStats();
    this._renderTable();
  },

  _renderStats() {
    const s  = this._filtered;
    const ca = s.reduce((t, v) => t + v.total,  0);
    const pf = s.reduce((t, v) => t + v.profit, 0);
    const db = s.reduce((t, v) => t + v.debt,   0);
    const mg = ca > 0 ? ((pf / ca) * 100).toFixed(1) : '0';
    const se = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    se('hist-count',      s.length);
    se('hist-ca',         Utils.currency(ca));
    se('hist-ca-sub',     I18n.t('lbl_revenue_total'));
    se('hist-profit',     Utils.currency(pf));
    se('hist-margin-sub', I18n.t('dash_margin_prefix') + mg + '%');
    se('hist-debt',       Utils.currency(db));
  },

  _renderTable() {
    const tbody = document.querySelector('#tableHistory tbody');
    if (!tbody) return;
    const total = this._filtered.length;
    const pages = Math.ceil(total / this._perPage);
    const start = (this._page - 1) * this._perPage;
    const slice = this._filtered.slice(start, start + this._perPage);

    if (!slice.length) {
      tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;color:var(--text3);padding:32px">${I18n.t('lbl_no_sales_criteria')}</td></tr>`;
    } else {
      const locale = I18n._lang === 'en' ? 'en-US' : 'fr-FR';
      tbody.innerHTML = slice.map(s => `
        <tr class="${this._selected.has(s.id)?'row-selected':''}">
          <td><input type="checkbox" class="row-check hist-row-check" value="${Utils.esc(s.id)}" ${this._selected.has(s.id)?'checked':''} onchange="History.toggleOne('${Utils.esc(s.id)}', this.checked, this)" ${!Auth.isAdmin()?'disabled':''}></td>
          <td class="td-mono" style="font-size:.72rem">${new Date(s.date).toLocaleDateString(locale, {day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}${s.deferred?'<span style="margin-left:3px;font-size:.55rem;color:var(--warning)">📒</span>':''}</td>
          <td class="fw-700">${Utils.esc(s.itemName || '')}</td>
          <td class="td-mono">${s.qty}</td>
          <td class="td-mono">${Utils.currency(s.total)}</td>
          <td class="td-mono" style="color:var(--accent);font-weight:800">${Utils.currency(s.profit)}</td>
          <td>${Utils.esc(s.clientName || '—')}</td>
          <td style="font-size:.72rem;color:var(--text3)">${Utils.esc(s.userName || '—')}</td>
          <td class="td-mono" style="color:${s.debt > 0 ? 'var(--danger)' : 'var(--text3)'}">${s.debt > 0 ? Utils.currency(s.debt) : '—'}</td>
          <td><button class="btn btn-danger btn-sm" onclick="Sales.cancel('${Utils.esc(s.id)}')" ${!Auth.isAdmin()?'disabled':''}>${I18n.t('btn_cancel')}</button></td>
        </tr>`).join('');
    }
    this._updateSelectionUI();

    // Pagination
    const pg = document.getElementById('hist-pagination');
    if (!pg) return;
    if (pages <= 1) { pg.innerHTML = ''; return; }
    let html = '';
    if (this._page > 1) html += `<button class="btn btn-ghost btn-sm" onclick="History.goPage(${this._page - 1})">← ${I18n.t('lbl_prev_short')}</button>`;
    html += `<span style="font-family:var(--fm);font-size:.75rem;color:var(--text3)">${I18n.t('lbl_page')} ${this._page} / ${pages} &nbsp;(${total} ${I18n.t('dash_sales_count')})</span>`;
    if (this._page < pages) html += `<button class="btn btn-ghost btn-sm" onclick="History.goPage(${this._page + 1})">${I18n.t('lbl_next_short')} →</button>`;
    pg.innerHTML = html;
  },

  goPage(n) {
    this._page = n;
    this._renderTable();
    document.getElementById('tableHistory')?.scrollIntoView({ behavior: 'smooth' });
  }
};

/* ═══════════════ EXPENSES ═══════════════ */
