'use strict';
const Categories = {
  defaults: ['Alimentation','Boissons','Hygiène','Cosmétique','Électronique','Textile','Papeterie','Autre'],

  // Normalise toujours les catégories en strings pures
  getAll() {
    const raw = DB.data.categories || this.defaults;
    return [...new Set(raw.map(c => typeof c === 'string' ? c.trim() : (c && c.name ? c.name.trim() : '')).filter(Boolean))];
  },

  // Normalise la DB au démarrage (migration strings/objets)
  normalize() {
    if (!DB.data.categories) { DB.data.categories = [...this.defaults]; return; }
    DB.data.categories = this.getAll();
  },

  add(name) {
    if (!name || name.trim().length < 2) return UI.toast(I18n.t('toast_err_cat_name_short'),'danger');
    this.normalize();
    if (DB.data.categories.includes(name.trim())) return UI.toast(I18n.t('toast_category_exists'),'warning');
    DB.data.categories.push(name.trim());
    DB.save();
    this.render();
    UI.toast(`${I18n.t('toast_category_added')} : ${name.trim()}`,'success');
  },

  remove(name) {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin_required'),'danger');
    if (this.defaults.includes(name)) return UI.toast(I18n.t('toast_category_default'),'warning');
    this.normalize();
    DB.data.categories = DB.data.categories.filter(c => c !== name);
    // Remove category from products
    DB.data.items.forEach(i => { if (i.category === name) i.category = 'Autre'; });
    DB.save();
    this.render();
    UI.toast(I18n.t('toast_category_deleted'),'warning');
  },

  render() {
    const tbody = document.querySelector('#tableCat tbody');
    if (!tbody) return;
    const cats = this.getAll();
    tbody.innerHTML = cats.map(cat => {
      const count = DB.data.items.filter(i => i.category === cat).length;
      return `<tr>
        <td class="fw-700">${Utils.esc(cat)}</td>
        <td class="td-mono">${count} produit(s)</td>
        <td><button class="btn btn-danger btn-sm" onclick="Categories.remove('${Utils.esc(cat)}')" ${this.defaults.includes(cat)||!Auth.isAdmin()?'disabled':''}>Suppr.</button></td>
      </tr>`;
    }).join('');

    // Mettre à jour TOUS les selects de catégories (ajout, filtre, modification)
    const selects = ['i-category','s-cat-filter','edit-stock-cat'];
    selects.forEach(id => {
      const sel = document.getElementById(id);
      if (!sel) return;
      const val = sel.value;
      sel.innerHTML = (id==='s-cat-filter'?'<option value="">Toutes</option>':'') +
        cats.map(c => `<option value="${Utils.esc(c)}">${Utils.esc(c)}</option>`).join('');
      if (val && cats.includes(val)) sel.value = val;
    });
  }
};

/* ═══════════════════════════════════════════════════════
   MODULE: SUPPLIERS — Gestion des fournisseurs
   ═══════════════════════════════════════════════════════ */
