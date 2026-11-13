'use strict';
const Commissions = {
  KEY: 'SMP_COMM_V76',

  getRates() {
    try {
      // Migration depuis ancienne clé
      const old = localStorage.getItem('SMP_COMM_V73');
      if (old && !localStorage.getItem(this.KEY)) {
        localStorage.setItem(this.KEY, old);
      }
      return JSON.parse(localStorage.getItem(this.KEY) || '{}');
    } catch(_) { return {}; }
  },

  isEnabled() {
    return Settings.data.commissionsEnabled === true;
  },

  getBase() {
    return Settings.data.commissionsBase || 'profit';
  },

  /* Calcule la commission d'un vendeur sur une période */
  calcCommission(userId, sales) {
    const rates  = this.getRates();
    const rate   = rates[userId] || 0;
    const base   = this.getBase();
    let baseAmt  = 0;
    if (base === 'profit') {
      // % du bénéfice brut (prix vente - prix achat) généré par le vendeur
      baseAmt = sales.reduce((t, s) => t + (s.profit || 0), 0);
    } else {
      // % du CA
      baseAmt = sales.reduce((t, s) => t + s.total, 0);
    }
    return { rate, baseAmt, commission: baseAmt * rate / 100, base };
  },

  saveRates() {
    const rates = {};
    DB.data.users.forEach(u => {
      const el = document.getElementById('rate-' + u.id);
      if (el) rates[u.id] = Utils.num(el.value) || 0;
    });
    localStorage.setItem(this.KEY, JSON.stringify(rates));
    this.render();
    UI.toast(I18n.t('toast_rates_saved'),'success');
  },

  markPaid(userId, month) {
    if (!DB.data.commissionsPaid) DB.data.commissionsPaid = {};
    DB.data.commissionsPaid[userId + '_' + month] = true;
    DB.save();
    this.render();
    UI.toast(I18n.t('toast_commission_paid'),'success');
  },

  render() {
    const enabled = this.isEnabled();
    const base    = this.getBase();
    const rates   = this.getRates();
    const n       = new Date();
    const mk      = n.getFullYear() + '-' + String(n.getMonth() + 1).padStart(2, '0');
    const ms      = DB.salesInPeriod('month');
    const paid    = DB.data.commissionsPaid || {};
    const baseLabel = base === 'profit' ? I18n.t('comm_base_profit') : I18n.t('th_ca');

    // Bannière si désactivé
    const cfg = document.getElementById('commissions-config');
    if (cfg) {
      if (!enabled) {
        cfg.innerHTML = `
          <div style="background:rgba(255,186,0,.08);border:1px solid var(--warning);border-radius:var(--rmd);padding:14px;margin-bottom:12px;font-family:var(--fm);font-size:.75rem;color:var(--text2);line-height:1.6">
            ⚠️ ${I18n.t('comm_disabled_1')}<br>
            ${I18n.t('comm_disabled_2')}
          </div>`;
      } else {
        cfg.innerHTML = `
          <div style="background:rgba(0,232,122,.06);border:1px solid var(--accent);border-radius:var(--rmd);padding:10px 12px;margin-bottom:12px;font-family:var(--fm);font-size:.72rem;color:var(--text2)">
            ${I18n.t('comm_calc_base')} : <strong>${baseLabel}</strong> &nbsp;|&nbsp; ${I18n.t('comm_configure_rates')}
          </div>` +
          DB.data.users.filter(u => u.role !== 'admin').map(u => `
          <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--sur2);border-radius:var(--rmd);margin-bottom:8px">
            <div style="width:36px;height:36px;border-radius:50%;background:var(--info);display:flex;align-items:center;justify-content:center;font-weight:800;color:#000;flex-shrink:0">
              ${u.name.charAt(0).toUpperCase()}
            </div>
            <div style="flex:1">
              <div class="fw-700" style="font-size:.85rem">${Utils.esc(u.name)}</div>
              <div style="font-family:var(--fm);font-size:.62rem;color:var(--text3)">${I18n.t('role_seller')}</div>
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <input type="number" id="rate-${u.id}" value="${rates[u.id] || 0}"
                min="0" max="100" step="0.5" style="width:70px;text-align:center;padding:8px"
                inputmode="decimal">
              <span style="font-family:var(--fm);font-size:.8rem;color:var(--text3)">%</span>
            </div>
          </div>`).join('');
      }
    }

    const tbody = document.querySelector('#tableCommissions tbody');
    if (!tbody) return;

    const sellers = DB.data.users.filter(u => u.role !== 'admin');
    if (!sellers.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:32px">${I18n.t('comm_no_seller')}</td></tr>`;
      return;
    }

    if (!enabled) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--text3);padding:32px">${I18n.t('comm_disabled_short')}</td></tr>`;
      return;
    }

    tbody.innerHTML = sellers.map(u => {
      const us = ms.filter(s => s.userId === u.id);
      const { rate, baseAmt, commission, base: b } = this.calcCommission(u.id, us);
      const ca     = us.reduce((t, s) => t + s.total, 0);
      const isPaid = paid[u.id + '_' + mk] || false;
      return `<tr>
        <td class="fw-700">${Utils.esc(u.name)}</td>
        <td class="td-mono">${Utils.currency(ca)}</td>
        <td class="td-mono" style="font-size:.72rem;color:var(--text3)">${Utils.currency(baseAmt)}<br><span style="font-size:.6rem">${baseLabel}</span></td>
        <td class="td-mono">${rate}%</td>
        <td class="td-mono" style="color:var(--accent);font-weight:700">${Utils.currency(commission)}</td>
        <td><span class="badge ${isPaid ? 'badge-green' : 'badge-yellow'}">${isPaid ? '✅ '+I18n.t('lbl_paid_check2') : '⏳ '+I18n.t('lbl_pending')}</span></td>
        <td>${!isPaid && commission > 0
          ? `<button class="btn btn-primary btn-sm" onclick="Commissions.markPaid('${Utils.esc(u.id)}','${mk}')">Marquer payé</button>`
          : '—'}</td>
      </tr>`;
    }).join('');
  }
};

/* ═══════════════ SELLER MODE ═══════════════ */
