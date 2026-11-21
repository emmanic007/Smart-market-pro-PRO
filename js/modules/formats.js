'use strict';
/* ═══════════════ FORMATS — unités de base et formats de vente (PRO) ═══════════════
   Le stock est TOUJOURS compté en unité de base (bouteille, kg, pièce).
   Un format (casier, quart de kilo…) = { id, name, n, price } :
   n = nombre d'unités de base contenues (peut être décimal), price = prix d'UN format. */
const Formats = {
  r(n) { return Math.round((Number(n) || 0) * 1e6) / 1e6; },
  baseName(item) { return (item && item.unit) ? item.unit : 'unité'; },
  has(item) { return !!(item && Array.isArray(item.formats) && item.formats.length); },
  // Unité de base d'abord (id ''), puis les formats définis
  list(item) {
    if (!item) return [];
    const base = { id: '', name: this.baseName(item), n: 1, price: Number(item.sell) || 0 };
    const fm = (item.formats || []).filter(f => f && f.n > 0).map(f => ({
      id: String(f.id), name: String(f.name || ''), n: Number(f.n), price: Number(f.price) || 0
    }));
    return [base].concat(fm);
  },
  get(item, id) { return this.list(item).find(f => f.id === (id || '')) || this.list(item)[0]; },
  // Calcule la ligne de vente pour `count` formats de `fmtId` (qty en unités de base)
  line(item, fmtId, count) {
    const f = this.get(item, fmtId);
    const c = this.r(count);
    const qty = this.r(c * f.n);
    const total = Math.round(f.price * c * 100) / 100;
    const price = f.n > 0 ? this.r(f.price / f.n) : 0;
    const profit = Math.round((total - (Number(item.buy) || 0) * qty) * 100) / 100;
    const out = { qty, price, total, profit };
    if (f.id) out.fmt = { id: f.id, name: f.name, n: f.n, count: c };
    return out;
  },
  // Affichage d'une ligne de vente : « 2 × Casier » ou la quantité simple
  saleQty(sale) {
    if (sale && sale.fmt && sale.fmt.name) return sale.fmt.count + ' × ' + sale.fmt.name;
    return this.qtyText(sale ? sale.qty : 0);
  },
  qtyText(q) {
    const v = this.r(q);
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 3 }).format(v);
  },
  // Ex. « 37 bouteille ≈ 3 Casier + 1 » (plus grand format entier d'abord)
  stockLabel(item) {
    const q = this.r(item ? item.qty : 0);
    let txt = this.qtyText(q) + ' ' + this.baseName(item);
    const big = (item && item.formats || []).filter(f => f && f.n > 1).sort((a, b) => b.n - a.n)[0];
    if (big && q >= big.n) {
      const k = Math.floor(this.r(q / big.n));
      const rest = this.r(q - k * big.n);
      txt += ' ≈ ' + k + ' ' + big.name + (rest > 0 ? ' + ' + this.qtyText(rest) : '');
    }
    return txt;
  },
  fillSelect(sel, item, selectedId) {
    if (!sel) return;
    sel.innerHTML = this.list(item).map(f =>
      '<option value="' + Utils.esc(f.id) + '">' + Utils.esc(f.name) +
      (f.n !== 1 ? ' (' + this.qtyText(f.n) + ')' : '') + ' — ' + Utils.currency(f.price) + '</option>'
    ).join('');
    sel.value = selectedId || '';
  },
  /* ── Éditeur de formats (fenêtre de modification d'un produit) ── */
  _row(f) {
    const e = Utils.esc;
    return '<div class="fmt-row" style="display:grid;grid-template-columns:1.4fr .8fr 1fr auto;gap:6px;margin-bottom:6px">' +
      '<input type="text" class="fmt-name" placeholder="Nom (ex. Casier)" maxlength="30" value="' + e(f.name || '') + '" data-id="' + e(f.id || '') + '">' +
      '<input type="number" class="fmt-n" placeholder="Unités" min="0" step="any" inputmode="decimal" value="' + e(f.n ?? '') + '">' +
      '<input type="number" class="fmt-price" placeholder="Prix" min="0" step="any" inputmode="decimal" value="' + e(f.price ?? '') + '">' +
      '<button type="button" class="btn btn-danger btn-sm" onclick="this.parentNode.remove()">✕</button></div>';
  },
  editorFill(item) {
    const box = document.getElementById('edit-formats-list'); if (!box) return;
    box.innerHTML = (item.formats || []).map(f => this._row(f)).join('');
  },
  editorAdd() {
    const box = document.getElementById('edit-formats-list'); if (!box) return;
    box.insertAdjacentHTML('beforeend', this._row({ id: '' }));
  },
  // Lit l'éditeur ; renvoie {formats} ou {error}
  editorRead() {
    const rows = document.querySelectorAll('#edit-formats-list .fmt-row');
    const out = [], seen = new Set();
    for (const r of rows) {
      const name = r.querySelector('.fmt-name').value.trim();
      const n = Utils.num(r.querySelector('.fmt-n').value);
      const price = Utils.num(r.querySelector('.fmt-price').value);
      if (!name && isNaN(n) && isNaN(price)) continue;
      if (!name || !(n > 0) || isNaN(price) || price < 0) return { error: 'Format incomplet : nom, unités (> 0) et prix sont obligatoires.' };
      if (seen.has(name.toLowerCase())) return { error: 'Deux formats ont le même nom : ' + name };
      seen.add(name.toLowerCase());
      out.push({ id: r.querySelector('.fmt-name').dataset.id || ('f' + Math.random().toString(36).slice(2, 7)), name, n: this.r(n), price });
    }
    return { formats: out };
  }
};
