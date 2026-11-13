'use strict';
const SellerDash = {
  show() {
    const user = Auth.currentUser;
    if (!user) return;
    const ov = document.getElementById('seller-dash-overlay');
    if (!ov) return;

    // Masquer l'interface principale
    ['top-nav', 'bot-nav', 'mob-header'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    });
    const cont = document.querySelector('.container'); if (cont) cont.style.display = 'none';
    const foot = document.querySelector('footer'); if (foot) foot.style.display = 'none';
    ov.style.display = 'block';
    this.refresh();
  },

  hide() {
    const ov = document.getElementById('seller-dash-overlay');
    if (ov) ov.style.display = 'none';
    ['top-nav', 'bot-nav', 'mob-header'].forEach(id => {
      const el = document.getElementById(id); if (el) el.style.removeProperty('display');
    });
    const cont = document.querySelector('.container'); if (cont) cont.style.removeProperty('display');
    const foot = document.querySelector('footer'); if (foot) foot.style.removeProperty('display');
  },

  refresh() {
    const user  = Auth.currentUser;
    if (!user) return;
    const today = new Date().toDateString();
    const now   = new Date();
    const mk    = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');

    // KPIs
    const todaySales = DB.activeSales().filter(s =>
      s.userId === user.id && new Date(s.date).toDateString() === today
    );
    const monthSales = DB.activeSales().filter(s =>
      s.userId === user.id && s.date.startsWith(mk)
    );
    const ca    = todaySales.reduce((t, s) => t + s.total, 0);
    const mCA   = monthSales.reduce((t, s) => t + s.total, 0);
    const rates = Commissions.getRates();
    const rate  = rates[user.id] || 0;
    const comm  = mCA * rate / 100;

    const se = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const locale = I18n._lang === 'en' ? 'en-US' : 'fr-FR';
    se('sd-shop-name',  Settings.data.shopName || 'Smart Market Pro');
    se('sd-seller-name', user.name);
    se('sd-date', now.toLocaleDateString(locale, {weekday:'long', day:'numeric', month:'long'}));
    se('sd-count',    todaySales.length);
    se('sd-ca',       I18n.t('sd_ca_prefix') + Utils.currency(ca));
    if (Commissions.isEnabled()) {
      se('sd-comm',     Utils.currency(comm));
      se('sd-comm-sub', I18n.t('sd_rate_prefix') + rate + '% (' + (Commissions.getBase()==='profit'?I18n.t('sd_base_profit'):I18n.t('sd_base_ca')) + ') — ' + I18n.t('sd_month_prefix') + Utils.currency(mCA));
    } else {
      se('sd-comm',     '—');
      se('sd-comm-sub', I18n.t('sd_commissions_off'));
    }

    // Dernières ventes
    const recent = document.getElementById('sd-recent');
    if (recent) {
      const last5 = todaySales.slice(-5).reverse();
      if (!last5.length) {
        recent.innerHTML = `<div style="text-align:center;color:var(--text3);font-family:var(--fm);font-size:.8rem;padding:16px">${I18n.t('sd_no_sales_today')}</div>`;
      } else {
        recent.innerHTML = last5.map(s => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--sur2);border-radius:var(--rmd)">
            <div>
              <div style="font-weight:700;font-size:.85rem">${Utils.esc(s.itemName)}</div>
              <div style="font-family:var(--fm);font-size:.65rem;color:var(--text3)">${new Date(s.date).toLocaleTimeString(locale,{hour:'2-digit',minute:'2-digit'})} — ${s.qty} ${I18n.t('sd_units')}</div>
            </div>
            <div style="font-family:var(--fd);font-size:.95rem;font-weight:800;color:var(--accent)">${Utils.currency(s.total)}</div>
          </div>`).join('');
      }
    }
  },

  goSales() {
    this.hide();
    UI.switchTab('sales');
  },

  goStock() {
    this.hide();
    UI.switchTab('stock');
  },

  goDebts() {
    this.hide();
    UI.switchTab('debts');
  },

  openPrefs() {
    const ov = document.getElementById('seller-prefs-overlay');
    if (!ov) return;
    // Remplir les couleurs accent
    const colGrid = document.getElementById('seller-accent-colors');
    const colors = ['#00e87a','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#10b981'];
    if (colGrid) {
      colGrid.innerHTML = colors.map(col => `
        <button onclick="SellerDash.setAccent('${col}')"
          style="width:36px;height:36px;border-radius:50%;background:${col};border:3px solid ${col===Settings.data.accentColor?'#fff':'transparent'};cursor:pointer;transition:var(--tr)">
        </button>`).join('');
    }
    // Taille police
    const fsEl = document.getElementById('seller-font-size');
    if (fsEl) fsEl.textContent = (Settings.data.fontSize || 16) + 'px';
    // Langue active
    const lang = Settings.data.lang || 'fr';
    document.getElementById('seller-lang-fr')?.classList.toggle('active', lang === 'fr');
    document.getElementById('seller-lang-en')?.classList.toggle('active', lang === 'en');
    ov.style.display = 'flex';
  },

  closePrefs() {
    const ov = document.getElementById('seller-prefs-overlay');
    if (ov) ov.style.display = 'none';
  },

  setLang(lang) {
    Settings.data.lang = lang;
    Settings.save();
    I18n._lang = lang;
    I18n.apply();
    this.openPrefs(); // Rafraîchir
    UI.toast(lang==='fr' ? 'Langue : Français' : 'Language: English','success');
  },

  setAccent(color) {
    Settings.data.accentColor = color;
    Settings.save();
    Settings.apply();
    this.openPrefs(); // Rafraîchir
  },

  setFontSize(delta) {
    const current = Settings.data.fontSize || 16;
    const next = Math.min(22, Math.max(12, current + delta));
    Settings.data.fontSize = next;
    Settings.save();
    Settings.apply();
    const fsEl = document.getElementById('seller-font-size');
    if (fsEl) fsEl.textContent = next + 'px';
  }
};

/* ═══════════════ EOD SUMMARY (Résumé fin de journée) ═══════════════ */
