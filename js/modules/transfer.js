'use strict';
/* ═══════════════ TRANSFER — Ouvrir / transférer du stock (PRO) ═══════════════
   Retire des unités d'un produit A (ex. des casiers de Coca) et les ajoute à un produit B
   (ex. Coca à l'unité), en reportant le coût d'achat (coût moyen pondéré sur B). */
const Transfer = {
  _src: null,
  _el() { return document.getElementById('tr-overlay'); },
  _q(id) { return document.getElementById(id); },

  open(srcId) {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin'), 'danger');
    const src = DB.data.items.find(i => i.id === srcId); if (!src) return;
    const others = DB.data.items.filter(i => i.id !== srcId)
      .sort((a, b) => a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' }));
    if (!others.length) return UI.toast('Crée d\'abord le produit de destination (ex. « Coca à l\'unité »).', 'warning');
    this._src = src;
    this._el()?.remove();
    const d = document.createElement('div');
    d.id = 'tr-overlay';
    d.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:99999;display:flex;align-items:flex-start;justify-content:center;padding:16px;overflow:auto';
    const e = Utils.esc, inp = 'width:100%;margin-bottom:10px';
    d.innerHTML = '<div style="background:var(--bg2,#0b1117);border:1px solid var(--border,#2a3441);border-radius:16px;padding:18px;width:100%;max-width:400px;margin:auto">' +
      '<h3 style="margin:0 0 4px">🔀 Ouvrir / transférer</h3>' +
      '<div style="font-size:.75rem;opacity:.7;margin-bottom:14px">Sors du stock de <strong>' + e(src.name) + '</strong> pour l\'ajouter à un autre produit. Stock actuel : ' + e(Formats.stockShort(src)) + '</div>' +
      '<label class="form-label">Format à retirer</label><select id="tr-fmt" style="' + inp + '" onchange="Transfer.calc()"></select>' +
      '<label class="form-label">Nombre de ce format</label><input type="number" id="tr-count" value="1" min="0" step="any" inputmode="decimal" style="' + inp + '" oninput="Transfer.calc()">' +
      '<div id="tr-out" style="font-size:.78rem;opacity:.8;margin:-4px 0 12px"></div>' +
      '<label class="form-label">Produit de destination</label><select id="tr-dest" style="' + inp + '" onchange="Transfer.calc(true)">' +
      '<option value="">— Choisir —</option>' + others.map(i => '<option value="' + e(i.id) + '">' + e(i.name) + ' (' + e(Formats.stockShort(i)) + ')</option>').join('') + '</select>' +
      '<label class="form-label" id="tr-recv-lbl">Quantité reçue</label><input type="number" id="tr-recv" min="0" step="any" inputmode="decimal" style="' + inp + '" oninput="Transfer._manual=true;Transfer.calc()">' +
      '<div id="tr-info" style="font-size:.75rem;opacity:.85;margin-bottom:12px"></div>' +
      '<div style="display:flex;gap:8px"><button type="button" class="btn btn-secondary" style="flex:1" onclick="Transfer.close()">Annuler</button>' +
      '<button type="button" class="btn btn-primary" style="flex:1" onclick="Transfer.apply()">Valider</button></div></div>';
    document.body.appendChild(d);
    Formats.fillSelect(this._q('tr-fmt'), src, '');
    this._manual = false;
    this.calc(true);
  },
  close() { this._el()?.remove(); this._src = null; },

  _read() {
    const src = this._src; if (!src) return null;
    const f = Formats.get(src, this._q('tr-fmt')?.value);
    const count = Utils.num(this._q('tr-count')?.value);
    const out = Formats.r(count * f.n);
    const dest = DB.data.items.find(i => i.id === this._q('tr-dest')?.value) || null;
    return { src, f, count, out, dest };
  },

  calc(resetRecv) {
    const r = this._read(); if (!r) return;
    const o = this._q('tr-out');
    if (o) o.textContent = r.out > 0 ? '= ' + Formats.qtyText(r.out) + ' ' + Formats.baseName(r.src) + ' retiré(s)' : '';
    if (r.dest) {
      const lbl = this._q('tr-recv-lbl'); if (lbl) lbl.textContent = 'Quantité reçue (en ' + Formats.baseName(r.dest) + ')';
      const rv = this._q('tr-recv');
      if (rv && (resetRecv === true || !this._manual)) { rv.value = r.out > 0 ? r.out : ''; if (resetRecv === true) this._manual = false; }
      const recv = Utils.num(rv?.value);
      const info = this._q('tr-info');
      if (info && r.out > 0 && recv > 0) {
        const nb = Formats.r((r.dest.qty * r.dest.buy + r.src.buy * r.out) / (r.dest.qty + recv));
        info.textContent = r.src.name + ' : ' + Formats.qtyText(r.src.qty) + ' → ' + Formats.qtyText(Formats.r(r.src.qty - r.out)) + '  •  ' +
          r.dest.name + ' : ' + Formats.qtyText(r.dest.qty) + ' → ' + Formats.qtyText(Formats.r(r.dest.qty + recv)) + '  •  coût de ' + r.dest.name + ' : ' + Utils.currency(nb);
      } else if (info) info.textContent = '';
    }
  },

  apply() {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin'), 'danger');
    const r = this._read(); if (!r) return;
    const recv = Utils.num(this._q('tr-recv')?.value);
    if (!r.dest) return UI.toast('Choisis le produit de destination.', 'danger');
    if (isNaN(r.out) || r.out <= 0) return UI.toast('Quantité à retirer invalide.', 'danger');
    if (r.out > r.src.qty + 1e-9) return UI.toast('Stock insuffisant (dispo : ' + Formats.stockShort(r.src) + ').', 'danger');
    if (isNaN(recv) || recv <= 0) return UI.toast('Quantité reçue invalide.', 'danger');
    const cost = r.src.buy * r.out;
    r.dest.buy = Formats.r((r.dest.qty * r.dest.buy + cost) / (r.dest.qty + recv));
    r.dest.qty = Formats.r(r.dest.qty + recv);
    r.src.qty  = Formats.r(r.src.qty - r.out);
    DB.save(); UI.renderAll();
    UI.toast(Formats.qtyText(r.out) + ' ' + Formats.baseName(r.src) + ' ' + r.src.name + ' → ' + Formats.qtyText(recv) + ' ' + Formats.baseName(r.dest) + ' ' + r.dest.name, 'success');
    this.close();
  }
};
