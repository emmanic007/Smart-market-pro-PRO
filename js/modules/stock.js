'use strict';
const Stock = {
  add() {
    const name=document.getElementById('i-name')?.value.trim();
    const code=document.getElementById('i-code')?.value.trim();
    const buy=Utils.num(document.getElementById('i-buy')?.value);
    const sell=Utils.num(document.getElementById('i-sell')?.value);
    let qty=Utils.num(document.getElementById('i-qty')?.value);
    const min=Utils.num(document.getElementById('i-min')?.value)||(Settings.data.stockMin||5);
    const unit=document.getElementById('i-unit')?.value.trim()||'';
    const packName=document.getElementById('i-pack-name')?.value.trim()||'';
    const packN=Utils.num(document.getElementById('i-pack-n')?.value);
    const packed=!!packName||(packN>0);
    if (packed && !(packName&&packN>0)) return UI.toast('Conditionnement : indique le nom ET le nombre d\'unités','danger');
    if (!name)               return UI.toast(I18n.t('toast_err_name_required'),'danger');
    if (name.length>80)      return UI.toast(I18n.t('toast_err_name_too_long'),'danger');
    if (isNaN(buy)||buy<0)   return UI.toast(I18n.t('toast_err_buy_price_invalid'),'danger');
    if (isNaN(sell)||sell<0) return UI.toast(I18n.t('toast_err_sell_price_invalid'),'danger');
    if (isNaN(qty)||qty<=0)  return UI.toast(I18n.t('toast_err_qty_invalid'),'danger');
    let buyU=buy, sellU=sell, fmtNew=null;
    if (packed) { // quantité et prix d'achat comptés par conditionnement
      buyU=Formats.r(buy/packN); qty=Formats.r(qty*packN);
      fmtNew={id:'f'+Math.random().toString(36).slice(2,7),name:packName,n:Formats.r(packN),price:Formats.r(sell*packN)};
    }
    const addFmt=(it)=>{ if(!fmtNew) return; it.formats=it.formats||[];
      if(!it.formats.some(f=>f.n===fmtNew.n||f.name.toLowerCase()===packName.toLowerCase())) it.formats.push(fmtNew); };
    const existing = DB.data.items.find(i=>i.name.toLowerCase()===name.toLowerCase()||(code&&i.code&&i.code===code));
    if (existing) {
      existing.qty=Formats.r(existing.qty+qty); existing.buy=buyU; existing.sell=sellU; existing.min=min;
      if(unit) existing.unit=unit; addFmt(existing);
      if(code) existing.code=code;
      UI.toast(`${I18n.t('toast_stock_restock')} : +${qty} ${name}`,'success');
    } else {
      const category   = document.getElementById('i-category')?.value || 'Autre';
      const supplierId = document.getElementById('i-supplier')?.value || '';
      const tva        = Utils.num(document.getElementById('i-tva')?.value) || 0;
      const sellWithTVA = tva > 0 ? sell * (1 + tva/100) : sell;
      const desc = document.getElementById('i-desc')?.value.trim() || '';
      const ni={id:Utils.uid(),name,code:code||'',buy:buyU,sell:sellU,sellWithTVA,tva,qty,min,category,desc,supplierId,createdAt:new Date().toISOString()};
      if(unit) ni.unit=unit; addFmt(ni);
      DB.data.items.push(ni);
      UI.toast(`${I18n.t('toast_product_added')} : ${name}`,'success');
    }
    DB.save(); UI.renderAll();
    ['i-name','i-code','i-buy','i-sell','i-qty','i-min','i-desc','i-unit','i-pack-name','i-pack-n'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  },
  openEdit(itemId) {
    const item = DB.data.items.find(i => i.id === itemId);
    if (!item) return;
    const ov = document.getElementById('smp-edit-stock-overlay');
    const set = (id, val) => { const el=document.getElementById(id); if(el) el.value=(val??''); };
    set('edit-stock-id',   item.id);
    set('edit-stock-name', item.name);
    set('edit-stock-code', item.code || '');
    set('edit-stock-buy',  item.buy);
    set('edit-stock-sell', item.sell);
    set('edit-stock-qty',  item.qty);
    set('edit-stock-min',  item.min || Settings.data.stockMin || 5);
    set('edit-stock-tva',  item.tva || 0);
    set('edit-stock-desc', item.desc || '');
    set('edit-stock-unit', item.unit || '');
    Formats.editorFill(item);
    const catSel = document.getElementById('edit-stock-cat');
    if (catSel) {
      const uniqueCats = ['Autre', ...Categories.getAll().filter(c => c !== 'Autre')];
      catSel.innerHTML = uniqueCats
        .map(name => `<option value="${Utils.esc(name)}" ${name===item.category?'selected':''}>${Utils.esc(name)}</option>`)
        .join('');
      // Si la catégorie du produit n'est pas dans la liste, l'ajouter
      if (item.category && !uniqueCats.includes(item.category)) {
        catSel.innerHTML += `<option value="${Utils.esc(item.category)}" selected>${Utils.esc(item.category)}</option>`;
      }
    }
    if (ov) { ov.style.display = 'flex'; setTimeout(() => document.getElementById('edit-stock-name')?.focus(), 100); }
  },

  closeEdit() {
    const ov = document.getElementById('smp-edit-stock-overlay');
    if (ov) ov.style.display = 'none';
  },

  saveEdit() {
    const id   = document.getElementById('edit-stock-id')?.value;
    const item = DB.data.items.find(i => i.id === id);
    if (!item) { this.closeEdit(); return; }
    const name = document.getElementById('edit-stock-name')?.value.trim();
    const buy  = Utils.num(document.getElementById('edit-stock-buy')?.value);
    const sell = Utils.num(document.getElementById('edit-stock-sell')?.value);
    const qty  = Utils.num(document.getElementById('edit-stock-qty')?.value);
    const fm   = Formats.editorRead();
    if (fm.error) return UI.toast(fm.error,'danger');
    if (!name)            return UI.toast(I18n.t('toast_err_name_required'),'danger');
    if (isNaN(buy)||buy<0)  return UI.toast(I18n.t('toast_err_buy_price_invalid'),'danger');
    if (isNaN(sell)||sell<0) return UI.toast(I18n.t('toast_err_sell_price_invalid'),'danger');
    if (isNaN(qty)||qty<0)   return UI.toast(I18n.t('toast_err_qty_invalid'),'danger');
    const tva = Utils.num(document.getElementById('edit-stock-tva')?.value) || 0;
    item.name     = name;
    item.code     = document.getElementById('edit-stock-code')?.value.trim() || '';
    item.buy      = buy;
    item.sell     = sell;
    item.sellWithTVA = tva > 0 ? sell * (1 + tva/100) : sell;
    item.tva      = tva;
    item.qty      = Formats.r(qty);
    item.unit     = document.getElementById('edit-stock-unit')?.value.trim() || '';
    if (!item.unit) delete item.unit;
    item.formats  = fm.formats; if (!item.formats.length) delete item.formats;
    item.min      = Utils.num(document.getElementById('edit-stock-min')?.value) || Settings.data.stockMin || 5;
    item.category = document.getElementById('edit-stock-cat')?.value || 'Autre';
    item.desc     = document.getElementById('edit-stock-desc')?.value.trim() || '';
    item.updatedAt = new Date().toISOString();
    DB.save(); UI.renderAll();
    UI.toast(`${I18n.t('toast_product_updated')} : ${name}`,'success');
    this.closeEdit();
  },

  async remove(id) {
    if (!Auth.isAdmin()) return UI.toast(I18n.t('toast_err_admin_required'),'danger');
    const item = DB.data.items.find(i=>i.id===id); if(!item) return;
    const linked = DB.activeSales().filter(s=>s.itemId===id).length;
    if (!await SmpModal.confirm(`${I18n.t('modal_delete_product_irreversible').replace('Cette',`${I18n.t('btn_delete')} "${item.name}"${linked>0?' ('+linked+' '+I18n.t('modal_delete_product_linked')+')':''} — Cette`)}`, {title:I18n.t('modal_delete_product_title'), icon:'🗑️', okLabel:I18n.t('modal_delete_product_ok'), okClass:'btn-danger'})) return;
    DB.data.items = DB.data.items.filter(i=>i.id!==id);
    DB.save(); UI.renderAll();
    UI.toast(I18n.t('toast_product_deleted'),'warning');
  },
  filterTable(q) {
    const term = (q||'').toLowerCase().trim();
    const rows = document.querySelectorAll('#tableStock tbody tr');
    rows.forEach(tr => {
      const txt = tr.textContent.toLowerCase();
      tr.style.display = (!term || txt.includes(term)) ? '' : 'none';
    });
  }
};

/* ═══════════════ ANALYTICS ═══════════════ */
