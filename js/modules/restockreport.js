'use strict';
const RestockReport = {

  open() {
    const ov = document.getElementById('restock-overlay');
    if (!ov) return;
    ov.style.display = 'flex';
    this.render();
  },

  close() {
    const ov = document.getElementById('restock-overlay');
    if (ov) ov.style.display = 'none';
  },

  /* Calcule la vitesse d'écoulement d'un article sur les 7 derniers jours */
  _velocity(itemId) {
    const now   = Date.now();
    const week  = 7 * 24 * 3600 * 1000;
    const sales = DB.data.sales.filter(s =>
      s.itemId === itemId && !s.deleted && !s.returned &&
      (now - new Date(s.date).getTime()) <= week
    );
    const qtyWeek = sales.reduce((t, s) => t + s.qty, 0);
    return qtyWeek; // unités vendues sur 7 jours
  },

  /* Calcule la quantité recommandée à commander */
  _recommended(item) {
    const min      = item.min || Settings.data.stockMin || 5;
    const velocity = this._velocity(item.id);
    // Stock cible = seuil minimum + 2 semaines de ventes
    const target   = min + Math.ceil(velocity * 2);
    const toOrder  = Math.max(0, target - item.qty);
    return { toOrder, velocity, target };
  },

  render() {
    const items   = DB.data.items;
    const minQty  = Settings.data.stockMin || 5;

    const outOfStock = items.filter(i => i.qty === 0);
    const lowStock   = items.filter(i => i.qty > 0 && i.qty <= (i.min || minQty));
    const critical   = [...outOfStock, ...lowStock];

    // KPIs
    const se = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
    se('rs-count-out', outOfStock.length);
    se('rs-count-low', lowStock.length);

    let totalCost = 0;
    const rows = critical.map(i => {
      const { toOrder, velocity, target } = this._recommended(i);
      totalCost += toOrder * i.buy;
      return { item: i, toOrder, velocity, target };
    }).sort((a, b) => b.toOrder - a.toOrder);

    se('rs-cost-total', Utils.currency(totalCost));

    const sub = document.getElementById('restock-subtitle');
    if (sub) {
      const locale = I18n._lang === 'en' ? 'en-US' : 'fr-FR';
      const d = new Date().toLocaleDateString(locale, {day:'numeric', month:'long', year:'numeric'});
      sub.textContent = critical.length + ' ' + I18n.t('rs_items_to_restock') + ' — ' + d;
    }

    const list = document.getElementById('restock-list');
    if (!list) return;

    if (!critical.length) {
      list.innerHTML = `
        <div style="text-align:center;padding:32px">
          <div style="font-size:3rem;margin-bottom:10px">✅</div>
          <div style="font-family:var(--fd);font-weight:800;color:var(--accent)">${I18n.t('rs_all_ok')}</div>
          <div style="font-family:var(--fm);font-size:.75rem;color:var(--text3);margin-top:6px">${I18n.t('rs_no_critical')}</div>
        </div>`;
      return;
    }

    list.innerHTML = rows.map(({ item: i, toOrder, velocity, target }) => {
      const isOut   = i.qty === 0;
      const urgency = isOut ? 'var(--danger)' : 'var(--warning)';
      const badge   = isOut
        ? `<span style="background:rgba(255,59,92,.15);color:var(--danger);font-family:var(--fm);font-size:.58rem;font-weight:700;padding:2px 6px;border-radius:4px">${I18n.t('rs_badge_out')}</span>`
        : `<span style="background:rgba(255,186,0,.12);color:var(--warning);font-family:var(--fm);font-size:.58rem;font-weight:700;padding:2px 6px;border-radius:4px">${I18n.t('rs_badge_low')}</span>`;
      const velText = velocity > 0
        ? `<span style="color:var(--text3)">${I18n.t('rs_velocity')} : </span><strong>${velocity} ${I18n.t('rs_units_week')}</strong>`
        : `<span style="color:var(--text3)">${I18n.t('rs_no_recent_sales')}</span>`;

      return `
        <div style="padding:12px 14px;background:var(--sur2);border:1.5px solid ${urgency}22;border-left:3px solid ${urgency};border-radius:var(--rmd);margin-bottom:8px">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;margin-bottom:6px">
            <div style="flex:1;min-width:0">
              <div style="font-family:var(--fd);font-weight:800;font-size:.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${Utils.esc(i.name)}</div>
              <div style="font-family:var(--fm);font-size:.65rem;margin-top:2px">${badge} &nbsp;${velText}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-family:var(--fd);font-size:1.1rem;font-weight:800;color:${urgency}">${toOrder}</div>
              <div style="font-family:var(--fm);font-size:.58rem;color:var(--text3)">${I18n.t('rs_to_order')}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;font-family:var(--fm);font-size:.65rem">
            <div style="background:var(--surface);padding:5px 8px;border-radius:4px">
              <div style="color:var(--text3)">${I18n.t('rs_current_stock')}</div>
              <div style="font-weight:700;color:${urgency}">${i.qty} ${I18n.t('rs_units')}</div>
            </div>
            <div style="background:var(--surface);padding:5px 8px;border-radius:4px">
              <div style="color:var(--text3)">${I18n.t('rs_alert_threshold')}</div>
              <div style="font-weight:700">${i.min || Settings.data.stockMin || 5} ${I18n.t('rs_units')}</div>
            </div>
            <div style="background:var(--surface);padding:5px 8px;border-radius:4px">
              <div style="color:var(--text3)">${I18n.t('restock_cost')}</div>
              <div style="font-weight:700;color:var(--accent)">${Utils.currency(toOrder * i.buy)}</div>
            </div>
          </div>
          ${i.sellWithTVA || i.sell ? `<div style="font-family:var(--fm);font-size:.62rem;color:var(--text3);margin-top:6px">${I18n.t('rs_buy_price')} : ${Utils.currency(i.buy)} · ${I18n.t('rs_sell_price')} : ${Utils.currency(i.sellWithTVA||i.sell)} · ${I18n.t('rs_margin')} : ${i.buy>0?Math.round((((i.sell||0)-i.buy)/i.buy)*100)+'%':'—'}</div>` : ''}
        </div>`;
    }).join('');
  },

  exportCSV() {
    const items  = DB.data.items;
    const minQty = Settings.data.stockMin || 5;
    const crit   = [...items.filter(i=>i.qty===0), ...items.filter(i=>i.qty>0&&i.qty<=(i.min||minQty))];
    if (!crit.length) { UI.toast(I18n.t('toast_err_no_stock'),'warning'); return; }
    const curr = Settings.getCurrency();
    const locale = I18n._lang === 'en' ? 'en-US' : 'fr-FR';
    const esc  = v => { const s=String(v??''); return s.includes(',')?'"'+s+'"':s; };
    const lines = [
      I18n.t('restock_title').replace(/^[^\wÀ-ÿ]*/,'').trim() + ',' + new Date().toLocaleDateString(locale),
      '',
      I18n.t('rs_csv_header'),
      ...crit.map(i => {
        const { toOrder, velocity } = this._recommended(i);
        return [i.name, i.qty, i.min||minQty, velocity, toOrder, i.buy+' '+curr, (toOrder*i.buy)+' '+curr].map(esc).join(',');
      })
    ];
    const csv = '\uFEFF' + lines.join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
    a.download = 'Approvisionnement_' + new Date().toLocaleDateString('fr-FR').split('/').join('-') + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
    UI.toast(I18n.t('toast_export_ok'),'success');
  }
};

/* ═══════════════ CLOUD CONFIG ═══════════════ */
