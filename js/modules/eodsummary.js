'use strict';
const EODSummary = {
  _timer: null,
  _shownToday: null,

  schedule() {
    clearTimeout(this._timer);
    if (!Settings.data.eodEnabled) return;
    const now  = new Date();
    const eod  = new Date(now.getFullYear(), now.getMonth(), now.getDate(),
                          Settings.data.eodHour ?? 20, Settings.data.eodMinute ?? 0, 0);
    if (eod <= now) return; // heure déjà passée aujourd'hui
    const delay = eod.getTime() - now.getTime();
    this._timer = setTimeout(() => this._trigger(), delay);
    console.log('[EOD] Résumé planifié dans', Math.round(delay/60000), 'min');
  },

  _trigger() {
    const today = new Date().toDateString();
    if (this._shownToday === today) return; // déjà affiché aujourd'hui
    this._shownToday = today;
    if (Auth.currentUser && Auth.isAdmin()) this.show();
  },

  _mode: 'day', // 'day' | 'week' | 'month' | 'year' | 'custom'
  _anchorDate: null, // Date de référence pour la navigation
  _customStart: null,
  _customEnd: null,

  setMode(mode) {
    this._mode = mode;
    document.querySelectorAll('.eod-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    const stdNav = document.getElementById('eod-nav-standard');
    const customNav = document.getElementById('eod-nav-custom');
    if (mode === 'custom') {
      if (stdNav) stdNav.style.display = 'none';
      if (customNav) customNav.style.display = 'flex';
      // Valeurs par défaut : les 7 derniers jours si rien n'est encore choisi
      const fromEl = document.getElementById('eod-custom-from');
      const toEl   = document.getElementById('eod-custom-to');
      if (!this._customStart || !this._customEnd) {
        const today = new Date();
        const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 6);
        this._customStart = weekAgo;
        this._customEnd   = today;
      }
      if (fromEl) fromEl.value = this._toDateStr(this._customStart);
      if (toEl)   toEl.value   = this._toDateStr(this._customEnd);
      if (toEl)   toEl.max     = this._toDateStr(new Date());
      this.show();
    } else {
      if (stdNav) stdNav.style.display = 'flex';
      if (customNav) customNav.style.display = 'none';
      this.show(this._anchorDate ? this._toDateStr(this._anchorDate) : null);
    }
  },

  applyCustomRange() {
    const fromEl = document.getElementById('eod-custom-from');
    const toEl   = document.getElementById('eod-custom-to');
    const fromV  = fromEl?.value;
    const toV    = toEl?.value;
    if (!fromV || !toV) { UI.toast(I18n.t('toast_err_dates_required'), 'warning'); return; }
    const start = new Date(fromV + 'T00:00:00');
    const end   = new Date(toV + 'T23:59:59');
    if (start > end) { UI.toast(I18n.t('toast_err_date_range_invalid'), 'warning'); return; }
    this._customStart = start;
    this._customEnd   = end;
    this.show();
  },

  _toDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  },

  // Calcule {start, end} en Date selon le mode et une date d'ancrage
  _getRange(anchor) {
    const s = new Date(anchor); s.setHours(0,0,0,0);
    const e = new Date(anchor); e.setHours(23,59,59,999);
    if (this._mode === 'custom') {
      return { start: this._customStart || s, end: this._customEnd || e };
    }
    if (this._mode === 'day') {
      return { start: s, end: e };
    }
    if (this._mode === 'week') {
      // Semaine ISO : lundi à dimanche
      const day = s.getDay(); // 0=dimanche
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const start = new Date(s); start.setDate(s.getDate() + diffToMonday);
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
      return { start, end };
    }
    if (this._mode === 'month') {
      const start = new Date(s.getFullYear(), s.getMonth(), 1);
      const end = new Date(s.getFullYear(), s.getMonth()+1, 0); end.setHours(23,59,59,999);
      return { start, end };
    }
    if (this._mode === 'year') {
      const start = new Date(s.getFullYear(), 0, 1);
      const end = new Date(s.getFullYear(), 11, 31); end.setHours(23,59,59,999);
      return { start, end };
    }
    return { start: s, end: e };
  },

  _formatRangeLabel(start, end) {
    const L = I18n._lang === 'en';
    if (this._mode === 'day') {
      return start.toLocaleDateString(L?'en-GB':'fr-FR', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
    }
    const opts = {day:'numeric', month:'short'};
    const startStr = start.toLocaleDateString(L?'en-GB':'fr-FR', opts);
    const endStr = end.toLocaleDateString(L?'en-GB':'fr-FR', {day:'numeric', month:'short', year:'numeric'});
    if (this._mode === 'week') return (L?'Week: ':'Semaine : ') + startStr + ' — ' + endStr;
    if (this._mode === 'month') return start.toLocaleDateString(L?'en-GB':'fr-FR', {month:'long', year:'numeric'});
    if (this._mode === 'year') return String(start.getFullYear());
    if (this._mode === 'custom') return startStr + ' → ' + endStr;
    return startStr + ' — ' + endStr;
  },

  show(dateStr) {
    // dateStr optionnel 'YYYY-MM-DD' — sinon aujourd'hui ou dernière date visitée
    const anchor = dateStr ? new Date(dateStr + 'T12:00:00') : (this._anchorDate || new Date());
    this._anchorDate = anchor;
    const { start, end } = this._getRange(anchor);

    const inRange = (d) => { const t = new Date(d).getTime(); return t >= start.getTime() && t <= end.getTime(); };

    const sales   = DB.activeSales().filter(s => inRange(s.date));
    const periodReturns = (DB.data.returns || []).filter(r => inRange(r.date));
    const ca      = sales.reduce((t, s) => t + s.total,  0);
    const profit  = sales.reduce((t, s) => t + s.profit, 0);
    const debt    = sales.reduce((t, s) => t + s.debt,   0);
    const paid    = sales.reduce((t, s) => t + (s.paid||0), 0);
    const margin  = ca > 0 ? ((profit / ca) * 100).toFixed(1) : '0';
    const exps    = (DB.data.expenses || []).filter(e => inRange(e.date||0));
    const expT    = exps.reduce((t, e) => t + e.amount, 0);
    const netP    = profit - expT;

    const capitalReel = sales.reduce((t, s) => {
      const item = DB.data.items.find(i => i.id === s.itemId);
      return t + (item ? item.buy * s.qty : 0);
    }, 0);

    const fondOuverture = DB.data.cashInit || 0;
    const caisse = fondOuverture + paid - expT;

    const prodMap = {};
    sales.forEach(s => { if (!prodMap[s.itemName]) prodMap[s.itemName] = 0; prodMap[s.itemName] += s.total; });
    const topProd = Object.entries(prodMap).sort((a, b) => b[1] - a[1])[0];

    const selMap = {};
    sales.forEach(s => { const n = s.userName || 'Inconnu'; if (!selMap[n]) selMap[n] = 0; selMap[n] += s.total; });
    const topSel = Object.entries(selMap).sort((a, b) => b[1] - a[1])[0];

    const row = (lbl, val, color) => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:.82rem;color:var(--text2)">${lbl}</span>
        <span style="font-family:var(--fd);font-weight:800;color:${color || 'var(--text)'}">${val}</span>
      </div>`;

    const dateEl = document.getElementById('eod-date');
    if (dateEl) dateEl.textContent = this._formatRangeLabel(start, end);

    const picker = document.getElementById('eod-date-picker');
    if (picker) {
      picker.value = this._toDateStr(anchor);
      const now = new Date();
      picker.max = this._toDateStr(now);
    }
    const nextBtn = document.getElementById('eod-next-btn');
    if (nextBtn) {
      const now = new Date();
      nextBtn.disabled = end.getTime() >= now.setHours(23,59,59,999);
    }
    // Marquer le bouton de mode actif
    document.querySelectorAll('.eod-mode-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === this._mode);
    });

    const expensesLabel = this._mode === 'day'
      ? (I18n._lang==='en'?'Day Expenses':'💸 Dépenses du Jour')
      : (I18n._lang==='en'?'Period Expenses':'💸 Dépenses de la Période');
    const salesCountLabel = I18n._lang==='en'?'Number of sales':'Nombre de ventes';

    const content = document.getElementById('eod-content');
    if (content) content.innerHTML = `
      ${row(salesCountLabel, sales.length + ' transactions')}
      ${row(I18n._lang==='en'?'Revenue':'Chiffre d\'Affaires', Utils.currency(ca), 'var(--info)')}
      ${row(I18n._lang==='en'?'Gross Profit':'Profit Brut', Utils.currency(profit) + ' (' + margin + '%)', 'var(--accent)')}
      ${row(expensesLabel, (expT>0?'-':'')+Utils.currency(expT), expT>0?'var(--danger)':'var(--text2)')}
      ${expT > 0 ? row(I18n._lang==='en'?'Net Profit':'✅ Bénéfice Net Réel', Utils.currency(netP), netP >= 0 ? 'var(--accent)' : 'var(--danger)') : ''}
      ${row(I18n._lang==='en'?'Cost of goods sold':'🏷️ Capital Réel (coût achat)', Utils.currency(capitalReel), 'var(--text2)')}
      ${debt > 0 ? row(I18n._lang==='en'?'Uncollected receivables':'Créances non encaissées', Utils.currency(debt), 'var(--warning)') : ''}
      ${this._mode==='day' && fondOuverture > 0 ? row(I18n._lang==='en'?'Opening fund':'Fond d\'ouverture', Utils.currency(fondOuverture)) : ''}
      ${row(I18n._lang==='en'?'💰 Cash in register':'💰 Liquidités en caisse', Utils.currency(caisse), caisse>=0?'var(--accent)':'var(--danger)')}
      ${periodReturns.length > 0 ? row(I18n._lang==='en'?'Customer returns':'Retours clients', periodReturns.length + ' retour(s) — -' + Utils.currency(periodReturns.reduce((t,r)=>t+r.amount,0)), 'var(--danger)') : ''}
      ${topProd ? row(I18n._lang==='en'?'Best Product':'Meilleur Produit', Utils.esc(topProd[0]) + ' — ' + Utils.currency(topProd[1])) : ''}
      ${topSel  ? row(I18n._lang==='en'?'Best Seller':'Meilleur Vendeur',  Utils.esc(topSel[0]) + ' — ' + Utils.currency(topSel[1])) : ''}
      ${sales.length === 0 ? `<div style="text-align:center;padding:20px;color:var(--text3);font-family:var(--fm);font-size:.82rem">${I18n.t('no_sales')}</div>` : ''}
    `;

    const ov = document.getElementById('eod-overlay');
    if (ov) ov.style.display = 'flex';
  },

  onDateChange() {
    const picker = document.getElementById('eod-date-picker');
    if (picker && picker.value) this.show(picker.value);
  },

  // Recule d'une unité selon le mode actif (jour/semaine/mois/année)
  prevDay() {
    const current = this._anchorDate ? new Date(this._anchorDate) : new Date();
    if (this._mode === 'day')   current.setDate(current.getDate() - 1);
    if (this._mode === 'week')  current.setDate(current.getDate() - 7);
    if (this._mode === 'month') current.setMonth(current.getMonth() - 1);
    if (this._mode === 'year')  current.setFullYear(current.getFullYear() - 1);
    this.show(this._toDateStr(current));
  },

  // Avance d'une unité selon le mode actif, jamais au-delà d'aujourd'hui
  nextDay() {
    const current = this._anchorDate ? new Date(this._anchorDate) : new Date();
    if (this._mode === 'day')   current.setDate(current.getDate() + 1);
    if (this._mode === 'week')  current.setDate(current.getDate() + 7);
    if (this._mode === 'month') current.setMonth(current.getMonth() + 1);
    if (this._mode === 'year')  current.setFullYear(current.getFullYear() + 1);
    const { start: nextStart } = this._getRange(current);
    const now = new Date(); now.setHours(23,59,59,999);
    if (nextStart.getTime() > now.getTime()) return; // Ne pas dépasser aujourd'hui
    this.show(this._toDateStr(current));
  },

  goToday() {
    this._anchorDate = null;
    this.show();
  },

  close() {
    const ov = document.getElementById('eod-overlay');
    if (ov) ov.style.display = 'none';
  },

  print() {
    const shop    = Settings.data.shopName || 'Smart Market Pro';
    const area    = document.getElementById('print-area');
    const content = document.getElementById('eod-content')?.innerText || '';
    const date    = document.getElementById('eod-date')?.textContent || '';
    if (area) {
      area.innerHTML = '<div class="t-center t-bold">' + Utils.esc(shop) + '</div>'
        + `<div class="t-center t-bold">${I18n._lang==='en'?'END OF DAY SUMMARY':'RÉSUMÉ FIN DE JOURNÉE'}</div>`
        + '<div class="t-center">' + Utils.esc(date) + '</div>'
        + '<div class="t-line"></div>'
        + '<div style="white-space:pre-wrap;font-size:11px">' + Utils.esc(content) + '</div>';
    }
    this.close();
    window.print();
  }
};

/* ═══════════════ HISTORY ═══════════════ */
