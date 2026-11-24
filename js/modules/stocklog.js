'use strict';
/* ═══════════════ STOCKLOG — Historique des mouvements de stock (PRO) ═══════════════
   Affiche, pour tout le stock ou un produit : ventes, retours (déjà synchronisés) et
   réapprovisionnements / corrections / transferts / suppressions (journal local DB.data.stockLog). */
const StockLog = {
  MAX: 3000,
  add(item, type, delta, note) {
    if (!item) return;
    delta = Formats.r(delta);
    if (!delta && type !== 'Suppression') return;
    if (!Array.isArray(DB.data.stockLog)) DB.data.stockLog = [];
    DB.data.stockLog.push({
      id: Utils.uid(), date: new Date().toISOString(), itemId: item.id, itemName: item.name, type,
      delta, after: Formats.r(item.qty), unit: item.unit || '', note: note || '',
      userName: (Auth.currentUser && Auth.currentUser.name) || ''
    });
    if (DB.data.stockLog.length > this.MAX) DB.data.stockLog = DB.data.stockLog.slice(-this.MAX);
  },

  // Fusionne ventes, retours et journal local en une seule liste, du plus récent au plus ancien
  _rows() {
    const rows = [];
    (DB.data.sales || []).filter(s => !s.deleted).forEach(s => rows.push({
      date: s.date, itemId: s.itemId, itemName: s.itemName, type: s.returned ? 'Vente (retournée)' : 'Vente',
      delta: s.returned ? 0 : -s.qty, qtyTxt: Formats.saleQty(s), user: s.userName || '', note: s.clientName || ''
    }));
    (DB.data.returns || []).forEach(r => rows.push({
      date: r.date, itemId: r.itemId, itemName: r.itemName, type: 'Retour client', delta: r.qty, user: r.userName || '', note: r.clientName || ''
    }));
    (DB.data.stockLog || []).forEach(l => rows.push({
      date: l.date, itemId: l.itemId, itemName: l.itemName, type: l.type, delta: l.delta, after: l.after, unit: l.unit, user: l.userName || '', note: l.note || ''
    }));
    return rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  open(itemId) {
    document.getElementById('sl-overlay')?.remove();
    const items = [...DB.data.items].sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    const e = Utils.esc;
    const d = document.createElement('div');
    d.id = 'sl-overlay';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:12px;overflow:auto';
    d.innerHTML = '<div style="background:var(--bg2,#0b1117);border:1px solid var(--border,#2a3441);border-radius:16px;padding:16px;width:100%;max-width:560px;margin:auto">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><h3 style="margin:0">📜 Mouvements de stock</h3>' +
      '<button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById(\'sl-overlay\').remove()">✕</button></div>' +
      '<select id="sl-item" style="width:100%;margin-bottom:8px" onchange="StockLog.render()"><option value="">Tous les produits</option>' +
      items.map(i => '<option value="' + e(i.id) + '"' + (i.id === itemId ? ' selected' : '') + '>' + e(i.name) + '</option>').join('') + '</select>' +
      '<select id="sl-type" style="width:100%;margin-bottom:10px" onchange="StockLog.render()"><option value="">Tous les types</option>' +
      ['Vente', 'Retour client', 'Réapprovisionnement', 'Création', 'Correction', 'Transfert sortant', 'Transfert entrant', 'Suppression'].map(t => '<option>' + t + '</option>').join('') + '</select>' +
      '<div id="sl-list"></div>' +
      '<div style="font-size:.66rem;opacity:.65;margin-top:10px;line-height:1.5">Les ventes et retours viennent de toute la boutique. Réapprovisionnements, corrections, transferts et suppressions sont enregistrés sur l\'appareil où ils sont faits.</div></div>';
    document.body.appendChild(d);
    this.render();
  },

  render() {
    const box = document.getElementById('sl-list'); if (!box) return;
    const id = document.getElementById('sl-item')?.value || '', tp = document.getElementById('sl-type')?.value || '';
    const e = Utils.esc, locale = I18n._lang === 'en' ? 'en-GB' : 'fr-FR';
    let rows = this._rows().filter(r => (!id || r.itemId === id) && (!tp || (r.type || '').indexOf(tp) === 0));
    const total = rows.length; rows = rows.slice(0, 150);
    if (!rows.length) { box.innerHTML = '<div style="text-align:center;opacity:.6;padding:24px;font-size:.8rem">Aucun mouvement.</div>'; return; }
    box.innerHTML = rows.map(r => {
      const dl = r.delta, col = dl > 0 ? 'var(--accent)' : (dl < 0 ? 'var(--danger)' : 'var(--text3)');
      const sign = dl > 0 ? '+' : '';
      const dt = new Date(r.date).toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
      return '<div style="display:flex;justify-content:space-between;gap:10px;padding:9px 0;border-bottom:1px solid var(--border,#1f2933)">' +
        '<div style="min-width:0"><div style="font-weight:700;font-size:.82rem">' + e(r.itemName || '') + '</div>' +
        '<div style="font-size:.68rem;opacity:.7">' + e(r.type) + (r.qtyTxt ? ' · ' + e(r.qtyTxt) : '') + (r.note ? ' · ' + e(r.note) : '') + '</div>' +
        '<div style="font-size:.64rem;opacity:.55">' + dt + (r.user ? ' · ' + e(r.user) : '') + '</div></div>' +
        '<div style="text-align:right;white-space:nowrap"><div style="font-weight:800;color:' + col + '">' + sign + Formats.qtyText(dl) + (r.unit ? ' ' + e(r.unit) : '') + '</div>' +
        (r.after !== undefined ? '<div style="font-size:.62rem;opacity:.55">→ ' + Formats.qtyText(r.after) + '</div>' : '') + '</div></div>';
    }).join('') + (total > rows.length ? '<div style="text-align:center;font-size:.7rem;opacity:.6;padding:8px">150 mouvements affichés sur ' + total + ' — filtre par produit ou par type pour affiner.</div>' : '');
  }
};
