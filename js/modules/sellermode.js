'use strict';
const SellerMode = {
  _active: false,
  _cart:   [],
  _mobTab: 'products',

  activate() {
    this._active = true;
    this._cart   = [];
    this._mobTab = 'products';
    ['top-nav','bot-nav','mob-header'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    const cont = document.querySelector('.container'); if (cont) cont.style.display = 'none';
    const foot = document.querySelector('footer');    if (foot) foot.style.display = 'none';
    const ov = document.getElementById('seller-mode-overlay');
    if (ov) {
      ov.classList.add('active');
      // Init noms
      const sn = document.getElementById('sm-shop-name');
      const sl = document.getElementById('sm-seller-name');
      if (sn) sn.textContent = Settings.data.shopName || 'Smart Market Pro';
      if (sl) sl.textContent = Auth.currentUser?.name || I18n.t('role_seller');
      this.renderProducts();
      this.renderCart();
      // Toujours démarrer sur l'onglet Produits
      this.mobTab('products');
    }
  },

  deactivate() {
    this._active = false;
    const ov = document.getElementById('seller-mode-overlay');
    if (ov) ov.classList.remove('active');
    ['top-nav','bot-nav','mob-header'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.removeProperty('display');
    });
    const cont = document.querySelector('.container'); if (cont) cont.style.removeProperty('display');
    const foot = document.querySelector('footer');    if (foot) foot.style.removeProperty('display');
    UI.switchTab('sales');
  },

  mobTab(tab) {
    this._mobTab = tab;
    const prodPanel = document.getElementById('sm-products-panel');
    const cartPanel = document.getElementById('sm-cart-panel');
    const tabProd   = document.getElementById('sm-tab-products');
    const tabCart   = document.getElementById('sm-tab-cart');
    if (tab === 'products') {
      if (prodPanel) prodPanel.classList.remove('mob-hidden');
      if (cartPanel) cartPanel.classList.remove('mob-active');
      if (tabProd)   tabProd.classList.add('active');
      if (tabCart)   tabCart.classList.remove('active');
    } else {
      if (prodPanel) prodPanel.classList.add('mob-hidden');
      if (cartPanel) cartPanel.classList.add('mob-active');
      if (tabProd)   tabProd.classList.remove('active');
      if (tabCart)   tabCart.classList.add('active');
    }
  },

  renderProducts() {
    const grid  = document.getElementById('sm-products-grid');
    if (!grid) return;
    const items = DB.data.items;
    if (!items.length) {
      grid.innerHTML = `<div style="text-align:center;color:var(--text3);padding:40px;grid-column:1/-1;font-family:var(--fm);font-size:.82rem">${I18n.t('no_stock')}</div>`;
      return;
    }
    grid.innerHTML = items.map(i => {
      const outOfStock = i.qty <= 0;
      const inCart     = this._cart.find(c => c.itemId === i.id);
      const cartQty    = inCart ? inCart.qty : 0;
      return `
        <div class="sm-prod-card${outOfStock ? ' out-of-stock' : ''}"
          onclick="SellerMode.addToCart('${Utils.esc(i.id)}')">
          <div class="sm-prod-icon">📦</div>
          <div class="sm-prod-name">${Utils.esc(i.name)}</div>
          <div class="sm-prod-price">${Utils.currency(i.sell)}</div>
          <div class="sm-prod-stock" style="color:${i.qty<=3?'var(--danger)':'var(--text3)'}">
            ${outOfStock ? '❌ '+I18n.t('lbl_out_of_stock') : I18n.t('lbl_stock_short')+' : ' + i.qty + (cartQty ? ' ('+cartQty+' '+I18n.t('sm_in_cart')+')' : '')}
          </div>
        </div>`;
    }).join('');
  },

  addToCart(itemId) {
    const item = DB.data.items.find(i => i.id === itemId);
    if (!item || item.qty <= 0) return UI.toast(I18n.t('toast_err_stock_low'),'danger');
    const ex = this._cart.find(c => c.itemId === itemId);
    if (ex) {
      if (ex.qty >= item.qty) return UI.toast(I18n.t('toast_err_stock_max'),'warning');
      ex.qty++;
    } else {
      this._cart.push({ itemId, itemName: item.name, qty: 1, price: item.sell, buy: item.buy });
    }
    this.renderCart();
    this.renderProducts();
    // Sur mobile : basculer vers panier après ajout + feedback visuel
    const isMobile = window.innerWidth <= 680;
    if (isMobile) {
      // Badge sur onglet panier
      const badge = document.getElementById('sm-tab-cart-badge');
      if (badge) {
        const total = this._cart.reduce((t,c) => t+c.qty, 0);
        badge.textContent = total;
        badge.classList.add('show');
      }
    }
  },

  changeQty(itemId, delta) {
    const ex   = this._cart.find(c => c.itemId === itemId);
    const item = DB.data.items.find(i => i.id === itemId);
    if (!ex) return;
    ex.qty += delta;
    if (ex.qty <= 0) {
      this._cart = this._cart.filter(c => c.itemId !== itemId);
    } else if (item && ex.qty > item.qty) {
      ex.qty = item.qty;
      UI.toast(I18n.t('toast_err_stock_max'),'warning');
    }
    this.renderCart();
    this.renderProducts();
  },

  removeFromCart(itemId) {
    this._cart = this._cart.filter(c => c.itemId !== itemId);
    this.renderCart();
    this.renderProducts();
  },

  onPaidInput() {
    const total    = this._cart.reduce((t,c) => t + c.price*c.qty, 0);
    const paidRaw  = document.getElementById('sm-paid')?.value;
    const infoEl   = document.getElementById('sm-change-info');
    if (!infoEl) return;
    if (paidRaw !== '' && paidRaw != null) {
      const paid   = parseFloat(paidRaw);
      const change = paid - total;
      if (!isNaN(paid) && paid >= 0) {
        infoEl.style.display = '';
        if (change >= 0) {
          infoEl.textContent    = I18n.t('lbl_change_due') + ' : ' + Utils.currency(change);
          infoEl.style.background = 'rgba(0,232,122,.12)';
          infoEl.style.color      = 'var(--accent)';
        } else {
          infoEl.textContent    = I18n.t('sm_remaining_due') + ' : ' + Utils.currency(Math.abs(change));
          infoEl.style.background = 'rgba(255,59,92,.12)';
          infoEl.style.color      = 'var(--danger)';
        }
      } else { infoEl.style.display = 'none'; }
    } else { infoEl.style.display = 'none'; }
  },

  renderCart() {
    const cartEl  = document.getElementById('sm-cart');
    const totalEl = document.getElementById('sm-total');
    const hdrTot  = document.getElementById('sm-total-header');
    const btnEl   = document.getElementById('sm-validate-btn');
    const cntEl   = document.getElementById('sm-cart-count');
    const badge   = document.getElementById('sm-tab-cart-badge');
    const total   = this._cart.reduce((t,c) => t + c.price*c.qty, 0);
    const items   = this._cart.reduce((t,c) => t + c.qty, 0);

    // Totaux
    if (totalEl) totalEl.textContent = Utils.currency(total);
    if (hdrTot)  { hdrTot.textContent = Utils.currency(total); hdrTot.style.display = total>0 ? '' : 'none'; }
    if (btnEl)   btnEl.disabled = this._cart.length === 0;

    // Badge
    if (cntEl)  { cntEl.textContent = items; cntEl.style.display = items>0?'':'none'; }
    if (badge)  { badge.textContent = items; badge.classList.toggle('show', items>0); }

    // Contenu panier
    if (!cartEl) return;
    if (!this._cart.length) {
      cartEl.innerHTML = `<div style="text-align:center;color:var(--text3);font-family:var(--fm);font-size:.8rem;padding:24px 12px;line-height:1.6">${I18n.t('sm_cart_empty')}<br><span style="font-size:.7rem">${I18n.t('sm_tap_to_add')}</span></div>`;
      return;
    }
    cartEl.innerHTML = this._cart.map(it => `
      <div class="sm-cart-item">
        <div class="sm-cart-item-info">
          <div class="sm-cart-item-name">${Utils.esc(it.itemName)}</div>
          <div class="sm-qty-ctrl">
            <button class="sm-qty-btn" onclick="SellerMode.changeQty('${Utils.esc(it.itemId)}',-1)">−</button>
            <span class="sm-qty-val">${it.qty}</span>
            <button class="sm-qty-btn" onclick="SellerMode.changeQty('${Utils.esc(it.itemId)}',1)">+</button>
            <span class="sm-cart-item-sub" style="margin-left:4px">× ${Utils.currency(it.price)}</span>
          </div>
        </div>
        <div class="sm-cart-item-price">${Utils.currency(it.price*it.qty)}</div>
        <button class="sm-cart-item-del" onclick="SellerMode.removeFromCart('${Utils.esc(it.itemId)}')">✕</button>
      </div>`).join('');

    this.onPaidInput();
  },

  async validate() {
    if (!this._cart.length) return;
    const client  = document.getElementById('sm-client')?.value.trim() || '';
    const paidRaw = document.getElementById('sm-paid')?.value;
    const total   = this._cart.reduce((t,c) => t + c.price*c.qty, 0);
    const paid    = (paidRaw === '' || paidRaw == null) ? total : parseFloat(paidRaw);
    const change  = isNaN(paid) ? 0 : Math.max(0, paid - total);

    for (const it of this._cart) {
      const dbIt = DB.data.items.find(i => i.id === it.itemId);
      if (!dbIt || dbIt.qty < it.qty) { UI.toast(`${I18n.t('toast_err_stock_low')} : ${it.itemName}`, 'danger'); return; }
      const itTotal = it.price * it.qty;
      const itPaid  = isNaN(paid) ? itTotal : Math.min(itTotal, paid);
      DB.data.sales.push({
        id: Utils.uid(), date: new Date().toISOString(),
        itemId: it.itemId, itemName: it.itemName, qty: it.qty,
        price: it.price, total: itTotal,
        debt: Math.max(0, itTotal - (isNaN(paid) ? itTotal : paid)),
        profit: (it.price - it.buy) * it.qty,
        userId: Auth.currentUser?.id || '', userName: Auth.currentUser?.name || '',
        clientName: client, deleted: false
      });
      dbIt.qty -= it.qty;
      if (client && typeof Loyalty !== 'undefined') Loyalty.addPoints(client, itTotal);
    }

    DB.save();
    this._cart = [];
    const cel = document.getElementById('sm-client'); if (cel) cel.value = '';
    const pel = document.getElementById('sm-paid');   if (pel) pel.value = '';
    this.renderCart();
    this.renderProducts();

    // Flash succès
    const suc = document.getElementById('sm-success');
    const sa  = document.getElementById('sm-success-amount');
    const sc  = document.getElementById('sm-success-change');
    if (suc) {
      if (sa) sa.textContent = Utils.currency(total);
      if (sc) sc.textContent = change > 0 ? I18n.t('lbl_change_due') + ' : ' + Utils.currency(change) : '';
      suc.style.display = 'flex';
      setTimeout(() => {
        suc.style.display = 'none';
        this.mobTab('products');
        Dashboard.refresh();
      }, 2000);
    }
  }
};

/* ═══════════════ RECOVERY MANAGER ═══════════════ */
/* ═══════════════ HYBRID AUTH ═══════════════ */
